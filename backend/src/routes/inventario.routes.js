import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { inventarioCreateSchema, inventarioIdParam, inventarioUpdateSchema } from '../validators/inventario.schema.js';
import * as ctrl from '../controllers/inventario.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/',       ctrl.list);
router.post('/',      requireRole('ADMIN'), requireCsrf, validate({ body: inventarioCreateSchema }), ctrl.create);
router.put('/:id',    requireRole('ADMIN'), requireCsrf, validate({ params: inventarioIdParam, body: inventarioUpdateSchema }), ctrl.update);
router.delete('/:id', requireRole('ADMIN'), requireCsrf, validate({ params: inventarioIdParam }), ctrl.remove);
export default router;
