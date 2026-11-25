import { COLORS } from '../../constants/theme.js';

const VARIANTS = {
  tip: { bg: '#0d2b1a', border: COLORS.green, label: COLORS.green },
  note: { bg: '#2b210d', border: '#F5A623', label: '#F5A623' },
  crit: { bg: '#2b0d0d', border: COLORS.red, label: COLORS.red },
};

export default function Callout({ variant = 'tip', title, children }) {
  const v = VARIANTS[variant] || VARIANTS.tip;
  return (
    <div
      style={{
        background: v.bg,
        borderLeft: `3px solid ${v.border}`,
        borderRadius: 10,
        padding: '12px 16px',
        margin: '14px 0',
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: v.label,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ color: COLORS.subtle, fontSize: 13.5, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
