import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioPagos, ErrorPago } from '../src/services/pagos.service.js';
import { crearServicioPagoRecibido } from '../src/services/pagoRecibido.service.js';
import { crearServicioRespuestas } from '../src/services/respuestas.service.js';
import { parseMercadoPagoConfig } from '../src/config/mercadoPago.js';
import { parseMensajeroConfig } from '../src/config/mensajero.js';
import { interpretarRespuesta } from '../src/services/recordatorioPago.logic.js';
import { crearTokenLiga } from '../src/services/ligaPago.logic.js';

const SECRETO_LIGA = 'secreto-de-prueba-de-ligas-de-pago-0123';
const MP_CONFIG = parseMercadoPagoConfig({
  MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-prueba', MERCADOPAGO_WEBHOOK_SECRET: 'whsec',
  PUBLIC_API_URL: 'https://api.iron-core.mx', PUBLIC_FRONTEND_URL: 'https://iron-core.mx',
});
const MSG_CONFIG = parseMensajeroConfig({ MENSAJERO_URL: 'https://msg.test', MENSAJERO_API_KEY: 'k', MENSAJERO_CANAL: 'default' });

const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;
// "Hoy" = 2026-11-24 en México
const AHORA = new Date('2026-11-24T18:00:00Z');
const tick = () => new Promise((r) => setImmediate(r));
const clon = (x) => (x == null ? x : structuredClone(x));

/** gym_pagos + gym_clientes en memoria con las mismas condiciones que pagos.repo.js / clientes.repo.js. */
function bdEnMemoria(clientesIniciales) {
  const pagos = new Map();
  const clientes = new Map(clientesIniciales.map((c) => [c.clienteId, clon(c)]));
  const escrituras = { cliente: 0 };
  const repo = {
    pagos,
    async getPago(k) { await tick(); return clon(pagos.get(k)) || null; },
    async listPagos({ clienteId, limit = 20 }) {
      await tick();
      return [...pagos.values()].filter((p) => !clienteId || p.clienteId === clienteId)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, limit).map(clon);
    },
    async guardarPago({ pagoId, nuevo, esperado, set = {}, quitar = [], cliente }) {
      await tick();
      if (nuevo) {
        if (pagos.has(pagoId)) return { ok: false, conflicto: 'pago' };
      } else {
        const p = pagos.get(pagoId);
        const mpOk = esperado.mpPaymentId == null ? p?.mpPaymentId == null : p?.mpPaymentId === esperado.mpPaymentId;
        if (!p || p.estado !== esperado.estado || !mpOk || (esperado.sinRenovacion && p.renovacion)) return { ok: false, conflicto: 'pago' };
      }
      if (cliente) {
        const c = clientes.get(cliente.clienteId);
        const vOk = cliente.vencimientoPrevio == null ? c?.vencimiento == null : c?.vencimiento === cliente.vencimientoPrevio;
        if (!c || !vOk) return { ok: false, conflicto: 'cliente' };
      }
      // Atómico: todo o nada
      if (nuevo) pagos.set(pagoId, clon(nuevo));
      else {
        const p = pagos.get(pagoId);
        for (const [k, v] of Object.entries(set)) if (v !== undefined) p[k] = clon(v);
        for (const k of quitar) delete p[k];
      }
      if (cliente) { Object.assign(clientes.get(cliente.clienteId), cliente.set); escrituras.cliente += 1; }
      return { ok: true };
    },
    async marcarRevision(k, motivo, extra = {}) { Object.assign(pagos.get(k), { requiereRevision: true, revisionMotivo: motivo }, extra); },
  };
  const clientesRepo = {
    clientes,
    async getCliente(k) { await tick(); return clon(clientes.get(k)) || null; },
    async listClientes() { return [...clientes.values()].map(clon); },
    async guardarRespuestasWhatsapp(k, lista, v) {
      await tick();
      const c = clientes.get(k);
      if (!c || (c.respuestasVersion ?? null) !== v) return false;
      c.respuestasWhatsapp = clon(lista); c.respuestasVersion = (v || 0) + 1; return true;
    },
  };
  return { repo, clientesRepo, escrituras };
}

/** gym_recordatorios en memoria (mismas condiciones que recordatorios.repo.js). */
function recordatoriosEnMemoria() {
  const db = new Map();
  return {
    db,
    async iniciarEnvioPago(k, datos, exitosos) {
      const cur = db.get(k);
      if (cur && exitosos.includes(cur.estado)) return null;
      db.set(k, { ...(cur || { recordatorioId: k }), ...datos, estado: 'Enviando' });
      return { ...db.get(k) };
    },
    async registrarResultadoPago(k, { estado, estadosPrevios, ...campos }) {
      const cur = db.get(k);
      if (estadosPrevios.includes(cur.estado)) cur.estado = estado;
      for (const [c, v] of Object.entries(campos)) if (v !== undefined && v !== null) cur[c] = v;
      return { ...cur };
    },
    async avanzarEstadoPago(k, { mensajeId, estado, estadosPrevios }) {
      const cur = db.get(k);
      if (!cur || (cur.mensajeId && cur.mensajeId !== mensajeId) || !estadosPrevios.includes(cur.estado)) return false;
      Object.assign(cur, { estado, mensajeId });
      return true;
    },
  };
}

const CLIENTES = () => [
  { clienteId: id(1), nombre: 'CARLOS PÉREZ', apellido: 'López', email: 'carlos@x.mx', telefono: '55 1111 1111', plan: 'Mensual', tipoMensualidad: 'Mensual', monto: 850, vencimiento: '2026-11-27', estado: 'Por vencer', inscripcion: { padecimientos: 'asma' } },
  { clienteId: id(2), nombre: 'Beto', telefono: '55 2222 2222', plan: 'Trimestre', monto: 1450, vencimiento: '2026-10-01', estado: 'Vencido' },
  { clienteId: id(3), nombre: 'Caro', telefono: '', plan: 'Mensual', monto: 500, vencimiento: '2027-06-01', estado: 'Activo' },
  { clienteId: id(4), nombre: 'Dani', telefono: '55 4444 4444', plan: 'Mensual', monto: 0, vencimiento: '2026-11-20' },
];

function armar({ activo = true, mensajeroFalla = null, mpConfig = MP_CONFIG, mpPagos = {}, clientes = CLIENTES() } = {}) {
  const { repo, clientesRepo, escrituras } = bdEnMemoria(clientes);
  const recordatorios = recordatoriosEnMemoria();
  const enviados = [];
  const interruptor = { activo };
  const logger = { warn() {}, info() {}, error() {}, debug() {} };
  const aviso = crearServicioPagoRecibido({
    config: MSG_CONFIG,
    mensajero: {
      async enviarPlantilla(payload) {
        enviados.push(payload);
        if (mensajeroFalla === 'lanza') throw new Error('mensajero caído');
        if (mensajeroFalla) return interpretarRespuesta(...mensajeroFalla);
        return interpretarRespuesta(201, { message: { id: `m-${enviados.length}`, status: 'sent' } });
      },
    },
    repo: recordatorios,
    settings: { getMensajeria: async () => ({ activo: interruptor.activo }) },
    logger,
    now: () => AHORA,
  });
  const respuestas = crearServicioRespuestas({ clientes: clientesRepo, logger, now: () => AHORA });
  const preferencias = [];
  const mp = {
    async crearPreferencia(pref, llave) { preferencias.push({ pref, llave }); return { ok: true, status: 201, body: { id: `pref-${preferencias.length}`, init_point: `https://mp.test/checkout/${preferencias.length}` } }; },
    async obtenerPago(pid) { await tick(); return mpPagos[pid] ? { ok: true, status: 200, body: clon(mpPagos[pid]) } : { ok: false, status: 404, body: { message: 'not found' } }; },
  };
  let n = 0;
  const servicio = crearServicioPagos({
    mpConfig, mp, repo, clientes: clientesRepo, aviso, respuestas, logger, ligaSecret: SECRETO_LIGA,
    now: () => AHORA, generarId: () => `TXN-${String(++n).padStart(10, '0')}`,
  });
  return { servicio, repo, clientesRepo, recordatorios, enviados, interruptor, preferencias, mpPagos, escrituras };
}

const pagoMp = (over = {}) => ({
  id: 555, status: 'approved', status_detail: 'accredited', transaction_amount: 850, currency_id: 'MXN',
  external_reference: 'TXN-0000000001', payment_type_id: 'credit_card', payment_method_id: 'visa',
  date_approved: '2026-11-24T17:00:00.000-06:00', live_mode: false, ...over,
});

// ── Mostrador ────────────────────────────────────────────────────────────────

test('mostrador: registra Exitoso, renueva desde el vencimiento vigente y manda el WhatsApp', async () => {
  const { servicio, repo, clientesRepo, enviados, recordatorios } = armar();
  const r = await servicio.registrarEnMostrador({ clienteId: id(1), metodo: 'efectivo', usuario: 'recep@x' });
  assert.equal(r.pago.estado, 'Exitoso');
  assert.equal(r.pago.monto, 850);
  assert.equal(r.pago.origen, 'recepcion');
  assert.equal(r.renovacion.vencimientoNuevo, '2026-12-27');
  assert.equal(clientesRepo.clientes.get(id(1)).vencimiento, '2026-12-27');
  assert.equal(clientesRepo.clientes.get(id(1)).estado, 'Activo');
  assert.equal(repo.pagos.get(r.pago.pagoId).renovacion.vencimientoAnterior, '2026-11-27');

  await servicio.avisosPendientes();
  assert.equal(enviados.length, 1);
  const m = enviados[0];
  assert.equal(m.template, 'ironcore_pago_recibido');
  assert.equal(m.idempotencyKey, `pagorecibido:${r.pago.pagoId}`);
  assert.deepEqual(m.parameters.body, { nombre: 'Carlos', monto: '$850', folio: r.pago.pagoId, fecha: 'domingo 27 de diciembre' });
  assert.equal(m.ref, `cliente:${id(1)}`);
  assert.equal(recordatorios.db.get(m.idempotencyKey).estado, 'Enviado');
  assert.equal(recordatorios.db.get(m.idempotencyKey).origen, 'pago_recibido');
});

test('mostrador: vencido renueva desde hoy; sin monto exige capturarlo; cliente inexistente', async () => {
  const { servicio, clientesRepo } = armar();
  const r = await servicio.registrarEnMostrador({ clienteId: id(2), metodo: 'transferencia', referencia: 'SPEI 123' });
  assert.equal(r.renovacion.desde, 'pago');
  assert.equal(clientesRepo.clientes.get(id(2)).vencimiento, '2027-02-24');
  await assert.rejects(servicio.registrarEnMostrador({ clienteId: id(4), metodo: 'efectivo' }), (e) => e instanceof ErrorPago && e.code === 'SIN_MONTO');
  const conMonto = await servicio.registrarEnMostrador({ clienteId: id(4), metodo: 'efectivo', monto: 400 });
  assert.equal(conMonto.pago.monto, 400);
  await assert.rejects(servicio.registrarEnMostrador({ clienteId: id(9), metodo: 'efectivo' }), (e) => e.status === 404);
});

test('mostrador: dos cobros simultáneos del mismo cliente acumulan dos periodos (sin perder ninguno)', async () => {
  const { servicio, clientesRepo, repo } = armar();
  await Promise.all([
    servicio.registrarEnMostrador({ clienteId: id(1), metodo: 'efectivo' }),
    servicio.registrarEnMostrador({ clienteId: id(1), metodo: 'tarjeta' }),
  ]);
  assert.equal(repo.pagos.size, 2);
  assert.equal(clientesRepo.clientes.get(id(1)).vencimiento, '2027-01-27');
});

// ── WhatsApp de pago recibido ────────────────────────────────────────────────

test('pago recibido: interruptor apagado → el pago se procesa igual y no se manda nada', async () => {
  const { servicio, enviados, recordatorios, clientesRepo } = armar({ activo: false });
  await servicio.registrarEnMostrador({ clienteId: id(1), metodo: 'efectivo' });
  await servicio.avisosPendientes();
  assert.equal(enviados.length, 0);
  assert.equal(recordatorios.db.size, 0);
  assert.equal(clientesRepo.clientes.get(id(1)).vencimiento, '2026-12-27');
});

test('pago recibido: si el mensajero falla (lanza, 502, CLIENT_DISABLED) el pago queda intacto', async () => {
  for (const falla of ['lanza', [502, { error: { code: 'SEND_FAILED', retryable: true } }], [403, { error: { code: 'CLIENT_DISABLED' } }]]) {
    const { servicio, repo, clientesRepo, recordatorios } = armar({ mensajeroFalla: falla });
    const r = await servicio.registrarEnMostrador({ clienteId: id(1), metodo: 'efectivo' });
    await servicio.avisosPendientes();
    assert.equal(repo.pagos.get(r.pago.pagoId).estado, 'Exitoso');
    assert.equal(clientesRepo.clientes.get(id(1)).vencimiento, '2026-12-27');
    if (falla === 'lanza') continue;
    const reg = recordatorios.db.get(`pagorecibido:${r.pago.pagoId}`);
    assert.equal(reg.estado, 'Fallido');
    if (falla[0] === 403) {
      assert.match(reg.motivoFalla, /no activado por SofIA/);
      assert.equal(reg.reintentable, true);
    }
  }
});

test('pago recibido: sin teléfono no se intenta; y el webhook del mensajero actualiza su estado', async () => {
  const sinTel = armar();
  await sinTel.servicio.registrarEnMostrador({ clienteId: id(3), metodo: 'efectivo' });
  await sinTel.servicio.avisosPendientes();
  assert.equal(sinTel.enviados.length, 0);

  const { servicio, recordatorios } = armar();
  const r = await servicio.registrarEnMostrador({ clienteId: id(1), metodo: 'efectivo' });
  await servicio.avisosPendientes();
  const k = `pagorecibido:${r.pago.pagoId}`;
  const aviso = crearServicioPagoRecibido({ config: MSG_CONFIG, mensajero: {}, repo: recordatorios, settings: {}, logger: {} });
  const mid = recordatorios.db.get(k).mensajeId;
  assert.equal((await aviso.procesarWebhook({ event: 'message.status', data: { id: mid, status: 'delivered', metadata: { recordatorioId: k } } })).actualizado, true);
  assert.equal(recordatorios.db.get(k).estado, 'Entregado');
  assert.equal((await aviso.procesarWebhook({ event: 'message.status', data: { id: 'x', status: 'read', metadata: { recordatorioId: 'pago:otro' } } })).ignorado, 'ajeno');
});

// ── Checkout (portal) ────────────────────────────────────────────────────────

test('checkout: monto y concepto del backend, Pendiente ligado a la preferencia, reuso ante doble clic', async () => {
  const { servicio, repo, preferencias } = armar();
  const r = await servicio.iniciarCheckout(id(1));
  assert.equal(r.url, 'https://mp.test/checkout/1');
  const pago = repo.pagos.get(r.pagoId);
  assert.equal(pago.estado, 'Pendiente');
  assert.equal(pago.monto, 850);
  assert.equal(pago.preferenciaId, 'pref-1');
  const { pref } = preferencias[0];
  assert.equal(pref.external_reference, r.pagoId);
  assert.equal(pref.items[0].unit_price, 850);
  assert.equal(pref.items[0].currency_id, 'MXN');
  assert.equal(pref.notification_url, 'https://api.iron-core.mx/api/v1/webhooks/mercadopago?source_news=webhooks');
  assert.equal(pref.back_urls.success, `https://iron-core.mx/mi/pago/resultado?pago=${r.pagoId}`);
  assert.equal(pref.auto_return, 'approved');
  const otra = await servicio.iniciarCheckout(id(1));
  assert.equal(otra.pagoId, r.pagoId);
  assert.equal(preferencias.length, 1);
});

test('checkout: sin Mercado Pago configurado o sin monto responde error claro', async () => {
  const sin = armar({ mpConfig: parseMercadoPagoConfig({}) });
  await assert.rejects(sin.servicio.iniciarCheckout(id(1)), (e) => e.status === 503 && e.code === 'PAGO_EN_LINEA_NO_CONFIGURADO');
  const resumen = await sin.servicio.resumenCliente(id(1));
  assert.equal(resumen.checkoutDisponible, false);
  assert.equal(resumen.puedePagar, false);
  const { servicio } = armar();
  await assert.rejects(servicio.iniciarCheckout(id(4)), (e) => e.code === 'SIN_MONTO');
});

test('portal: un cliente no ve el pago de otro (404 igual que inexistente)', async () => {
  const { servicio } = armar();
  const r = await servicio.iniciarCheckout(id(1));
  assert.equal((await servicio.estadoParaCliente(id(1), r.pagoId)).estado, 'Pendiente');
  await assert.rejects(servicio.estadoParaCliente(id(2), r.pagoId), (e) => e.status === 404);
  await assert.rejects(servicio.estadoParaCliente(id(1), 'TXN-FFFFFFFFFF'), (e) => e.status === 404);
});

// ── Aviso de Mercado Pago ────────────────────────────────────────────────────

async function conCheckout(opciones) {
  const ctx = armar(opciones);
  const r = await ctx.servicio.iniciarCheckout(id(1));
  return { ...ctx, pagoId: r.pagoId };
}

test('MP aprobado: Exitoso, renueva una sola vez aunque el aviso llegue repetido', async () => {
  const ctx = await conCheckout();
  ctx.mpPagos['555'] = pagoMp({ external_reference: ctx.pagoId });
  const r1 = await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '555' });
  assert.equal(r1.estado, 'Exitoso');
  const r2 = await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '555' });
  assert.equal(r2.ignorado, 'sin_cambio');
  const pago = ctx.repo.pagos.get(ctx.pagoId);
  assert.equal(pago.estado, 'Exitoso');
  assert.equal(pago.mpPaymentId, '555');
  assert.equal(pago.mpTipo, 'credit_card');
  assert.equal(ctx.clientesRepo.clientes.get(id(1)).vencimiento, '2026-12-27');
  assert.equal(ctx.escrituras.cliente, 1);
  await ctx.servicio.avisosPendientes();
  assert.equal(ctx.enviados.length, 1);
});

test('MP aprobado: avisos concurrentes del mismo pago renuevan una sola vez', async () => {
  const ctx = await conCheckout();
  ctx.mpPagos['555'] = pagoMp({ external_reference: ctx.pagoId });
  const rs = await Promise.all(Array.from({ length: 5 }, () => ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '555' })));
  assert.equal(rs.filter((r) => r.estado === 'Exitoso').length, 1);
  assert.equal(ctx.escrituras.cliente, 1);
  assert.equal(ctx.clientesRepo.clientes.get(id(1)).vencimiento, '2026-12-27');
  await ctx.servicio.avisosPendientes();
  assert.equal(ctx.enviados.length, 1);
});

test('MP OXXO: pendiente y después aprobado; renueva desde el día en que se acreditó', async () => {
  const ctx = await conCheckout({ clientes: CLIENTES().map((c) => (c.clienteId === id(1) ? { ...c, vencimiento: '2026-11-01' } : c)) });
  ctx.mpPagos['600'] = pagoMp({ id: 600, status: 'pending', status_detail: 'pending_waiting_payment', payment_type_id: 'ticket', payment_method_id: 'oxxo', date_approved: null, external_reference: ctx.pagoId });
  const r1 = await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '600' });
  assert.equal(r1.accion, 'ligar');
  assert.equal(ctx.repo.pagos.get(ctx.pagoId).estado, 'Pendiente');
  assert.equal((await ctx.servicio.estadoParaCliente(id(1), ctx.pagoId)).esperandoEfectivo, true);
  assert.equal(ctx.clientesRepo.clientes.get(id(1)).vencimiento, '2026-11-01');

  ctx.mpPagos['600'] = { ...ctx.mpPagos['600'], status: 'approved', status_detail: 'accredited', date_approved: '2026-11-23T10:00:00.000-06:00' };
  await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '600' });
  assert.equal(ctx.repo.pagos.get(ctx.pagoId).estado, 'Exitoso');
  assert.equal(ctx.clientesRepo.clientes.get(id(1)).vencimiento, '2026-12-23');
});

test('MP: rechazado y luego reintento aprobado con otro pago; cancelado tardío no retrocede', async () => {
  const ctx = await conCheckout();
  ctx.mpPagos['700'] = pagoMp({ id: 700, status: 'rejected', status_detail: 'cc_rejected_insufficient_amount', external_reference: ctx.pagoId });
  await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '700' });
  assert.equal(ctx.repo.pagos.get(ctx.pagoId).estado, 'Rechazado');
  assert.equal(ctx.escrituras.cliente, 0);

  ctx.mpPagos['701'] = pagoMp({ id: 701, external_reference: ctx.pagoId });
  await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '701' });
  const pago = ctx.repo.pagos.get(ctx.pagoId);
  assert.equal(pago.estado, 'Exitoso');
  assert.equal(pago.mpPaymentId, '701');

  ctx.mpPagos['700'] = { ...ctx.mpPagos['700'], status: 'cancelled' };
  assert.equal((await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '700' })).ignorado, 'otro_pago_de_mp');
  assert.equal(ctx.repo.pagos.get(ctx.pagoId).estado, 'Exitoso');
});

test('MP: segundo pago aprobado de la misma preferencia se registra aparte y también renueva', async () => {
  const ctx = await conCheckout();
  ctx.mpPagos['801'] = pagoMp({ id: 801, external_reference: ctx.pagoId });
  ctx.mpPagos['802'] = pagoMp({ id: 802, external_reference: ctx.pagoId });
  await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '801' });
  const r = await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '802' });
  assert.equal(r.accion, 'duplicado');
  assert.equal(ctx.repo.pagos.get('MP-802').estado, 'Exitoso');
  assert.equal(ctx.repo.pagos.get('MP-802').duplicadoDe, ctx.pagoId);
  assert.equal(ctx.clientesRepo.clientes.get(id(1)).vencimiento, '2027-01-27');
  // Repetido del duplicado: nada nuevo
  assert.equal((await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '802' })).ignorado, 'sin_cambio');
  assert.equal(ctx.escrituras.cliente, 2);
});

test('MP: monto, moneda o referencia que no cuadran → no se marca Exitoso y queda en revisión', async () => {
  for (const [over, patron] of [[{ transaction_amount: 1 }, /Monto/], [{ currency_id: 'USD' }, /Moneda/]]) {
    const ctx = await conCheckout();
    ctx.mpPagos['900'] = pagoMp({ id: 900, external_reference: ctx.pagoId, ...over });
    const r = await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '900' });
    assert.match(r.revision, patron);
    const pago = ctx.repo.pagos.get(ctx.pagoId);
    assert.equal(pago.estado, 'Pendiente');
    assert.equal(pago.requiereRevision, true);
    assert.equal(ctx.escrituras.cliente, 0);
  }
  const ctx = await conCheckout();
  ctx.mpPagos['901'] = pagoMp({ id: 901, external_reference: 'otra-cosa' });
  assert.equal((await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '901' })).ignorado, 'referencia_ajena');
  ctx.mpPagos['902'] = pagoMp({ id: 902, external_reference: 'TXN-ABCDEF0000' });
  assert.equal((await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '902' })).ignorado, 'sin_pago_local');
  // Un folio de mostrador no se toca desde Mercado Pago
  const m = await ctx.servicio.registrarEnMostrador({ clienteId: id(2), metodo: 'efectivo' });
  ctx.mpPagos['903'] = pagoMp({ id: 903, external_reference: m.pago.pagoId, transaction_amount: 1450 });
  assert.equal((await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '903' })).ignorado, 'sin_pago_local');
  assert.equal(ctx.escrituras.cliente, 1);
});

test('MP: id inexistente (simulación del panel), otro tópico o id raro se ignoran; MP caído pide reintento', async () => {
  const ctx = await conCheckout();
  assert.equal((await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '123' })).ignorado, 'pago_inexistente_en_mp');
  assert.equal((await ctx.servicio.procesarNotificacion({ tipo: 'merchant_order', dataId: '1' })).ignorado, 'tipo');
  assert.equal((await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '1;DROP' })).ignorado, 'id');
  const caido = crearServicioPagos({
    mpConfig: MP_CONFIG, mp: { obtenerPago: async () => ({ ok: false, status: 500 }) }, repo: {}, clientes: {}, aviso: {}, logger: {},
  });
  await assert.rejects(caido.procesarNotificacion({ tipo: 'payment', dataId: '1' }), (e) => e.code === 'MERCADOPAGO_NO_DISPONIBLE');
});

test('MP: reembolso revierte la renovación si nada más movió el vencimiento; si no, revisión', async () => {
  const ctx = await conCheckout();
  ctx.mpPagos['555'] = pagoMp({ external_reference: ctx.pagoId });
  await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '555' });
  assert.equal(ctx.clientesRepo.clientes.get(id(1)).vencimiento, '2026-12-27');
  ctx.mpPagos['555'] = { ...ctx.mpPagos['555'], status: 'refunded', status_detail: 'refunded' };
  await ctx.servicio.procesarNotificacion({ tipo: 'payment', dataId: '555' });
  const pago = ctx.repo.pagos.get(ctx.pagoId);
  assert.equal(pago.estado, 'Reembolsado');
  assert.equal(pago.renovacion.revertida, true);
  assert.equal(ctx.clientesRepo.clientes.get(id(1)).vencimiento, '2026-11-27');

  const otro = await conCheckout();
  otro.mpPagos['555'] = pagoMp({ external_reference: otro.pagoId });
  await otro.servicio.procesarNotificacion({ tipo: 'payment', dataId: '555' });
  await otro.servicio.registrarEnMostrador({ clienteId: id(1), metodo: 'efectivo' }); // movió el vencimiento
  otro.mpPagos['555'] = { ...otro.mpPagos['555'], status: 'charged_back' };
  await otro.servicio.procesarNotificacion({ tipo: 'payment', dataId: '555' });
  const p2 = otro.repo.pagos.get(otro.pagoId);
  assert.equal(p2.estado, 'Contracargo');
  assert.equal(p2.requiereRevision, true);
  assert.equal(otro.clientesRepo.clientes.get(id(1)).vencimiento, '2027-01-27');
});

// ── Liga pública ─────────────────────────────────────────────────────────────

const liga = (cid, expira = '2027-02-10') => crearTokenLiga(cid, expira, SECRETO_LIGA);

test('liga pública: solo datos mínimos (sin teléfono, correo, apellidos ni salud)', async () => {
  const { servicio } = armar();
  const d = await servicio.datosLiga(liga(id(1)));
  assert.deepEqual(Object.keys(d).sort(), ['monto', 'motivo', 'nombre', 'periodo', 'plan', 'puedePagar', 'vencimientoActual', 'vencimientoTrasPagar']);
  assert.equal(d.nombre, 'Carlos');
  assert.equal(d.monto, 850);
  assert.equal(d.vencimientoTrasPagar, '2026-12-27');
  assert.equal(d.puedePagar, true);
  const texto = JSON.stringify(d);
  for (const prohibido of ['López', 'PÉREZ', 'carlos@x.mx', '1111', 'asma', id(1)]) assert.equal(texto.includes(prohibido), false, prohibido);
});

test('liga pública: token inválido, alterado o de cliente borrado → mismo error genérico', async () => {
  const { servicio } = armar();
  const t = liga(id(1));
  const errores = [];
  for (const malo of [t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'), 'x'.repeat(47), liga(id(9)), liga(id(1), '2026-11-01')]) {
    await assert.rejects(servicio.datosLiga(malo), (e) => { errores.push(`${e.status}|${e.code}|${e.message}`); return true; });
  }
  assert.equal(new Set(errores).size, 1);
  assert.match(errores[0], /^404\|LIGA_INVALIDA\|/);
});

test('liga pública: ya vigente lejos del vencimiento, o MP sin configurar, lo dice en vez de fallar', async () => {
  const { servicio, preferencias } = armar();
  const d = await servicio.datosLiga(liga(id(3)));
  assert.equal(d.puedePagar, false);
  assert.match(d.motivo, /ya está pagada y vigente hasta el/);
  await assert.rejects(servicio.checkoutLiga(liga(id(3))), (e) => e.status === 409);
  assert.equal(preferencias.length, 0);

  const sin = armar({ mpConfig: parseMercadoPagoConfig({}) });
  const d2 = await sin.servicio.datosLiga(liga(id(1)));
  assert.equal(d2.puedePagar, false);
  assert.match(d2.motivo, /recepción/);
});

test('liga pública: checkout con regreso a la página pública y resultado solo de ese cliente', async () => {
  const { servicio, preferencias, mpPagos } = armar();
  const t = liga(id(1));
  const r = await servicio.checkoutLiga(t);
  assert.equal(preferencias[0].pref.back_urls.success, `https://iron-core.mx/pagar/${t}/resultado?pago=${r.pagoId}`);
  assert.equal(preferencias[0].pref.items[0].unit_price, 850);
  mpPagos['555'] = pagoMp({ external_reference: r.pagoId });
  await servicio.procesarNotificacion({ tipo: 'payment', dataId: '555' });
  const e = await servicio.estadoLiga(t, r.pagoId);
  assert.deepEqual(Object.keys(e).sort(), ['esperandoEfectivo', 'estado', 'medio', 'monto', 'pagoId', 'sinCompletar', 'vencimientoNuevo']);
  assert.equal(e.estado, 'Exitoso');
  assert.equal(e.vencimientoNuevo, '2026-12-27');
  // La liga de otro cliente no ve ese pago
  await assert.rejects(servicio.estadoLiga(liga(id(2)), r.pagoId), (x) => x.status === 404);
  // El portal (canal distinto) no reusa el checkout de la liga
  const portal = await servicio.iniciarCheckout(id(2));
  assert.notEqual(portal.pagoId, r.pagoId);
});

// ── Respuestas: "ya pagué" no renueva; un pago real las atiende ─────────────

test('respuesta "ya pagué" no cambia nada; el pago real la da por atendida', async () => {
  const { servicio, clientesRepo, escrituras } = armar();
  const respuestas = crearServicioRespuestas({ clientes: clientesRepo, logger: { info() {} }, now: () => AHORA });
  await respuestas.procesarWebhook({ event: 'message.received', data: { id: 'in-1', direction: 'in', text: 'ya pagué', ref: `cliente:${id(1)}`, profileName: 'Carlos', createdAt: '2026-11-24T16:00:00.000Z', metadata: { recordatorioId: `pago:${id(1)}:2026-11-27:d-3` } } });
  const c = clientesRepo.clientes.get(id(1));
  assert.equal(c.vencimiento, '2026-11-27');
  assert.equal(c.estado, 'Por vencer');
  assert.equal(escrituras.cliente, 0);
  assert.equal((await respuestas.listarPendientes()).length, 1);

  await servicio.registrarEnMostrador({ clienteId: id(1), metodo: 'efectivo' });
  await servicio.avisosPendientes();
  const r = clientesRepo.clientes.get(id(1)).respuestasWhatsapp[0];
  assert.equal(r.atendida, true);
  assert.match(r.atendidaMotivo, /^Pago TXN-/);
  assert.equal((await respuestas.listarPendientes()).length, 0);
});
