import { z } from 'zod';

const planEnum = z.enum(['Básico', 'Premium', 'Elite']);
const estadoEnum = z.enum(['Activo', 'Por vencer', 'Vencido']);

// Helpers: aceptar strings vacíos opcionales (los normaliza a undefined antes de validar)
const optionalString = (schema) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

export const clienteCreateSchema = z.object({
  nombre: z.string().trim().min(2).max(60),
  apellido: optionalString(z.string().trim().min(2).max(60)),
  email: z.string().email().max(120).toLowerCase().trim(),
  telefono: optionalString(z.string().regex(/^[\d\s\-()+]{7,20}$/)),
  plan: planEnum,
  monto: z.number().positive().max(100_000),
  vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO yyyy-mm-dd
  objetivo: optionalString(z.string().max(60)),
  estado: estadoEnum.default('Activo'),
});

export const clienteUpdateSchema = clienteCreateSchema.partial();
export const clienteIdParam = z.object({ id: z.string().uuid() });
export const clienteQuery = z.object({
  q: z.string().max(60).optional(),
  plan: planEnum.optional(),
  estado: estadoEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
