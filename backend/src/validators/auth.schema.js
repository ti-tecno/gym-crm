import { z } from 'zod';

export const ROLES = ['ADMIN', 'COACH', 'RECEP', 'CLIENTE'];
export const roleEnum = z.enum(ROLES);

export const loginSchema = z.object({
  email: z.string().email().max(120).toLowerCase().trim(),
  password: z.string().min(8).max(128),
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
});
