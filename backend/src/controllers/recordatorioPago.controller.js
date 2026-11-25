import env from '../config/env.js';
import logger from '../config/logger.js';
import { HttpError } from '../middleware/errorHandler.js';
import { recordatorioPago } from '../services/recordatorioPago.js';
import { ErrorRecordatorio } from '../services/recordatorioPago.service.js';
import { verificarFirma } from '../services/mensajero.client.js';

const aHttp = (e) => (e instanceof ErrorRecordatorio ? new HttpError(e.status, e.code, e.message, e.details) : e);

/** GET /recordatorios/pago — lista calculada desde los vencimientos reales. */
export async function listado(_req, res, next) {
  try { res.json(await recordatorioPago.listado()); } catch (e) { next(aHttp(e)); }
}

/** POST /recordatorios/pago/:clienteId/enviar — envío manual (recepción / admin). */
export async function enviar(req, res, next) {
  try {
    const usuario = req.user?.email || req.user?.sub || null;
    const r = await recordatorioPago.enviarManual(req.params.clienteId, usuario);
    logger.info('Recordatorio de pago enviado manualmente', { clienteId: req.params.clienteId, por: usuario, resultado: r.resultado });
    res.json(r);
  } catch (e) { next(aHttp(e)); }
}

/**
 * POST /webhooks/mensajero — `message.status` del mensajero. Sin JWT ni CSRF: lo autentica
 * la firma X-Signature-256 sobre el cuerpo crudo (capturado en app.js).
 */
export async function webhook(req, res, next) {
  try {
    if (!env.MENSAJERO.webhookDisponible) {
      return next(new HttpError(503, 'WEBHOOK_NO_CONFIGURADO', 'Webhook del mensajero sin configurar'));
    }
    if (!verificarFirma(req.rawBody, req.get('X-Signature-256'), env.MENSAJERO.webhookSecret)) {
      logger.warn('Webhook del mensajero con firma inválida', { reqId: req.id, ip: req.ip });
      return next(new HttpError(401, 'FIRMA_INVALIDA', 'Firma inválida'));
    }
    const r = await recordatorioPago.procesarWebhook(req.body);
    logger.debug('Webhook del mensajero', { reqId: req.id, ...r });
    res.json({ ok: true });
  } catch (e) { next(e); }
}
