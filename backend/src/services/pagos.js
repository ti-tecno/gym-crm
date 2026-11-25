/**
 * Instancias reales (DynamoDB + Mercado Pago + mensajero) de pagos, mensaje de pago recibido
 * y respuestas de clientes por WhatsApp.
 */
import env from '../config/env.js';
import logger from '../config/logger.js';
import * as pagosRepo from '../repositories/pagos.repo.js';
import * as clientesRepo from '../repositories/clientes.repo.js';
import * as recordatoriosRepo from '../repositories/recordatorios.repo.js';
import * as settingsRepo from '../repositories/settings.repo.js';
import { crearClienteMensajero } from './mensajero.client.js';
import { crearClienteMercadoPago } from './mercadoPago.client.js';
import { crearServicioPagoRecibido } from './pagoRecibido.service.js';
import { crearServicioRespuestas } from './respuestas.service.js';
import { crearServicioPagos } from './pagos.service.js';

const mensajero = crearClienteMensajero({ url: env.MENSAJERO.url, apiKey: env.MENSAJERO.apiKey });

export const mensajeroApp = mensajero;

export const pagoRecibido = crearServicioPagoRecibido({
  config: env.MENSAJERO,
  mensajero,
  repo: recordatoriosRepo,
  settings: settingsRepo,
  logger,
});

export const respuestas = crearServicioRespuestas({ clientes: clientesRepo, logger });

export const pagos = crearServicioPagos({
  mpConfig: env.MERCADOPAGO,
  mp: crearClienteMercadoPago({ accessToken: env.MERCADOPAGO.accessToken }),
  repo: pagosRepo,
  clientes: clientesRepo,
  aviso: pagoRecibido,
  respuestas,
  logger,
  ligaSecret: env.MENSAJERO.ligaPagoSecret,
});

for (const aviso of env.MERCADOPAGO.avisos) logger.warn(`[mercadopago] ${aviso}`);
