/**
 * Cifrado autenticado (AES-256-GCM) de secretos guardados en gym_settings.
 *
 * Formato: "v1.<idLlave>.<iv>.<tag>.<cifrado>" (base64url). El `contexto` (p. ej.
 * "mercadoPago.accessToken") va como dato asociado (AAD): un valor cifrado no se puede mover a
 * otro campo. Los errores nunca incluyen el texto en claro ni el cifrado.
 */
import crypto from 'node:crypto';
import { idDeLlave } from '../config/seguridad.js';

const VERSION = 'v1';
const ALGORITMO = 'aes-256-gcm';

export class ErrorCifrado extends Error {
  /** code: SIN_LLAVE | LLAVE_DISTINTA | DATO_ALTERADO | FORMATO */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const b64u = (buf) => buf.toString('base64url');
const aad = (contexto) => Buffer.from(`ironcore:${contexto}`, 'utf8');

export function cifrar(texto, llave, contexto) {
  if (!Buffer.isBuffer(llave) || llave.length !== 32) throw new ErrorCifrado('SIN_LLAVE', 'Falta la llave maestra');
  if (typeof texto !== 'string') throw new ErrorCifrado('FORMATO', 'Solo se cifra texto');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGORITMO, llave, iv);
  c.setAAD(aad(contexto));
  const cifrado = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [VERSION, idDeLlave(llave), b64u(iv), b64u(c.getAuthTag()), b64u(cifrado)].join('.');
}

export function descifrar(valor, llave, contexto) {
  const partes = typeof valor === 'string' ? valor.split('.') : [];
  if (partes.length !== 5 || partes[0] !== VERSION) throw new ErrorCifrado('FORMATO', 'El dato cifrado no tiene un formato reconocible');
  if (!Buffer.isBuffer(llave) || llave.length !== 32) throw new ErrorCifrado('SIN_LLAVE', 'Falta la llave maestra');
  if (partes[1] !== idDeLlave(llave)) throw new ErrorCifrado('LLAVE_DISTINTA', 'El dato se cifró con otra llave maestra');
  try {
    const iv = Buffer.from(partes[2], 'base64url');
    const tag = Buffer.from(partes[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) throw new Error('largo');
    const d = crypto.createDecipheriv(ALGORITMO, llave, iv);
    d.setAAD(aad(contexto));
    d.setAuthTag(tag);
    return Buffer.concat([d.update(Buffer.from(partes[4], 'base64url')), d.final()]).toString('utf8');
  } catch {
    throw new ErrorCifrado('DATO_ALTERADO', 'El dato cifrado está alterado o dañado');
  }
}

/** Explicación para el administrador (sin datos sensibles). */
export function explicarErrorCifrado(e) {
  switch (e?.code) {
    case 'SIN_LLAVE': return 'Hay credenciales de Mercado Pago guardadas en el Backoffice, pero falta CREDENCIALES_LLAVE_MAESTRA en el servidor: no se pueden leer.';
    case 'LLAVE_DISTINTA': return 'Las credenciales de Mercado Pago guardadas en el Backoffice se cifraron con otra llave maestra (¿se cambió CREDENCIALES_LLAVE_MAESTRA?): no se pueden leer. Bórralas y vuelve a capturarlas.';
    case 'DATO_ALTERADO': return 'Las credenciales de Mercado Pago guardadas en el Backoffice están alteradas o dañadas: no se pueden leer. Bórralas y vuelve a capturarlas.';
    default: return 'Las credenciales de Mercado Pago guardadas en el Backoffice no se pueden leer. Bórralas y vuelve a capturarlas.';
  }
}
