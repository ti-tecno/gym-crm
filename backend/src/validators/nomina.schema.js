import { z } from 'zod';

export const empleadoCreateSchema = z.object({
  nombre: z.string().min(2).max(80).trim(),
  puesto: z.string().min(2).max(60).trim(),
  salario: z.number().positive().max(1_000_000),
  horas: z.number().int().nonnegative().max(744),
  estado: z.enum(['Pagado', 'Pendiente']).default('Pendiente'),
});

export const empleadoUpdateSchema = empleadoCreateSchema.partial();
export const empleadoIdParam = z.object({ id: z.string().uuid() });
