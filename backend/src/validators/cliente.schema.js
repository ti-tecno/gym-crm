import { z } from 'zod';

const planEnum = z.enum(['Básico', 'Premium', 'Elite']);
const estadoEnum = z.enum(['Activo', 'Por vencer', 'Vencido']);

// Helpers: aceptar strings vacíos opcionales (los normaliza a undefined antes de validar)
const optionalString = (schema) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

export const clienteCreateSchema = z.object({
  nombre: z.string().trim().min(2).max(60),
  apellido: optionalString(z.string().trim().min(2).max(60)),
  email: z.string().email().max(120).toLowerCase().trim(),
  telefono: optionalString(z.string().regex(/^[\d\s\-()+]{7,20}$/)),
  plan: planEnum,
  monto: z.number().positive().max(100_000),
  vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO yyyy-mm-dd
  objetivo: optionalString(z.string().max(60)),
  inscripcion: z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    peso: z.coerce.number().positive().max(300),
    fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    edad: z.coerce.number().int().min(10).max(120).optional(),
    genero: z.enum(['H', 'M', 'Otro']).optional(),
    estudiante: z.boolean().optional(),
    matricula: optionalString(z.string().trim().min(2).max(40)),
    grupoSanguineo: optionalString(z.string().trim().max(12)),
    alergiaMedicamentos: optionalString(z.string().trim().max(120)),
    emergencia: z.object({
      nombre: optionalString(z.string().trim().min(2).max(60)),
      parentesco: optionalString(z.string().trim().min(2).max(40)),
      telefono: optionalString(z.string().regex(/^[\d\s\-()+]{7,20}$/)),
    }).optional(),
    salud: z.object({
      cardiaco: z.boolean().optional(),
      pecho: z.boolean().optional(),
      ahogo: z.boolean().optional(),
      mareo: z.boolean().optional(),
      neurologico: z.boolean().optional(),
      respiratorio: z.boolean().optional(),
      osteoarticular: z.boolean().optional(),
      dolorReciente: z.boolean().optional(),
      factoresRiesgo: optionalString(z.string().trim().max(240)),
      medicamentoActual: optionalString(z.string().trim().max(240)),
      otroPadecimiento: optionalString(z.string().trim().max(240)),
    }).optional(),
    habitos: z.object({
      actividadHabitual: z.boolean().optional(),
      actividadTipo: optionalString(z.string().trim().max(80)),
      frecuenciaSemanal: z.coerce.number().int().min(0).max(14).optional(),
      tiempoSesion: optionalString(z.string().trim().max(40)),
      ultimaVezPrograma: optionalString(z.string().trim().max(80)),
    beneficios: z.array(z.string().trim().max(60)).max(8).optional(),
    aceptoResponsiva: z.boolean(),
  }).optional(),
  }),
  estado: estadoEnum.default('Activo'),
});

export const clienteUpdateSchema = clienteCreateSchema.partial();
export const clienteIdParam = z.object({ id: z.string().uuid() });
export const clienteQuery = z.object({
  q: z.string().max(60).optional(),
  plan: planEnum.optional(),
  estado: estadoEnum.optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  all: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});
