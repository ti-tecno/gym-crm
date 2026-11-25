/**
 * Cliente mínimo de SofIA Messenger API (docs/SPEC.md del mensajero, §4 y §7).
 * Usa fetch nativo; `fetchImpl` se inyecta para las pruebas.
 */
import crypto from 'node:crypto';
import { interpretarRespuesta } from './recordatorioPago.logic.js';

const TIMEOUT_MS = 15_000;

export function crearClienteMensajero({ url, apiKey, fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS }) {
  /**
   * POST /v1/messages/template. Nunca lanza: devuelve el resultado ya interpretado
   * (ver interpretarRespuesta) más `httpStatus`.
   */
  async function enviarPlantilla(payload) {
    let response;
    try {
      response = await fetchImpl(`${url}/v1/messages/template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'ironcore-api',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Red caída o timeout: no sabemos si llegó. Reintentar con la misma idempotencyKey es seguro.
      return {
        resultado: 'error', estado: 'Fallido', mensajeId: null, telefono: null,
        reintentable: true, detener: true, httpStatus: null,
        motivo: `No se pudo contactar al mensajero (${err?.name === 'TimeoutError' ? 'tiempo de espera agotado' : err?.message || 'error de red'})`,
      };
    }
    const body = await response.json().catch(() => ({}));
    return { ...interpretarRespuesta(response.status, body), httpStatus: response.status };
  }

  return { enviarPlantilla };
}

/**
 * Verifica `X-Signature-256: sha256=<hex>` = HMAC-SHA256 del cuerpo crudo con el secreto
 * del webhook, en tiempo constante.
 */
export function verificarFirma(rawBody, header, secret) {
  if (!secret || !Buffer.isBuffer(rawBody) || typeof header !== 'string') return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(header.trim());
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
