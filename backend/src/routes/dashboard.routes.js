import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { summary } from '../controllers/dashboard.controller.js';

const router = Router();
router.get('/summary', requireAuth, summary);
export default router;
