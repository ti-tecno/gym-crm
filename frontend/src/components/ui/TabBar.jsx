import { COLORS } from '../../constants/theme.js';

export default function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 3, background: COLORS.surface, borderRadius: 12,
      padding: 4, marginBottom: 24, width: 'fit-content', border: `1px solid ${COLORS.border}`,
    }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14,
            fontWeight: active === t.id ? 700 : 500,
            background: active === t.id ? COLORS.accent : 'transparent',
            color: active === t.id ? '#000' : COLORS.muted,
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}
