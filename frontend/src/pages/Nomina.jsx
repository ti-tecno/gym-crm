import { useEffect, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Badge from '../components/ui/Badge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { nominaService } from '../services/modules.service.js';
import { fmtMoney, initials } from '../utils/format.js';

export default function Nomina() {
  const [emp, setEmp] = useState([]);
  const refresh = () => nominaService.list().then(setEmp).catch(() => setEmp([]));
  useEffect(() => { refresh(); }, []);

  const total = emp.reduce((a, e) => a + Number(e.salario || 0), 0);
  const pendientes = emp.filter((e) => e.estado === 'Pendiente').length;

  const pagar = async (id) => { try { await nominaService.pagar(id); refresh(); } catch (e) { /* TODO toast */ } };

  return (
    <div>
      <SectionHeader title="Nómina" sub="Control de personal y pagos" action="Procesar Pago" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Empleados"    value={emp.length}            color={COLORS.accent} icon="◎" />
        <StatCard label="Nómina Total" value={fmtMoney(total)}       color={COLORS.green}  icon="◈" />
        <StatCard label="Pendientes"   value={pendientes}            color={COLORS.red}    icon="◷" />
        <StatCard label="Mes"          value={new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })} color={COLORS.blue} icon="⬡" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {emp.map((e) => (
          <div key={e.empleadoId}
               onMouseEnter={(ev) => (ev.currentTarget.style.transform = 'translateX(4px)')}
               onMouseLeave={(ev) => (ev.currentTarget.style.transform = 'translateX(0)')}
               style={{
                 background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14,
                 padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 18,
                 transition: 'transform 0.15s',
               }}>
            <Avatar initials={initials(e.nombre)} size={42} />
            <div style={{ flex: 1 }}>
              <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16, fontFamily: "'Barlow Condensed',sans-serif" }}>{e.nombre}</div>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>{e.puesto}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Horas</div>
              <div style={{ color: COLORS.text, fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 600 }}>{e.horas}h</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Salario</div>
              <div style={{ color: COLORS.green, fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700 }}>{fmtMoney(e.salario)}</div>
            </div>
            <Badge text={e.estado} />
            <button
              onClick={() => e.estado === 'Pendiente' && pagar(e.empleadoId)}
              style={{
                background: e.estado === 'Pendiente' ? COLORS.accent : COLORS.border,
                color: e.estado === 'Pendiente' ? '#000' : COLORS.muted,
                border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 700,
              }}
            >
              {e.estado === 'Pendiente' ? 'Pagar' : 'Ver'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
