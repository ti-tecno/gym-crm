import { useEffect, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { clientePortal } from '../../services/cliente.service.js';
import { fmtDate, fmtMoney } from '../../utils/format.js';

export default function MiMembresia() {
  const [m, setM] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    clientePortal.membresia().then(setM).catch((e) => setErr(e?.response?.data?.error || 'Error'));
  }, []);

  if (err) return <div style={{ color: COLORS.red }}>{err}</div>;
  if (!m) return <div style={{ color: COLORS.muted }}>Cargando…</div>;

  const color = m.estado === 'Activo' ? COLORS.green : m.estado === 'Vencido' ? COLORS.red : COLORS.accent;

  return (
    <div>
      <SectionHeader title="Mi Membresía" sub="Estado, plan y vigencia" />

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 28, maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, background: `${color}22`, border: `2px solid ${color}`, display: 'grid', placeItems: 'center', fontSize: 36 }}>
            {m.estado === 'Activo' ? '✓' : m.estado === 'Vencido' ? '⚠' : '◷'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: COLORS.muted, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Estado</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0, color, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 36, fontWeight: 800 }}>
                {m.estado}
              </h2>
              <Badge text={m.plan} />
            </div>
            <div style={{ color: COLORS.subtle, fontSize: 14, marginTop: 4 }}>
              {m.diasRestantes < 0
                ? <>Tu membresía venció hace <strong style={{ color: COLORS.red }}>{Math.abs(m.diasRestantes)} días</strong>.</>
                : m.diasRestantes <= 7
                  ? <>Tu membresía vence en <strong style={{ color: COLORS.accent }}>{m.diasRestantes} día{m.diasRestantes === 1 ? '' : 's'}</strong>. ¡Renueva pronto!</>
                  : <>Tu membresía está vigente <strong style={{ color: COLORS.green }}>{m.diasRestantes} días</strong> más.</>}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[
            ['Plan',          m.plan],
            ['Mensualidad',   fmtMoney(m.monto)],
            ['Fecha de vencimiento', fmtDate(m.vencimiento)],
            ['Miembro desde', fmtDate(m.alta)],
            ['Email',         m.email],
            ['Nombre',        m.nombre],
          ].map(([k, v]) => (
            <div key={k} style={{ background: COLORS.surface, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>{k}</div>
              <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22, background: '#2b1a0d', border: `1px solid ${COLORS.accent}44`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: COLORS.subtle }}>
          💡 Para renovar pasa a recepción o solicita una liga de pago en línea. El recibo se enviará a tu correo automáticamente.
        </div>
      </div>
    </div>
  );
}
