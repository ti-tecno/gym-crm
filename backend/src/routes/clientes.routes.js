import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { clienteCreateSchema, clienteIdParam, clienteQuery, clienteUpdateSchema } from '../validators/cliente.schema.js';
import * as ctrl from '../controllers/clientes.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/',     validate({ query: clienteQuery }), ctrl.list);
router.get('/:id',  validate({ params: clienteIdParam }), ctrl.getOne);
router.post('/',    requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ body: clienteCreateSchema }), ctrl.create);
router.put('/:id',  requireRole('ADMIN', 'RECEP'), requireCsrf, validate({ params: clienteIdParam, body: clienteUpdateSchema }), ctrl.update);
router.delete('/:id', requireRole('ADMIN'),       requireCsrf, validate({ params: clienteIdParam }), ctrl.remove);

export default router;
