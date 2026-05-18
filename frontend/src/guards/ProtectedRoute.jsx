import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/theme.js';
import { safeNext } from '../utils/safeRoute.js';

const HOME_FOR = (rol) => rol === ROLES.CLIENTE ? '/mi/resumen' : '/dashboard';

/**
 * Verifica:
 *  1) Sesión activa (usuario cargado)
 *  2) Access token vigente (o se intentará refresh por el interceptor)
 *  3) Rol permitido (RBAC) si se pasan `roles`
 * Si el rol no coincide, redirige a la home propia del rol (no a /dashboard fijo).
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#0A0B0E', color: '#6B7280' }}>
        Cargando…
      </div>
    );
  }

  if (!user) {
    const next = safeNext(location.pathname + location.search, HOME_FOR('STAFF'));
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (roles && roles.length && !hasRole(...roles)) {
    return <Navigate to={HOME_FOR(user.rol)} replace />;
  }

  return children;
}
