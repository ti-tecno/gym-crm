import { z } from 'zod';

export const pagoCreateSchema = z.object({
  clienteId: z.string().uuid(),
  monto: z.number().positive().max(1_000_000),
  metodo: z.enum(['tarjeta', 'transferencia', 'efectivo']),
  // Datos sensibles de tarjeta NO se almacenan: se mandan a la pasarela y sólo guardamos el last4
  cardLast4: z.string().regex(/^\d{4}$/).optional(),
  folio: z.string().max(40).optional(),
  estado: z.enum(['Exitoso', 'Fallido', 'Pendiente']).default('Exitoso'),
});

export const pagoQuery = z.object({
  clienteId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
