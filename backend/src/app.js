import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import env from './config/env.js';
import logger from './config/logger.js';
import requestId from './middleware/requestId.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';
import routes from './routes/index.js';

const app = express();

// Trust proxy 1 hop (config infra ajustable)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Helmet (CSP estricta, HSTS, frameguard, nosniff…)
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // inline para estilos React de referencia
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", ...env.CORS_ORIGIN_LIST],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: env.IS_PROD ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: env.IS_PROD ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
  frameguard: { action: 'deny' },
  noSniff: true,
}));

// ── CORS con whitelist
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // tools como curl
    if (env.CORS_ORIGIN_LIST.includes(origin)) return cb(null, true);
    return cb(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
}));

app.use(compression());
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: env.JSON_BODY_LIMIT }));
app.use(cookieParser());
app.use(hpp());           // contra HTTP parameter pollution
app.use(requestId);       // X-Request-Id por petición
app.use(generalLimiter);  // rate limit global

// Acceso log mínimo
app.use((req, _res, next) => {
  logger.debug('http', { id: req.id, m: req.method, u: req.originalUrl, ip: req.ip });
  next();
});

// Health (info mínima)
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Rutas
app.use(env.API_PREFIX, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
