import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { COLORS } from '../../constants/theme.js';
import FInput from '../../components/ui/FInput.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { clientesService, pagosService } from '../../services/modules.service.js';
import { fmtDate, fmtMoney, initials } from '../../utils/format.js';

const tarjetaSchema = z.object({
  numero:    z.string().regex(/^\d{13,19}$/, 'Número inválido'),
  vence:     z.string().regex(/^(0[1-9]|1[0-2]) \/ \d{2}$/, 'MM / AA'),
  cvv:       z.string().regex(/^\d{3,4}$/, 'CVV inválido'),
  titular:   z.string().min(3).max(80),
});

export default function PagoEnLinea() {
  const [clientes, setClientes] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [metodo, setMetodo] = useState('tarjeta');
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    clientesService.list({ limit: 100 }).then((cs) => { setClientes(cs); setCliente(cs[0] || null); }).catch(() => setClientes([]));
    pagosService.list({ limit: 10 }).then(setPagos).catch(() => setPagos([]));
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(tarjetaSchema) });

  const procesar = async (data) => {
    setError(''); setResultado(null);
    if (!cliente) { setError('Selecciona un cliente'); return; }
    try {
      const payload = {
        clienteId: cliente.clienteId,
        monto: Number(cliente.monto),
        metodo,
      };
      if (metodo === 'tarjeta') {
        // Sólo enviamos los últimos 4 dígitos al backend, NUNCA el PAN completo
        payload.cardLast4 = String(data.numero).slice(-4);
      }
      const pago = await pagosService.create(payload);
      setResultado(pago);
      setPagos((prev) => [pago, ...prev].slice(0, 10));
    } catch (e) {
      setError(e?.response?.data?.error || 'No fue posible procesar el pago');
    }
  };

  return (
    <div>
      {resultado && (
        <div style={{ background: '#0d2b1a', border: `1px solid ${COLORS.green}44`, borderRadius: 14, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0d2b1a', border: `2px solid ${COLORS.green}`, display: 'grid', placeItems: 'center', fontSize: 20 }}>✓</div>
          <div>
            <div style={{ color: COLORS.green, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800 }}>Pago Procesado — {resultado.pagoId}</div>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Recibo enviado al correo del cliente · {fmtDate(resultado.fecha)}</div>
          </div>
          <button onClick={() => setResultado(null)} style={{ marginLeft: 'auto', background: COLORS.border, color: COLORS.muted, border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Nuevo pago</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        <form onSubmit={handleSubmit(procesar)} noValidate>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Avatar initials={initials(cliente?.nombre || 'CL')} size={44} />
                <div>
                  <select value={cliente?.clienteId || ''} onChange={(e) => setCliente(clientes.find((c) => c.clienteId === e.target.value))}
                          style={{ background: 'transparent', border: 'none', color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, outline: 'none' }}>
                    {clientes.map((c) => <option key={c.clienteId} value={c.clienteId}>{c.nombre}</option>)}
                  </select>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>Plan {cliente?.plan} · Vence {fmtDate(cliente?.vencimiento)}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: 1 }}>TOTAL A PAGAR</div>
                <div style={{ color: COLORS.accent, fontFamily: "'DM Mono',monospace", fontSize: 30, fontWeight: 700 }}>{fmtMoney(cliente?.monto)}</div>
              </div>
            </div>
          </div>

          <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>Método de Pago</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[
              { id: 'tarjeta', label: '💳 Tarjeta' },
              { id: 'transferencia', label: '🏦 Transferencia' },
              { id: 'efectivo', label: '💵 Efectivo' },
            ].map((m) => (
              <button type="button" key={m.id} onClick={() => setMetodo(m.id)}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: 10,
                        border: `2px solid ${metodo === m.id ? COLORS.accent : COLORS.border}`,
                        background: metodo === m.id ? `${COLORS.accent}14` : COLORS.surface,
                        color: metodo === m.id ? COLORS.accent : COLORS.muted,
                        fontWeight: metodo === m.id ? 700 : 500, fontSize: 13, cursor: 'pointer',
                      }}>
                {m.label}
              </button>
            ))}
          </div>

          {metodo === 'tarjeta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <FInput label="Número de Tarjeta" placeholder="1234567890123456" inputMode="numeric" {...register('numero')} error={errors.numero?.message} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <FInput label="Vencimiento" placeholder="MM / AA" {...register('vence')} error={errors.vence?.message} />
                <FInput label="CVV"         placeholder="•••"     type="password" {...register('cvv')}   error={errors.cvv?.message} />
              </div>
              <FInput label="Nombre en la Tarjeta" placeholder="Como aparece en la tarjeta" {...register('titular')} error={errors.titular?.message} />
            </div>
          )}

          {metodo === 'transferencia' && (
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 12 }}>
                Datos Bancarios
              </div>
              {[
                ['Banco', 'BBVA México'],
                ['CLABE', '012 320 0123456789 01'],
                ['Referencia', 'GYM-' + (cliente?.clienteId?.slice(0, 6) || '------')],
                ['Beneficiario', 'IronCore S.A. de C.V.'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>{k}</span>
                  <span style={{ color: COLORS.text, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {metodo === 'efectivo' && (
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 20, color: COLORS.subtle, fontSize: 13, lineHeight: 1.8 }}>
              💵 El pago en efectivo se registra en recepción.<br />
              Se genera recibo digital automáticamente.<br />
              <span style={{ color: COLORS.accent, fontWeight: 700 }}>Monto exacto: {fmtMoney(cliente?.monto)} MXN</span>
            </div>
          )}

          {error && <div style={{ color: COLORS.red, marginBottom: 10, fontSize: 12 }}>{error}</div>}

          <button type="submit"
                  style={{ width: '100%', background: COLORS.accent, color: '#000', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: "'Barlow Condensed',sans-serif" }}>
            🔒 Procesar Pago · {fmtMoney(cliente?.monto)}
          </button>
        </form>

        <div>
          <div style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Últimas Transacciones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagos.map((p) => (
              <div key={p.pagoId} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar initials="CL" size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{p.pagoId}</div>
                  <div style={{ color: COLORS.muted, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{fmtDate(p.fecha)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: p.estado === 'Exitoso' ? COLORS.green : COLORS.red, fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700 }}>
                    {fmtMoney(p.monto)}
                  </div>
                  <Badge text={p.estado} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
