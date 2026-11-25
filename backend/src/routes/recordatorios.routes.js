import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recordatorioCreateSchema, recordatorioUpdateSchema } from '../validators/recordatorio.schema.js';
import * as ctrl from '../controllers/recordatorios.controller.js';
import * as pagoCtrl from '../controllers/recordatorioPago.controller.js';
import { recordatorioPagoParams, respuestaParams } from '../validators/recordatorio.schema.js';

const router = Router();
// Todo el módulo es de staff: un CLIENTE no debe listar recordatorios de nadie.
router.use(requireAuth, requireRole('ADMIN', 'RECEP', 'COACH'));
router.get('/',  ctrl.list);
// Recordatorio de pago por WhatsApp
router.get('/pago', pagoCtrl.listado);
router.post('/pago/:clienteId/enviar', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ params: recordatorioPagoParams }), pagoCtrl.enviar);
// Respuestas de clientes por WhatsApp
router.get('/respuestas', pagoCtrl.respuestasPendientes);
router.post('/respuestas/:clienteId/:respuestaId/atender', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ params: respuestaParams }), pagoCtrl.atenderRespuesta);
router.post('/', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ body: recordatorioCreateSchema }), ctrl.create);
router.put('/:id', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ body: recordatorioUpdateSchema }), ctrl.update);
export default router;
