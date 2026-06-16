import { useEffect, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Badge from '../components/ui/Badge.jsx';
import { inventarioService } from '../services/modules.service.js';
import { fmtMoney } from '../utils/format.js';

export default function Inventario() {
  const [items, setItems] = useState([]);
  useEffect(() => { inventarioService.list().then(setItems).catch(() => setItems([])); }, []);

  const total = items.reduce((a, i) => a + Number(i.precio || 0) * Number(i.cantidad || 0), 0);
  const bajo = items.filter((i) => i.estado !== 'OK').length;

  return (
    <div>
      <SectionHeader title="Inventario" sub="Control de equipos y materiales" action="+ Agregar" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Artículos" value={items.length} color={COLORS.accent} icon="▦" />
        <StatCard label="Valor Total"     value={fmtMoney(total)} color={COLORS.blue} icon="◎" />
        <StatCard label="Bajo Stock"      value={bajo} color={COLORS.red} icon="⚠" />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {['Artículo', 'Categoría', 'Cantidad', 'Mínimo', 'Precio', 'Estado'].map((h) => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.itemId}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{ borderBottom: `1px solid ${COLORS.border}` }}
              >
                <td style={{ padding: '13px 18px', color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{item.nombre}</td>
                <td style={{ padding: '13px 18px' }}>
                  <span style={{ background: COLORS.border, color: COLORS.subtle, padding: '3px 10px', borderRadius: 20, fontSize: 11 }}>
                    {item.categoria}
                  </span>
                </td>
                <td style={{ padding: '13px 18px', fontFamily: "'DM Mono',monospace", fontSize: 14, color: item.cantidad <= item.minimo ? COLORS.red : COLORS.text, fontWeight: 600 }}>
                  {item.cantidad}
                  <div style={{ width: 48, height: 4, background: COLORS.border, borderRadius: 2, marginTop: 4 }}>
                    <div style={{
                      width: `${Math.min(100, (item.cantidad / Math.max(1, item.minimo * 2)) * 100)}%`,
                      height: '100%',
                      background: item.cantidad < item.minimo ? COLORS.red : item.cantidad === item.minimo ? COLORS.accent : COLORS.green,
                      borderRadius: 2,
                    }} />
                  </div>
                </td>
                <td style={{ padding: '13px 18px', color: COLORS.muted, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{item.minimo}</td>
                <td style={{ padding: '13px 18px', color: COLORS.green, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{fmtMoney(item.precio)}</td>
                <td style={{ padding: '13px 18px' }}><Badge text={item.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
