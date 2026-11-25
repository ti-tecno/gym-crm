import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recordatorioCreateSchema, recordatorioUpdateSchema } from '../validators/recordatorio.schema.js';
import * as ctrl from '../controllers/recordatorios.controller.js';
import * as pagoCtrl from '../controllers/recordatorioPago.controller.js';
import { recordatorioPagoParams } from '../validators/recordatorio.schema.js';

const router = Router();
router.use(requireAuth);
router.get('/',  ctrl.list);
// Recordatorio de pago por WhatsApp
router.get('/pago', requireRole('ADMIN', 'RECEP', 'COACH'), pagoCtrl.listado);
router.post('/pago/:clienteId/enviar', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ params: recordatorioPagoParams }), pagoCtrl.enviar);
router.post('/', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ body: recordatorioCreateSchema }), ctrl.create);
router.put('/:id', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ body: recordatorioUpdateSchema }), ctrl.update);
export default router;
