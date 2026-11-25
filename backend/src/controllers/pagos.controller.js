import logger from '../config/logger.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as repo from '../repositories/pagos.repo.js';
import * as clientesRepo from '../repositories/clientes.repo.js';
import { obtenerConfigMercadoPago, pagos } from '../services/pagos.js';
import { ErrorPago } from '../services/pagos.service.js';
import { verificarFirmaMercadoPago } from '../services/mercadoPago.client.js';

const aHttp = (e) => (e instanceof ErrorPago ? new HttpError(e.status, e.code, e.message, e.details) : e);
const usuario = (req) => req.user?.email || req.user?.sub || null;

// ── Staff (ADMIN / RECEP) ────────────────────────────────────────────────────

export async function list(req, res, next) {
  try { res.json(await repo.listPagos(req.query)); } catch (e) { next(e); }
}

/** GET /pagos/vista-previa?clienteId= — cómo quedaría la membresía si paga hoy. */
export async function vistaPrevia(req, res, next) {
  try {
    const c = await clientesRepo.getCliente(req.query.clienteId);
    if (!c) return next(new HttpError(404, 'NOT_FOUND', 'Cliente no encontrado'));
    res.json(pagos.vistaPrevia(c));
  } catch (e) { next(aHttp(e)); }
}

/** POST /pagos — pago cobrado en mostrador. Queda Exitoso y renueva la membresía. */
export async function create(req, res, next) {
  try {
    const r = await pagos.registrarEnMostrador({ ...req.body, usuario: usuario(req) });
    logger.info('Pago registrado en mostrador', { pagoId: r.pago.pagoId, clienteId: r.pago.clienteId, por: usuario(req), vencimiento: r.renovacion.vencimientoNuevo });
    res.status(201).json(r);
  } catch (e) { next(aHttp(e)); }
}

// ── Portal del cliente (siempre req.user.cid, nunca un id del navegador) ─────

function cid(req) {
  const c = req.user?.cid;
  if (!c) throw new HttpError(403, 'NO_CLIENTE_LINKED', 'Tu usuario no tiene perfil de cliente vinculado');
  return c;
}

export async function misPagos(req, res, next) {
  try { res.json(await pagos.resumenCliente(cid(req))); } catch (e) { next(aHttp(e)); }
}

export async function checkout(req, res, next) {
  try {
    const r = await pagos.iniciarCheckout(cid(req));
    logger.info('Checkout de Mercado Pago', { clienteId: req.user.cid, pagoId: r.pagoId, reutilizado: Boolean(r.reutilizado) });
    res.status(201).json(r);
  } catch (e) { next(aHttp(e)); }
}

export async function miPago(req, res, next) {
  try { res.json(await pagos.estadoParaCliente(cid(req), req.params.pagoId)); } catch (e) { next(aHttp(e)); }
}

// ── Liga pública /pagar/<token> (sin sesión; el token firmado identifica al cliente) ──

export async function ligaDatos(req, res, next) {
  try { res.set('Cache-Control', 'no-store'); res.json(await pagos.datosLiga(req.params.token)); } catch (e) { next(aHttp(e)); }
}

export async function ligaCheckout(req, res, next) {
  try {
    const r = await pagos.checkoutLiga(req.params.token);
    logger.info('Checkout de Mercado Pago desde liga pública', { pagoId: r.pagoId, ip: req.ip });
    res.status(201).json({ url: r.url, pagoId: r.pagoId });
  } catch (e) { next(aHttp(e)); }
}

export async function ligaPago(req, res, next) {
  try { res.set('Cache-Control', 'no-store'); res.json(await pagos.estadoLiga(req.params.token, req.params.pagoId)); } catch (e) { next(aHttp(e)); }
}

// ── Aviso de Mercado Pago ────────────────────────────────────────────────────

/**
 * POST /webhooks/mercadopago — sin JWT ni CSRF. Se autentica con x-signature (HMAC del
 * manifiesto id/request-id/ts con la clave secreta) y además el pago se consulta a la API de MP
 * con nuestro token antes de tocar nada. 2xx = recibido; 5xx = que MP lo reintente.
 */
export async function webhookMercadoPago(req, res, next) {
  try {
    const mpConfig = await obtenerConfigMercadoPago(); // en cada aviso, nunca guardada
    if (!mpConfig.webhookDisponible) {
      return next(new HttpError(503, 'WEBHOOK_NO_CONFIGURADO', 'Webhook de Mercado Pago sin configurar'));
    }
    const xSignature = req.get('x-signature');
    // Formato IPN heredado (topic/id, sin firma): no se procesa; se responde 200 para que no se reintente.
    if (!xSignature && req.query.topic) {
      logger.info('Aviso IPN de Mercado Pago ignorado (se usan Webhooks firmados)', { reqId: req.id, topic: req.query.topic });
      return res.json({ ok: true });
    }
    const dataId = typeof req.query['data.id'] === 'string' ? req.query['data.id'] : null;
    const ok = verificarFirmaMercadoPago({ xSignature, xRequestId: req.get('x-request-id'), dataId, secret: mpConfig.webhookSecret });
    if (!ok) {
      logger.warn('Aviso de Mercado Pago con firma inválida', { reqId: req.id, ip: req.ip });
      return next(new HttpError(401, 'FIRMA_INVALIDA', 'Firma inválida'));
    }
    const tipo = (typeof req.query.type === 'string' && req.query.type) || req.body?.type;
    // El id firmado es el del query; si no viene, el del cuerpo (igual se consulta a MP con nuestro token).
    const idPago = dataId || (req.body?.data?.id != null ? String(req.body.data.id) : null);
    const r = await pagos.procesarNotificacion({ tipo, dataId: idPago });
    logger.info('Aviso de Mercado Pago', { reqId: req.id, dataId: idPago, ...r });
    res.json({ ok: true });
  } catch (e) {
    logger.error('Error procesando aviso de Mercado Pago (MP lo reintentará)', { reqId: req.id, err: e?.message });
    next(e instanceof ErrorPago ? new HttpError(503, e.code, e.message) : e);
  }
}
