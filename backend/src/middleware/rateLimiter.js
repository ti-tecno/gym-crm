import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intenta más tarde' },
});

// Rate-limit estricto en login/refresh
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos. Cuenta temporalmente bloqueada.' },
});

// Bucket separado de authLimiter: evita que intentos fallidos de Google agoten
// el límite de login por contraseña de la misma cuenta, y viceversa.
export const googleAuthLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de inicio de sesión con Google.' },
});

// Liga pública de pago (/publico/pagar/...): sin sesión, bucket propio y estricto por IP.
// Alcanza para abrir la liga, pagar y que la página de resultado consulte el estado unas veces.
export const ligaPagoLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intenta más tarde', code: 'RATE_LIMIT' },
});

// Webhook del mensajero (servidor a servidor, autenticado por firma). Bucket propio y más
// amplio para que una ráfaga de estados no choque con el límite global de la IP.
export const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones al webhook' },
});
