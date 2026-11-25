/**
 * Pagos de membresía: registro en mostrador, checkout de Mercado Pago, aviso (webhook) de
 * Mercado Pago, renovación de la membresía y mensaje de "pago recibido".
 *
 * Fábrica con dependencias inyectadas (repositorios, cliente de MP, aviso, reloj) para poder
 * probarla sin DynamoDB ni red. El cableado real está en pagos.js.
 *
 * Reglas:
 *  - Todo pago que pasa a Exitoso renueva la membresía UNA sola vez: el cambio de estado del
 *    pago y el nuevo vencimiento del cliente se escriben en la misma transacción, condicionada
 *    a que el pago siga como se leyó (sin renovación previa) y a que el vencimiento del cliente
 *    no haya cambiado (bloqueo optimista). Ante conflicto se relee y se decide de nuevo.
 *  - El monto y el concepto del checkout salen del cliente autenticado, nunca del navegador.
 *  - El estado de un pago en línea solo lo cambia el aviso de Mercado Pago, y solo después de
 *    consultar el pago con nuestro token y comprobar referencia, moneda y monto.
 *  - El mensaje de WhatsApp va después y aparte: si falla, el pago queda igual.
 */
import { diasParaVencer, fechaLegible, hoyMx, normalizarFecha, primerNombre } from './recordatorioPago.logic.js';
import { verificarTokenLiga } from './ligaPago.logic.js';
import { calcularRenovacion, estadoMembresia, etiquetaPeriodo, mesesDelPeriodo } from './membresia.logic.js';
import {
  ESTADO_PAGO, MONEDA, camposMercadoPago, decidirAccion, esPagoId, generarPagoId, medioLegible,
  motivoDiscrepancia, pagoIdDerivado,
} from './pagos.logic.js';

export class ErrorPago extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const MAX_INTENTOS = 5;
const REUSO_CHECKOUT_MS = 30 * 60_000;
const VIGENCIA_CHECKOUT_MS = 72 * 3_600_000;
/** Con la liga pública solo se puede pagar si faltan a lo más estos días para el vencimiento. */
export const DIAS_ANTES_PAGO_LIGA = 15;

const nombreCompleto = (c) => [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || 'Cliente';

/** Fecha con zona fija de México (UTC-6, sin horario de verano desde 2022) para MP. */
function isoMx(fecha) {
  return new Date(fecha.getTime() - 6 * 3_600_000).toISOString().replace('Z', '-06:00');
}

/** Lo que el cliente (o recepción) ve de un pago. Sin datos internos de la pasarela. */
export function pagoPublico(p) {
  const sinCompletar = p.estado === ESTADO_PAGO.PENDIENTE && p.origen === 'mercadopago' && !p.mpPaymentId;
  return {
    pagoId: p.pagoId,
    fecha: p.fecha || p.createdAt || null,
    monto: Number(p.monto) || 0,
    moneda: p.moneda || MONEDA,
    estado: p.estado || ESTADO_PAGO.EXITOSO,
    sinCompletar,
    origen: p.origen || 'recepcion',
    medio: medioLegible(p),
    concepto: p.concepto || null,
    aprobadoAt: p.aprobadoAt || null,
    vencimientoNuevo: p.renovacion && !p.renovacion.revertida ? p.renovacion.vencimientoNuevo : null,
    esperandoEfectivo: p.estado === ESTADO_PAGO.PENDIENTE && ['ticket', 'atm', 'bank_transfer'].includes(p.mpTipo),
  };
}

export function crearServicioPagos({
  mpConfig, mp, repo, clientes, aviso, respuestas = null, logger, ligaSecret = '',
  now = () => new Date(), generarId = generarPagoId,
}) {
  const pendientes = new Set();
  // Configuración de Mercado Pago: se pide en CADA operación a la función proveedora (hoy env,
  // después settings cifrados). Se acepta un objeto fijo solo por compatibilidad/pruebas.
  const leerConfig = typeof mpConfig === 'function' ? mpConfig : async () => mpConfig;

  /** Mensaje + respuestas atendidas, en segundo plano. Nunca afecta al pago. */
  function despuesDeExitoso(pago, cliente, vencimiento) {
    const p = (async () => {
      try { await aviso.notificar({ pago, cliente, vencimiento }); } catch (err) {
        logger.error('Aviso de pago recibido falló', { pagoId: pago.pagoId, err: err?.message });
      }
      if (respuestas) {
        try { await respuestas.atenderPorPago(cliente.clienteId, pago.pagoId); } catch (err) {
          logger.warn('No se pudieron dar por atendidas las respuestas del cliente', { clienteId: cliente.clienteId, err: err?.message });
        }
      }
    })();
    pendientes.add(p);
    p.finally(() => pendientes.delete(p));
  }

  async function clienteOError(clienteId) {
    const c = await clientes.getCliente(clienteId);
    if (!c) throw new ErrorPago(404, 'CLIENTE_NOT_FOUND', 'Cliente no encontrado');
    return c;
  }

  const concepto = (cliente, meses) => `Membresía IronCore Gym${cliente.plan ? ` ${cliente.plan}` : ''} (${etiquetaPeriodo(meses)})`;

  /** Cómo quedaría la membresía si paga hoy. */
  function vistaPrevia(cliente) {
    const hoy = hoyMx(now());
    const ren = calcularRenovacion(cliente, hoy);
    return {
      clienteId: cliente.clienteId,
      nombre: nombreCompleto(cliente),
      plan: cliente.plan || null,
      monto: Number(cliente.monto) || 0,
      meses: ren.meses,
      periodo: etiquetaPeriodo(ren.meses),
      vencimientoActual: ren.vencimientoAnterior,
      vencimientoTrasPagar: ren.vencimientoNuevo,
      desde: ren.desde,
      hoy,
    };
  }

  // ── Mostrador ──────────────────────────────────────────────────────────────

  /** Pago cobrado en recepción (efectivo, transferencia o tarjeta en terminal): Exitoso y renueva. */
  async function registrarEnMostrador({ clienteId, monto, metodo, referencia, usuario }) {
    let cliente = await clienteOError(clienteId);
    const total = monto != null ? Number(monto) : Number(cliente.monto);
    if (!(total > 0)) throw new ErrorPago(422, 'SIN_MONTO', 'El cliente no tiene monto de mensualidad registrado; captura el monto cobrado');

    for (let i = 0; i < MAX_INTENTOS; i += 1) {
      if (i > 0) cliente = await clienteOError(clienteId);
      const ahora = now();
      const hoy = hoyMx(ahora);
      const ren = calcularRenovacion(cliente, hoy);
      const item = {
        pagoId: generarId(),
        clienteId,
        monto: total,
        moneda: MONEDA,
        metodo,
        origen: 'recepcion',
        estado: ESTADO_PAGO.EXITOSO,
        fecha: ahora.toISOString(),
        createdAt: ahora.toISOString(),
        aprobadoAt: ahora.toISOString(),
        registradoPor: usuario || null,
        ...(referencia ? { referencia } : {}),
        concepto: concepto(cliente, ren.meses),
        periodoMeses: ren.meses,
        renovacion: { ...ren, aplicadaAt: ahora.toISOString() },
      };
      const r = await repo.guardarPago({
        pagoId: item.pagoId,
        nuevo: item,
        cliente: { clienteId, vencimientoPrevio: cliente.vencimiento ?? null, set: { vencimiento: ren.vencimientoNuevo, estado: ren.estado } },
      });
      if (r.ok) {
        despuesDeExitoso(item, cliente, ren.vencimientoNuevo);
        return { pago: item, renovacion: ren };
      }
      // 'pago': choque de folio (se genera otro). 'cliente': alguien movió el vencimiento (se relee).
    }
    throw new ErrorPago(409, 'CONFLICTO', 'El cliente se modificó al mismo tiempo; intenta de nuevo');
  }

  // ── Portal del cliente ─────────────────────────────────────────────────────

  async function resumenCliente(clienteId) {
    const cliente = await clienteOError(clienteId);
    const [lista, cfg] = await Promise.all([repo.listPagos({ clienteId, limit: 30 }), leerConfig()]);
    const vp = vistaPrevia(cliente);
    return {
      checkoutDisponible: cfg.checkoutDisponible,
      puedePagar: cfg.checkoutDisponible && vp.monto > 0,
      motivo: !cfg.checkoutDisponible
        ? 'El pago en línea no está disponible por ahora. Puedes pagar en recepción.'
        : (vp.monto > 0 ? null : 'Tu mensualidad no tiene monto registrado. Pasa a recepción para actualizarla.'),
      ...vp,
      pagos: lista.map(pagoPublico),
    };
  }

  /**
   * Crea (o reusa) el pago Pendiente y la preferencia de Checkout Pro. Lo comparten el portal
   * (canal 'portal', regreso a /mi/pago/resultado) y la liga pública (canal 'liga', regreso a
   * /pagar/<token>/resultado).
   */
  async function iniciarCheckout(clienteId, { canal = 'portal', token = null, cliente: precargado = null } = {}) {
    const mpConfig = await leerConfig();
    if (!mpConfig.checkoutDisponible) {
      throw new ErrorPago(503, 'PAGO_EN_LINEA_NO_CONFIGURADO', 'El pago en línea no está disponible por ahora. Puedes pagar en recepción.');
    }
    const cliente = precargado || await clienteOError(clienteId);
    const monto = Number(cliente.monto);
    if (!(monto > 0)) throw new ErrorPago(422, 'SIN_MONTO', 'Tu mensualidad no tiene monto registrado. Pasa a recepción para actualizarla.');

    const ahora = now();
    // Un doble clic o volver atrás no crea otro folio: se reusa el checkout recién creado.
    const recientes = await repo.listPagos({ clienteId, limit: 10 });
    const reuso = recientes.find((p) => p.origen === 'mercadopago' && p.estado === ESTADO_PAGO.PENDIENTE && !p.mpPaymentId
      && p.initPoint && (p.canal || 'portal') === canal && Number(p.monto) === monto && ahora.getTime() - Date.parse(p.createdAt || 0) < REUSO_CHECKOUT_MS);
    if (reuso) return { pagoId: reuso.pagoId, url: reuso.initPoint, reutilizado: true };

    const meses = mesesDelPeriodo(cliente);
    const item = {
      clienteId,
      monto,
      moneda: MONEDA,
      metodo: 'mercadopago',
      origen: 'mercadopago',
      estado: ESTADO_PAGO.PENDIENTE,
      fecha: ahora.toISOString(),
      createdAt: ahora.toISOString(),
      concepto: concepto(cliente, meses),
      periodoMeses: meses,
      canal,
    };
    let creado = null;
    for (let i = 0; i < 3 && !creado; i += 1) {
      const intento = { pagoId: generarId(), ...item };
      const r = await repo.guardarPago({ pagoId: intento.pagoId, nuevo: intento });
      if (r.ok) creado = intento;
    }
    if (!creado) throw new ErrorPago(409, 'CONFLICTO', 'No se pudo generar el folio; intenta de nuevo');

    const regreso = canal === 'liga'
      ? `${mpConfig.frontendUrl}/pagar/${token}/resultado?pago=${encodeURIComponent(creado.pagoId)}`
      : `${mpConfig.retornoUrl}?pago=${encodeURIComponent(creado.pagoId)}`;
    const preferencia = {
      items: [{
        id: `membresia-${meses}m`,
        title: creado.concepto,
        description: `Pago de membresía de ${nombreCompleto(cliente)} (folio ${creado.pagoId})`,
        quantity: 1,
        currency_id: MONEDA,
        unit_price: monto,
      }],
      ...(cliente.email ? { payer: { email: cliente.email } } : {}),
      external_reference: creado.pagoId,
      back_urls: { success: regreso, pending: regreso, failure: regreso },
      auto_return: 'approved',
      notification_url: mpConfig.notificationUrl,
      statement_descriptor: mpConfig.descriptor,
      payment_methods: { installments: 1 },
      expires: true,
      expiration_date_from: isoMx(ahora),
      expiration_date_to: isoMx(new Date(ahora.getTime() + VIGENCIA_CHECKOUT_MS)),
      metadata: { pago_id: creado.pagoId, cliente_id: clienteId },
    };

    const r = await mp.crearPreferencia(preferencia, `preferencia-${creado.pagoId}`);
    const esperado = { estado: ESTADO_PAGO.PENDIENTE, mpPaymentId: null };
    if (!r.ok || !r.body?.id || !r.body?.init_point) {
      logger.error('Mercado Pago no creó la preferencia', { pagoId: creado.pagoId, status: r.status, error: r.error, body: r.body?.message || r.body?.error });
      await repo.guardarPago({ pagoId: creado.pagoId, esperado, set: { estado: ESTADO_PAGO.CANCELADO, revisionMotivo: 'No se pudo abrir el checkout de Mercado Pago' } }).catch(() => {});
      throw new ErrorPago(502, 'MERCADOPAGO_NO_DISPONIBLE', 'No pudimos abrir el pago en línea. Intenta de nuevo en unos minutos o paga en recepción.');
    }
    await repo.guardarPago({ pagoId: creado.pagoId, esperado, set: { preferenciaId: r.body.id, initPoint: r.body.init_point } });
    return { pagoId: creado.pagoId, url: r.body.init_point };
  }

  async function estadoParaCliente(clienteId, pagoId) {
    const pago = esPagoId(pagoId) || /^MP-\d{1,20}$/.test(pagoId) ? await repo.getPago(pagoId) : null;
    // Un pago ajeno responde igual que uno inexistente (sin filtrar que existe).
    if (!pago || pago.clienteId !== clienteId) throw new ErrorPago(404, 'PAGO_NOT_FOUND', 'Pago no encontrado');
    return pagoPublico(pago);
  }

  // ── Liga pública /pagar/<token> (sin sesión) ───────────────────────────────

  const LIGA_INVALIDA = () => new ErrorPago(404, 'LIGA_INVALIDA', 'Esta liga de pago no es válida o ya venció. Pide una nueva o pasa a recepción.');

  /** Cliente de la liga; ante cualquier problema, el mismo error genérico. */
  async function clienteDeLiga(token) {
    const clienteId = verificarTokenLiga(token, ligaSecret, hoyMx(now()));
    if (!clienteId) throw LIGA_INVALIDA();
    const cliente = await clientes.getCliente(clienteId);
    if (!cliente) throw LIGA_INVALIDA();
    return cliente;
  }

  /** ¿Toca pagar por liga? Solo cerca del vencimiento o ya vencido (evita pagar dos veces con una liga vieja). */
  function motivoNoPagarLiga(cliente, vp, cfg) {
    if (!cfg.checkoutDisponible) return 'El pago en línea no está disponible por ahora. Puedes pagar en recepción.';
    if (!(vp.monto > 0)) return 'No tenemos registrado el monto de tu mensualidad. Pasa a recepción para pagar.';
    const venc = normalizarFecha(cliente.vencimiento);
    if (venc && diasParaVencer(venc, vp.hoy) > DIAS_ANTES_PAGO_LIGA) {
      return `Tu membresía ya está pagada y vigente hasta el ${fechaLegible(venc)}. Si tienes dudas, pasa a recepción.`;
    }
    return null;
  }

  /** Lo mínimo para la página pública: sin teléfono, correo, apellidos ni datos de salud. */
  async function datosLiga(token) {
    const cliente = await clienteDeLiga(token);
    const vp = vistaPrevia(cliente);
    const motivo = motivoNoPagarLiga(cliente, vp, await leerConfig());
    return {
      nombre: primerNombre(cliente.nombre) || null,
      plan: cliente.plan || null,
      monto: vp.monto,
      periodo: vp.periodo,
      vencimientoActual: vp.vencimientoActual,
      vencimientoTrasPagar: vp.vencimientoTrasPagar,
      puedePagar: !motivo,
      motivo,
    };
  }

  async function checkoutLiga(token) {
    const cliente = await clienteDeLiga(token);
    const cfg = await leerConfig();
    const motivo = motivoNoPagarLiga(cliente, vistaPrevia(cliente), cfg);
    if (motivo) throw new ErrorPago(cfg.checkoutDisponible ? 409 : 503, 'NO_DISPONIBLE', motivo);
    const r = await iniciarCheckout(cliente.clienteId, { canal: 'liga', token, cliente });
    return { url: r.url, pagoId: r.pagoId };
  }

  /** Resultado del pago hecho con la liga: solo pagos de ese mismo cliente, con datos mínimos. */
  async function estadoLiga(token, pagoId) {
    const cliente = await clienteDeLiga(token);
    const p = await estadoParaCliente(cliente.clienteId, pagoId);
    return {
      pagoId: p.pagoId, estado: p.estado, sinCompletar: p.sinCompletar, monto: p.monto, medio: p.medio,
      vencimientoNuevo: p.vencimientoNuevo, esperandoEfectivo: p.esperandoEfectivo,
    };
  }

  // ── Aviso de Mercado Pago ──────────────────────────────────────────────────

  /** Notificación ya con firma verificada. Lanza si hay que pedirle a MP que reintente. */
  async function procesarNotificacion({ tipo, dataId }) {
    if (tipo !== 'payment') return { ignorado: 'tipo' };
    if (!/^\d{1,20}$/.test(String(dataId || ''))) return { ignorado: 'id' };
    const r = await mp.obtenerPago(dataId);
    // "Simular" del panel de MP manda ids inexistentes: se confirma recepción y se ignora.
    if (r.status === 404) return { ignorado: 'pago_inexistente_en_mp' };
    if (!r.ok || !r.body) {
      throw new ErrorPago(502, 'MERCADOPAGO_NO_DISPONIBLE', `No se pudo consultar el pago en Mercado Pago (${r.status ?? r.error})`);
    }
    return aplicarPagoMp(r.body);
  }

  async function confirmar({ base, mp: pmp, esperado, nuevoId }) {
    const cliente = await clientes.getCliente(base.clienteId);
    const mpCampos = camposMercadoPago(pmp);
    if (!cliente) {
      logger.error('Pago aprobado de un cliente que ya no existe', { pagoId: base.pagoId, mpPaymentId: mpCampos.mpPaymentId });
      await repo.marcarRevision(base.pagoId, 'Pago aprobado en Mercado Pago de un cliente que ya no existe', mpCampos);
      return { ok: true };
    }
    const ahora = now();
    const aprobado = pmp.date_approved && !Number.isNaN(Date.parse(pmp.date_approved)) ? new Date(pmp.date_approved) : ahora;
    // El "día del pago" es el día en que se acreditó (una ficha OXXO puede pagarse días después).
    const ren = calcularRenovacion(cliente, hoyMx(aprobado), hoyMx(ahora));
    const set = {
      ...mpCampos,
      estado: ESTADO_PAGO.EXITOSO,
      aprobadoAt: aprobado.toISOString(),
      renovacion: { ...ren, aplicadaAt: ahora.toISOString() },
    };
    const clienteOp = { clienteId: cliente.clienteId, vencimientoPrevio: cliente.vencimiento ?? null, set: { vencimiento: ren.vencimientoNuevo, estado: ren.estado } };

    let pagoFinal;
    let r;
    if (nuevoId) {
      pagoFinal = {
        pagoId: nuevoId,
        clienteId: cliente.clienteId,
        monto: Number(pmp.transaction_amount),
        moneda: MONEDA,
        metodo: 'mercadopago',
        origen: 'mercadopago',
        fecha: ahora.toISOString(),
        createdAt: ahora.toISOString(),
        concepto: base.concepto,
        periodoMeses: ren.meses,
        duplicadoDe: base.pagoId,
        ...set,
      };
      r = await repo.guardarPago({ pagoId: nuevoId, nuevo: pagoFinal, cliente: clienteOp });
      if (r.ok) logger.warn('Segundo pago aprobado para la misma preferencia: se registró aparte y también renovó', { original: base.pagoId, nuevo: nuevoId });
    } else {
      pagoFinal = { ...base, ...set };
      r = await repo.guardarPago({ pagoId: base.pagoId, esperado: { ...esperado, sinRenovacion: true }, set, cliente: clienteOp });
    }
    if (r.ok) despuesDeExitoso(pagoFinal, cliente, ren.vencimientoNuevo);
    return { ...r, pagoId: pagoFinal.pagoId };
  }

  /**
   * Reembolso o contracargo de un pago que ya había renovado. Si nada movió el vencimiento
   * desde entonces, se regresa al anterior; si no, el pago queda marcado para revisión.
   */
  async function revertir(pago, pmp, nuevo, esperado) {
    const set = { ...camposMercadoPago(pmp), estado: nuevo };
    const ren = pago.renovacion;
    const cliente = await clientes.getCliente(pago.clienteId);
    if (cliente && ren && !ren.revertida && normalizarFecha(cliente.vencimiento) === ren.vencimientoNuevo) {
      const restaurado = ren.vencimientoAnterior || ren.base;
      set.renovacion = { ...ren, revertida: true, revertidaAt: now().toISOString() };
      const r = await repo.guardarPago({
        pagoId: pago.pagoId, esperado, set,
        cliente: { clienteId: cliente.clienteId, vencimientoPrevio: cliente.vencimiento, set: { vencimiento: restaurado, estado: estadoMembresia(restaurado, hoyMx(now())) } },
      });
      if (r.ok) logger.warn(`Pago ${nuevo.toLowerCase()}: se revirtió la renovación`, { pagoId: pago.pagoId, vencimiento: restaurado });
      return r;
    }
    set.requiereRevision = true;
    set.revisionMotivo = `${nuevo}: el vencimiento ya cambió después de este pago; ajústalo a mano si corresponde`;
    logger.warn(`Pago ${nuevo.toLowerCase()} que requiere revisión manual`, { pagoId: pago.pagoId });
    return repo.guardarPago({ pagoId: pago.pagoId, esperado, set });
  }

  /** Aplica el pago de MP (ya consultado con nuestro token) al pago local. Idempotente. */
  async function aplicarPagoMp(pmp) {
    const ref = String(pmp?.external_reference || '');
    if (!esPagoId(ref) || pmp.id == null) return { ignorado: 'referencia_ajena' };
    const derivadoId = pagoIdDerivado(pmp.id);

    for (let i = 0; i < MAX_INTENTOS; i += 1) {
      const pago = (await repo.getPago(derivadoId)) || (await repo.getPago(ref));
      if (!pago || pago.origen !== 'mercadopago') return { ignorado: 'sin_pago_local' };

      const d = decidirAccion(pago, pmp);
      if (d.accion === 'ignorar') return { ignorado: d.motivo, pagoId: pago.pagoId };

      const discrepancia = motivoDiscrepancia(pago, pmp, ref);
      if (discrepancia) {
        logger.error('Pago de Mercado Pago que no cuadra con el folio', { pagoId: pago.pagoId, mpPaymentId: String(pmp.id), motivo: discrepancia });
        if (d.nuevo === ESTADO_PAGO.EXITOSO && !pago.requiereRevision) {
          await repo.marcarRevision(pago.pagoId, discrepancia, { revisionMpPaymentId: String(pmp.id) });
        }
        return { revision: discrepancia, pagoId: pago.pagoId };
      }

      const esperado = { estado: pago.estado, mpPaymentId: pago.mpPaymentId ?? null };
      let r;
      if (d.accion === 'ligar') {
        r = await repo.guardarPago({ pagoId: pago.pagoId, esperado, set: camposMercadoPago(pmp) });
      } else if (d.accion === 'duplicado') {
        r = await confirmar({ base: pago, mp: pmp, nuevoId: derivadoId });
      } else if (d.nuevo === ESTADO_PAGO.EXITOSO) {
        r = await confirmar({ base: pago, mp: pmp, esperado });
      } else if ([ESTADO_PAGO.REEMBOLSADO, ESTADO_PAGO.CONTRACARGO].includes(d.nuevo) && pago.estado === ESTADO_PAGO.EXITOSO) {
        r = await revertir(pago, pmp, d.nuevo, esperado);
      } else {
        r = await repo.guardarPago({ pagoId: pago.pagoId, esperado, set: { ...camposMercadoPago(pmp), estado: d.nuevo } });
      }
      if (r.ok) return { pagoId: r.pagoId || pago.pagoId, accion: d.accion, estado: d.nuevo };
      // Conflicto (otro aviso u otro pago llegó al mismo tiempo): se relee y se decide de nuevo.
    }
    throw new Error('No se pudo aplicar el pago de Mercado Pago tras varios intentos');
  }

  return {
    vistaPrevia, registrarEnMostrador, resumenCliente, iniciarCheckout, estadoParaCliente,
    datosLiga, checkoutLiga, estadoLiga,
    procesarNotificacion, aplicarPagoMp,
    /** Configuración vigente de Mercado Pago (para el webhook y el Backoffice). */
    configuracionMercadoPago: leerConfig,
    /** Espera los avisos en segundo plano (pruebas y apagado ordenado). */
    avisosPendientes: () => Promise.allSettled([...pendientes]),
  };
}
