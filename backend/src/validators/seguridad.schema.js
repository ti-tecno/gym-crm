import { z } from 'zod';

// Solo forma y tamaño; el formato fino (celular, credenciales, 6 dígitos) lo revisa el servicio
// con mensajes para una persona. Ningún mensaje de error repite el valor capturado.
const codigo = z.string().trim().max(12);
const telefono = z.string().trim().min(1).max(30);

export const solicitarCodigoSchema = z.object({
  accion: z.enum(['mp_guardar', 'mp_borrar', 'telefono_cambiar']),
}).strict();

export const guardarMercadoPagoSchema = z.object({
  accessToken: z.string().max(400),
  webhookSecret: z.string().max(400),
  codigo,
}).strict();

export const borrarMercadoPagoSchema = z.object({ codigo }).strict();

export const telefonoCodigoSchema = z.object({
  telefono,
  password: z.string().max(200).optional(),
  codigo: codigo.optional(),
}).strict();

export const confirmarTelefonoSchema = z.object({ telefono, codigo }).strict();
