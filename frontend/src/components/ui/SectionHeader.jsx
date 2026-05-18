import { COLORS } from '../../constants/theme.js';

export default function SectionHeader({ title, sub, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>
          Módulo
        </div>
        <h2 style={{ margin: 0, color: COLORS.text, fontSize: 36, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800 }}>
          {title}
        </h2>
        {sub && <p style={{ margin: '4px 0 0', color: COLORS.muted, fontSize: 13 }}>{sub}</p>}
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
