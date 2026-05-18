import { z } from 'zod';

export const recordatorioCreateSchema = z.object({
  clienteId: z.string().uuid(),
  tipo: z.enum(['WhatsApp', 'Email']),
  estado: z.enum(['Pendiente', 'Programado', 'Enviado']).default('Pendiente'),
  dias: z.number().int().min(-365).max(365),
  monto: z.number().nonnegative().max(1_000_000),
});

export const recordatorioUpdateSchema = recordatorioCreateSchema.partial();
