import { Router } from 'express';
import { ligaPagoLimiter } from '../middleware/rateLimiter.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ligaParams, ligaPagoParams } from '../validators/pago.schema.js';
import * as ctrl from '../controllers/pagos.controller.js';

// Rutas públicas (sin sesión) de la liga de pago que va en el botón del recordatorio.
// Un token o folio mal formado responde lo mismo que uno inválido (404 genérico).
const router = Router();
router.use(ligaPagoLimiter);

const generico = () => new HttpError(404, 'LIGA_INVALIDA', 'Esta liga de pago no es válida o ya venció. Pide una nueva o pasa a recepción.');
const params = (schema) => (req, _res, next) => {
  const r = schema.safeParse(req.params);
  if (!r.success) return next(generico());
  req.params = r.data;
  next();
};

router.get('/pagar/:token', params(ligaParams), ctrl.ligaDatos);
router.post('/pagar/:token/checkout', params(ligaParams), ctrl.ligaCheckout);
router.get('/pagar/:token/pagos/:pagoId', params(ligaPagoParams), ctrl.ligaPago);
export default router;
