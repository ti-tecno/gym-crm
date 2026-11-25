import { useEffect, useRef, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import { fmtMoney } from '../../utils/format.js';
import { fmtDia } from '../../utils/recordatorios.js';

const ESPERA_MS = 3_000;
const MAX_CONSULTAS = 20; // ~1 minuto esperando el aviso de Mercado Pago

/**
 * Resultado de un pago en línea. NO confía en los parámetros con que regresa Mercado Pago:
 * consulta el estado a nuestro backend, que solo cambia con el aviso (webhook) de Mercado Pago.
 * `consultar()` devuelve { estado, sinCompletar, monto, medio, vencimientoNuevo, esperandoEfectivo }.
 */
export default function ResultadoPago({ consultar, accion }) {
  const [pago, setPago] = useState(null);
  const [error, setError] = useState('');
  const [agotado, setAgotado] = useState(false);
  const intentos = useRef(0);

  useEffect(() => {
    let vivo = true;
    let timer;
    const ciclo = async () => {
      try {
        const p = await consultar();
        if (!vivo) return;
        setPago(p);
        const esperando = p.estado === 'Pendiente' && !p.esperandoEfectivo;
        intentos.current += 1;
        if (esperando && intentos.current < MAX_CONSULTAS) timer = setTimeout(ciclo, ESPERA_MS);
        else if (esperando) setAgotado(true);
      } catch (e) {
        if (vivo) setError(e?.response?.data?.error || 'No pudimos consultar tu pago.');
      }
    };
    ciclo();
    return () => { vivo = false; clearTimeout(timer); };
  }, [consultar]);

  const caja = (color, icono, titulo, texto) => (
    <div style={{ background: COLORS.card, border: `1px solid ${color}55`, borderRadius: 16, padding: 28, maxWidth: 560, textAlign: 'center', margin: '0 auto' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', border: `2px solid ${color}`, color, display: 'grid', placeItems: 'center', fontSize: 30, margin: '0 auto 14px' }}>{icono}</div>
      <h2 style={{ color, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 800, margin: 0 }}>{titulo}</h2>
      <div style={{ color: COLORS.subtle, fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>{texto}</div>
      {pago?.pagoId && <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 12, fontFamily: "'DM Mono',monospace" }}>Folio {pago.pagoId}</div>}
      {accion && <div style={{ marginTop: 18 }}>{accion}</div>}
    </div>
  );

  if (error) return caja(COLORS.red, '!', 'No pudimos consultar tu pago', error);
  if (!pago) return caja(COLORS.blue, '…', 'Consultando tu pago', 'Un momento, por favor.');

  if (pago.estado === 'Exitoso') {
    return caja(COLORS.green, '✓', '¡Pago recibido!', <>
      Recibimos tu pago de <b>{fmtMoney(pago.monto)}</b>{pago.medio ? ` (${pago.medio})` : ''}.
      {pago.vencimientoNuevo && <> Tu membresía está vigente hasta el <b style={{ color: COLORS.green }}>{fmtDia(pago.vencimientoNuevo)}</b>.</>}
    </>);
  }
  if (pago.estado === 'Pendiente' && pago.esperandoEfectivo) {
    return caja(COLORS.accent, '◷', 'Pago pendiente', <>
      Tu ficha de pago está lista. Cuando pagues en {pago.medio || 'OXXO o por SPEI'}, Mercado Pago nos avisará y tu membresía se renovará automáticamente
      (puede tardar algunas horas). Revisa tu correo para ver la ficha.
    </>);
  }
  if (pago.estado === 'Pendiente') {
    return agotado
      ? caja(COLORS.accent, '◷', 'Aún sin confirmación', 'Mercado Pago todavía no nos confirma el pago. Si lo completaste, se reflejará en unos minutos; si lo cancelaste, puedes intentar de nuevo.')
      : caja(COLORS.blue, '…', 'Confirmando tu pago', 'Estamos esperando la confirmación de Mercado Pago. No cierres esta página.');
  }
  if (pago.estado === 'Rechazado') {
    return caja(COLORS.red, '✕', 'Pago rechazado', 'Mercado Pago no aprobó el pago y no se hizo ningún cargo. Puedes intentar con otro medio o pagar en recepción.');
  }
  if (pago.estado === 'Cancelado') {
    return caja(COLORS.muted, '✕', 'Pago cancelado', 'El pago se canceló o la ficha venció. Puedes intentarlo de nuevo o pagar en recepción.');
  }
  return caja(COLORS.muted, 'i', `Pago ${String(pago.estado).toLowerCase()}`, 'Si tienes dudas sobre este pago, pasa a recepción.');
}
