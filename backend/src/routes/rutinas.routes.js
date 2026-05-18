import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rutinaClienteSchema, rutinaCoachSchema } from '../validators/rutina.schema.js';
import * as ctrl from '../controllers/rutinas.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/clientes', ctrl.listClientes);
router.post('/clientes', requireRole('ADMIN', 'COACH'), requireCsrf, validate({ body: rutinaClienteSchema }), ctrl.upsertCliente);

router.get('/coach', ctrl.listCoach);
router.post('/coach', requireRole('ADMIN', 'COACH'), requireCsrf, validate({ body: rutinaCoachSchema }), ctrl.upsertCoach);
export default router;
