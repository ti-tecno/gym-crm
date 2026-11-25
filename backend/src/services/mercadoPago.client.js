/**
 * Cliente mínimo de la API de Mercado Pago con fetch nativo (sin SDK). `fetchImpl` se inyecta
 * para las pruebas. Referencias (consultadas 2026-11):
 *   - POST https://api.mercadopago.com/checkout/preferences   (Checkout Pro)
 *   - GET  https://api.mercadopago.com/v1/payments/{id}
 *   - Webhooks: header x-signature "ts=…,v1=…" (HMAC-SHA256 hex) + x-request-id + query data.id
 */
import crypto from 'node:crypto';

const BASE = 'https://api.mercadopago.com';
const TIMEOUT_MS = 10_000; // el aviso de MP espera respuesta en 22 s

export function crearClienteMercadoPago({ accessToken, fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS, base = BASE }) {
  /** Nunca lanza: { ok, status, body } (status null si no hubo respuesta). */
  async function llamar(method, path, { body, headers = {} } = {}) {
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      return { ok: false, status: null, body: null, error: err?.name === 'TimeoutError' ? 'tiempo de espera agotado' : (err?.message || 'error de red') };
    }
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body: data };
  }

  return {
    /** Crea una preferencia de Checkout Pro. La llave evita duplicar si se reintenta. */
    crearPreferencia: (preferencia, idempotencyKey) =>
      llamar('POST', '/checkout/preferences', { body: preferencia, headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {} }),
    /** Consulta un pago con nuestro token (fuente de verdad del estado, monto y referencia). */
    obtenerPago: (id) => llamar('GET', `/v1/payments/${encodeURIComponent(String(id))}`),
  };
}

/** "ts=1704908010,v1=abc…" → { ts, v1 } (claves sin importar mayúsculas ni espacios). */
export function parsearXSignature(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const parte of header.split(',')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const k = parte.slice(0, i).trim().toLowerCase();
    const v = parte.slice(i + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

/**
 * Plantilla firmada por Mercado Pago: `id:[data.id];request-id:[x-request-id];ts:[ts];`
 * - data.id sale del query string; si es alfanumérico va en minúsculas.
 * - Si falta un valor, ese par se omite.
 */
export function manifiestoMercadoPago({ dataId, xRequestId, ts }) {
  let m = '';
  if (dataId) m += `id:${String(dataId).toLowerCase()};`;
  if (xRequestId) m += `request-id:${xRequestId};`;
  if (ts) m += `ts:${ts};`;
  return m;
}

/** Verifica x-signature (HMAC-SHA256 hex del manifiesto con la clave secreta), en tiempo constante. */
export function verificarFirmaMercadoPago({ xSignature, xRequestId, dataId, secret }) {
  if (!secret) return false;
  const { ts, v1 } = parsearXSignature(xSignature);
  if (!ts || !v1 || !/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/i.test(v1)) return false;
  const esperado = crypto.createHmac('sha256', secret).update(manifiestoMercadoPago({ dataId, xRequestId, ts })).digest('hex');
  const a = Buffer.from(v1.toLowerCase());
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
