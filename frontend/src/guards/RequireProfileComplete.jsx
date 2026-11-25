import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLES } from '../constants/theme.js';

const PERFIL_PATH = '/mi/completar-perfil';

/**
 * Fuerza a un CLIENTE con perfil incompleto (p. ej. entró por Google y nunca llenó
 * el cuestionario de registro) a completarlo antes de usar el resto del portal.
 * No aplica a otros roles ni a la propia ruta de completar perfil.
 */
export default function RequireProfileComplete({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  const debeCompletar = user?.rol === ROLES.CLIENTE && user.perfilCompleto === false;
  if (debeCompletar && location.pathname !== PERFIL_PATH) {
    return <Navigate to={PERFIL_PATH} replace />;
  }

  return children;
}
