import env from '../config/env.js';
import logger from '../config/logger.js';
import { HttpError } from '../middleware/errorHandler.js';
import { recordatorioPago } from '../services/recordatorioPago.js';
import { ErrorRecordatorio } from '../services/recordatorioPago.service.js';
import { verificarFirma } from '../services/mensajero.client.js';
import { mensajeroApp, pagoRecibido, respuestas } from '../services/pagos.js';
import { ErrorRespuesta } from '../services/respuestas.service.js';

const aHttp = (e) => (e instanceof ErrorRecordatorio || e instanceof ErrorRespuesta ? new HttpError(e.status, e.code, e.message, e.details) : e);
const usuario = (req) => req.user?.email || req.user?.sub || null;

/** Estado de la app de IronCore en el mensajero (interruptor de SofIA). Nunca lanza. */
async function estadoMensajero() {
  if (!env.MENSAJERO.conexionDisponible) return { estado: 'sin_configurar', motivo: 'Falta MENSAJERO_URL o MENSAJERO_API_KEY en el servidor' };
  try { return await mensajeroApp.consultarApp(); } catch { return { estado: 'sin_conexion', motivo: 'No se pudo consultar el mensajero' }; }
}

/** GET /recordatorios/pago — lista calculada desde los vencimientos reales (+ estado de la mensajería). */
export async function listado(_req, res, next) {
  try {
    const [data, mensajero] = await Promise.all([recordatorioPago.listado(), estadoMensajero()]);
    res.json({
      ...data,
      config: { ...data.config, ligaDisponible: env.MENSAJERO.ligaDisponible },
      mensajero,
      // El mismo interruptor (config.activo) gobierna también el mensaje de pago recibido.
      pagoRecibido: { disponible: env.MENSAJERO.pagoRecibidoDisponible, plantilla: env.MENSAJERO.plantillaPagoRecibido },
      mercadoPago: {
        checkoutDisponible: env.MERCADOPAGO.checkoutDisponible,
        webhookDisponible: env.MERCADOPAGO.webhookDisponible,
        modoPrueba: env.MERCADOPAGO.modoPrueba,
        avisos: env.MERCADOPAGO.avisos,
      },
    });
  } catch (e) { next(aHttp(e)); }
}

/** POST /recordatorios/pago/:clienteId/enviar — envío manual (recepción / admin). */
export async function enviar(req, res, next) {
  try {
    const r = await recordatorioPago.enviarManual(req.params.clienteId, usuario(req));
    logger.info('Recordatorio de pago enviado manualmente', { clienteId: req.params.clienteId, por: usuario(req), resultado: r.resultado });
    res.json(r);
  } catch (e) { next(aHttp(e)); }
}

/** GET /recordatorios/respuestas — clientes que contestaron por WhatsApp y nadie ha atendido. */
export async function respuestasPendientes(_req, res, next) {
  try { res.json({ items: await respuestas.listarPendientes() }); } catch (e) { next(aHttp(e)); }
}

/** POST /recordatorios/respuestas/:clienteId/:respuestaId/atender */
export async function atenderRespuesta(req, res, next) {
  try {
    res.json(await respuestas.marcarAtendida(req.params.clienteId, req.params.respuestaId, usuario(req)));
  } catch (e) { next(aHttp(e)); }
}

/**
 * POST /webhooks/mensajero — `message.status` y `message.received` del mensajero. Sin JWT ni
 * CSRF: lo autentica la firma X-Signature-256 sobre el cuerpo crudo (capturado en app.js).
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
    let r;
    if (req.body?.event === 'message.received') {
      r = await respuestas.procesarWebhook(req.body);
    } else {
      r = await recordatorioPago.procesarWebhook(req.body);
      if (r.ignorado === 'ajeno') r = await pagoRecibido.procesarWebhook(req.body);
    }
    logger.debug('Webhook del mensajero', { reqId: req.id, ...r });
    res.json({ ok: true });
  } catch (e) { next(e); }
}
