import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { recordatoriosService } from '../../services/modules.service.js';
import { fmtMoney, initials } from '../../utils/format.js';
import { etapaLabel, etapaDeOffset, fmtDia } from '../../utils/recordatorios.js';

const EXITOSOS = ['Enviado', 'Entregado', 'Leído'];

const fmtMomento = (iso) => (iso
  ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '');

const diasLabel = (d) => (d < 0 ? `${Math.abs(d)}d vencido` : d === 0 ? 'Hoy' : `${d}d`);

const FILTROS = [
  { id: 'todos',     label: 'Todos' },
  { id: 'hoy',       label: 'Tocan hoy' },
  { id: 'porVencer', label: 'Por vencer' },
  { id: 'vencidos',  label: 'Vencidos' },
  { id: 'fallidos',  label: 'Con falla' },
];

export default function Recordatorios() {
  const { hasRole } = useAuth();
  const puedeEnviarRol = hasRole('ADMIN', 'RECEP');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [enviando, setEnviando] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(() => recordatoriosService.pago()
    .then((d) => { setData(d); setError(''); })
    .catch((e) => setError(e?.response?.data?.error || 'No fue posible cargar los recordatorios')), []);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async (it) => {
    setEnviando(it.clienteId);
    setAviso(null);
    try {
      await recordatoriosService.enviarPago(it.clienteId);
      setAviso({ ok: true, texto: `Recordatorio enviado por WhatsApp a ${it.nombre}.` });
    } catch (e) {
      setAviso({ ok: false, texto: `${it.nombre}: ${e?.response?.data?.error || 'No se pudo enviar el recordatorio'}` });
    } finally {
      setEnviando(null);
      cargar();
    }
  };

  if (error && !data) return <div style={{ color: COLORS.red }}>{error}</div>;
  if (!data) return <div style={{ color: COLORS.muted }}>Cargando recordatorios…</div>;

  const { config, items, resumen } = data;
  const ultimo = (it) => it.envios[0] || null;
  const envioHabilitado = config.envioDisponible && config.activo;

  const filtrados = items.filter((it) => {
    if (filtro === 'hoy') return it.tocaHoy;
    if (filtro === 'porVencer') return it.dias >= 0;
    if (filtro === 'vencidos') return it.dias < 0;
    if (filtro === 'fallidos') return ultimo(it)?.estado === 'Fallido';
    return true;
  });

  const motivoBloqueo = (it) => {
    if (!puedeEnviarRol) return 'Solo recepción o administración pueden enviar';
    if (!config.envioDisponible) return 'El envío por WhatsApp no está configurado en el servidor';
    if (!config.activo) return 'El envío está apagado (Backoffice → Mensajería)';
    if (!it.tieneTelefono) return 'El cliente no tiene teléfono registrado';
    if (!(it.monto > 0)) return 'El cliente no tiene monto de mensualidad';
    return '';
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard label="Por vencer (7d)" value={items.filter((i) => i.dias >= 0).length} color={COLORS.accent} icon="◷" sub="Requieren aviso" />
        <StatCard label="Vencidos (15d)"  value={items.filter((i) => i.dias < 0).length}  color={COLORS.red}    icon="⚠" sub="Cobro pendiente" />
        <StatCard label="Tocan hoy"       value={resumen.tocanHoy}                          color={COLORS.blue}   icon="◈" sub={`Envío diario ${config.hora} (México)`} />
        <StatCard label="Enviados"        value={items.filter((i) => EXITOSOS.includes(ultimo(i)?.estado)).length} color={COLORS.green} icon="✉" sub="WhatsApp" />
      </div>

      <div style={{
        background: envioHabilitado ? '#0d2b1a' : '#2b210d',
        borderLeft: `3px solid ${envioHabilitado ? COLORS.green : '#F5A623'}`,
        borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: COLORS.text, fontSize: 13,
      }}>
        {!config.envioDisponible && 'El envío por WhatsApp no está configurado en el servidor. La lista se calcula igual, pero no se envía nada.'}
        {config.envioDisponible && !config.activo && 'El envío de mensajes está APAGADO. Nadie recibe recordatorios hasta que un administrador lo encienda en Backoffice → Mensajería.'}
        {envioHabilitado && `Envío automático encendido: todos los días a las ${config.hora} (hora de México), ${config.etapas.map((e) => etapaLabel(etapaDeOffset(e)).toLowerCase()).join(', ')}.`}
      </div>

      {aviso && (
        <div style={{
          background: aviso.ok ? '#0d2b1a' : '#2b0d0d', border: `1px solid ${aviso.ok ? COLORS.green : COLORS.red}44`,
          color: aviso.ok ? COLORS.green : COLORS.red, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13,
        }}>
          {aviso.texto}
        </div>
      )}
      {error && <div style={{ color: COLORS.red, marginBottom: 10, fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTROS.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
                  style={{
                    padding: '7px 16px', borderRadius: 20,
                    border: `1px solid ${filtro === f.id ? COLORS.accent : COLORS.border}`,
                    background: filtro === f.id ? `${COLORS.accent}18` : 'transparent',
                    color: filtro === f.id ? COLORS.accent : COLORS.muted, fontSize: 12, cursor: 'pointer',
                    fontWeight: filtro === f.id ? 700 : 400,
                  }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflowX: 'auto', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {['Cliente', 'Vence', 'Monto', 'WhatsApp', 'Recordatorio', 'Acciones'].map((h) => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '18px', color: COLORS.muted, fontSize: 13 }}>No hay clientes en este filtro.</td></tr>
            )}
            {filtrados.map((it) => {
              const u = ultimo(it);
              const bloqueo = motivoBloqueo(it);
              return (
                <tr key={it.clienteId}
                    onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar initials={initials(it.nombre)} size={32} />
                      <div>
                        <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{it.nombre}</div>
                        <div style={{ color: COLORS.muted, fontSize: 11 }}>{it.plan || '—'}{it.email ? ` · ${it.email}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ color: it.dias < 0 ? COLORS.red : it.dias <= 3 ? COLORS.accent : COLORS.subtle, fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700 }}>
                      {diasLabel(it.dias)}
                    </div>
                    <div style={{ color: COLORS.muted, fontSize: 11 }}>{fmtDia(it.vencimiento)}</div>
                  </td>
                  <td style={{ padding: '14px 18px', color: COLORS.green, fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600 }}>{fmtMoney(it.monto)}</td>
                  <td style={{ padding: '14px 18px', fontSize: 12 }}>
                    {it.tieneTelefono
                      ? <span style={{ color: '#25d366', fontFamily: "'DM Mono',monospace" }}>📱 {it.telefono}</span>
                      : <span style={{ color: COLORS.red }}>Sin teléfono</span>}
                  </td>
                  <td style={{ padding: '14px 18px', maxWidth: 280 }}>
                    {u ? (
                      <div>
                        <Badge text={u.estado} />
                        <span style={{ color: COLORS.muted, fontSize: 11, marginLeft: 8 }}>{etapaLabel(u.etapa)} · {fmtMomento(u.enviadoAt || u.updatedAt)}</span>
                        {u.estado === 'Fallido' && u.motivoFalla && (
                          <div style={{ color: COLORS.red, fontSize: 11, marginTop: 4 }}>{u.motivoFalla}</div>
                        )}
                      </div>
                    ) : <span style={{ color: COLORS.muted, fontSize: 12 }}>Sin enviar</span>}
                    {it.pagoReciente && (
                      <div style={{ color: COLORS.green, fontSize: 11, marginTop: 4 }}>
                        Pago registrado {fmtMomento(it.pagoReciente.fecha)} · no se le recuerda
                      </div>
                    )}
                    {it.tocaHoy && (
                      <div style={{ color: COLORS.blue, fontSize: 11, marginTop: 4 }}>Le toca hoy: {etapaLabel(it.etapaHoy).toLowerCase()}</div>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <button
                      onClick={() => enviar(it)}
                      disabled={Boolean(bloqueo) || enviando !== null}
                      title={bloqueo || 'Enviar recordatorio de pago por WhatsApp'}
                      style={{
                        background: bloqueo ? COLORS.border : '#128c7e', color: bloqueo ? COLORS.muted : '#fff',
                        border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11,
                        cursor: bloqueo || enviando !== null ? 'not-allowed' : 'pointer', opacity: enviando === it.clienteId ? 0.6 : 1,
                      }}>
                      {enviando === it.clienteId ? 'Enviando…' : 'Enviar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ color: COLORS.muted, fontSize: 11 }}>
        Se muestran clientes con vencimiento entre hace 15 días y los próximos 7, según la fecha de vencimiento de su ficha.
        Registrar un pago no cambia esa fecha: actualízala en Lista → Editar al renovar.
      </div>
    </div>
  );
}
