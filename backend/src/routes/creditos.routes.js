import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { creditoCreateSchema, creditoIdParam, creditoUpdateSchema } from '../validators/credito.schema.js';
import * as ctrl from '../controllers/creditos.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/',       ctrl.list);
router.post('/',      requireRole('ADMIN'), requireCsrf, validate({ body: creditoCreateSchema }), ctrl.create);
router.put('/:id',    requireRole('ADMIN'), requireCsrf, validate({ params: creditoIdParam, body: creditoUpdateSchema }), ctrl.update);
router.delete('/:id', requireRole('ADMIN'), requireCsrf, validate({ params: creditoIdParam }), ctrl.remove);
export default router;
