import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import ClienteLayout from './components/layout/ClienteLayout.jsx';
import ProtectedRoute from './guards/ProtectedRoute.jsx';
import { ROLES, STAFF_ROLES } from './constants/theme.js';
import { useAuth } from './context/AuthContext.jsx';

import Login from './pages/Login.jsx';

// Staff
import Dashboard from './pages/Dashboard.jsx';
import Clientes from './pages/Clientes/index.jsx';
import Inventario from './pages/Inventario.jsx';
import Nomina from './pages/Nomina.jsx';
import RutinasClientes from './pages/RutinasClientes.jsx';
import RutinasCoach from './pages/RutinasCoach.jsx';

// Portal cliente
import MiResumen from './pages/Cliente/MiResumen.jsx';
import MiMembresia from './pages/Cliente/MiMembresia.jsx';
import MisRutinas from './pages/Cliente/MisRutinas.jsx';
import Diario from './pages/Cliente/Diario.jsx';
import Medidas from './pages/Cliente/Medidas.jsx';
import Progreso from './pages/Cliente/Progreso.jsx';

/** Redirige el root según el rol del usuario autenticado. */
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.rol === ROLES.CLIENTE ? '/mi/resumen' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* ── Portal STAFF (ADMIN / COACH / RECEP) ── */}
      <Route element={<ProtectedRoute roles={STAFF_ROLES}><Layout /></ProtectedRoute>}>
        <Route path="/dashboard"  element={<Dashboard />} />
        <Route path="/clientes/*" element={<Clientes />} />
        <Route path="/inventario" element={<ProtectedRoute roles={[ROLES.ADMIN]}><Inventario /></ProtectedRoute>} />
        <Route path="/nomina"     element={<ProtectedRoute roles={[ROLES.ADMIN]}><Nomina /></ProtectedRoute>} />
        <Route path="/rutinas/clientes" element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.COACH]}><RutinasClientes /></ProtectedRoute>} />
        <Route path="/rutinas/coach"    element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.COACH]}><RutinasCoach /></ProtectedRoute>} />
      </Route>

      {/* ── Portal CLIENTE ── */}
      <Route element={<ProtectedRoute roles={[ROLES.CLIENTE]}><ClienteLayout /></ProtectedRoute>}>
        <Route path="/mi/resumen"   element={<MiResumen />} />
        <Route path="/mi/membresia" element={<MiMembresia />} />
        <Route path="/mi/rutinas"   element={<MisRutinas />} />
        <Route path="/mi/diario"    element={<Diario />} />
        <Route path="/mi/medidas"   element={<Medidas />} />
        <Route path="/mi/progreso"  element={<Progreso />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
