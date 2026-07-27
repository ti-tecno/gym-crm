import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { gastoCreateSchema, gastoIdParam, gastoUpdateSchema } from '../validators/gasto.schema.js';
import * as ctrl from '../controllers/gastos.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/',       ctrl.list);
router.post('/',      requireRole('ADMIN'), requireCsrf, validate({ body: gastoCreateSchema }), ctrl.create);
router.put('/:id',    requireRole('ADMIN'), requireCsrf, validate({ params: gastoIdParam, body: gastoUpdateSchema }), ctrl.update);
router.delete('/:id', requireRole('ADMIN'), requireCsrf, validate({ params: gastoIdParam }), ctrl.remove);
export default router;
