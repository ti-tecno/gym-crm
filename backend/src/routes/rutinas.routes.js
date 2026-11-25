import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rutinaClienteSchema, rutinaCoachCreateSchema, rutinaCoachUpdateSchema, rutinaCoachIdParam } from '../validators/rutina.schema.js';
import * as ctrl from '../controllers/rutinas.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/clientes', ctrl.listClientes);
router.post('/clientes', requireRole('ADMIN', 'COACH'), requireCsrf, validate({ body: rutinaClienteSchema }), ctrl.upsertCliente);

router.get('/coach', ctrl.listCoach);
router.post('/coach', requireRole('ADMIN', 'COACH'), requireCsrf, validate({ body: rutinaCoachCreateSchema }), ctrl.createCoach);
router.put('/coach/:id', requireRole('ADMIN', 'COACH'), requireCsrf, validate({ params: rutinaCoachIdParam, body: rutinaCoachUpdateSchema }), ctrl.updateCoach);
router.delete('/coach/:id', requireRole('ADMIN', 'COACH'), requireCsrf, validate({ params: rutinaCoachIdParam }), ctrl.deleteCoach);
export default router;
