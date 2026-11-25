/**
 * Instancia real (DynamoDB + mensajero) del servicio de credenciales de Mercado Pago y OTP del
 * administrador. Ver seguridad.service.js y docs/PAGO_EN_LINEA.md.
 */
import crypto from 'node:crypto';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { ddb, TABLES } from '../config/dynamo.js';
import { crearRepoSeguridad } from '../repositories/seguridad.repo.js';
import * as usersRepo from '../repositories/users.repo.js';
import { verifyPassword } from './password.service.js';
import { crearClienteMensajero } from './mensajero.client.js';
import { crearServicioSeguridad } from './seguridad.service.js';

// "Pimienta" del HMAC de los códigos: derivada de la llave privada del JWT (nunca está en la BD).
// Si no hubiera llave (el servidor tampoco podría iniciar sesiones), una aleatoria por proceso.
const pimienta = env.JWT_PRIVATE_KEY
  ? crypto.createHash('sha256').update('ironcore-otp-pimienta|').update(env.JWT_PRIVATE_KEY).digest()
  : crypto.randomBytes(32);

async function verificarPasswordUsuario(userId, password) {
  const user = await usersRepo.getUserById(userId);
  if (!user?.passwordHash) return null;
  return verifyPassword(password, user.passwordHash);
}

export const seguridad = crearServicioSeguridad({
  repo: crearRepoSeguridad({ ddb, tabla: TABLES.SETTINGS, GetCommand, PutCommand }),
  verificarPassword: verificarPasswordUsuario,
  mensajero: crearClienteMensajero({ url: env.MENSAJERO.url, apiKey: env.MENSAJERO.apiKey }),
  mensajeroConfig: env.MENSAJERO,
  config: env.SEGURIDAD,
  pimienta,
  envMp: () => process.env,
  apiPrefix: env.API_PREFIX,
  logger,
});

if (env.SEGURIDAD.avisoLlave) logger.warn(`[seguridad] ${env.SEGURIDAD.avisoLlave}`);
