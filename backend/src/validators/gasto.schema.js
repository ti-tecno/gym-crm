import { z } from 'zod';

export const gastoCreateSchema = z.object({
  descripcion: z.string().min(2).max(160).trim(),
  monto: z.number().positive().max(1_000_000),
  metodo: z.enum(['Efectivo', 'Tarjeta', 'Transferencia']),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  categoria: z.string().min(2).max(60).trim().optional(),
});

export const gastoUpdateSchema = gastoCreateSchema.partial();
export const gastoIdParam = z.object({ id: z.string().min(1) });
