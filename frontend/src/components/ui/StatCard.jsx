import { COLORS } from '../../constants/theme.js';

export default function StatCard({ label, value, sub, color, icon }) {
  return (
    <div
      style={{
        background: COLORS.card, border: `1px solid ${COLORS.border}`,
        borderRadius: 14, padding: '22px 24px', position: 'relative', overflow: 'hidden',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 26, opacity: 0.1 }}>{icon}</div>
      <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ color: color || COLORS.accent, fontSize: 32, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ color: COLORS.subtle, fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
