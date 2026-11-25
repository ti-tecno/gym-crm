import { useEffect, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { clientePortal } from '../../services/cliente.service.js';
import { fmtDate, fmtMoney } from '../../utils/format.js';
import { fmtDia } from '../../utils/recordatorios.js';

const fmtMomento = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function MiMembresia() {
  const [m, setM] = useState(null);
  const [err, setErr] = useState('');
  const [pagos, setPagos] = useState(null);
  const [pagando, setPagando] = useState(false);
  const [errPago, setErrPago] = useState('');

  useEffect(() => {
    clientePortal.membresia().then(setM).catch((e) => setErr(e?.response?.data?.error || 'Error'));
    clientePortal.pagos().then(setPagos).catch(() => setPagos(null));
  }, []);

  // El monto y el concepto los decide el backend; aquí solo se pide el checkout y se redirige.
  const pagar = async () => {
    setPagando(true); setErrPago('');
    try {
      const { url } = await clientePortal.checkout();
      if (!/^https:\/\//.test(url || '')) throw new Error('liga');
      window.location.assign(url);
    } catch (e) {
      setErrPago(e?.response?.data?.error || 'No pudimos abrir el pago en línea. Intenta de nuevo o paga en recepción.');
      setPagando(false);
    }
  };

  if (err) return <div style={{ color: COLORS.red }}>{err}</div>;
  if (!m) return <div style={{ color: COLORS.muted }}>Cargando…</div>;

  const color = m.estado === 'Activo' ? COLORS.green : m.estado === 'Vencido' ? COLORS.red : COLORS.accent;

  return (
    <div>
      <SectionHeader title="Mi Membresía" sub="Estado, plan, vigencia y pagos" />

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
            ['Fecha de vencimiento', fmtDia(m.vencimiento)],
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

        {pagos?.puedePagar ? (
          <div style={{ marginTop: 22, background: `${COLORS.accent}12`, border: `1px solid ${COLORS.accent}55`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>Paga tu membresía en línea</div>
              <div style={{ color: COLORS.subtle, fontSize: 13, marginTop: 4 }}>
                {pagos.plan ? `Plan ${pagos.plan}, ` : ''}{pagos.periodo}: <b style={{ color: COLORS.text }}>{fmtMoney(pagos.monto)} MXN</b>.
                {' '}Al pagar quedarías vigente hasta el <b style={{ color: COLORS.green }}>{fmtDia(pagos.vencimientoTrasPagar)}</b>
                {pagos.desde === 'pago' ? ' (contando desde el día en que se acredite el pago).' : '.'}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>Tarjeta, OXXO o SPEI en la página segura de Mercado Pago. Tus datos de pago no pasan por IronCore.</div>
              {errPago && <div style={{ color: COLORS.red, fontSize: 13, marginTop: 6 }}>{errPago}</div>}
            </div>
            <button onClick={pagar} disabled={pagando}
                    style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 10, padding: '12px 22px', fontWeight: 800, fontSize: 15, cursor: pagando ? 'wait' : 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
              {pagando ? 'Abriendo Mercado Pago…' : `Pagar ${fmtMoney(pagos.monto)}`}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 22, background: '#2b1a0d', border: `1px solid ${COLORS.accent}44`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: COLORS.subtle }}>
            💡 {pagos?.motivo || 'Para renovar pasa a recepción.'}
          </div>
        )}
      </div>

      {pagos?.pagos?.length > 0 && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20, maxWidth: 720, marginTop: 20 }}>
          <div style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Mis pagos</div>
          {pagos.pagos.map((p) => (
            <div key={p.pagoId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{p.medio} · {fmtMomento(p.fecha)}</div>
                <div style={{ color: COLORS.muted, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                  Folio {p.pagoId}{p.vencimientoNuevo ? ` · vigente hasta ${fmtDia(p.vencimientoNuevo)}` : ''}
                  {p.esperandoEfectivo ? ' · esperando tu pago en OXXO/SPEI' : ''}
                </div>
              </div>
              <div style={{ color: p.estado === 'Exitoso' ? COLORS.green : COLORS.muted, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{fmtMoney(p.monto)}</div>
              <Badge text={p.sinCompletar ? 'Sin completar' : p.estado} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
