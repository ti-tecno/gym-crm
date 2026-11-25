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

/**
 * ÚNICA fuente de la configuración de Mercado Pago (token, secreto del webhook, URLs y si está
 * configurado). Todo el código de MP la llama en cada operación; nadie guarda el token en una
 * constante. Hoy devuelve lo de las variables de entorno; para leerla de settings (cifrada) basta
 * con cambiar esta función, manteniendo la forma de parseMercadoPagoConfig (config/mercadoPago.js).
 */
export async function obtenerConfigMercadoPago() {
  return env.MERCADOPAGO;
}

export const pagos = crearServicioPagos({
  mpConfig: obtenerConfigMercadoPago,
  mp: crearClienteMercadoPago({ obtenerConfig: obtenerConfigMercadoPago }),
  repo: pagosRepo,
  clientes: clientesRepo,
  aviso: pagoRecibido,
  respuestas,
  logger,
  ligaSecret: env.MENSAJERO.ligaPagoSecret,
});

// Solo un aviso informativo en el log al arrancar; no se guarda nada de la configuración.
obtenerConfigMercadoPago()
  .then((c) => { for (const aviso of c.avisos || []) logger.warn(`[mercadopago] ${aviso}`); })
  .catch(() => {});
