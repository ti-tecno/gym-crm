import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { crearClienteMensajero, verificarFirma } from '../src/services/mensajero.client.js';
import { guardarCuerpoCrudoPara } from '../src/middleware/rawBody.js';

// fetch simulado: nunca sale a la red.
function fetchFalso(status, body, capturas = []) {
  return async (url, init) => {
    capturas.push({ url, init });
    return { status, json: async () => body };
  };
}

const msg = (over = {}) => ({ id: 'm-1', status: 'sent', phone: '525512345678', error: null, ...over });

test('envía a /v1/messages/template con Bearer y el cuerpo tal cual', async () => {
  const capturas = [];
  const c = crearClienteMensajero({ url: 'https://msg.test', apiKey: 'msk_abc', fetchImpl: fetchFalso(201, { message: msg() }, capturas) });
  const payload = { to: '5512345678', template: 't', idempotencyKey: 'pago:x:2026-11-27:d0', ref: 'cliente:x', metadata: { refLabel: 'Ana' } };
  const r = await c.enviarPlantilla(payload);
  assert.equal(capturas[0].url, 'https://msg.test/v1/messages/template');
  assert.equal(capturas[0].init.method, 'POST');
  assert.equal(capturas[0].init.headers.Authorization, 'Bearer msk_abc');
  assert.deepEqual(JSON.parse(capturas[0].init.body), payload);
  assert.equal(r.resultado, 'enviado');
  assert.equal(r.estado, 'Enviado');
  assert.equal(r.mensajeId, 'm-1');
  assert.equal(r.httpStatus, 201);
});

const casos = [
  ['200 duplicate (ya enviado)', 200, { message: msg({ status: 'delivered' }), duplicate: true }, { resultado: 'duplicado', estado: 'Entregado', detener: false }],
  ['200 duplicate de un fallido', 200, { message: msg({ status: 'failed', error: { code: 131026, reason: 'Sin WhatsApp' } }), duplicate: true }, { resultado: 'duplicado', estado: 'Fallido', motivo: 'Sin WhatsApp' }],
  ['403 sandbox', 403, { error: { code: 'RECIPIENT_NOT_ALLOWED', message: 'x' } }, { resultado: 'no_permitido', estado: 'Fallido', reintentable: false, detener: false }],
  ['422 teléfono inválido', 422, { error: { code: 'INVALID_PHONE', message: 'x' } }, { resultado: 'telefono_invalido', estado: 'Fallido', reintentable: false, detener: false }],
  ['429 límite diario detiene la corrida', 429, { error: { code: 'DAILY_LIMIT', message: 'x' } }, { resultado: 'limite_diario', detener: true, reintentable: true }],
  ['502 reintentable', 502, { error: { code: 'SEND_FAILED', message: 'Meta', retryable: true }, message: msg({ status: 'failed', error: { code: 130429, reason: 'Límite de Meta' } }) }, { resultado: 'envio_fallido', reintentable: true, motivo: 'Límite de Meta', mensajeId: 'm-1' }],
  ['502 definitivo', 502, { error: { code: 'SEND_FAILED', message: 'Meta', retryable: false }, message: msg({ status: 'failed', error: { code: 131026, reason: 'El número no tiene WhatsApp' } }) }, { resultado: 'envio_fallido', reintentable: false, motivo: 'El número no tiene WhatsApp' }],
  ['401 llave inválida detiene', 401, { error: { code: 'UNAUTHORIZED', message: 'Llave inválida' } }, { resultado: 'error', detener: true }],
  ['503 canal sin configurar detiene', 503, { error: { code: 'NOT_CONFIGURED', message: 'x' } }, { resultado: 'error', detener: true }],
];

for (const [nombre, status, body, esperado] of casos) {
  test(`respuesta ${nombre}`, async () => {
    const c = crearClienteMensajero({ url: 'https://msg.test', apiKey: 'k', fetchImpl: fetchFalso(status, body) });
    const r = await c.enviarPlantilla({});
    for (const [k, v] of Object.entries(esperado)) assert.deepEqual(r[k], v, `${k}`);
    assert.ok(r.motivo === null || typeof r.motivo === 'string');
  });
}

test('red caída o timeout: no lanza, se puede reintentar y detiene la corrida', async () => {
  const c = crearClienteMensajero({ url: 'https://msg.test', apiKey: 'k', fetchImpl: async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; } });
  const r = await c.enviarPlantilla({});
  assert.equal(r.resultado, 'error');
  assert.equal(r.reintentable, true);
  assert.equal(r.detener, true);
  assert.match(r.motivo, /tiempo de espera/);
});

test('firma del webhook: HMAC-SHA256 del cuerpo crudo, en tiempo constante', () => {
  const secreto = 'whsec_prueba';
  const cuerpo = Buffer.from('{"event":"message.status","data":{"id":"m-1"}}');
  const firma = 'sha256=' + crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex');
  assert.equal(verificarFirma(cuerpo, firma, secreto), true);
  assert.equal(verificarFirma(Buffer.from(cuerpo.toString().replace('m-1', 'm-2')), firma, secreto), false);
  assert.equal(verificarFirma(cuerpo, firma, 'otro'), false);
  assert.equal(verificarFirma(cuerpo, firma.slice(0, -2), secreto), false); // largo distinto no lanza
  assert.equal(verificarFirma(cuerpo, undefined, secreto), false);
  assert.equal(verificarFirma(cuerpo, firma, ''), false);
  assert.equal(verificarFirma(undefined, firma, secreto), false);
});

test('el cuerpo crudo se guarda solo en la ruta del webhook, sin romper el parser ni el límite', async () => {
  const app = express();
  app.use(express.json({ limit: '1kb', verify: guardarCuerpoCrudoPara('/api/v1/webhooks/mensajero') }));
  app.post('/api/v1/webhooks/mensajero', (req, res) => res.json({ crudo: req.rawBody?.toString('utf8') ?? null, parseado: req.body }));
  app.post('/api/v1/otra', (req, res) => res.json({ crudo: req.rawBody ? 'si' : null, parseado: req.body }));
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ type: err.type }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const texto = '{"event":"message.status",  "data":{"id":"m-1"}}'; // con espacios: debe llegar idéntico
    let r = await fetch(`${base}/api/v1/webhooks/mensajero?x=1`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: texto });
    let j = await r.json();
    assert.equal(j.crudo, texto);
    assert.deepEqual(j.parseado, { event: 'message.status', data: { id: 'm-1' } });

    r = await fetch(`${base}/api/v1/otra`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' });
    j = await r.json();
    assert.equal(j.crudo, null);
    assert.deepEqual(j.parseado, { a: 1 });

    r = await fetch(`${base}/api/v1/webhooks/mensajero`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'y'.repeat(2000) }) });
    assert.equal(r.status, 413);
  } finally {
    server.close();
  }
});
