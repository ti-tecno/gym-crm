import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '../../constants/theme.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { clientePortal } from '../../services/cliente.service.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate, fmtMoney } from '../../utils/format.js';

export default function MiResumen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    clientePortal.dashboard().then(setData).catch((e) => setErr(e?.response?.data?.error || 'Error al cargar'));
  }, []);

  if (err) return <div style={{ color: COLORS.red }}>{err}</div>;
  if (!data) return <div style={{ color: COLORS.muted }}>Cargando…</div>;

  const { membresia, progreso } = data;
  const estadoColor = membresia.estado === 'Activo' ? COLORS.green
                    : membresia.estado === 'Vencido' ? COLORS.red
                    : COLORS.accent;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>
          Portal de Cliente
        </div>
        <h1 style={{ margin: 0, color: COLORS.text, fontSize: 38, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, letterSpacing: -1 }}>
          Hola, <span style={{ color: COLORS.green }}>{user?.nombre?.split(' ')[0] || 'atleta'}</span> 💪
        </h1>
        <p style={{ color: COLORS.muted, margin: '6px 0 0', fontSize: 14 }}>
          {progreso.diasComoMiembro != null ? `${progreso.diasComoMiembro} días como miembro` : 'Bienvenido'}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Sesiones totales" value={progreso.totalSesiones}     color={COLORS.accent} icon="◎" />
        <StatCard label="Racha actual"     value={`${progreso.racha} días`}    color={COLORS.green}  icon="✦" sub={progreso.últimoEntreno ? `Última: ${fmtDate(progreso.últimoEntreno)}` : 'Sin sesiones'} />
        <StatCard label="Récords personales" value={progreso.totalPRs}        color={COLORS.purple} icon="★" />
        <StatCard
          label="Peso actual"
          value={progreso.pesoActual != null ? `${progreso.pesoActual} kg` : '—'}
          color={COLORS.blue}
          icon="⚖"
          sub={progreso.diffPeso == null
            ? 'Sin referencia inicial'
            : `${progreso.diffPeso > 0 ? '+' : ''}${progreso.diffPeso} kg vs inicio`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Rutina del día / próxima */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif" }}>
              Tu rutina actual
            </div>
            <Link to="/mi/rutinas" style={{ color: COLORS.green, fontSize: 12 }}>Ver completa →</Link>
          </div>
          {!data.rutina ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Aún no tienes rutina asignada. Pide a tu coach que te asigne una o elige una plantilla en <Link to="/mi/rutinas" style={{ color: COLORS.green }}>Mis Rutinas</Link>.</div>
          ) : (
            <div>
              <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 12 }}>
                Coach: {data.rutina.coach} · Semana {data.rutina.semana} · <span style={{ color: COLORS.accent }}>{data.rutina.objetivo}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {(data.rutina.dias || []).map((d, i) => (
                  <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: COLORS.green, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif" }}>{d.dia}</span>
                      <span style={{ color: COLORS.muted, fontSize: 10, background: COLORS.border, padding: '2px 8px', borderRadius: 20 }}>{d.musculo}</span>
                    </div>
                    <div style={{ color: COLORS.subtle, fontSize: 11 }}>{(d.ejercicios || []).length} ejercicios</div>
                  </div>
                ))}
              </div>
              <Link to="/mi/diario" style={{ display: 'inline-block', marginTop: 14, background: COLORS.green, color: '#000', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 13 }}>
                + Registrar sesión de hoy
              </Link>
            </div>
          )}
        </div>

        {/* Membresía resumida */}
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 14 }}>Mi Membresía</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: COLORS.muted }}>Plan</span>
            <span style={{ color: COLORS.accent, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20 }}>{membresia.plan}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: COLORS.muted }}>Estado</span>
            <Badge text={membresia.estado} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: COLORS.muted }}>Vence</span>
            <span style={{ color: estadoColor, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>
              {fmtDate(membresia.vencimiento)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: COLORS.muted }}>Días restantes</span>
            <span style={{ color: estadoColor, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>
              {membresia.diasRestantes < 0 ? `${Math.abs(membresia.diasRestantes)} d vencido` : `${membresia.diasRestantes} d`}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ color: COLORS.muted }}>Mensualidad</span>
            <span style={{ color: COLORS.green, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{fmtMoney(membresia.monto)}</span>
          </div>
          <Link to="/mi/membresia" style={{ display: 'block', textAlign: 'center', background: COLORS.surface, color: COLORS.muted, borderRadius: 8, padding: '8px 0', fontSize: 12 }}>
            Ver detalle →
          </Link>
        </div>
      </div>
    </div>
  );
}
