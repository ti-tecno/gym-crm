export const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('es-MX');

export const initials = (nombre = '') =>
  nombre.trim().split(/\s+/).map(p => p[0] || '').slice(0, 2).join('').toUpperCase();

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const daysUntil = (iso) => {
  if (!iso) return 0;
  return Math.ceil((new Date(iso) - new Date()) / 86_400_000);
};
