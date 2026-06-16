import { v4 as uuid } from 'uuid';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { HttpError } from '../middleware/errorHandler.js';
import { createUser, getUserByEmail, getUserById, incrementFailedAttempts, lockUser, resetFailedAttempts } from '../repositories/users.repo.js';
import { createCliente, getClienteByEmail } from '../repositories/clientes.repo.js';
import { getRefresh, revokeRefresh, saveRefresh } from '../repositories/refreshTokens.repo.js';
import { hashPassword, verifyPassword } from '../services/password.service.js';
import { csrfTokenValue, signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/jwt.service.js';

const PLAN_PRECIO = { 'Básico': 450, 'Premium': 850, 'Elite': 1200 };

const REFRESH_COOKIE = 'refreshToken';
const CSRF_COOKIE = 'csrfToken';
const MAX_FAILED = 5;
const LOCK_MIN = 15;

function setAuthCookies(res, refreshToken, csrf) {
  const base = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
  };
  // Refresh: httpOnly (no accesible a JS) → previene XSS robe el token
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
  // CSRF: NO httpOnly (el cliente lo lee para reenviarlo en X-CSRF-Token)
  res.cookie(CSRF_COOKIE, csrf, { ...base, httpOnly: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res) {
  const base = { path: '/', domain: env.COOKIE_DOMAIN || undefined };
  res.clearCookie(REFRESH_COOKIE, base);
  res.clearCookie(CSRF_COOKIE, base);
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);

    // Mensaje genérico para no filtrar existencia del usuario
    const invalid = () => next(new HttpError(401, 'INVALID_CREDENTIALS', 'Credenciales inválidas'));
    if (!user) return invalid();

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return next(new HttpError(423, 'ACCOUNT_LOCKED', 'Cuenta bloqueada temporalmente. Intenta más tarde.'));
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await incrementFailedAttempts(user.userId);
      const attempts = (user.failedAttempts || 0) + 1;
      if (attempts >= MAX_FAILED) {
        const until = new Date(Date.now() + LOCK_MIN * 60_000).toISOString();
        await lockUser(user.userId, until);
        logger.warn('Bloqueo de cuenta', { userId: user.userId, until });
      }
      return invalid();
    }

    await resetFailedAttempts(user.userId);

    const accessToken = signAccessToken({ sub: user.userId, email: user.email, rol: user.rol, cid: user.clienteId });
    const { token: refreshToken, jti } = signRefreshToken({ sub: user.userId });
    await saveRefresh({ jti, userId: user.userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });

    const csrf = csrfTokenValue();
    setAuthCookies(res, refreshToken, csrf);

    res.json({
      accessToken,
      user: { id: user.userId, email: user.email, nombre: user.nombre, rol: user.rol, clienteId: user.clienteId || null },
      csrfToken: csrf,
    });
  } catch (err) { next(err); }
}

/** Auto-registro de CLIENTE. Crea User + Cliente vinculados y devuelve sesión activa. */
export async function register(req, res, next) {
  try {
    const { nombre, apellido, email, telefono, password, plan } = req.body;

    if (await getUserByEmail(email)) {
      return next(new HttpError(409, 'EMAIL_TAKEN', 'Ese email ya está registrado'));
    }
    if (await getClienteByEmail(email)) {
      return next(new HttpError(409, 'EMAIL_TAKEN', 'Ese email ya está registrado como cliente'));
    }

    // 1) Crea el registro Cliente
    const today = new Date();
    const venc = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const cliente = await createCliente({
      nombre: apellido ? `${nombre} ${apellido}` : nombre,
      email, telefono,
      plan,
      monto: PLAN_PRECIO[plan],
      vencimiento: venc.toISOString().slice(0, 10),
      estado: 'Por vencer', // auto-aprobado pero pendiente de pago inicial
      autoRegistrado: true,
    });

    // 2) Crea el User con rol CLIENTE vinculado al Cliente
    const passwordHash = await hashPassword(password);
    const user = await createUser({
      userId: uuid(),
      email, nombre: cliente.nombre, rol: 'CLIENTE',
      passwordHash, failedAttempts: 0, clienteId: cliente.clienteId,
      createdAt: new Date().toISOString(),
    });

    logger.info('Cliente auto-registrado', { reqId: req.id, userId: user.userId, clienteId: cliente.clienteId });

    // 3) Emite sesión inmediata
    const accessToken = signAccessToken({ sub: user.userId, email: user.email, rol: user.rol, cid: cliente.clienteId });
    const { token: refreshToken, jti } = signRefreshToken({ sub: user.userId });
    await saveRefresh({ jti, userId: user.userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    const csrf = csrfTokenValue();
    setAuthCookies(res, refreshToken, csrf);

    res.status(201).json({
      accessToken,
      user: { id: user.userId, email: user.email, nombre: user.nombre, rol: user.rol, clienteId: cliente.clienteId },
      csrfToken: csrf,
    });
  } catch (err) { next(err); }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return next(new HttpError(401, 'NO_REFRESH', 'Sin refresh token'));

    let payload;
    try { payload = verifyRefreshToken(token); }
    catch { return next(new HttpError(401, 'INVALID_REFRESH', 'Refresh inválido')); }

    const stored = await getRefresh(payload.jti);
    if (!stored || stored.userId !== payload.sub) {
      return next(new HttpError(401, 'REFRESH_REVOKED', 'Refresh revocado'));
    }

    // Rotación: invalidamos el anterior y emitimos uno nuevo
    await revokeRefresh(payload.jti);

    const user = await getUserById(payload.sub);
    if (!user) return next(new HttpError(401, 'NO_USER', 'Usuario inexistente'));

    const accessToken = signAccessToken({ sub: user.userId, email: user.email, rol: user.rol });
    const { token: newRefresh, jti: newJti } = signRefreshToken({ sub: user.userId });
    await saveRefresh({ jti: newJti, userId: user.userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });

    const csrf = csrfTokenValue();
    setAuthCookies(res, newRefresh, csrf);

    res.json({ accessToken, csrfToken: csrf });
  } catch (err) { next(err); }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try { const p = verifyRefreshToken(token); await revokeRefresh(p.jti); } catch { /* noop */ }
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function me(req, res, next) {
  try {
    const user = await getUserById(req.user.sub);
    if (!user) return next(new HttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado'));
    res.json({
      id: user.userId,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      clienteId: user.clienteId || null,
    });
  } catch (err) { next(err); }
}
