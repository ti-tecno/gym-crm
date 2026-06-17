import { Router } from 'express';
import { requireAuth, requireCsrf, requireRole } from '../middleware/auth.js';
import * as ctrl from '../controllers/settings.controller.js';

const router = Router();

// Público (landing)
router.get('/public', ctrl.getPublic);

// Admin
router.get('/admin', requireAuth, requireRole('ADMIN'), ctrl.getAdmin);
router.put('/admin/packages', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updatePackages);
router.put('/admin/schedule', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updateSchedule);
router.put('/admin/calendar', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updateCalendar);
router.put('/admin/coaches', requireAuth, requireRole('ADMIN'), requireCsrf, ctrl.updateCoaches);

export default router;
