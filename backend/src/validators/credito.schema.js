import { z } from 'zod';

export const creditoCreateSchema = z.object({
  legacyUsuario: z.string().min(2).max(160).trim(),
  concepto: z.string().min(2).max(160).trim(),
  montoRegistrado: z.number().positive().max(1_000_000),
  saldoPendiente: z.number().min(0).max(1_000_000).default(0),
  comentarios: z.string().max(500).trim().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
});

export const creditoUpdateSchema = creditoCreateSchema.partial().extend({
  estado: z.enum(['Pendiente', 'Pagado']).optional(),
});

export const creditoIdParam = z.object({ id: z.string().min(1) });
