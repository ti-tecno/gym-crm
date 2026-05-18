import { z } from 'zod';

export const inventarioCreateSchema = z.object({
  nombre: z.string().min(2).max(80).trim(),
  categoria: z.enum(['Pesas', 'Barras', 'Cardio', 'Bancos', 'Accesorios']),
  cantidad: z.number().int().nonnegative().max(10_000),
  minimo: z.number().int().nonnegative().max(10_000),
  precio: z.number().nonnegative().max(1_000_000),
});

export const inventarioUpdateSchema = inventarioCreateSchema.partial();
export const inventarioIdParam = z.object({ id: z.string().uuid() });
