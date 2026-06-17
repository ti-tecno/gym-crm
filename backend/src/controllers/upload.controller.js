import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { v4 as uuid } from 'uuid';
import { HttpError } from '../middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../public/uploads/coaches');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Solo se permiten imágenes JPG, PNG, WebP o GIF'));
    }
    cb(null, true);
  },
});

export const uploadMiddleware = upload.single('image');

export function uploadCoachImage(req, res, next) {
  try {
    if (!req.file) return next(new HttpError(400, 'NO_FILE', 'No se recibió ninguna imagen'));
    const url = `/uploads/coaches/${req.file.filename}`;
    res.json({ url });
  } catch (e) {
    next(e);
  }
}
