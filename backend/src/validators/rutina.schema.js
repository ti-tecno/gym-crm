import { z } from 'zod';

const diaSchema = z.object({
  dia: z.enum(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']),
  musculo: z.string().max(40),
  ejercicios: z.array(z.string().max(120)).max(15),
});

export const rutinaClienteSchema = z.object({
  clienteId: z.string().uuid(),
  coach: z.string().max(80),
  semana: z.number().int().positive().max(520),
  objetivo: z.string().max(60),
  dias: z.array(diaSchema).max(7),
});

export const rutinaCoachCreateSchema = z.object({
  nombre: z.string().min(2).max(80),
  nivel: z.enum(['Principiante', 'Intermedio', 'Avanzado']),
  duracion: z.string().max(20),
  coach: z.string().max(80),
  clientes: z.number().int().nonnegative().max(100).optional().default(0),
  dias: z.array(diaSchema).max(7).optional().default([]),
});

export const rutinaCoachUpdateSchema = rutinaCoachCreateSchema.partial();
export const rutinaCoachIdParam = z.object({ id: z.string().min(1) });

// POST /cliente/rutina/asignar — el cliente se auto-asigna un programa de la biblioteca (gym_rutinas_coach)
export const asignarRutinaSchema = z.object({
  rutinaId: z.string().uuid(),
});
