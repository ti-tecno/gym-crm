/** Utilidades de la pantalla de Recordatorios y del Backoffice → Mensajería. */

// 'yyyy-mm-dd' es un día de calendario: se arma en hora local para que no se recorra un día.
export const fmtDia = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function etapaLabel(etapa) {
  if (!etapa) return '';
  if (etapa === 'd0') return 'Día de vencimiento';
  if (etapa.startsWith('manual')) return 'Manual';
  const m = etapa.match(/^d([+-])(\d+)$/);
  if (!m) return etapa;
  return `${m[2]} día${m[2] === '1' ? '' : 's'} ${m[1] === '-' ? 'antes' : 'después'}`;
}

/** -3 → 'd-3', 0 → 'd0', 3 → 'd+3' (mismo nombre que usa el backend). */
export const etapaDeOffset = (e) => (e === 0 ? 'd0' : e > 0 ? `d+${e}` : `d${e}`);
