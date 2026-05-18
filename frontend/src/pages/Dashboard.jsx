import { useEffect, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import StatCard from '../components/ui/StatCard.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { dashboardService } from '../services/modules.service.js';
import { fmtMoney, initials } from '../utils/format.js';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [anim, setAnim] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try { setData(await dashboardService.summary()); }
      catch (e) { setErr(e?.response?.data?.error || 'No fue posible cargar el dashboard'); }
    })();
    const t = setTimeout(() => setAnim(1), 100);
    return () => clearTimeout(t);
  }, []);

  if (err) return <div style={{ color: COLORS.red }}>{err}</div>;
  if (!data) return <div style={{ color: COLORS.muted }}>Cargando…</div>;

  const week = data.asistenciaSemanal || [];
  const max = Math.max(1, ...week);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>
          Sistema de Gestión
        </div>
        <h1 style={{ margin: 0, color: COLORS.text, fontSize: 46, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: -1 }}>
          Panel de Control <span style={{ color: COLORS.accent }}>GymOS</span>
        </h1>
        <p style={{ color: COLORS.muted, margin: '6px 0 0', fontSize: 14 }}>Resumen general</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Clientes Activos"  value={data.kpis.activos}                color={COLORS.green}  icon="◈" />
        <StatCard label="Ingresos (recientes)" value={fmtMoney(data.kpis.ingresosMes)} color={COLORS.accent} icon="◎" />
        <StatCard label="Por Vencer (7d)"   value={data.kpis.porVencer}              color={COLORS.red}    icon="◷" />
        <StatCard label="Stock Bajo"        value={data.kpis.stockBajo}              color={COLORS.blue}   icon="⬡" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, marginBottom: 20 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 20 }}>
            Asistencia Semanal
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120 }}>
            {week.map((val, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ color: COLORS.muted, fontSize: 10 }}>{val}</div>
                <div style={{
                  width: '100%', borderRadius: 6,
                  height: anim ? `${(val / max) * 90}px` : '0px',
                  background: i === 4 ? COLORS.accent : `${COLORS.accent}44`,
                  transition: `height 0.8s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.05}s`,
                  minHeight: 4,
                }} />
                <div style={{ color: i === 4 ? COLORS.accent : COLORS.muted, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                  {DAYS[i]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 14 }}>
            Últimos Pagos
          </div>
          {(data.ultimosPagos || []).map((p) => (
            <div key={p.pagoId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
              <Avatar initials={initials(p.clienteId?.slice(0, 2) || 'CL')} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.pagoId}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 11 }}>{p.metodo}{p.cardLast4 ? ` •••• ${p.cardLast4}` : ''}</div>
              </div>
              <div style={{ color: p.estado === 'Exitoso' ? COLORS.green : COLORS.red, fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700 }}>
                {fmtMoney(p.monto)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.alertas?.length > 0 && (
        <div style={{ background: '#2b1a0d', border: `1px solid ${COLORS.accent}44`, borderRadius: 14, padding: '14px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span>⚠</span>
            <span style={{ color: COLORS.accent, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16 }}>
              Alertas del Sistema
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {data.alertas.map((a, i) => (
              <div key={i} style={{ color: COLORS.subtle, fontSize: 13 }}>· {a}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
