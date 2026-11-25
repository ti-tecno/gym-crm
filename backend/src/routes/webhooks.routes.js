import { Router } from 'express';
import { webhookLimiter } from '../middleware/rateLimiter.js';
import * as ctrl from '../controllers/recordatorioPago.controller.js';
import * as pagosCtrl from '../controllers/pagos.controller.js';

// Webhooks de servicios externos. Se montan en app.js ANTES del limitador global y fuera
// de routes/index.js; sin requireAuth ni requireCsrf (cada uno se autentica con su firma).
export const WEBHOOK_MENSAJERO_PATH = '/webhooks/mensajero';

const router = Router();
router.post('/mensajero', webhookLimiter, ctrl.webhook);
// Mercado Pago firma el manifiesto id/request-id/ts (no el cuerpo): no necesita cuerpo crudo.
router.post('/mercadopago', webhookLimiter, pagosCtrl.webhookMercadoPago);
export default router;
