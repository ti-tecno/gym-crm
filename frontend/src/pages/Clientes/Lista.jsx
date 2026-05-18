import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { clientesService } from '../../services/modules.service.js';
import { fmtDate, fmtMoney, initials } from '../../utils/format.js';
import { sanitizeText } from '../../utils/sanitize.js';

export default function Lista({ onNuevo, onPagar, onRecordar }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');

  useEffect(() => { clientesService.list({ limit: 100 }).then(setItems).catch(() => setItems([])); }, []);

  const cleanSearch = sanitizeText(search).toLowerCase();
  const filtered = useMemo(() => items.filter((c) =>
    (!plan || c.plan === plan) &&
    (!cleanSearch || c.nombre.toLowerCase().includes(cleanSearch))
  ), [items, plan, cleanSearch]);

  const activos = items.filter((c) => c.estado === 'Activo').length;
  const vencidos = items.filter((c) => c.estado === 'Vencido').length;
  const ingresos = items.reduce((a, c) => a + Number(c.monto || 0), 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Clientes" value={items.length}    color={COLORS.accent} icon="◈" />
        <StatCard label="Mensualidad Activa" value={fmtMoney(ingresos)} color={COLORS.green}  icon="◎" />
        <StatCard label="Vencidos"       value={vencidos}        color={COLORS.red}    icon="◷" />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            maxLength={60} placeholder="Buscar cliente…"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 14px', color: COLORS.text, fontSize: 13, flex: 1, outline: 'none', fontFamily: 'inherit' }}
          />
          <select
            value={plan} onChange={(e) => setPlan(e.target.value)}
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 12px', color: COLORS.subtle, fontSize: 13, outline: 'none' }}
          >
            <option value="">Todos los planes</option>
            <option>Básico</option><option>Premium</option><option>Elite</option>
          </select>
          <button onClick={onNuevo} style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Nuevo
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {['Cliente', 'Plan', 'Vencimiento', 'Monto', 'Estado', 'Acciones'].map((h) => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.clienteId}
                  onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  style={{ borderBottom: `1px solid ${COLORS.border}`, transition: 'background 0.15s' }}>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar initials={initials(c.nombre)} size={32} />
                    <div>
                      <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{c.nombre}</div>
                      <div style={{ color: COLORS.muted, fontSize: 11 }}>{c.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 18px', color: COLORS.subtle, fontSize: 13 }}>{c.plan}</td>
                <td style={{ padding: '13px 18px', color: COLORS.subtle, fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{fmtDate(c.vencimiento)}</td>
                <td style={{ padding: '13px 18px', color: COLORS.green, fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{fmtMoney(c.monto)}</td>
                <td style={{ padding: '13px 18px' }}><Badge text={c.estado} /></td>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={onPagar} style={{ background: `${COLORS.accent}22`, color: COLORS.accent, border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>💳 Pagar</button>
                    <button onClick={onRecordar} style={{ background: `${COLORS.blue}22`, color: COLORS.blue, border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>🔔</button>
                    <button style={{ background: COLORS.border, color: COLORS.muted, border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>✏</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
