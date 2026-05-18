import { verifyAccessToken } from '../services/jwt.service.js';
import { HttpError } from './errorHandler.js';

/** Autenticación obligatoria. Coloca req.user = { sub, email, rol }. */
export function requireAuth(req, _res, next) {
  const header = req.header('Authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return next(new HttpError(401, 'NO_TOKEN', 'Token requerido'));
  try {
    const payload = verifyAccessToken(m[1]);
    req.user = payload;
    next();
  } catch (err) {
    next(new HttpError(401, 'INVALID_TOKEN', 'Token inválido o expirado'));
  }
}

/** RBAC: requiere alguno de los roles indicados. */
export function requireRole(...roles) {
  const allow = new Set(roles);
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'NO_AUTH', 'No autenticado'));
    if (!allow.has(req.user.rol)) return next(new HttpError(403, 'FORBIDDEN', 'Sin permisos para esta acción'));
    next();
  };
}

/**
 * CSRF — double-submit cookie pattern.
 * El cliente lee la cookie `csrfToken` y envía el mismo valor en header `X-CSRF-Token`.
 */
export function requireCsrf(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.csrfToken;
  const headerToken = req.header('X-CSRF-Token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new HttpError(403, 'CSRF_FAIL', 'Validación CSRF fallida'));
  }
  next();
}
