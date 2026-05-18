import { useEffect, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { clientesService, recordatoriosService } from '../../services/modules.service.js';
import { fmtMoney, initials } from '../../utils/format.js';

export default function Recordatorios() {
  const [recs, setRecs] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [canal, setCanal] = useState('todos');

  useEffect(() => {
    Promise.all([recordatoriosService.list(), clientesService.list({ limit: 100 })])
      .then(([rs, cs]) => { setRecs(rs); setClientes(cs); })
      .catch(() => {});
  }, []);

  const byId = Object.fromEntries(clientes.map((c) => [c.clienteId, c]));
  const filtrados = recs.filter((r) => canal === 'todos' || r.tipo === canal);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Por vencer (7d)" value={recs.filter((r) => r.dias > 0 && r.dias <= 7).length} color={COLORS.accent} icon="◷" sub="Requieren aviso" />
        <StatCard label="Vencidos"        value={recs.filter((r) => r.dias < 0).length}                color={COLORS.red}    icon="⚠" sub="Cobro urgente" />
        <StatCard label="Enviados"        value={recs.filter((r) => r.estado === 'Enviado').length}    color={COLORS.green}  icon="✉" sub="WhatsApp + Email" />
        <StatCard label="Total"           value={recs.length}                                           color={COLORS.blue}   icon="◈" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['todos', 'WhatsApp', 'Email'].map((c) => (
          <button key={c} onClick={() => setCanal(c)}
                  style={{
                    padding: '7px 16px', borderRadius: 20,
                    border: `1px solid ${canal === c ? COLORS.accent : COLORS.border}`,
                    background: canal === c ? `${COLORS.accent}18` : 'transparent',
                    color: canal === c ? COLORS.accent : COLORS.muted, fontSize: 12, cursor: 'pointer',
                    fontWeight: canal === c ? 700 : 400,
                  }}>
            {c === 'todos' ? 'Todos' : c}
          </button>
        ))}
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {['Cliente', 'Vence en', 'Monto', 'Canal', 'Estado', 'Acciones'].map((h) => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((r) => {
              const c = byId[r.clienteId] || { nombre: '—', email: '—' };
              return (
                <tr key={r.recordatorioId}
                    onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar initials={initials(c.nombre)} size={32} />
                      <div>
                        <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{c.nombre}</div>
                        <div style={{ color: COLORS.muted, fontSize: 11 }}>{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ color: r.dias < 0 ? COLORS.red : r.dias <= 5 ? COLORS.accent : COLORS.subtle, fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700 }}>
                      {r.dias < 0 ? `${Math.abs(r.dias)}d vencido` : `${r.dias}d`}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: COLORS.green, fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600 }}>{fmtMoney(r.monto)}</td>
                  <td style={{ padding: '14px 18px', color: r.tipo === 'WhatsApp' ? '#25d366' : COLORS.blue, fontSize: 13 }}>
                    {r.tipo === 'WhatsApp' ? '📱' : '✉'} {r.tipo}
                  </td>
                  <td style={{ padding: '14px 18px' }}><Badge text={r.estado} /></td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ background: r.tipo === 'WhatsApp' ? '#128c7e' : COLORS.blue, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer' }}>Enviar</button>
                      <button style={{ background: COLORS.border, color: COLORS.muted, border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>✏</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
