/**
 * Helpers para validar que URLs y rutas provengan de fuentes confiables
 * antes de ser usadas por React Router o redirecciones.
 */

const ALLOWED_ROUTES = new Set([
  '/', '/login',
  // Staff
  '/dashboard',
  '/clientes', '/clientes/registro', '/clientes/pagos', '/clientes/recordatorios',
  '/inventario',
  '/nomina',
  '/rutinas/clientes', '/rutinas/coach',
  // Portal cliente
  '/mi/resumen', '/mi/membresia', '/mi/rutinas', '/mi/diario', '/mi/medidas', '/mi/progreso',
]);

/** Acepta sólo paths relativos del propio app. Rechaza protocolos `javascript:` etc. */
export function isSafeRoute(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;                // protocol-relative
  if (/^\s*javascript:/i.test(path)) return false;
  if (path.includes('\\')) return false;
  // sólo caracteres URL seguros
  if (!/^[\w\-./?=&%:]+$/.test(path)) return false;
  return true;
}

export function safeNext(path, fallback = '/dashboard') {
  return isSafeRoute(path) ? path : fallback;
}

/** Permite navegar sólo a rutas conocidas (whitelist). Útil para parámetros tipo ?next=. */
export function isWhitelistedRoute(path) {
  if (!isSafeRoute(path)) return false;
  const clean = path.split('?')[0];
  return ALLOWED_ROUTES.has(clean);
}

const ALLOWED_HOSTS = new Set([
  window.location.host, // mismo origen
]);

/** Verifica que una URL externa (para abrir, fetch, etc.) sea confiable. */
export function isSafeUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    if (!['https:', 'http:'].includes(u.protocol)) return false;
    return ALLOWED_HOSTS.has(u.host);
  } catch {
    return false;
  }
}
