const MAP = {
  'Activo':     { bg: '#0d2b1a', color: '#2ECC71' },
  'Vencido':    { bg: '#2b0d0d', color: '#E74C3C' },
  'Por vencer': { bg: '#2b210d', color: '#F5A623' },
  'OK':         { bg: '#0d2b1a', color: '#2ECC71' },
  'Bajo':       { bg: '#2b210d', color: '#F5A623' },
  'Crítico':    { bg: '#2b0d0d', color: '#E74C3C' },
  'Pagado':     { bg: '#0d2b1a', color: '#2ECC71' },
  'Pendiente':  { bg: '#2b210d', color: '#F5A623' },
  'Enviado':    { bg: '#0d2b1a', color: '#2ECC71' },
  'Programado': { bg: '#0d1a2b', color: '#4A90D9' },
  'Exitoso':    { bg: '#0d2b1a', color: '#2ECC71' },
  'Fallido':    { bg: '#2b0d0d', color: '#E74C3C' },
};

export default function Badge({ text }) {
  const c = MAP[text] || { bg: '#252836', color: '#6B7280' };
  return (
    <span
      style={{
        background: c.bg, color: c.color, padding: '3px 10px',
        borderRadius: 20, fontSize: 11, fontWeight: 600,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {text}
    </span>
  );
}
