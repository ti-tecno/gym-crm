import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerRespuesta, agregarRespuesta, atender } from '../src/services/respuestas.logic.js';
import { crearServicioRespuestas } from '../src/services/respuestas.service.js';
import { crearClienteMensajero } from '../src/services/mensajero.client.js';
import { crearServicioRecordatorioPago } from '../src/services/recordatorioPago.service.js';
import { parseMensajeroConfig } from '../src/config/mensajero.js';
import { interpretarRespuesta } from '../src/services/recordatorioPago.logic.js';

const CID = '0b9c8f1e-2d3a-4b5c-8d7e-6f5a4b3c2d1e';
const recibido = (over = {}) => ({
  event: 'message.received',
  createdAt: '2026-11-24T16:00:00.000Z',
  data: {
    id: 'in-1', direction: 'in', kind: 'text', phone: '525511111111', text: 'Ya pagué <script>alert(1)</script>',
    msgType: 'text', profileName: 'Carlos', ref: `cliente:${CID}`, status: 'received',
    metadata: { recordatorioId: `pago:${CID}:2026-11-27:d-3`, clienteId: CID }, createdAt: '2026-11-24T16:00:00.000Z', ...over,
  },
});

test('respuesta: se liga por ref cliente:<id>, guarda el texto tal cual (dato no confiable) y su origen', () => {
  const r = extraerRespuesta(recibido());
  assert.equal(r.clienteId, CID);
  assert.equal(r.respuesta.texto, 'Ya pagué <script>alert(1)</script>'); // se muestra como texto, nunca HTML
  assert.equal(r.respuesta.perfil, 'Carlos');
  assert.equal(r.respuesta.origen, 'recordatorio');
  assert.equal(r.respuesta.atendida, false);
  assert.equal(extraerRespuesta(recibido({ metadata: { recordatorioId: 'pagorecibido:TXN-0000000001' } })).respuesta.origen, 'pago_recibido');
  assert.equal(extraerRespuesta(recibido({ text: 'x'.repeat(5000) })).respuesta.texto.length, 1000);
  // Sin ref (nunca se le escribió) o ajeno: no se puede ligar
  assert.equal(extraerRespuesta(recibido({ ref: null })).ignorado, 'sin_cliente');
  assert.equal(extraerRespuesta(recibido({ ref: 'event:14' })).ignorado, 'sin_cliente');
  assert.equal(extraerRespuesta(recibido({ direction: 'out' })).ignorado, 'direccion');
  assert.equal(extraerRespuesta({ event: 'message.status', data: {} }).ignorado, 'evento');
});

test('respuesta: repetida no se duplica; atender una o todas', () => {
  const r = extraerRespuesta(recibido()).respuesta;
  const l1 = agregarRespuesta([], r);
  assert.equal(agregarRespuesta(l1, r), null);
  const l2 = agregarRespuesta(l1, { ...r, id: 'in-2', recibidoAt: '2026-11-24T17:00:00.000Z' });
  assert.equal(l2[0].id, 'in-2');
  const l3 = atender(l2, 'in-1', { por: 'recep@x', at: 't' });
  assert.equal(l3.find((x) => x.id === 'in-1').atendida, true);
  assert.equal(l3.find((x) => x.id === 'in-2').atendida, false);
  assert.equal(atender(l3, 'in-1', { at: 't' }), null);
  assert.equal(atender(l3, null, { at: 't' }).every((x) => x.atendida), true);
});

test('servicio de respuestas: webhook repetido y concurrente guarda una sola vez; recepción la atiende', async () => {
  const c = { clienteId: CID, nombre: 'Carlos', telefono: '55 1111 1111', vencimiento: '2026-11-27', estado: 'Por vencer' };
  const clientes = {
    async getCliente() { await new Promise((r) => setImmediate(r)); return structuredClone(c); },
    async listClientes() { return [structuredClone(c)]; },
    async guardarRespuestasWhatsapp(_id, lista, v) {
      await new Promise((r) => setImmediate(r));
      if ((c.respuestasVersion ?? null) !== v) return false;
      c.respuestasWhatsapp = structuredClone(lista); c.respuestasVersion = (v || 0) + 1; return true;
    },
  };
  const s = crearServicioRespuestas({ clientes, logger: { info() {} } });
  await Promise.all([s.procesarWebhook(recibido()), s.procesarWebhook(recibido()), s.procesarWebhook(recibido({ id: 'in-2' }))]);
  assert.equal(c.respuestasWhatsapp.length, 2);
  assert.equal(c.vencimiento, '2026-11-27'); // nada más cambia
  assert.equal(c.estado, 'Por vencer');
  const pend = await s.listarPendientes();
  assert.equal(pend[0].respuestas.length, 2);
  assert.equal('email' in pend[0], false);
  await s.marcarAtendida(CID, 'in-1', 'recep@x');
  assert.equal((await s.listarPendientes())[0].respuestas.length, 1);
});

test('GET /v1/me: activa, no activada por SofIA (403 CLIENT_DISABLED), llave inválida y sin conexión', async () => {
  const con = (status, body) => crearClienteMensajero({ url: 'https://msg.test', apiKey: 'k', fetchImpl: async (u) => { assert.equal(u, 'https://msg.test/v1/me'); return new Response(JSON.stringify(body), { status }); } });
  const a = await con(200, { sandbox: true, channels: [{ slug: 'default', isDefault: true, displayPhone: '+52 55' }] }).consultarApp();
  assert.equal(a.estado, 'activa');
  assert.equal(a.sandbox, true);
  assert.equal((await con(403, { error: { code: 'CLIENT_DISABLED' } }).consultarApp()).estado, 'inactiva');
  assert.match((await con(403, { error: { code: 'CLIENT_DISABLED' } }).consultarApp()).motivo, /no activado por SofIA/);
  assert.equal((await con(401, { error: { code: 'UNAUTHORIZED' } }).consultarApp()).estado, 'llave_invalida');
  const caido = crearClienteMensajero({ url: 'https://msg.test', apiKey: 'k', fetchImpl: async () => { throw Object.assign(new Error('t'), { name: 'TimeoutError' }); } });
  assert.equal((await caido.consultarApp()).estado, 'sin_conexion');
});

test('CLIENT_DISABLED al enviar: motivo legible, detiene la corrida y no es falla definitiva', async () => {
  const r = interpretarRespuesta(403, { error: { code: 'CLIENT_DISABLED', message: 'App desactivada' } });
  assert.equal(r.resultado, 'servicio_inactivo');
  assert.equal(r.detener, true);
  assert.equal(r.reintentable, true);
  assert.match(r.motivo, /no activado por SofIA/);

  const config = parseMensajeroConfig({
    MENSAJERO_URL: 'https://msg.test', MENSAJERO_API_KEY: 'k',
    RECORDATORIO_PAGO_PLANTILLA_ANTES: 'a', RECORDATORIO_PAGO_PLANTILLA_HOY: 'h', RECORDATORIO_PAGO_PLANTILLA_DESPUES: 'd',
    LIGA_PAGO_SECRET: 'secreto-de-prueba-de-ligas-de-pago-0123',
  });
  const db = new Map();
  let respuesta = [403, { error: { code: 'CLIENT_DISABLED' } }];
  const envios = [];
  const clientes = [
    { clienteId: '00000000-0000-4000-8000-000000000001', nombre: 'Ana', telefono: '55 1111 1111', monto: 500, vencimiento: '2026-11-27' },
    { clienteId: '00000000-0000-4000-8000-000000000002', nombre: 'Beto', telefono: '55 2222 2222', monto: 500, vencimiento: '2026-11-24' },
  ];
  const servicio = crearServicioRecordatorioPago({
    config,
    mensajero: { async enviarPlantilla(p) { envios.push(p); return interpretarRespuesta(...respuesta); } },
    repo: {
      async getRecordatorio(k) { return db.get(k) ? { ...db.get(k) } : null; },
      async iniciarEnvioPago(k, d, ex) { const cur = db.get(k); if (cur && ex.includes(cur.estado)) return null; db.set(k, { ...cur, ...d, estado: 'Enviando' }); return db.get(k); },
      async registrarResultadoPago(k, { estado, estadosPrevios, ...c }) { const cur = db.get(k); if (estadosPrevios.includes(cur.estado)) cur.estado = estado; for (const [x, v] of Object.entries(c)) if (v != null) cur[x] = v; return { ...cur }; },
    },
    clientes: { listClientes: async () => clientes, getCliente: async (i) => clientes.find((c) => c.clienteId === i) },
    pagos: { listPagos: async () => [] },
    settings: { getMensajeria: async () => ({ activo: true }) },
    logger: { warn() {}, info() {}, error() {} },
    now: () => new Date('2026-11-24T15:00:00Z'),
  });
  const r1 = await servicio.correrDia();
  assert.equal(r1.detenida, 'servicio_inactivo');
  assert.equal(envios.length, 1);
  const reg = [...db.values()][0];
  assert.equal(reg.estado, 'Fallido');
  assert.equal(reg.reintentable, true);
  assert.match(reg.motivoFalla, /no activado por SofIA/);
  await assert.rejects(servicio.enviarManual(clientes[1].clienteId, 'u'), (e) => e.code === 'SERVICIO_INACTIVO' && /SofIA/.test(e.message));
  // SofIA lo activa: la siguiente corrida sí reintenta al que falló
  respuesta = [201, { message: { id: 'm1', status: 'sent' } }];
  const r2 = await servicio.correrDia();
  assert.equal(r2.enviados, 2);
});
