import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { pagoCreateSchema, pagoQuery, vistaPreviaQuery } from '../validators/pago.schema.js';
import * as ctrl from '../controllers/pagos.controller.js';

// Pagos de todos los clientes: solo staff de caja. El CLIENTE ve los suyos en /cliente/pagos.
const router = Router();
router.use(requireAuth, requireRole('ADMIN', 'RECEP'));
router.get('/',  validate({ query: pagoQuery }), ctrl.list);
router.get('/vista-previa', validate({ query: vistaPreviaQuery }), ctrl.vistaPrevia);
router.post('/', requireCsrf, validate({ body: pagoCreateSchema }), ctrl.create);
export default router;
