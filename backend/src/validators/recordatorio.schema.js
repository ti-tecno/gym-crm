import { z } from 'zod';

export const recordatorioCreateSchema = z.object({
  clienteId: z.string().uuid(),
  tipo: z.enum(['WhatsApp', 'Email']),
  estado: z.enum(['Pendiente', 'Programado', 'Enviado']).default('Pendiente'),
  dias: z.number().int().min(-365).max(365),
  monto: z.number().nonnegative().max(1_000_000),
});

export const recordatorioUpdateSchema = recordatorioCreateSchema.partial();

export const recordatorioPagoParams = z.object({ clienteId: z.string().uuid() });

// data.id del mensajero (uuid) de la respuesta del cliente.
export const respuestaParams = z.object({ clienteId: z.string().uuid(), respuestaId: z.string().min(1).max(100).regex(/^[\w-]+$/) });
