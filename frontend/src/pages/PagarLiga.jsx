import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { COLORS } from '../constants/theme.js';
import ResultadoPago from '../components/pago/ResultadoPago.jsx';
import { ligaPago } from '../services/cliente.service.js';
import { fmtMoney } from '../utils/format.js';
import { fmtDia } from '../utils/recordatorios.js';

const TOKEN = /^[A-Za-z0-9_-]{47}$/;
const FOLIO = /^(TXN-[0-9A-F]{4,16}|MP-\d{1,20})$/;
const INVALIDA = 'Esta liga de pago no es válida o ya venció. Pide una nueva o pasa a recepción.';

function Marco({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, color: COLORS.text, padding: '40px 16px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 24, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>
          IRON<span style={{ color: COLORS.accent }}>CORE</span> GYM
        </div>
        {children}
      </div>
    </div>
  );
}

const tarjeta = { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 26 };

/** /pagar/:token — liga pública del recordatorio (sin iniciar sesión). Datos mínimos. */
export function PagarLiga() {
  const { token } = useParams();
  const valido = TOKEN.test(token || '');
  const [d, setD] = useState(null);
  const [error, setError] = useState(valido ? '' : INVALIDA);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    if (!valido) return;
    ligaPago.datos(token).then(setD).catch((e) => setError(e?.response?.data?.error || INVALIDA));
  }, [token, valido]);

  const pagar = async () => {
    setPagando(true); setError('');
    try {
      const { url } = await ligaPago.checkout(token);
      if (!/^https:\/\//.test(url || '')) throw new Error('liga');
      window.location.assign(url);
    } catch (e) {
      setError(e?.response?.data?.error || 'No pudimos abrir el pago en línea. Intenta de nuevo o paga en recepción.');
      setPagando(false);
    }
  };

  if (error && !d) return <Marco><div style={{ ...tarjeta, textAlign: 'center', color: COLORS.subtle }}>{error}</div></Marco>;
  if (!d) return <Marco><div style={{ ...tarjeta, textAlign: 'center', color: COLORS.muted }}>Cargando…</div></Marco>;

  return (
    <Marco>
      <div style={tarjeta}>
        <h1 style={{ margin: 0, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 800 }}>
          {d.nombre ? `Hola, ${d.nombre}` : 'Pago de membresía'}
        </h1>
        <div style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>Renovación de tu membresía en IronCore Gym</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
          {[
            ['Plan', [d.plan, d.periodo].filter(Boolean).join(' · ') || '—'],
            ['Monto', `${fmtMoney(d.monto)} MXN`],
            ['Vigente hasta hoy', fmtDia(d.vencimientoActual)],
            ['Al pagar, vigente hasta', fmtDia(d.vencimientoTrasPagar)],
          ].map(([k, v]) => (
            <div key={k} style={{ background: COLORS.surface, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>{k}</div>
              <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        {d.puedePagar ? (
          <>
            <button onClick={pagar} disabled={pagando}
                    style={{ width: '100%', marginTop: 22, background: COLORS.accent, color: '#000', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 800, fontSize: 18, cursor: pagando ? 'wait' : 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
              {pagando ? 'Abriendo Mercado Pago…' : `Pagar ${fmtMoney(d.monto)}`}
            </button>
            <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
              Tarjeta, OXXO o SPEI en la página segura de Mercado Pago. Tus datos de pago no pasan por IronCore.
            </div>
          </>
        ) : (
          <div style={{ marginTop: 20, background: '#2b1a0d', border: `1px solid ${COLORS.accent}44`, borderRadius: 10, padding: '12px 16px', fontSize: 14, color: COLORS.subtle }}>
            {d.motivo}
          </div>
        )}
        {error && <div style={{ color: COLORS.red, fontSize: 13, marginTop: 10 }}>{error}</div>}
      </div>
    </Marco>
  );
}

/** /pagar/:token/resultado?pago=<folio> — regreso de Mercado Pago a la liga pública. */
export function PagarLigaResultado() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const folio = [params.get('pago'), params.get('external_reference')].find((v) => FOLIO.test(v || '')) || null;
  const consultar = useCallback(() => ligaPago.pago(token, folio), [token, folio]);
  if (!TOKEN.test(token || '') || !folio) {
    return <Marco><div style={{ ...tarjeta, textAlign: 'center', color: COLORS.subtle }}>No encontramos este pago. Si tienes dudas, pasa a recepción.</div></Marco>;
  }
  return <Marco><ResultadoPago consultar={consultar} /></Marco>;
}

export default PagarLiga;
