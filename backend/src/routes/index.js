import { Router } from 'express';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import clientesRoutes from './clientes.routes.js';
import pagosRoutes from './pagos.routes.js';
import inventarioRoutes from './inventario.routes.js';
import nominaRoutes from './nomina.routes.js';
import rutinasRoutes from './rutinas.routes.js';
import recordatoriosRoutes from './recordatorios.routes.js';
import settingsRoutes from './settings.routes.js';
import uploadRoutes from './upload.routes.js';
import clienteRoutes from './cliente.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/clientes', clientesRoutes);
router.use('/pagos', pagosRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/nomina', nominaRoutes);
router.use('/rutinas', rutinasRoutes);
router.use('/recordatorios', recordatoriosRoutes);
router.use('/settings', settingsRoutes);
router.use('/upload', uploadRoutes);
router.use('/cliente', clienteRoutes);     // portal de auto-servicio para CLIENTE

export default router;
