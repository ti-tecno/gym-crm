/**
 * Configuración del pago en línea con Mercado Pago (Checkout Pro).
 *
 * Función pura, mismo criterio que config/mensajero.js: TODAS las variables son opcionales;
 * si faltan o son inválidas el pago en línea queda apagado con avisos, pero el servidor arranca.
 *
 *   MERCADOPAGO_ACCESS_TOKEN          token de acceso (secreto, solo backend)
 *   MERCADOPAGO_WEBHOOK_SECRET        "clave secreta" de Webhooks (Tus integraciones → Webhooks)
 *   PUBLIC_API_URL                    URL pública HTTPS del backend, sin /api/v1 (notificaciones)
 *   PUBLIC_FRONTEND_URL               URL pública HTTPS del frontend (regreso del checkout)
 *   MERCADOPAGO_STATEMENT_DESCRIPTOR  texto en el estado de cuenta (≤13, opcional)
 */

const limpio = (v) => (typeof v === 'string' ? v.trim() : '');

function urlHttps(valor, nombre, avisos) {
  const v = limpio(valor).replace(/\/+$/, '');
  if (!v) return '';
  try {
    const u = new URL(v);
    // Mercado Pago descarta back_urls HTTP y exige HTTPS en notification_url.
    if (u.protocol !== 'https:') { avisos.push(`${nombre} debe ser HTTPS (Mercado Pago no acepta HTTP)`); return ''; }
    return v;
  } catch {
    avisos.push(`${nombre} no es una URL válida`);
    return '';
  }
}

export const RUTA_WEBHOOK_MERCADOPAGO = '/webhooks/mercadopago';
export const RUTA_RESULTADO_FRONTEND = '/mi/pago/resultado';

export function parseMercadoPagoConfig(raw = {}, { apiPrefix = '/api/v1' } = {}) {
  const avisos = [];
  const accessToken = limpio(raw.MERCADOPAGO_ACCESS_TOKEN);
  const webhookSecret = limpio(raw.MERCADOPAGO_WEBHOOK_SECRET);
  let apiUrl = urlHttps(raw.PUBLIC_API_URL, 'PUBLIC_API_URL', avisos);
  // Se acepta con o sin el prefijo de la API al final.
  if (apiPrefix && apiUrl.endsWith(apiPrefix)) apiUrl = apiUrl.slice(0, -apiPrefix.length);
  const frontendUrl = urlHttps(raw.PUBLIC_FRONTEND_URL, 'PUBLIC_FRONTEND_URL', avisos);
  let descriptor = limpio(raw.MERCADOPAGO_STATEMENT_DESCRIPTOR) || 'IRONCORE GYM';
  if (descriptor.length > 13) {
    avisos.push('MERCADOPAGO_STATEMENT_DESCRIPTOR tiene más de 13 caracteres; se recorta');
    descriptor = descriptor.slice(0, 13);
  }

  const faltantes = [];
  if (!accessToken) faltantes.push('MERCADOPAGO_ACCESS_TOKEN');
  if (!webhookSecret) faltantes.push('MERCADOPAGO_WEBHOOK_SECRET');
  if (!apiUrl) faltantes.push('PUBLIC_API_URL');
  if (!frontendUrl) faltantes.push('PUBLIC_FRONTEND_URL');

  // Sin secreto no se pueden verificar los avisos, y sin avisos no se confirma ningún pago:
  // por eso el checkout exige las cuatro.
  const checkoutDisponible = faltantes.length === 0;
  const webhookDisponible = Boolean(accessToken && webhookSecret);
  if (!checkoutDisponible) avisos.push(`Pago en línea apagado: faltan ${faltantes.join(', ')}`);
  const modoPrueba = accessToken.startsWith('TEST-');
  if (modoPrueba) avisos.push('MERCADOPAGO_ACCESS_TOKEN es de prueba (TEST-…): no se cobra dinero real');

  return {
    accessToken,
    webhookSecret,
    apiUrl,
    frontendUrl,
    descriptor,
    // source_news=webhooks: que solo lleguen avisos en formato Webhooks (con x-signature), no IPN.
    notificationUrl: apiUrl ? `${apiUrl}${apiPrefix}${RUTA_WEBHOOK_MERCADOPAGO}?source_news=webhooks` : '',
    retornoUrl: frontendUrl ? `${frontendUrl}${RUTA_RESULTADO_FRONTEND}` : '',
    checkoutDisponible,
    webhookDisponible,
    modoPrueba,
    avisos,
  };
}
