import { z } from 'zod';

export const ROLES = ['ADMIN', 'COACH', 'RECEP', 'CLIENTE'];
export const roleEnum = z.enum(ROLES);

export const loginSchema = z.object({
  email: z.string().email().max(120).toLowerCase().trim(),
  password: z.string().min(8).max(128),
});

const optionalString = (schema) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

const inscripcionSchema = z.object({
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
    telefono: optionalString(z.string().trim().regex(/^[\d\s\-()+]{7,20}$/)),
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
});

// Registro público — sólo crea un usuario CLIENTE (no se permite elegir rol)
export const registerSchema = z.object({
  nombre:   z.string().trim().min(2).max(60),
  apellido: z.string().trim().min(2).max(60).optional(),
  email:    z.string().email().max(120).toLowerCase().trim(),
  telefono: z.string().regex(/^[\d\s\-()+]{7,20}$/).optional(),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, 'Debe incluir mayúscula')
    .regex(/[a-z]/, 'Debe incluir minúscula')
    .regex(/\d/,    'Debe incluir número'),
  plan: z.enum(['Básico', 'Premium', 'Elite']),
  inscripcion: inscripcionSchema,
});
