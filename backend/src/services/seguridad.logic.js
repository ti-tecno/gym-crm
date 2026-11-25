/**
 * Lógica pura de la sección "Mercado Pago" del Backoffice: teléfono del administrador, código de
 * un solo uso (OTP), formato de credenciales y resolución de la configuración de Mercado Pago.
 * Sin BD, sin red, sin env: todo lo que depende del reloj recibe `now`.
 */
import crypto from 'node:crypto';
import { parseMercadoPagoConfig, RUTA_WEBHOOK_MERCADOPAGO } from '../config/mercadoPago.js';
import { descifrar, explicarErrorCifrado } from './cifrado.logic.js';

// ── Teléfono del administrador ───────────────────────────────────────────────

/**
 * Celular mexicano de WhatsApp → "+52XXXXXXXXXX", o null. Acepta 10 dígitos, 52 + 10 o 521 + 10,
 * con espacios, guiones, paréntesis o "+". La lada no empieza con 0 ni 1.
 */
export function normalizarCelularMx(valor) {
  if (typeof valor !== 'string') return null;
  let d = valor.replace(/[\s().-]/g, '');
  if (!/^\+?\d{10,13}$/.test(d)) return null;
  d = d.replace(/^\+/, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  else if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  if (!/^[2-9]\d{9}$/.test(d)) return null;
  return `+52${d}`;
}

/** "+525512345678" → "+52 •••••• 5678". Nunca devuelve el número completo. */
export function enmascararTelefono(e164) {
  if (typeof e164 !== 'string' || e164.length < 4) return null;
  return `+52 •••••• ${e164.slice(-4)}`;
}

/** Lo que espera el mensajero en `to`: solo dígitos con lada de país. */
export const telefonoParaMensajero = (e164) => e164.replace(/^\+/, '');

// ── Credenciales de Mercado Pago ─────────────────────────────────────────────

export const CONTEXTO_TOKEN = 'mercadoPago.accessToken';
export const CONTEXTO_SECRETO = 'mercadoPago.webhookSecret';

export const ultimos4 = (s) => (typeof s === 'string' && s.length >= 8 ? s.slice(-4) : null);

/**
 * Validación de FORMATO solamente (no se llama a Mercado Pago). Devuelve la lista de problemas
 * (vacía = bien). Los mensajes nunca incluyen el valor capturado.
 */
export function validarCredenciales({ accessToken, webhookSecret }) {
  const errores = {};
  const t = typeof accessToken === 'string' ? accessToken.trim() : '';
  const s = typeof webhookSecret === 'string' ? webhookSecret.trim() : '';
  if (!/^(APP_USR|TEST)-[A-Za-z0-9_-]{20,300}$/.test(t)) {
    errores.accessToken = 'El Access Token debe empezar con APP_USR- (producción) o TEST- (prueba), sin espacios, como aparece en Tus integraciones → Credenciales';
  }
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(s)) {
    errores.webhookSecret = 'La clave secreta de webhooks debe tener al menos 16 letras o números, sin espacios, como aparece en Tus integraciones → Webhooks';
  }
  return { ok: Object.keys(errores).length === 0, errores, accessToken: t, webhookSecret: s };
}

const CAMPOS_ENTORNO_MP = ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET', 'PUBLIC_API_URL', 'PUBLIC_FRONTEND_URL', 'MERCADOPAGO_STATEMENT_DESCRIPTOR'];

/**
 * Configuración de Mercado Pago con la misma forma que parseMercadoPagoConfig, más `origen`
 * ('backoffice' | 'entorno' | 'ninguno') e `ilegible`. Prioridad: lo guardado en el Backoffice;
 * si no hay nada guardado, las variables de entorno. Si lo guardado no se puede descifrar NO se
 * cae a las de entorno: queda "no configurado" con aviso (mejor apagado que con otra cuenta).
 * Las URLs públicas y el descriptor siempre salen del entorno.
 */
export function resolverConfigMercadoPago({ guardado, envRaw = {}, llave, apiPrefix = '/api/v1' }) {
  const base = {};
  for (const k of CAMPOS_ENTORNO_MP) base[k] = envRaw[k];
  const mp = guardado?.mercadoPago;
  if (mp && (mp.accessTokenCifrado || mp.webhookSecretCifrado)) {
    try {
      const accessToken = descifrar(mp.accessTokenCifrado, llave, CONTEXTO_TOKEN);
      const webhookSecret = descifrar(mp.webhookSecretCifrado, llave, CONTEXTO_SECRETO);
      const cfg = parseMercadoPagoConfig({ ...base, MERCADOPAGO_ACCESS_TOKEN: accessToken, MERCADOPAGO_WEBHOOK_SECRET: webhookSecret }, { apiPrefix });
      return { ...cfg, origen: 'backoffice', ilegible: false };
    } catch (e) {
      const cfg = parseMercadoPagoConfig({ ...base, MERCADOPAGO_ACCESS_TOKEN: '', MERCADOPAGO_WEBHOOK_SECRET: '' }, { apiPrefix });
      return { ...cfg, origen: 'backoffice', ilegible: true, motivoIlegible: e?.code || 'DESCONOCIDO', avisos: [explicarErrorCifrado(e), ...cfg.avisos] };
    }
  }
  const cfg = parseMercadoPagoConfig(base, { apiPrefix });
  return { ...cfg, origen: cfg.accessToken || cfg.webhookSecret ? 'entorno' : 'ninguno', ilegible: false };
}

/** Configuración "apagada" cuando ni siquiera se pudo leer gym_settings (nunca lanza). */
export function configMercadoPagoNoDisponible({ envRaw = {}, apiPrefix = '/api/v1' } = {}) {
  const base = {};
  for (const k of CAMPOS_ENTORNO_MP) base[k] = envRaw[k];
  const cfg = parseMercadoPagoConfig({ ...base, MERCADOPAGO_ACCESS_TOKEN: '', MERCADOPAGO_WEBHOOK_SECRET: '' }, { apiPrefix });
  return { ...cfg, origen: 'ninguno', ilegible: false, avisos: ['No se pudo leer la configuración de Mercado Pago (base de datos); se reintenta en la siguiente operación', ...cfg.avisos] };
}

/** URL que hay que pegar en Tus integraciones → Webhooks (sin el query de la preferencia). */
export function urlWebhookMercadoPago(cfg, apiPrefix = '/api/v1') {
  return cfg?.apiUrl ? `${cfg.apiUrl}${apiPrefix}${RUTA_WEBHOOK_MERCADOPAGO}` : null;
}

// ── Código de un solo uso (OTP) ──────────────────────────────────────────────

export const OTP = {
  DIGITOS: 6,
  VIGENCIA_MS: 10 * 60_000,
  MAX_INTENTOS: 5,
  REENVIO_MS: 60_000,
  MAX_POR_HORA: 5,
  HORA_MS: 60 * 60_000,
};

/** Qué autoriza cada código. Un código solo sirve para su acción, su usuario y su destino. */
export const ACCION = {
  MP_GUARDAR: 'mp_guardar',
  MP_BORRAR: 'mp_borrar',
  TELEFONO_CAMBIAR: 'telefono_cambiar',     // al número actual, para poder cambiarlo
  TELEFONO_CONFIRMAR: 'telefono_confirmar', // al número nuevo, para confirmarlo
};

export const ETIQUETA_ACCION = {
  [ACCION.MP_GUARDAR]: 'guardar las credenciales de Mercado Pago',
  [ACCION.MP_BORRAR]: 'borrar las credenciales de Mercado Pago',
  [ACCION.TELEFONO_CAMBIAR]: 'cambiar el teléfono del administrador',
  [ACCION.TELEFONO_CONFIRMAR]: 'confirmar el teléfono del administrador',
};

/** 6 dígitos con azar criptográfico (distribución uniforme). */
export function generarCodigoOtp() {
  return String(crypto.randomInt(0, 10 ** OTP.DIGITOS)).padStart(OTP.DIGITOS, '0');
}

/**
 * HMAC-SHA256 con una "pimienta" del servidor (no guardada en la BD) y una sal por código. Liga
 * el código a usuario, acción y destino: el mismo número no sirve para otra cosa.
 */
export function hashOtp({ codigo, sal, pimienta, userId, accion, destino }) {
  return crypto.createHmac('sha256', pimienta)
    .update([sal, userId, accion, destino || '', codigo].join('|'))
    .digest('hex');
}

export function igualesTiempoConstante(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  // Largos distintos: se compara igual contra sí mismo para no acortar el tiempo.
  if (x.length !== y.length) { crypto.timingSafeEqual(x, x); return false; }
  return crypto.timingSafeEqual(x, y);
}

/** Solicitudes de la última hora (para el tope por hora). */
export function solicitudesRecientes(registro, now) {
  const desde = now.getTime() - OTP.HORA_MS;
  return (Array.isArray(registro?.solicitudes) ? registro.solicitudes : [])
    .filter((iso) => typeof iso === 'string' && Date.parse(iso) > desde);
}

/** ¿Tiene un código vigente sin usar? */
export function codigoVigente(registro, now) {
  return registro?.estado === 'pendiente' && Boolean(registro.hash) && Date.parse(registro.expiraAt) > now.getTime();
}

/**
 * ¿Se puede pedir un código ahora? null = sí; si no, { code, message, esperaSeg }.
 * El reenvío por minuto solo aplica mientras hay un código vigente (tras usar uno, el siguiente
 * paso del flujo puede pedir otro de inmediato); el tope por hora cuenta todas las solicitudes.
 */
export function evaluarLimites(registro, now, { ignorarReenvio = false } = {}) {
  const recientes = solicitudesRecientes(registro, now);
  if (recientes.length >= OTP.MAX_POR_HORA) {
    const masVieja = Math.min(...recientes.map((iso) => Date.parse(iso)));
    const esperaSeg = Math.max(1, Math.ceil((masVieja + OTP.HORA_MS - now.getTime()) / 1000));
    return { code: 'LIMITE_POR_HORA', message: `Se alcanzó el máximo de ${OTP.MAX_POR_HORA} códigos por hora. Intenta de nuevo en ${Math.ceil(esperaSeg / 60)} minuto(s).`, esperaSeg };
  }
  if (!ignorarReenvio && codigoVigente(registro, now) && registro.ultimoEnvioAt) {
    const listo = Date.parse(registro.ultimoEnvioAt) + OTP.REENVIO_MS;
    if (listo > now.getTime()) {
      const esperaSeg = Math.ceil((listo - now.getTime()) / 1000);
      return { code: 'REENVIO_PRONTO', message: `Espera ${esperaSeg} segundo(s) para pedir otro código.`, esperaSeg };
    }
  }
  return null;
}

/**
 * Decide qué pasa con un código capturado. No escribe nada.
 * resultado: ok | incorrecto | sin_codigo | usado | agotado | expirado | otra_accion | otro_destino | otro_usuario
 */
export function evaluarVerificacion(registro, { codigo, userId, accion, destino, pimienta, now }) {
  if (!registro || !['pendiente', 'usado', 'agotado'].includes(registro.estado)) return { resultado: 'sin_codigo' };
  if (registro.userId !== userId) return { resultado: 'otro_usuario' };
  if (registro.estado === 'usado') return { resultado: 'usado' };
  if (registro.estado === 'agotado') return { resultado: 'agotado' };
  if (registro.accion !== accion) return { resultado: 'otra_accion' };
  if ((registro.destino || '') !== (destino || '')) return { resultado: 'otro_destino' };
  if (!(Date.parse(registro.expiraAt) > now.getTime())) return { resultado: 'expirado' };
  const intentos = Number(registro.intentos) || 0;
  if (intentos >= OTP.MAX_INTENTOS) return { resultado: 'agotado' };
  const esperado = hashOtp({ codigo: String(codigo ?? ''), sal: registro.sal, pimienta, userId, accion, destino });
  if (igualesTiempoConstante(esperado, registro.hash || '')) return { resultado: 'ok' };
  const restantes = OTP.MAX_INTENTOS - (intentos + 1);
  return { resultado: 'incorrecto', intentos: intentos + 1, intentosRestantes: Math.max(0, restantes) };
}

export const MENSAJE_VERIFICACION = {
  sin_codigo: 'No hay un código pendiente para esta operación. Pide uno nuevo.',
  otro_usuario: 'No hay un código pendiente para esta operación. Pide uno nuevo.',
  usado: 'Ese código ya se usó. Pide uno nuevo.',
  agotado: 'Se agotaron los intentos de ese código. Pide uno nuevo.',
  expirado: 'El código expiró (vale 10 minutos). Pide uno nuevo.',
  otra_accion: 'Ese código se pidió para otra operación. Pide uno para esta.',
  otro_destino: 'Ese código se envió a otro número. Pide uno nuevo.',
};

// ── Entrega por el mensajero ─────────────────────────────────────────────────

// Códigos de Meta de plantilla inexistente, no aprobada o con parámetros que no cuadran.
const CODIGOS_PLANTILLA = new Set([132000, 132001, 132005, 132007, 132012, 132015, 132016]);

/**
 * Resultado de mensajero.enviarPlantilla → null si salió, o { status, code, message } para la
 * pantalla. Los mensajes son para una persona; no incluyen el código ni el teléfono completo.
 */
export function errorDeEntrega(r, { plantilla } = {}) {
  if (r && r.estado !== 'Fallido' && ['enviado', 'duplicado'].includes(r.resultado)) return null;
  switch (r?.resultado) {
    case 'servicio_inactivo':
      return { status: 503, code: 'MENSAJERIA_INACTIVA', message: 'El servicio de WhatsApp de IronCore no está activado por SofIA, así que no se pudo enviar el código. Pide a SofIA que lo active e inténtalo de nuevo.' };
    case 'telefono_invalido':
      return { status: 422, code: 'TELEFONO_SIN_WHATSAPP', message: 'El número no es un número de WhatsApp válido. Revísalo.' };
    case 'no_permitido':
      return { status: 503, code: 'MENSAJERO_SANDBOX', message: 'El mensajero está en modo de prueba y este número no está en su lista de números permitidos. Pide a SofIA que lo agregue.' };
    case 'limite_diario':
      return { status: 503, code: 'LIMITE_MENSAJERO', message: 'El mensajero alcanzó su límite diario de mensajes. Inténtalo mañana o pide a SofIA que lo amplíe.' };
    case 'envio_fallido':
    case 'duplicado':
      if (CODIGOS_PLANTILLA.has(r.codigoMeta)) {
        return { status: 503, code: 'PLANTILLA_NO_APROBADA', message: `La plantilla de WhatsApp del código${plantilla ? ` (${plantilla})` : ''} todavía no está aprobada por Meta o no existe. No se pudo enviar el código; inténtalo cuando esté aprobada.` };
      }
      if (r.codigoMeta === 131026) {
        return { status: 422, code: 'TELEFONO_SIN_WHATSAPP', message: 'El número no tiene WhatsApp o no pudo recibir el mensaje. Revísalo.' };
      }
      return { status: 502, code: 'ENVIO_FALLIDO', message: `WhatsApp no aceptó el código${r.motivo ? `: ${r.motivo}` : ''}. Inténtalo de nuevo en un momento.` };
    default:
      if (r?.httpStatus === 401) return { status: 503, code: 'MENSAJERO_LLAVE_INVALIDA', message: 'La llave del mensajero (MENSAJERO_API_KEY) no es válida: no se pudo enviar el código.' };
      if (r?.httpStatus == null) return { status: 503, code: 'MENSAJERO_SIN_CONEXION', message: 'No se pudo contactar al servicio de WhatsApp. Inténtalo de nuevo en un momento.' };
      return { status: 502, code: 'ERROR_MENSAJERO', message: `El servicio de WhatsApp respondió con un error (${r.httpStatus}). Inténtalo de nuevo en un momento.` };
  }
}
