import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { fechaQuery, medidaCreateSchema, workoutCreateSchema } from '../validators/progreso.schema.js';
import { perfilUpdateSchema } from '../validators/perfil.schema.js';
import { asignarRutinaSchema } from '../validators/rutina.schema.js';
import * as ctrl from '../controllers/cliente.controller.js';

const router = Router();

// Todas las rutas requieren rol CLIENTE.
router.use(requireAuth, requireRole('CLIENTE'));

router.get('/dashboard',  ctrl.dashboardCliente);
router.get('/membresia',  ctrl.membresia);
router.get('/rutina',     ctrl.miRutina);
router.get('/programas',  ctrl.programas);
router.post('/rutina/asignar', requireCsrf, validate({ body: asignarRutinaSchema }), ctrl.asignarRutina);

router.get('/perfil',     ctrl.getPerfil);
router.put('/perfil',     requireCsrf, validate({ body: perfilUpdateSchema }), ctrl.updatePerfil);

router.get('/workouts',   validate({ query: fechaQuery }), ctrl.listWorkouts);
router.post('/workouts',  requireCsrf, validate({ body: workoutCreateSchema }), ctrl.createWorkout);

router.get('/medidas',    ctrl.listMedidas);
router.post('/medidas',   requireCsrf, validate({ body: medidaCreateSchema }), ctrl.createMedida);

router.get('/prs',        ctrl.listPRs);

export default router;
