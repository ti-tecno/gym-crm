import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioRecordatorioPago, ErrorRecordatorio } from '../src/services/recordatorioPago.service.js';
import { parseMensajeroConfig } from '../src/config/mensajero.js';
import { interpretarRespuesta } from '../src/services/recordatorioPago.logic.js';

const config = parseMensajeroConfig({
  MENSAJERO_URL: 'https://msg.test', MENSAJERO_API_KEY: 'k', MENSAJERO_WEBHOOK_SECRET: 's', MENSAJERO_CANAL: 'ironcore',
  RECORDATORIO_PAGO_PLANTILLA_ANTES: 'pago_proximo', RECORDATORIO_PAGO_PLANTILLA_HOY: 'pago_hoy', RECORDATORIO_PAGO_PLANTILLA_DESPUES: 'pago_vencido',
});

const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;
// "Hoy" = 2026-11-24 en México (15:00 UTC = 09:00 CDMX)
const AHORA = new Date('2026-11-24T15:00:00Z');

const CLIENTES = [
  { clienteId: id(1), nombre: 'Ana', apellido: 'López', telefono: '55 1111 1111', monto: 500, vencimiento: '2026-11-27' }, // d-3
  { clienteId: id(2), nombre: 'Beto', telefono: '55 2222 2222', monto: 500, vencimiento: '2026-11-24' },                   // d0
  { clienteId: id(3), nombre: 'Caro', telefono: '55 3333 3333', monto: 500, vencimiento: '2026-11-21T00:00:00.000Z' },     // d+3
  { clienteId: id(4), nombre: 'Dani', telefono: '', monto: 500, vencimiento: '2026-11-24' },                               // sin teléfono
  { clienteId: id(5), nombre: 'Eva', telefono: '55 5555 5555', monto: 500, vencimiento: '2026-11-25' },                    // no toca hoy
  { clienteId: id(6), nombre: 'Fer', telefono: '55 6666 6666', monto: 500, vencimiento: '2026-11-27' },                    // ya pagó
];
const PAGOS = { [id(6)]: [{ fecha: '2026-11-22T17:00:00.000Z', estado: 'Exitoso', monto: 500 }] };

/** Repositorio en memoria que imita las condiciones de recordatorios.repo.js. */
function repoEnMemoria() {
  const db = new Map();
  return {
    db,
    async getRecordatorio(k) { return db.get(k) ? { ...db.get(k) } : null; },
    async listRecordatoriosPago() { return [...db.values()].map((r) => ({ ...r })); },
    async iniciarEnvioPago(k, datos, exitosos) {
      const cur = db.get(k);
      if (cur && exitosos.includes(cur.estado)) return null;
      const next = { ...(cur || { recordatorioId: k, createdAt: 'c' }), ...datos, estado: 'Enviando', intentos: (cur?.intentos || 0) + 1 };
      delete next.motivoFalla;
      db.set(k, next);
      return { ...next };
    },
    async registrarResultadoPago(k, { estado, estadosPrevios, ...campos }) {
      const cur = db.get(k);
      if (estadosPrevios.includes(cur.estado)) {
        cur.estado = estado;
        if (campos.motivoFalla == null) delete cur.motivoFalla;
      }
      for (const [c, v] of Object.entries(campos)) if (v !== undefined && v !== null) cur[c] = v;
      return { ...cur };
    },
    async avanzarEstadoPago(k, { mensajeId, estado, estadosPrevios, motivoFalla }) {
      const cur = db.get(k);
      if (!cur || (cur.mensajeId && cur.mensajeId !== mensajeId) || !estadosPrevios.includes(cur.estado)) return false;
      Object.assign(cur, { estado, mensajeId }, motivoFalla ? { motivoFalla } : {});
      return true;
    },
  };
}

function armar({ activo = true, respuestas = () => [201, { message: { id: `m-${Math.random()}`, status: 'sent' } }] } = {}) {
  const repo = repoEnMemoria();
  const enviados = [];
  const interruptor = { activo };
  const servicio = crearServicioRecordatorioPago({
    config,
    mensajero: {
      async enviarPlantilla(payload) {
        enviados.push(payload);
        const [status, body] = respuestas(payload, enviados.length);
        return interpretarRespuesta(status, body);
      },
    },
    repo,
    clientes: { listClientes: async () => CLIENTES, getCliente: async (cid) => CLIENTES.find((c) => c.clienteId === cid) || null },
    pagos: { listPagos: async ({ clienteId }) => PAGOS[clienteId] || [] },
    settings: { getMensajeria: async () => ({ activo: interruptor.activo }) },
    logger: { warn() {}, info() {}, error() {} },
    now: () => AHORA,
  });
  return { servicio, repo, enviados, interruptor };
}

test('apagado (valor por defecto): la corrida no envía ni registra nada', async () => {
  const { servicio, repo, enviados } = armar({ activo: false });
  const r = await servicio.correrDia();
  assert.equal(r.omitida, 'apagado');
  assert.equal(enviados.length, 0);
  assert.equal(repo.db.size, 0);
});

test('encendido: envía a quien le toca hoy, con llave, ref, metadata y plantilla correctas', async () => {
  const { servicio, repo, enviados } = armar();
  const r = await servicio.correrDia();
  assert.equal(r.enviados, 3);
  assert.equal(r.sinTelefono, 1);
  assert.equal(r.pagados, 1);
  assert.equal(r.candidatos, 5);
  assert.deepEqual(enviados.map((e) => e.to), ['55 1111 1111', '55 2222 2222', '55 3333 3333']);

  const ana = enviados[0];
  assert.equal(ana.idempotencyKey, `pago:${id(1)}:2026-11-27:d-3`);
  assert.equal(ana.template, 'pago_proximo');
  assert.equal(ana.channel, 'ironcore');
  assert.equal(ana.language, 'es_MX');
  assert.equal(ana.ref, `cliente:${id(1)}`);
  assert.equal(ana.metadata.refLabel, 'Ana López');
  assert.equal(ana.metadata.recordatorioId, ana.idempotencyKey);
  assert.deepEqual(Object.keys(ana.parameters.body).sort(), ['fecha', 'monto', 'nombre']);
  assert.equal(enviados[1].template, 'pago_hoy');
  assert.equal(enviados[2].template, 'pago_vencido');
  assert.equal(enviados[2].idempotencyKey, `pago:${id(3)}:2026-11-21:d+3`);

  const reg = repo.db.get(ana.idempotencyKey);
  assert.equal(reg.estado, 'Enviado');
  assert.equal(reg.etapa, 'd-3');
  assert.equal(reg.vencimiento, '2026-11-27');
  assert.equal(reg.monto, 500);
  assert.equal(reg.origen, 'pago');
  assert.ok(reg.mensajeId);
});

test('segunda corrida el mismo día (reinicio / doble ejecución) no vuelve a enviar', async () => {
  const { servicio, enviados } = armar();
  await servicio.correrDia();
  const r = await servicio.correrDia();
  assert.equal(enviados.length, 3);
  assert.equal(r.yaEnviados, 3);
  assert.equal(r.enviados, 0);
});

test('429 DAILY_LIMIT detiene la corrida y queda reintentable', async () => {
  const { servicio, repo, enviados } = armar({ respuestas: (_p, n) => (n === 2 ? [429, { error: { code: 'DAILY_LIMIT' } }] : [201, { message: { id: `m-${n}`, status: 'sent' } }]) });
  const r = await servicio.correrDia();
  assert.equal(r.detenida, 'limite_diario');
  assert.equal(enviados.length, 2);
  const beto = repo.db.get(`pago:${id(2)}:2026-11-24:d0`);
  assert.equal(beto.estado, 'Fallido');
  assert.equal(beto.reintentable, true);
  assert.match(beto.motivoFalla, /límite diario/);
});

test('falla definitiva: la tarea automática no insiste; la reintenta solo recepción', async () => {
  let fallar = true;
  const { servicio, enviados } = armar({
    respuestas: (p, n) => (fallar && p.to === '55 1111 1111'
      ? [502, { error: { code: 'SEND_FAILED', retryable: false }, message: { id: 'mx', status: 'failed', error: { reason: 'El número no tiene WhatsApp' } } }]
      : [201, { message: { id: `m-${n}`, status: 'sent' } }]),
  });
  const r1 = await servicio.correrDia();
  assert.equal(r1.fallidos, 1);
  const r2 = await servicio.correrDia();
  assert.equal(r2.omitidos, 1);
  assert.equal(enviados.filter((e) => e.to === '55 1111 1111').length, 1);
  fallar = false;
  const manual = await servicio.enviarManual(id(1), 'recep@x');
  assert.equal(manual.ok, true);
  assert.equal(enviados.filter((e) => e.to === '55 1111 1111').length, 2);
});

test('apagarlo a media corrida detiene los envíos siguientes', async () => {
  const ref = {};
  // El admin lo apaga justo mientras se envía el primero.
  ref.ctx = armar({
    respuestas: (_p, n) => {
      if (n === 1) ref.ctx.interruptor.activo = false;
      return [201, { message: { id: `m-${n}`, status: 'sent' } }];
    },
  });
  const r = await ref.ctx.servicio.correrDia();
  assert.equal(r.enviados, 1);
  assert.equal(r.detenida, 'apagado');
  assert.equal(ref.ctx.enviados.length, 1);
  assert.equal((await ref.ctx.servicio.correrDia()).omitida, 'apagado');
});

test('envío manual: apagado, sin teléfono, ya enviado y fuera de etapa', async () => {
  const off = armar({ activo: false });
  await assert.rejects(off.servicio.enviarManual(id(1), 'u'), (e) => e instanceof ErrorRecordatorio && e.code === 'ENVIO_APAGADO' && e.status === 409);
  assert.equal(off.enviados.length, 0);

  const { servicio, enviados } = armar();
  await assert.rejects(servicio.enviarManual(id(4), 'u'), (e) => e.code === 'SIN_TELEFONO');
  await servicio.enviarManual(id(1), 'u');
  await assert.rejects(servicio.enviarManual(id(1), 'u'), (e) => e.code === 'YA_ENVIADO');
  const fuera = await servicio.enviarManual(id(5), 'u'); // vence mañana: no es día de etapa
  assert.equal(fuera.ok, true);
  assert.equal(enviados.at(-1).idempotencyKey, `pago:${id(5)}:2026-11-25:manual-2026-11-24`);
  assert.equal(enviados.at(-1).template, 'pago_proximo');
});

test('envío manual con teléfono inválido devuelve el motivo legible', async () => {
  const { servicio, repo } = armar({ respuestas: () => [422, { error: { code: 'INVALID_PHONE' } }] });
  await assert.rejects(servicio.enviarManual(id(1), 'u'), (e) => e.code === 'ENVIO_FALLIDO' && /no es un número de WhatsApp/.test(e.message));
  assert.equal(repo.db.get(`pago:${id(1)}:2026-11-27:d-3`).estado, 'Fallido');
});

test('webhook: avanza enviado → entregado → leído, ignora retrocesos, ajenos y repetidos', async () => {
  const { servicio, repo } = armar();
  await servicio.correrDia();
  const k = `pago:${id(1)}:2026-11-27:d-3`;
  const mid = repo.db.get(k).mensajeId;
  const ev = (status, extra = {}) => ({ event: 'message.status', data: { id: mid, status, idempotencyKey: k, metadata: { recordatorioId: k }, ...extra } });

  assert.equal((await servicio.procesarWebhook(ev('delivered'))).actualizado, true);
  assert.equal(repo.db.get(k).estado, 'Entregado');
  assert.equal((await servicio.procesarWebhook(ev('delivered'))).actualizado, false); // repetido
  assert.equal((await servicio.procesarWebhook(ev('read'))).actualizado, true);
  assert.equal((await servicio.procesarWebhook(ev('delivered'))).actualizado, false); // tardío
  assert.equal((await servicio.procesarWebhook(ev('failed'))).actualizado, false);
  assert.equal(repo.db.get(k).estado, 'Leído');

  // Otro mensaje con la misma llave (no debería pasar) no toca el registro
  assert.equal((await servicio.procesarWebhook({ event: 'message.status', data: { id: 'otro', status: 'failed', metadata: { recordatorioId: k } } })).actualizado, false);
  // Eventos ajenos
  assert.equal((await servicio.procesarWebhook({ event: 'message.received', data: {} })).ignorado, 'evento');
  assert.equal((await servicio.procesarWebhook({ event: 'message.status', data: { id: 'x', status: 'read', metadata: { recordatorioId: 'event:14' } } })).ignorado, 'ajeno');
});

test('webhook: fallo de entrega guarda el motivo legible', async () => {
  const { servicio, repo } = armar();
  await servicio.correrDia();
  const k = `pago:${id(2)}:2026-11-24:d0`;
  const mid = repo.db.get(k).mensajeId;
  await servicio.procesarWebhook({ event: 'message.status', data: { id: mid, status: 'failed', idempotencyKey: k, error: { code: 131026, reason: 'El número no tiene WhatsApp' } } });
  assert.equal(repo.db.get(k).estado, 'Fallido');
  assert.equal(repo.db.get(k).motivoFalla, 'El número no tiene WhatsApp');
});

test('listado: calcula días reales, etapa de hoy, pago reciente y lo que toca', async () => {
  const { servicio } = armar({ activo: false });
  const l = await servicio.listado();
  assert.equal(l.hoy, '2026-11-24');
  assert.equal(l.config.activo, false);
  assert.equal(l.resumen.tocanHoy, 3);
  const fer = l.items.find((i) => i.clienteId === id(6));
  assert.ok(fer.pagoReciente);
  assert.equal(fer.tocaHoy, false);
  const caro = l.items.find((i) => i.clienteId === id(3));
  assert.equal(caro.dias, -3);
  assert.equal(caro.etapaHoy, 'd+3');
  assert.equal(l.items.find((i) => i.clienteId === id(4)).tieneTelefono, false);
});
