/**
 * Recordatorio de pago por WhatsApp: a quién le toca, envío, registro y webhook.
 *
 * Fábrica con dependencias inyectadas (repositorios, mensajero, reloj) para poder
 * probarla sin DynamoDB ni red. El cableado real está en recordatorioPago.js.
 *
 * Fuente de verdad del vencimiento: gym_clientes.vencimiento (yyyy-mm-dd).
 * El interruptor (gym_settings.mensajeria.activo) se lee antes de cada envío.
 */
import {
  ESTADO, ESTADOS_EXITOSOS, diasParaVencer, esIdRecordatorioPago, estadoLocal, estadosPrevios,
  etapaDeHoy, etapaManual, evaluarCliente, hoyMx, idempotencyKey, motivoDeMensaje, nombreEtapa,
  normalizarFecha, pagoDelPeriodo, parametrosPlantilla, tieneTelefono, tipoPlantilla,
} from './recordatorioPago.logic.js';

/** Error de negocio con status HTTP sugerido (el controlador lo convierte en HttpError). */
export class ErrorRecordatorio extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Ventana que muestra la pantalla: vencidos hace hasta 15 días y por vencer en 7. */
export const VENTANA_LISTADO = { vencidosDias: 15, porVencerDias: 7 };

const nombreCompleto = (c) => [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || 'Cliente';

export function crearServicioRecordatorioPago({ config, mensajero, repo, clientes, pagos, settings, logger, now = () => new Date() }) {
  let corriendo = false;
  let ultimaCorrida = null;

  async function envioEncendido() {
    const m = await settings.getMensajeria();
    return m?.activo === true;
  }

  async function pagoReciente(clienteId, vencimiento) {
    const lista = await pagos.listPagos({ clienteId, limit: 10 });
    return pagoDelPeriodo(lista, vencimiento);
  }

  /**
   * Envía (o reintenta) el recordatorio de una etapa. Nunca lanza por respuestas del
   * mensajero; sí puede lanzar si falla DynamoDB.
   * @param plan { vencimiento, etapa, dias }
   * @param modo 'auto' | 'manual'
   */
  async function enviar(cliente, plan, { modo, usuario } = {}) {
    const id = idempotencyKey(cliente.clienteId, plan.vencimiento, plan.etapa);
    const existente = await repo.getRecordatorio(id);
    if (existente && ESTADOS_EXITOSOS.includes(existente.estado)) {
      return { resultado: 'ya_enviado', estado: existente.estado, recordatorio: existente };
    }
    // La tarea automática no insiste con fallas definitivas (número sin WhatsApp, sandbox…);
    // recepción sí puede reintentar a mano, p. ej. después de corregir el teléfono.
    if (modo === 'auto' && existente?.estado === ESTADO.FALLIDO && existente.reintentable === false) {
      return { resultado: 'omitido', estado: existente.estado, motivo: existente.motivoFalla, recordatorio: existente };
    }

    const plantilla = config.plantillas[tipoPlantilla(plan.dias)];
    const reservado = await repo.iniciarEnvioPago(id, {
      clienteId: cliente.clienteId,
      tipo: 'WhatsApp',
      origen: 'pago',
      etapa: plan.etapa,
      dias: plan.dias,
      vencimiento: plan.vencimiento,
      monto: Number(cliente.monto),
      plantilla,
      modo,
      enviadoPor: usuario || 'automático',
    }, ESTADOS_EXITOSOS);
    if (!reservado) {
      const actual = await repo.getRecordatorio(id);
      return { resultado: 'ya_enviado', estado: actual?.estado, recordatorio: actual };
    }

    const r = await mensajero.enviarPlantilla({
      to: cliente.telefono,
      ...(config.canal ? { channel: config.canal } : {}),
      template: plantilla,
      language: config.idioma,
      parameters: parametrosPlantilla(cliente, plan.vencimiento),
      ref: `cliente:${cliente.clienteId}`,
      metadata: {
        refLabel: nombreCompleto(cliente),
        recordatorioId: id,
        clienteId: cliente.clienteId,
        etapa: plan.etapa,
        vencimiento: plan.vencimiento,
      },
      idempotencyKey: id,
    });

    const fallo = r.estado === ESTADO.FALLIDO;
    const recordatorio = await repo.registrarResultadoPago(id, {
      estado: r.estado,
      // Lo normal es que siga en 'Enviando'; si un webhook rápido ya lo adelantó, no se retrocede.
      estadosPrevios: [...new Set([ESTADO.ENVIANDO, ...estadosPrevios(r.estado)])],
      mensajeId: r.mensajeId || undefined,
      motivoFalla: fallo ? r.motivo : null,
      reintentable: fallo ? r.reintentable : undefined,
      resultado: r.resultado,
      enviadoAt: fallo ? undefined : now().toISOString(),
    });

    return { ...r, recordatorio };
  }

  /** Corrida diaria. Devuelve un resumen; `omitida` explica por qué no hizo nada. */
  async function correrDia() {
    if (!config.envioDisponible) return { omitida: 'sin_configurar' };
    if (corriendo) return { omitida: 'en_curso' };
    corriendo = true;
    const hoy = hoyMx(now());
    const resumen = { hoy, candidatos: 0, enviados: 0, yaEnviados: 0, sinTelefono: 0, pagados: 0, omitidos: 0, fallidos: 0, detenida: null };
    try {
      if (!(await envioEncendido())) return { omitida: 'apagado', hoy };
      const lista = await clientes.listClientes({ all: true });
      for (const cliente of lista) {
        const plan = evaluarCliente(cliente, hoy, config.etapas);
        if (!plan) continue;
        resumen.candidatos += 1;
        if (plan.omitir) { if (!tieneTelefono(cliente.telefono)) resumen.sinTelefono += 1; else resumen.omitidos += 1; continue; }
        if (await pagoReciente(cliente.clienteId, plan.vencimiento)) { resumen.pagados += 1; continue; }
        // El interruptor se relee antes de cada envío: apagarlo detiene la corrida en curso.
        if (!(await envioEncendido())) { resumen.detenida = 'apagado'; break; }

        const r = await enviar(cliente, plan, { modo: 'auto' });
        if (r.resultado === 'ya_enviado') resumen.yaEnviados += 1;
        else if (r.resultado === 'omitido') resumen.omitidos += 1;
        else if (r.estado === ESTADO.FALLIDO) {
          resumen.fallidos += 1;
          logger.warn('Recordatorio de pago no enviado', { clienteId: cliente.clienteId, etapa: plan.etapa, resultado: r.resultado, motivo: r.motivo });
        } else resumen.enviados += 1;

        if (r.detener) { resumen.detenida = r.resultado; break; }
      }
      return resumen;
    } finally {
      corriendo = false;
      ultimaCorrida = { at: now().toISOString(), ...resumen };
    }
  }

  /** Envío manual desde la pantalla de Recordatorios (recepción / admin). */
  async function enviarManual(clienteId, usuario) {
    if (!config.envioDisponible) {
      throw new ErrorRecordatorio(422, 'MENSAJERO_NO_CONFIGURADO', 'El envío por WhatsApp no está configurado en el servidor. Avisa al administrador.');
    }
    if (!(await envioEncendido())) {
      throw new ErrorRecordatorio(409, 'ENVIO_APAGADO', 'El envío de mensajes por WhatsApp está apagado. Un administrador puede encenderlo en Backoffice → Mensajería.');
    }
    const cliente = await clientes.getCliente(clienteId);
    if (!cliente) throw new ErrorRecordatorio(404, 'NOT_FOUND', 'Cliente no encontrado');
    const vencimiento = normalizarFecha(cliente.vencimiento);
    if (!vencimiento) throw new ErrorRecordatorio(422, 'SIN_VENCIMIENTO', 'El cliente no tiene fecha de vencimiento registrada');
    if (!tieneTelefono(cliente.telefono)) throw new ErrorRecordatorio(422, 'SIN_TELEFONO', 'El cliente no tiene un teléfono registrado');
    if (!(Number(cliente.monto) > 0)) throw new ErrorRecordatorio(422, 'SIN_MONTO', 'El cliente no tiene monto de mensualidad registrado');

    const hoy = hoyMx(now());
    const offset = etapaDeHoy(vencimiento, hoy, config.etapas);
    // Si hoy es día de etapa se usa esa misma llave (así la tarea automática no lo repite);
    // si no, una etapa "manual" del día (máximo un manual por día y vencimiento).
    const plan = { vencimiento, etapa: offset !== null ? nombreEtapa(offset) : etapaManual(hoy), dias: diasParaVencer(vencimiento, hoy) };

    const r = await enviar(cliente, plan, { modo: 'manual', usuario });
    if (r.resultado === 'ya_enviado') {
      throw new ErrorRecordatorio(409, 'YA_ENVIADO', 'Ya se le envió este recordatorio hoy', { recordatorio: r.recordatorio });
    }
    if (r.estado === ESTADO.FALLIDO) {
      const status = r.resultado === 'limite_diario' ? 429 : 422;
      const code = r.resultado === 'limite_diario' ? 'LIMITE_DIARIO' : 'ENVIO_FALLIDO';
      throw new ErrorRecordatorio(status, code, r.motivo || 'No se pudo enviar el mensaje', { recordatorio: r.recordatorio });
    }
    return { ok: true, resultado: r.resultado, estado: r.estado, recordatorio: r.recordatorio };
  }

  /** Datos de la pantalla de Recordatorios y del Backoffice → Mensajería. */
  async function listado() {
    const hoy = hoyMx(now());
    const [lista, registros, mensajeria] = await Promise.all([
      clientes.listClientes({ all: true }),
      repo.listRecordatoriosPago(),
      settings.getMensajeria(),
    ]);

    const porVencimiento = new Map();
    for (const r of registros) {
      const k = `${r.clienteId}|${r.vencimiento}`;
      if (!porVencimiento.has(k)) porVencimiento.set(k, []);
      porVencimiento.get(k).push(r);
    }

    const items = [];
    for (const c of lista) {
      const vencimiento = normalizarFecha(c.vencimiento);
      if (!vencimiento) continue;
      const dias = diasParaVencer(vencimiento, hoy);
      if (dias < -VENTANA_LISTADO.vencidosDias || dias > VENTANA_LISTADO.porVencerDias) continue;
      const plan = evaluarCliente(c, hoy, config.etapas);
      const envios = (porVencimiento.get(`${c.clienteId}|${vencimiento}`) || [])
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
        .map((r) => ({
          recordatorioId: r.recordatorioId, etapa: r.etapa, estado: r.estado, motivoFalla: r.motivoFalla || null,
          modo: r.modo || null, enviadoPor: r.enviadoPor || null, enviadoAt: r.enviadoAt || null, updatedAt: r.updatedAt || r.createdAt || null,
        }));
      items.push({
        clienteId: c.clienteId,
        nombre: nombreCompleto(c),
        email: c.email || null,
        telefono: c.telefono || null,
        tieneTelefono: tieneTelefono(c.telefono),
        plan: c.plan || null,
        monto: Number(c.monto) || 0,
        vencimiento,
        dias,
        etapaHoy: plan?.etapa || null,
        motivoOmitir: plan?.omitir || null,
        envios,
      });
    }

    // Pago registrado dentro del periodo (registrar un pago no mueve el vencimiento).
    for (let i = 0; i < items.length; i += 10) {
      await Promise.all(items.slice(i, i + 10).map(async (it) => {
        const p = await pagoReciente(it.clienteId, it.vencimiento);
        it.pagoReciente = p ? { fecha: p.fecha, monto: p.monto } : null;
      }));
    }

    for (const it of items) {
      const yaHoy = it.etapaHoy && it.envios.some((e) => e.etapa === it.etapaHoy && ESTADOS_EXITOSOS.includes(e.estado));
      it.tocaHoy = Boolean(it.etapaHoy && !it.motivoOmitir && !it.pagoReciente && !yaHoy);
    }
    items.sort((a, b) => a.dias - b.dias);

    return {
      hoy,
      config: {
        envioDisponible: config.envioDisponible,
        webhookDisponible: config.webhookDisponible,
        activo: mensajeria.activo === true,
        actualizadoPor: mensajeria.actualizadoPor,
        actualizadoAt: mensajeria.actualizadoAt,
        hora: `${String(config.hora.h).padStart(2, '0')}:${String(config.hora.m).padStart(2, '0')}`,
        etapas: config.etapas,
        avisos: config.avisos,
      },
      ultimaCorrida,
      resumen: {
        tocanHoy: items.filter((it) => it.tocaHoy).length,
        etapaHoySinTelefono: items.filter((it) => it.etapaHoy && !it.tieneTelefono).length,
        etapaHoyPagados: items.filter((it) => it.etapaHoy && it.pagoReciente).length,
      },
      items,
    };
  }

  /** Webhook `message.status` del mensajero (ya con firma verificada). Idempotente. */
  async function procesarWebhook(evento) {
    if (evento?.event !== 'message.status') return { ignorado: 'evento' };
    const data = evento.data || {};
    const id = data.metadata?.recordatorioId || data.idempotencyKey;
    if (!esIdRecordatorioPago(id) || typeof data.id !== 'string') return { ignorado: 'ajeno' };
    const estado = estadoLocal(data.status);
    if (!estado || estado === ESTADO.ENVIANDO) return { ignorado: 'estado' };
    const cambiado = await repo.avanzarEstadoPago(id, {
      mensajeId: data.id,
      estado,
      estadosPrevios: estadosPrevios(estado),
      motivoFalla: estado === ESTADO.FALLIDO ? (motivoDeMensaje(data) || 'WhatsApp no pudo entregar el mensaje') : undefined,
    });
    return { actualizado: cambiado, estado };
  }

  return {
    correrDia, enviarManual, listado, procesarWebhook, enviar,
    get corriendo() { return corriendo; },
    get ultimaCorrida() { return ultimaCorrida; },
  };
}
