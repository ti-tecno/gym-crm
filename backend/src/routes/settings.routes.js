import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import * as ctrl from '../controllers/settings.controller.js';
import { HttpError } from '../middleware/errorHandler.js';
import { seguridad } from '../services/seguridad.js';
import { ErrorSeguridad } from '../services/seguridad.service.js';
import { crearRutasSeguridad } from './seguridad.routes.js';

const router = Router();

// Backoffice → Mercado Pago (credenciales cifradas, teléfono del administrador, OTP). Solo ADMIN.
router.use('/admin/seguridad', crearRutasSeguridad({
  servicio: seguridad,
  requireAuth,
  requireRole,
  requireCsrf,
  aError: (e) => (e instanceof ErrorSeguridad ? new HttpError(e.status, e.code, e.message, e.details) : e),
}));

// Público (landing)
router.get('/public', ctrl.getPublic);

// Admin
router.get('/admin', requireAuth, requireRole('ADMIN'), ctrl.getAdmin);
router.put('/admin/packages', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updatePackages);
router.put('/admin/promotions', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updatePromotions);
router.put('/admin/schedule', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updateSchedule);
router.put('/admin/calendar', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updateCalendar);
router.put('/admin/coaches', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updateCoaches);
router.put('/admin/mensajeria', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updateMensajeria);

export default router;
