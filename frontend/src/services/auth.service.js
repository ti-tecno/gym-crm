import { z } from 'zod';
import { api, silentRefresh } from './api.js';
import { tokenStore } from '../utils/tokenStore.js';

const loginResponseSchema = z.object({
  accessToken: z.string(),
  csrfToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    nombre: z.string(),
    rol: z.enum(['ADMIN', 'COACH', 'RECEP', 'CLIENTE']),
    clienteId: z.string().nullable().optional(),
  }),
});

const ROLE = z.enum(['ADMIN', 'COACH', 'RECEP', 'CLIENTE']);

const meSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  nombre: z.string(),
  rol: ROLE,
  clienteId: z.string().nullable().optional(),
});

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  const parsed = loginResponseSchema.parse(data);
  tokenStore.setAccess(parsed.accessToken);
  tokenStore.setCsrf(parsed.csrfToken);
  return parsed.user;
}

/** Auto-registro de CLIENTE — devuelve la sesión activa (igual que login). */
export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  const parsed = loginResponseSchema.parse(data);
  tokenStore.setAccess(parsed.accessToken);
  tokenStore.setCsrf(parsed.csrfToken);
  return parsed.user;
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
  tokenStore.clearAll();
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return meSchema.parse(data);
}

export async function bootstrapSession() {
  // En primer load no tenemos access; intenta refresh por cookie httpOnly
  try {
    await silentRefresh();
    return await fetchMe();
  } catch {
    return null;
  }
}
