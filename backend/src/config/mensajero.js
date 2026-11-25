/**
 * Configuración del recordatorio de pago por WhatsApp (SofIA Messenger API).
 *
 * Función pura: recibe las variables de entorno crudas y devuelve la configuración
 * normalizada. TODAS las variables son opcionales: si faltan o son inválidas la
 * funcionalidad queda apagada y se explica en `avisos`, pero nunca se tumba el servidor
 * (por eso no van en el esquema Zod principal de env.js, que hace process.exit).
 *
 * Estas variables son solo de CONEXIÓN. El encendido/apagado del envío NO está aquí:
 * vive en gym_settings (`mensajeria.activo`, Backoffice → Mensajería), arranca apagado
 * y se lee en cada corrida y en cada envío manual.
 */

const ETAPAS_DEFECTO = [-3, 0, 3];
const HORA_DEFECTO = '09:00';

const limpio = (v) => (typeof v === 'string' ? v.trim() : '');

/** "-3,0,3" → [-3, 0, 3] (enteros entre -60 y 60, sin repetidos, ordenados). null si es inválido. */
export function parseEtapas(v) {
  const raw = limpio(v);
  if (!raw) return [...ETAPAS_DEFECTO];
  const partes = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (!partes.length) return null;
  const nums = partes.map((p) => (/^[+-]?\d{1,2}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < -60 || n > 60)) return null;
  return [...new Set(nums)].sort((a, b) => a - b);
}

/** "9:00" / "09:30" → { h, m }. null si es inválida. */
export function parseHora(v) {
  const raw = limpio(v) || HORA_DEFECTO;
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]); const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

export function parseMensajeroConfig(raw = {}) {
  const avisos = [];

  let url = limpio(raw.MENSAJERO_URL).replace(/\/+$/, '');
  if (url) {
    try {
      const u = new URL(url);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocolo');
    } catch {
      avisos.push('MENSAJERO_URL no es una URL válida');
      url = '';
    }
  }
  // Se acepta la base con o sin "/v1" al final.
  url = url.replace(/\/v1$/, '');

  const apiKey = limpio(raw.MENSAJERO_API_KEY);
  const webhookSecret = limpio(raw.MENSAJERO_WEBHOOK_SECRET);
  const canal = limpio(raw.MENSAJERO_CANAL) || null;
  const idioma = limpio(raw.RECORDATORIO_PAGO_IDIOMA) || 'es_MX';

  const plantillas = {
    antes: limpio(raw.RECORDATORIO_PAGO_PLANTILLA_ANTES),
    hoy: limpio(raw.RECORDATORIO_PAGO_PLANTILLA_HOY),
    despues: limpio(raw.RECORDATORIO_PAGO_PLANTILLA_DESPUES),
  };

  let etapas = parseEtapas(raw.RECORDATORIO_PAGO_ETAPAS);
  if (!etapas) {
    avisos.push(`RECORDATORIO_PAGO_ETAPAS inválido (ej. "-3,0,3"); se usan ${ETAPAS_DEFECTO.join(',')}`);
    etapas = [...ETAPAS_DEFECTO];
  }

  let hora = parseHora(raw.RECORDATORIO_PAGO_HORA);
  if (!hora) {
    avisos.push(`RECORDATORIO_PAGO_HORA inválida (formato HH:MM); se usa ${HORA_DEFECTO}`);
    hora = parseHora(HORA_DEFECTO);
  }

  const faltantes = [];
  if (!url) faltantes.push('MENSAJERO_URL');
  if (!apiKey) faltantes.push('MENSAJERO_API_KEY');
  // Solo se exigen las plantillas de las etapas configuradas.
  if (etapas.some((e) => e < 0) && !plantillas.antes) faltantes.push('RECORDATORIO_PAGO_PLANTILLA_ANTES');
  if (etapas.includes(0) && !plantillas.hoy) faltantes.push('RECORDATORIO_PAGO_PLANTILLA_HOY');
  if (etapas.some((e) => e > 0) && !plantillas.despues) faltantes.push('RECORDATORIO_PAGO_PLANTILLA_DESPUES');

  const envioDisponible = faltantes.length === 0;
  if (!envioDisponible) avisos.push(`Conexión con el mensajero sin configurar: faltan ${faltantes.join(', ')}`);
  if (!webhookSecret) avisos.push('MENSAJERO_WEBHOOK_SECRET no configurado: el webhook de estados responderá 503');

  return {
    url, apiKey, webhookSecret, canal, idioma, plantillas, etapas, hora,
    envioDisponible,
    webhookDisponible: Boolean(webhookSecret),
    avisos,
  };
}
