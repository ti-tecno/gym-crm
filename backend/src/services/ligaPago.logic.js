/**
 * Liga pública de pago: https://iron-core.mx/pagar/<token> (lógica pura, sin BD ni env).
 *
 * El token identifica al cliente sin iniciar sesión y sin índices nuevos: lleva el clienteId
 * (para leerlo por su llave primaria) y una fecha de expiración, firmados con HMAC-SHA256 y
 * un secreto del servidor (LIGA_PAGO_SECRET). Es seguro para URL (base64url, 47 caracteres).
 *
 *   bytes: [versión 1][clienteId 16][expira 2 (días desde 1970, UTC)][firma 16]
 *
 * La expiración se cuenta desde el vencimiento (o desde hoy si ya pasó) más DIAS_VIGENCIA_LIGA,
 * así la misma liga sirve durante toda la secuencia de recordatorios de ese vencimiento.
 */
import crypto from 'node:crypto';
import { diferenciaDias, sumarDias } from './recordatorioPago.logic.js';

export const DIAS_VIGENCIA_LIGA = 75;   // > etapa máxima permitida (60) + margen
export const SECRETO_MINIMO = 32;
const VERSION = 1;
const LARGO = 1 + 16 + 2 + 16;
const CONTEXTO = Buffer.from('ironcore:liga-pago:v1|');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const FORMATO_TOKEN = /^[A-Za-z0-9_-]{47}$/;

const diaNumero = (iso) => diferenciaDias('1970-01-01', iso);
const firmar = (datos, secret) => crypto.createHmac('sha256', secret).update(Buffer.concat([CONTEXTO, datos])).digest().subarray(0, 16);

/** Día (yyyy-mm-dd) hasta el que sirve una liga creada hoy para ese vencimiento. */
export function expiracionLiga(vencimiento, hoy) {
  const desde = vencimiento && vencimiento > hoy ? vencimiento : hoy;
  return sumarDias(desde, DIAS_VIGENCIA_LIGA);
}

/** Token de la liga, o null si el clienteId no es un uuid o falta el secreto. */
export function crearTokenLiga(clienteId, expira, secret) {
  if (!secret || typeof clienteId !== 'string' || !UUID.test(clienteId)) return null;
  const exp = diaNumero(expira);
  if (!(exp > 0 && exp < 65_536)) return null;
  const datos = Buffer.alloc(1 + 16 + 2);
  datos.writeUInt8(VERSION, 0);
  Buffer.from(clienteId.replace(/-/g, ''), 'hex').copy(datos, 1);
  datos.writeUInt16BE(exp, 17);
  return Buffer.concat([datos, firmar(datos, secret)]).toString('base64url');
}

/** clienteId si el token es auténtico y no ha expirado en `hoy`; si no, null (sin decir por qué). */
export function verificarTokenLiga(token, secret, hoy) {
  if (!secret || typeof token !== 'string' || !FORMATO_TOKEN.test(token)) return null;
  const buf = Buffer.from(token, 'base64url');
  if (buf.length !== LARGO || buf.readUInt8(0) !== VERSION) return null;
  const datos = buf.subarray(0, 19);
  const firma = buf.subarray(19);
  if (!crypto.timingSafeEqual(firma, firmar(datos, secret))) return null;
  if (datos.readUInt16BE(17) < diaNumero(hoy)) return null;
  const h = datos.subarray(1, 17).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
