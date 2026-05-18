import env from '../config/env.js';
import logger from '../config/logger.js';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export default function errorHandler(err, req, res, _next) {
  const reqId = req.id;

  if (err instanceof ZodError) {
    logger.warn('Validación fallida', { reqId, issues: err.flatten() });
    return res.status(400).json({
      error: 'Datos inválidos',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
      requestId: reqId,
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
      details: err.details,
      requestId: reqId,
    });
  }

  if (err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({ error: 'CORS bloqueado', code: 'CORS_BLOCKED', requestId: reqId });
  }

  logger.error('Error no controlado', { reqId, message: err.message, stack: env.IS_PROD ? undefined : err.stack });
  res.status(500).json({
    error: env.IS_PROD ? 'Error interno' : err.message,
    code: 'INTERNAL_ERROR',
    requestId: reqId,
  });
}
