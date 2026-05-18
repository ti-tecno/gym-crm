import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { pagoCreateSchema, pagoQuery } from '../validators/pago.schema.js';
import * as ctrl from '../controllers/pagos.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/',  validate({ query: pagoQuery }), ctrl.list);
router.post('/', requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ body: pagoCreateSchema }), ctrl.create);
export default router;
