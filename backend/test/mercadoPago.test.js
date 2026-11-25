import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  crearClienteMercadoPago, manifiestoMercadoPago, parsearXSignature, verificarFirmaMercadoPago,
} from '../src/services/mercadoPago.client.js';
import { parseMercadoPagoConfig } from '../src/config/mercadoPago.js';

const SECRET = 'clave-secreta-webhook';
const firma = (manifest, secret = SECRET) => crypto.createHmac('sha256', secret).update(manifest).digest('hex');

test('x-signature: manifiesto id;request-id;ts; con data.id del query en minúsculas', () => {
  assert.equal(manifiestoMercadoPago({ dataId: '123456', xRequestId: 'req-1', ts: '1704908010' }), 'id:123456;request-id:req-1;ts:1704908010;');
  assert.equal(manifiestoMercadoPago({ dataId: 'ABC123', xRequestId: 'r', ts: '1' }), 'id:abc123;request-id:r;ts:1;');
  // Valores ausentes se omiten
  assert.equal(manifiestoMercadoPago({ dataId: null, xRequestId: 'r', ts: '1' }), 'request-id:r;ts:1;');
  assert.equal(manifiestoMercadoPago({ dataId: '9', xRequestId: undefined, ts: '1' }), 'id:9;ts:1;');
  assert.deepEqual(parsearXSignature(' ts=1704908010 , v1=AbC '), { ts: '1704908010', v1: 'AbC' });
});

test('x-signature: válida, alterada, de otro secreto, sin ts o mal formada', () => {
  const ts = '1704908010';
  const v1 = firma(`id:123456;request-id:req-1;ts:${ts};`);
  const ok = { xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1', dataId: '123456', secret: SECRET };
  assert.equal(verificarFirmaMercadoPago(ok), true);
  assert.equal(verificarFirmaMercadoPago({ ...ok, xSignature: `v1=${v1},ts=${ts}` }), true); // orden indistinto
  assert.equal(verificarFirmaMercadoPago({ ...ok, dataId: '123457' }), false);               // otro pago
  assert.equal(verificarFirmaMercadoPago({ ...ok, xRequestId: 'req-2' }), false);
  assert.equal(verificarFirmaMercadoPago({ ...ok, xSignature: `ts=1704908011,v1=${v1}` }), false);
  assert.equal(verificarFirmaMercadoPago({ ...ok, secret: 'otro' }), false);
  assert.equal(verificarFirmaMercadoPago({ ...ok, secret: '' }), false);
  assert.equal(verificarFirmaMercadoPago({ ...ok, xSignature: `v1=${v1}` }), false);
  assert.equal(verificarFirmaMercadoPago({ ...ok, xSignature: undefined }), false);
  assert.equal(verificarFirmaMercadoPago({ ...ok, xSignature: `ts=${ts},v1=zz` }), false);
});

test('configuración de Mercado Pago: opcional, HTTPS obligatorio, URLs armadas', () => {
  const vacia = parseMercadoPagoConfig({});
  assert.equal(vacia.checkoutDisponible, false);
  assert.equal(vacia.webhookDisponible, false);
  assert.ok(vacia.avisos.some((a) => a.includes('MERCADOPAGO_ACCESS_TOKEN')));

  const completa = parseMercadoPagoConfig({
    MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-x', MERCADOPAGO_WEBHOOK_SECRET: 's',
    PUBLIC_API_URL: 'https://api.iron-core.mx/api/v1/', PUBLIC_FRONTEND_URL: 'https://iron-core.mx/',
  }, { apiPrefix: '/api/v1' });
  assert.equal(completa.checkoutDisponible, true);
  assert.equal(completa.notificationUrl, 'https://api.iron-core.mx/api/v1/webhooks/mercadopago?source_news=webhooks');
  assert.equal(completa.retornoUrl, 'https://iron-core.mx/mi/pago/resultado');
  assert.ok(completa.descriptor.length <= 13);

  const http = parseMercadoPagoConfig({ MERCADOPAGO_ACCESS_TOKEN: 'TEST-x', MERCADOPAGO_WEBHOOK_SECRET: 's', PUBLIC_API_URL: 'http://localhost:4000', PUBLIC_FRONTEND_URL: 'https://iron-core.mx' });
  assert.equal(http.checkoutDisponible, false);
  assert.equal(http.webhookDisponible, true);
  assert.equal(http.modoPrueba, true);
  assert.ok(http.avisos.some((a) => a.includes('HTTPS')));
});

test('cliente de MP: Bearer, rutas correctas, nunca lanza por red caída', async () => {
  const llamadas = [];
  const mp = crearClienteMercadoPago({
    accessToken: 'tok',
    fetchImpl: async (url, init) => {
      llamadas.push({ url, init });
      if (url.includes('/v1/payments/')) return new Response(JSON.stringify({ id: 1, status: 'approved' }), { status: 200 });
      return new Response(JSON.stringify({ id: 'pref-1', init_point: 'https://mp/checkout' }), { status: 201 });
    },
  });
  const p = await mp.crearPreferencia({ items: [] }, 'preferencia-TXN-1');
  assert.equal(p.ok, true);
  assert.equal(llamadas[0].url, 'https://api.mercadopago.com/checkout/preferences');
  assert.equal(llamadas[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(llamadas[0].init.headers['X-Idempotency-Key'], 'preferencia-TXN-1');
  const g = await mp.obtenerPago('123');
  assert.equal(llamadas[1].url, 'https://api.mercadopago.com/v1/payments/123');
  assert.equal(g.body.status, 'approved');

  const caido = crearClienteMercadoPago({ accessToken: 'tok', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  const r = await caido.obtenerPago('1');
  assert.equal(r.ok, false);
  assert.equal(r.status, null);
});
