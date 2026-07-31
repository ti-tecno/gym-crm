import { z } from 'zod';

const phone = /^[\d\s\-()+]{7,20}$/;
const dateIso = /^\d{4}-\d{2}-\d{2}$/;
const optionalText = (schema) => schema.optional().or(z.literal(''));

const saludSchema = z.object({
  cardiaco: z.boolean().optional().default(false),
  pecho: z.boolean().optional().default(false),
  ahogo: z.boolean().optional().default(false),
  mareo: z.boolean().optional().default(false),
  neurologico: z.boolean().optional().default(false),
  respiratorio: z.boolean().optional().default(false),
  osteoarticular: z.boolean().optional().default(false),
  dolorReciente: z.boolean().optional().default(false),
  factoresRiesgo: z.string().trim().min(1).max(240),
  medicamentoActual: z.string().trim().min(1).max(240),
  otroPadecimiento: optionalText(z.string().trim().max(240)),
});

const habitosSchema = z.object({
  actividadHabitual: z.boolean().optional().default(false),
  // Sólo obligatorias si actividadHabitual es true — ver superRefine
  actividadTipo: optionalText(z.string().trim().max(80)),
  frecuenciaSemanal: z.coerce.number().int().min(0).max(14).optional(),
  tiempoSesion: optionalText(z.string().trim().max(40)),
  ultimaVezPrograma: z.string().trim().min(1).max(80),
  beneficios: z.array(z.string().trim().max(60)).min(1).max(8),
  aceptoPrivacidad: z.boolean().refine(Boolean, 'Debes aceptar el aviso de privacidad'),
  aceptoResponsiva: z.boolean().refine(Boolean, 'Debes aceptar la responsiva'),
});

// PUT /cliente/perfil — completa/actualiza los datos de registro que faltan
// (p. ej. cuentas que entraron por Google y nunca pasaron por el registro con formulario completo).
export const perfilUpdateSchema = z
  .object({
    apellido: z.string().trim().min(2).max(60),
    telefono: z.string().trim().regex(phone),
    fechaNacimiento: z.string().regex(dateIso),
    edad: z.coerce.number().int().min(10).max(120),
    genero: z.enum(['H', 'M', 'Otro']),
    estudiante: z.boolean().optional().default(false),
    // Sólo obligatoria si estudiante es true — ver superRefine
    matricula: optionalText(z.string().trim().max(40)),
    peso: z.coerce.number().positive().max(300),
    grupoSanguineo: z.string().trim().min(1).max(12),
    alergiaMedicamentos: z.string().trim().min(1).max(120),
    emergencia: z.object({
      nombre: z.string().trim().min(2).max(60),
      parentesco: z.string().trim().min(2).max(40),
      telefono: z.string().trim().regex(phone),
    }),
    salud: saludSchema,
    habitos: habitosSchema,
  })
  .superRefine((d, ctx) => {
    if (d.estudiante && !d.matricula?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['matricula'], message: 'Requerido si eres estudiante' });
    }
    if (d.habitos.actividadHabitual) {
      if (!d.habitos.actividadTipo?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['habitos', 'actividadTipo'], message: 'Requerido si practicas actividad física' });
      }
      if (d.habitos.frecuenciaSemanal == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['habitos', 'frecuenciaSemanal'], message: 'Requerido si practicas actividad física' });
      }
      if (!d.habitos.tiempoSesion?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['habitos', 'tiempoSesion'], message: 'Requerido si practicas actividad física' });
      }
    }
  });
