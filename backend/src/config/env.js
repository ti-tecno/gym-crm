import dotenv from 'dotenv';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMensajeroConfig } from './mensajero.js';
import { parseMercadoPagoConfig } from './mercadoPago.js';
import { parseSeguridadConfig } from './seguridad.js';

// Resolve .env relative to this file (backend/.env), not process.cwd() —
// pm2/systemd may launch with a different working directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30_000),
  JSON_BODY_LIMIT: z.string().default('100kb'),

  TLS_KEY_PATH: z.string().optional(),
  TLS_CERT_PATH: z.string().optional(),

  CORS_ORIGINS: z.string().default('http://localhost:5173,https://www.iron-core.mx'),

  JWT_PRIVATE_KEY_PATH: z.string(),
  JWT_PUBLIC_KEY_PATH: z.string(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_ISSUER: z.string().default('ironcore-api'),
  JWT_AUDIENCE: z.string().default('ironcore-web'),

  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  COOKIE_DOMAIN: z.string().optional(),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  GOOGLE_CLIENT_ID: z.string().optional(),

  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  DYNAMODB_ENDPOINT: z.string().url().optional(),
  DYNAMODB_TABLE_PREFIX: z.string().default('gym_'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(5),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

// Resuelve claves (lazy — sólo si los archivos existen)
function readKey(p) {
  const abs = path.isAbsolute(p) ? p : path.resolve(__dirname, '../..', p);
  if (!fs.existsSync(abs)) {
    console.warn(`[env] Clave no encontrada: ${abs}. Ejecuta: npm run keys:gen`);
    return null;
  }
  return fs.readFileSync(abs, 'utf8');
}

env.JWT_PRIVATE_KEY = readKey(env.JWT_PRIVATE_KEY_PATH);
env.JWT_PUBLIC_KEY = readKey(env.JWT_PUBLIC_KEY_PATH);
env.CORS_ORIGIN_LIST = Array.from(new Set([
  ...env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  'https://www.iron-core.mx',
]));
env.IS_PROD = env.NODE_ENV === 'production';

// Recordatorio de pago por WhatsApp (SofIA Messenger API). Todas opcionales; se
// validan aparte para que una variable mal puesta apague la función en vez de
// impedir que el servidor arranque. Ver config/mensajero.js y docs/RECORDATORIO_PAGO.md:
//   MENSAJERO_URL, MENSAJERO_API_KEY, MENSAJERO_WEBHOOK_SECRET, MENSAJERO_CANAL,
//   RECORDATORIO_PAGO_PLANTILLA_ANTES / _HOY / _DESPUES, RECORDATORIO_PAGO_IDIOMA,
//   RECORDATORIO_PAGO_ETAPAS, RECORDATORIO_PAGO_HORA
// Son solo de conexión: el interruptor de envío está en gym_settings (Backoffice → Mensajería).
env.MENSAJERO = parseMensajeroConfig(process.env);

// Pago en línea con Mercado Pago (Checkout Pro). Todas opcionales, mismo criterio: si faltan,
// el pago en línea queda apagado con aviso. Ver config/mercadoPago.js y docs/PAGO_EN_LINEA.md:
//   MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET, PUBLIC_API_URL, PUBLIC_FRONTEND_URL,
//   MERCADOPAGO_STATEMENT_DESCRIPTOR
env.MERCADOPAGO = parseMercadoPagoConfig(process.env, { apiPrefix: env.API_PREFIX });

// Credenciales de Mercado Pago desde el Backoffice (cifradas) y código OTP por WhatsApp. Todas
// opcionales. Ver config/seguridad.js: CREDENCIALES_LLAVE_MAESTRA, OTP_PLANTILLA, OTP_IDIOMA
env.SEGURIDAD = parseSeguridadConfig(process.env);

export default env;
