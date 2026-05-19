import dotenv from 'dotenv';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(30_000),
  JSON_BODY_LIMIT: z.string().default('100kb'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

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
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  if (!fs.existsSync(abs)) {
    console.warn(`[env] Clave no encontrada: ${abs}. Ejecuta: npm run keys:gen`);
    return null;
  }
  return fs.readFileSync(abs, 'utf8');
}

env.JWT_PRIVATE_KEY = readKey(env.JWT_PRIVATE_KEY_PATH);
env.JWT_PUBLIC_KEY = readKey(env.JWT_PUBLIC_KEY_PATH);
env.CORS_ORIGIN_LIST = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
env.IS_PROD = env.NODE_ENV === 'production';

export default env;
