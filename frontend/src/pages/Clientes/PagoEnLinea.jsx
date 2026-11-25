import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import Avatar from '../../components/ui/Avatar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { clientesService, pagosService } from '../../services/modules.service.js';
import { fmtMoney, initials } from '../../utils/format.js';
import { fmtDia } from '../../utils/recordatorios.js';

/**
 * Registro de pagos cobrados en MOSTRADOR (efectivo, transferencia o tarjeta en la terminal).
 * Aquí no se cobra nada ni se capturan datos de tarjeta: solo se registra lo ya cobrado.
 * Registrar el pago renueva la membresía (el backend calcula el nuevo vencimiento).
 */
const METODOS = [
  { id: 'efectivo',      label: '💵 Efectivo' },
  { id: 'transferencia', label: '🏦 Transferencia' },
  { id: 'tarjeta',       label: '💳 Tarjeta (terminal)' },
];

const input = { background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', color: COLORS.text, outline: 'none', fontSize: 13, fontFamily: 'inherit' };
const etiqueta = { color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" };
const fmtMomento = (iso) => (iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function PagoEnLinea({ clienteInicial = null }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [clienteId, setClienteId] = useState(clienteInicial || '');
  const [cliente, setCliente] = useState(null);
  const [vista, setVista] = useState(null);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [pagos, setPagos] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarPagos = () => pagosService.list({ limit: 10 }).then(setPagos).catch(() => setPagos([]));

  useEffect(() => {
    clientesService.list({ all: true }).then(setClientes).catch(() => setClientes([]));
    cargarPagos();
  }, []);

  // Al elegir cliente: su ficha y cómo quedaría la membresía si paga hoy.
  useEffect(() => {
    setVista(null); setCliente(null); setError('');
    if (!clienteId) return;
    const local = clientes.find((c) => c.clienteId === clienteId);
    const ficha = local ? Promise.resolve(local) : clientesService.get(clienteId);
    ficha.then((c) => { setCliente(c); setMonto(c?.monto ? String(c.monto) : ''); }).catch(() => setError('No se encontró el cliente'));
    pagosService.vistaPrevia(clienteId).then(setVista).catch(() => setVista(null));
  }, [clienteId, clientes]);

  const nombres = useMemo(() => new Map(clientes.map((c) => [c.clienteId, c.nombre])), [clientes]);
  const q = busqueda.trim().toLowerCase();
  const opciones = useMemo(() => clientes
    .filter((c) => !q || String(c.nombre || '').toLowerCase().includes(q) || String(c.email || '').toLowerCase().includes(q))
    .slice(0, 200), [clientes, q]);

  const registrar = async (e) => {
    e.preventDefault();
    setError(''); setResultado(null);
    if (!cliente) { setError('Selecciona un cliente'); return; }
    const total = Number(monto);
    if (!(total > 0)) { setError('Captura el monto cobrado'); return; }
    setGuardando(true);
    try {
      const body = { clienteId: cliente.clienteId, monto: total, metodo };
      if (referencia.trim()) body.referencia = referencia.trim();
      const r = await pagosService.create(body);
      setResultado({ ...r, nombre: cliente.nombre });
      setReferencia('');
      cargarPagos();
      pagosService.vistaPrevia(cliente.clienteId).then(setVista).catch(() => {});
    } catch (err) {
      setError(err?.response?.data?.error || 'No fue posible registrar el pago');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      {resultado && (
        <div style={{ background: '#0d2b1a', border: `1px solid ${COLORS.green}44`, borderRadius: 14, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${COLORS.green}`, display: 'grid', placeItems: 'center', fontSize: 20, color: COLORS.green }}>✓</div>
          <div>
            <div style={{ color: COLORS.green, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800 }}>
              Pago registrado — folio {resultado.pago.pagoId}
            </div>
            <div style={{ color: COLORS.text, fontSize: 14, marginTop: 2 }}>
              {resultado.nombre}: {fmtMoney(resultado.pago.monto)} · membresía vigente hasta el <b>{fmtDia(resultado.renovacion.vencimientoNuevo)}</b>
              {resultado.renovacion.vencimientoAnterior ? ` (antes ${fmtDia(resultado.renovacion.vencimientoAnterior)})` : ''}
            </div>
            <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
              Si el envío por WhatsApp está encendido (Backoffice → Mensajería), el cliente recibe su comprobante de pago recibido.
            </div>
          </div>
          <button onClick={() => setResultado(null)} style={{ marginLeft: 'auto', background: COLORS.border, color: COLORS.muted, border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Cerrar</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 24 }}>
        <form onSubmit={registrar} noValidate>
          <div style={{ background: '#2b210d', borderLeft: '3px solid #F5A623', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: COLORS.text, fontSize: 13 }}>
            Registra aquí pagos <b>ya cobrados en mostrador</b>. La tarjeta se cobra en la terminal del gimnasio; aquí no se capturan datos de tarjeta.
            Los clientes también pueden pagar en línea desde su portal o con la liga de su recordatorio.
          </div>

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20, marginBottom: 20, display: 'grid', gap: 12 }}>
            <div style={etiqueta}>Cliente</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} maxLength={60} placeholder="Buscar por nombre o correo…" style={input} />
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={input}>
                <option value="">{clientes.length ? 'Selecciona un cliente…' : 'Cargando clientes…'}</option>
                {cliente && !opciones.some((c) => c.clienteId === cliente.clienteId) && <option value={cliente.clienteId}>{cliente.nombre}</option>}
                {opciones.map((c) => <option key={c.clienteId} value={c.clienteId}>{c.nombre}</option>)}
              </select>
            </div>

            {cliente && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingTop: 8 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <Avatar initials={initials(cliente.nombre || 'CL')} size={44} />
                  <div>
                    <div style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700 }}>{cliente.nombre}</div>
                    <div style={{ color: COLORS.muted, fontSize: 13 }}>
                      Plan {cliente.plan || '—'}{vista ? ` · ${vista.periodo}` : ''} · vence {fmtDia(cliente.vencimiento)} <Badge text={cliente.estado || '—'} />
                    </div>
                  </div>
                </div>
                {vista && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: 1 }}>VIGENTE HASTA, AL REGISTRAR</div>
                    <div style={{ color: COLORS.green, fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 700 }}>{fmtDia(vista.vencimientoTrasPagar)}</div>
                    <div style={{ color: COLORS.muted, fontSize: 11 }}>{vista.desde === 'vencimiento' ? 'se suma a su vigencia actual' : 'cuenta desde hoy (estaba vencida)'}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ ...etiqueta, marginBottom: 10 }}>Método con que se cobró</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {METODOS.map((m) => (
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, marginBottom: 20 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>Monto cobrado (MXN)</span>
              <input type="number" min="1" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} style={input} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>Referencia (opcional)</span>
              <input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={40}
                     placeholder={metodo === 'tarjeta' ? 'Folio del voucher de la terminal' : metodo === 'transferencia' ? 'Clave de rastreo / referencia' : ''}
                     style={input} />
            </label>
          </div>

          {error && <div style={{ color: COLORS.red, marginBottom: 10, fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={guardando || !cliente}
                  style={{ width: '100%', background: COLORS.accent, color: '#000', border: 'none', borderRadius: 12, padding: '14px 0', fontWeight: 800, fontSize: 16, cursor: guardando ? 'wait' : 'pointer', fontFamily: "'Barlow Condensed',sans-serif", opacity: !cliente ? 0.5 : 1 }}>
            {guardando ? 'Registrando…' : `Registrar pago${Number(monto) > 0 ? ` · ${fmtMoney(monto)}` : ''}`}
          </button>
        </form>

        <div>
          <div style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Últimos pagos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagos.length === 0 && <div style={{ color: COLORS.muted, fontSize: 13 }}>Sin pagos recientes.</div>}
            {pagos.map((p) => (
              <div key={p.pagoId} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar initials={initials(nombres.get(p.clienteId) || 'CL')} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombres.get(p.clienteId) || p.pagoId}</div>
                  <div style={{ color: COLORS.muted, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                    {p.pagoId} · {p.origen === 'mercadopago' ? 'En línea' : (p.metodo || '—')} · {fmtMomento(p.fecha)}
                  </div>
                  {p.requiereRevision && <div style={{ color: COLORS.red, fontSize: 11 }}>Revisar: {p.revisionMotivo}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: (p.estado || 'Exitoso') === 'Exitoso' ? COLORS.green : COLORS.muted, fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700 }}>{fmtMoney(p.monto)}</div>
                  <Badge text={p.estado || 'Exitoso'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
