import { z } from 'zod';

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha YYYY-MM-DD');

const serieSchema = z.object({
  reps:  z.number().int().nonnegative().max(500),
  peso:  z.number().nonnegative().max(1000),       // kg
  completada: z.boolean().default(true),
});

const ejercicioWorkoutSchema = z.object({
  nombre: z.string().trim().min(2).max(80),
  musculo: z.string().trim().max(40).optional(),
  series: z.array(serieSchema).min(1).max(20),
});

export const workoutCreateSchema = z.object({
  fecha: dateIso,
  rutinaDia: z.string().max(20).optional(),        // ej. "Lun - Pecho"
  duracionMin: z.number().int().nonnegative().max(480).optional(),
  notas: z.string().max(500).optional(),
  ejercicios: z.array(ejercicioWorkoutSchema).min(1).max(15),
});

export const medidaCreateSchema = z.object({
  fecha: dateIso,
  pesoKg:      z.number().positive().max(500).optional(),
  pctGrasa:    z.number().min(0).max(80).optional(),
  pctMusculo:  z.number().min(0).max(100).optional(),
  perimetros: z.object({
    pecho:   z.number().positive().max(300).optional(),
    brazo:   z.number().positive().max(100).optional(),
    cintura: z.number().positive().max(300).optional(),
    cadera:  z.number().positive().max(300).optional(),
    muslo:   z.number().positive().max(150).optional(),
  }).optional(),
  notas: z.string().max(300).optional(),
}).refine((d) => d.pesoKg || d.pctGrasa || d.pctMusculo || d.perimetros,
  { message: 'Captura al menos una medida' });

export const fechaQuery = z.object({
  desde: dateIso.optional(),
  hasta: dateIso.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
