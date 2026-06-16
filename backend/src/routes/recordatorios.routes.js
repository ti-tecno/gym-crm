import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recordatorioCreateSchema, recordatorioUpdateSchema } from '../validators/recordatorio.schema.js';
import * as ctrl from '../controllers/recordatorios.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/',  ctrl.list);
router.post('/', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ body: recordatorioCreateSchema }), ctrl.create);
router.put('/:id', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ body: recordatorioUpdateSchema }), ctrl.update);
export default router;
