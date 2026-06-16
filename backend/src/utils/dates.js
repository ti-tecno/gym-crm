/** Días restantes hasta una fecha ISO (yyyy-mm-dd). Negativo si está vencido. */
export function daysUntilIso(iso) {
  if (!iso) return null;
  const target = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86_400_000);
}
