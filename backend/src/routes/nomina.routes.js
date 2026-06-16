import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { empleadoCreateSchema, empleadoIdParam } from '../validators/nomina.schema.js';
import * as ctrl from '../controllers/nomina.controller.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));
router.get('/',  ctrl.list);
router.post('/', requireCsrf, validate({ body: empleadoCreateSchema }), ctrl.create);
router.post('/:id/pagar', requireCsrf, validate({ params: empleadoIdParam }), ctrl.pagar);
export default router;
