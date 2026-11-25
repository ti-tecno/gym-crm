import { useState } from 'react';
import { COLORS } from '../../constants/theme.js';

export default function Accordion({ items, defaultOpen = 0 }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.id || i}
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '16px 20px',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  display: 'grid',
                  placeItems: 'center',
                  color: COLORS.accent,
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontWeight: 800,
                      fontSize: 19,
                      color: COLORS.text,
                    }}
                  >
                    {item.title}
                  </span>
                  {item.tag && (
                    <span
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 11,
                        color: COLORS.blue,
                        background: '#0d1a2b',
                        padding: '2px 9px',
                        borderRadius: 20,
                      }}
                    >
                      {item.tag}
                    </span>
                  )}
                  {item.badge && (
                    <span
                      style={{
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 10.5,
                        color: item.badge.color,
                        background: item.badge.bg,
                        padding: '2px 9px',
                        borderRadius: 20,
                      }}
                    >
                      {item.badge.text}
                    </span>
                  )}
                </div>
                {item.dek && <div style={{ color: COLORS.muted, fontSize: 12.5, marginTop: 2 }}>{item.dek}</div>}
              </div>
              <span
                style={{
                  color: COLORS.muted,
                  fontSize: 14,
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s',
                  flexShrink: 0,
                }}
              >
                ▾
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 20px 20px 68px', color: COLORS.subtle, fontSize: 14, lineHeight: 1.65 }}>
                {item.children}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
