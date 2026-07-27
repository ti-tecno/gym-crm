import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ingresoCreateSchema, ingresoIdParam, ingresoUpdateSchema } from '../validators/ingreso.schema.js';
import * as ctrl from '../controllers/ingresos.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/',       ctrl.list);
router.post('/',      requireRole('ADMIN'), requireCsrf, validate({ body: ingresoCreateSchema }), ctrl.create);
router.put('/:id',    requireRole('ADMIN'), requireCsrf, validate({ params: ingresoIdParam, body: ingresoUpdateSchema }), ctrl.update);
router.delete('/:id', requireRole('ADMIN'), requireCsrf, validate({ params: ingresoIdParam }), ctrl.remove);
export default router;
