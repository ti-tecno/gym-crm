/**
 * Backoffice → Mercado Pago (solo ADMIN). Se monta en settings.routes.js bajo /settings/admin/seguridad.
 *
 *   GET  /                       estado (sin secretos, teléfono enmascarado)
 *   POST /codigo                 { accion: mp_guardar | mp_borrar | telefono_cambiar } → código al teléfono registrado
 *   PUT  /mercadopago            { accessToken, webhookSecret, codigo } → guarda cifradas
 *   POST /mercadopago/borrar     { codigo } → borra las guardadas
 *   POST /telefono/codigo        { telefono, password } (primera vez) | { telefono, codigo } (cambio) → código al número nuevo
 *   PUT  /telefono               { telefono, codigo } → confirma y guarda el número nuevo
 *
 * Fábrica con el servicio y los middlewares inyectados para probarla con fetch sin BD ni red.
 */
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  borrarMercadoPagoSchema, confirmarTelefonoSchema, guardarMercadoPagoSchema, solicitarCodigoSchema, telefonoCodigoSchema,
} from '../validators/seguridad.schema.js';

export function crearRutasSeguridad({ servicio, requireAuth, requireRole, requireCsrf, aError = (e) => e }) {
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));
  // Ninguna respuesta de esta sección se guarda en caché (intermedia ni del navegador).
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const quien = (req) => ({ userId: req.user.sub, usuario: req.user.email || req.user.sub });
  const h = (fn) => async (req, res, next) => {
    try { res.json(await fn(req)); } catch (e) { next(aError(e)); }
  };

  router.get('/', h((req) => servicio.estado(req.user.sub)));
  router.post('/codigo', requireCsrf, validate({ body: solicitarCodigoSchema }),
    h((req) => servicio.solicitarCodigo({ ...quien(req), accion: req.body.accion })));
  router.put('/mercadopago', requireCsrf, validate({ body: guardarMercadoPagoSchema }),
    h((req) => servicio.guardarCredenciales({ ...quien(req), ...req.body })));
  router.post('/mercadopago/borrar', requireCsrf, validate({ body: borrarMercadoPagoSchema }),
    h((req) => servicio.borrarCredenciales({ ...quien(req), codigo: req.body.codigo })));
  router.post('/telefono/codigo', requireCsrf, validate({ body: telefonoCodigoSchema }),
    h((req) => servicio.solicitarCodigoTelefonoNuevo({ ...quien(req), ...req.body })));
  router.put('/telefono', requireCsrf, validate({ body: confirmarTelefonoSchema }),
    h((req) => servicio.confirmarTelefono({ ...quien(req), ...req.body })));
  return router;
}
