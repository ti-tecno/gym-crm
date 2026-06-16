import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import env from '../config/env.js';

function ensureKeys() {
  if (!env.JWT_PRIVATE_KEY || !env.JWT_PUBLIC_KEY) {
    throw new Error('Claves JWT no inicializadas. Ejecuta: npm run keys:gen');
  }
}

export function signAccessToken(payload) {
  ensureKeys();
  return jwt.sign(payload, env.JWT_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

export function signRefreshToken(payload) {
  ensureKeys();
  // refresh token "opaco" mas firmado: sub + jti (rotable)
  const jti = randomBytes(24).toString('hex');
  const token = jwt.sign({ ...payload, jti, kind: 'refresh' }, env.JWT_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: env.JWT_REFRESH_TTL,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  return { token, jti };
}

export function verifyAccessToken(token) {
  ensureKeys();
  return jwt.verify(token, env.JWT_PUBLIC_KEY, {
    algorithms: ['RS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

export function verifyRefreshToken(token) {
  const payload = verifyAccessToken(token);
  if (payload.kind !== 'refresh') throw new Error('Token no es refresh');
  return payload;
}

export function csrfTokenValue() {
  return randomBytes(24).toString('hex');
}
