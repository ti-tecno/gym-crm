import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadMiddleware, uploadCoachImage } from '../controllers/upload.controller.js';

const router = Router();

function multerWrap(req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}

router.post('/coaches', requireAuth, requireRole('ADMIN'), multerWrap, uploadCoachImage);

export default router;
