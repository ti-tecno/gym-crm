import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { requireAuth, requireCsrf } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.schema.js';
import { login, logout, me, refresh, register } from '../controllers/auth.controller.js';

// Rate limit más holgado para registro (3 / hora por IP) que para login
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados registros desde esta IP, intenta en 1 hora.' },
});

const router = Router();
router.post('/login',    authLimiter,     validate({ body: loginSchema }),    login);
router.post('/register', registerLimiter, validate({ body: registerSchema }), register);
router.post('/refresh',  authLimiter, refresh);
router.post('/logout',   requireAuth, requireCsrf, logout);
router.get('/me',        requireAuth, me);
export default router;
