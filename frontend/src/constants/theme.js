export const COLORS = {
  bg: '#0A0B0E',
  surface: '#12141A',
  card: '#1A1D26',
  border: '#252836',
  accent: '#F5A623',
  accentDim: '#c47e0f',
  green: '#2ECC71',
  red: '#E74C3C',
  blue: '#4A90D9',
  purple: '#9B59B6',
  text: '#EAEDF3',
  muted: '#6B7280',
  subtle: '#9CA3AF',
};

export const NAV_ITEMS = [
  { id: 'dashboard',  to: '/dashboard',           icon: '⬡', label: 'Dashboard' },
  { id: 'clientes',   to: '/clientes',            icon: '◈', label: 'Clientes & Pagos' },
  { id: 'inventario', to: '/inventario',          icon: '▦', label: 'Inventario' },
  { id: 'nomina',     to: '/nomina',              icon: '◎', label: 'Nómina' },
  { id: 'rutinas',    to: '/rutinas/clientes',    icon: '◷', label: 'Rutinas Clientes' },
  { id: 'coach',      to: '/rutinas/coach',       icon: '◐', label: 'Rutinas Coach' },
];

export const ROLES = { ADMIN: 'ADMIN', COACH: 'COACH', RECEP: 'RECEP', CLIENTE: 'CLIENTE' };

export const STAFF_ROLES = [ROLES.ADMIN, ROLES.COACH, ROLES.RECEP];

// Items del sidebar del portal cliente
export const CLIENTE_NAV_ITEMS = [
  { id: 'mi-resumen',    to: '/mi/resumen',    icon: '⬡', label: 'Mi Resumen' },
  { id: 'mi-membresia',  to: '/mi/membresia',  icon: '◈', label: 'Membresía' },
  { id: 'mis-rutinas',   to: '/mi/rutinas',    icon: '◷', label: 'Mis Rutinas' },
  { id: 'mi-diario',     to: '/mi/diario',     icon: '✎', label: 'Diario' },
  { id: 'mis-medidas',   to: '/mi/medidas',    icon: '◐', label: 'Medidas' },
  { id: 'mi-progreso',   to: '/mi/progreso',   icon: '◎', label: 'Progreso' },
];
