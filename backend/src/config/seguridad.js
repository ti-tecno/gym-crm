/**
 * Configuración de las credenciales de Mercado Pago guardadas desde el Backoffice y del código
 * de un solo uso (OTP) por WhatsApp que las protege.
 *
 * Función pura, mismo criterio que config/mensajero.js y config/mercadoPago.js: TODAS las
 * variables son opcionales y una mal puesta nunca tumba el servidor; solo apaga la función con
 * un aviso.
 *
 *   CREDENCIALES_LLAVE_MAESTRA  llave AES-256 (32 bytes) en base64 (44 caracteres) o hex (64).
 *                               Cifra en reposo las credenciales guardadas desde el Backoffice.
 *                               Sin ella no se pueden guardar (las de variables de entorno siguen
 *                               funcionando). Si se pierde o se cambia, las guardadas quedan ilegibles.
 *   OTP_PLANTILLA               plantilla de autenticación de Meta (por defecto ironcore_codigo_verificacion)
 *   OTP_IDIOMA                  idioma de esa plantilla (por defecto es_MX)
 */
import crypto from 'node:crypto';

const limpio = (v) => (typeof v === 'string' ? v.trim() : '');

/** Identificador corto y no reversible de una llave: sirve para distinguir "llave cambiada" de "dato alterado". */
export function idDeLlave(llave) {
  return crypto.createHash('sha256').update('ironcore-llave-id|').update(llave).digest('hex').slice(0, 8);
}

export function parseLlaveMaestra(valor) {
  const v = limpio(valor);
  if (!v) {
    return {
      llave: null, llaveId: null,
      aviso: 'Falta CREDENCIALES_LLAVE_MAESTRA en el servidor: no se pueden guardar credenciales desde el Backoffice',
    };
  }
  let buf = null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) buf = Buffer.from(v, 'hex');
  else if (/^[A-Za-z0-9+/_-]{43}=?$/.test(v)) buf = Buffer.from(v, 'base64');
  if (!buf || buf.length !== 32) {
    return {
      llave: null, llaveId: null,
      aviso: 'CREDENCIALES_LLAVE_MAESTRA no es válida (debe ser de 32 bytes: 44 caracteres base64 o 64 hex); se ignora',
    };
  }
  return { llave: buf, llaveId: idDeLlave(buf), aviso: null };
}

export function parseSeguridadConfig(raw = {}) {
  const { llave, llaveId, aviso } = parseLlaveMaestra(raw.CREDENCIALES_LLAVE_MAESTRA);
  return {
    llave,
    llaveId,
    llaveDisponible: Boolean(llave),
    avisoLlave: aviso,
    otpPlantilla: limpio(raw.OTP_PLANTILLA) || 'ironcore_codigo_verificacion',
    otpIdioma: limpio(raw.OTP_IDIOMA) || 'es_MX',
  };
}
