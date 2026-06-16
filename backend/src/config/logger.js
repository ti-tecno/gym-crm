import winston from 'winston';
import env from './env.js';

const SENSITIVE = ['password', 'token', 'authorization', 'cookie', 'refreshToken', 'accessToken', 'cardNumber', 'cvv', 'cvc'];

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    if (SENSITIVE.includes(k.toLowerCase())) out[k] = '[REDACTED]';
    else if (typeof obj[k] === 'object' && obj[k] !== null) out[k] = redact(obj[k]);
    else out[k] = obj[k];
  }
  return out;
}

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: !env.IS_PROD }),
    winston.format.printf(({ timestamp, level, message, ...rest }) => {
      const meta = redact(rest);
      return JSON.stringify({ timestamp, level, message, ...meta });
    }),
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
