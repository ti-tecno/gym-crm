import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { clientePortal } from '../../services/cliente.service.js';
import { fmtDate } from '../../utils/format.js';

/**
 * Vista de PROGRESO: integra todo el viaje del cliente desde el alta.
 *  - KPIs (sesiones, racha, PRs)
 *  - Heatmap de los últimos 90 días (qué días entrenó)
 *  - Sparkline de peso corporal
 *  - Lista de récords personales
 *  - Timeline cronológico (sesiones + medidas + PRs)
 *
 * No usamos librerías externas — todo dibuja con SVG/divs para no inflar el bundle.
 */
export default function Progreso() {
  const [data, setData] = useState(null);
  const [medidas, setMedidas] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [prs, setPrs] = useState([]);

  useEffect(() => {
    Promise.all([
      clientePortal.dashboard(),
      clientePortal.medidas(),
      clientePortal.workouts({ limit: 200 }),
      clientePortal.prs(),
    ]).then(([d, m, w, p]) => { setData(d); setMedidas(m); setWorkouts(w); setPrs(p); })
      .catch(() => {});
  }, []);

  // ── Heatmap 90 días ──
  const heatmap = useMemo(() => {
    const map = new Map();
    workouts.forEach((w) => map.set(w.fecha, (map.get(w.fecha) || 0) + 1));
    const days = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, count: map.get(iso) || 0, dow: d.getDay() });
    }
    return days;
  }, [workouts]);

  // ── Sparkline peso ──
  const pesoSeries = useMemo(() =>
    [...medidas].reverse().filter((m) => m.pesoKg != null).map((m) => ({ x: m.fecha, y: m.pesoKg }))
  , [medidas]);

  if (!data) return <div style={{ color: COLORS.muted }}>Cargando…</div>;
  const { progreso } = data;

  // SVG sparkline
  let path = '';
  if (pesoSeries.length > 1) {
    const ys = pesoSeries.map((p) => p.y);
    const min = Math.min(...ys), max = Math.max(...ys), rng = max - min || 1;
    const W = 600, H = 60;
    path = pesoSeries.map((p, i) => {
      const x = (i / (pesoSeries.length - 1)) * W;
      const y = H - ((p.y - min) / rng) * H;
      return `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  return (
    <div>
      <SectionHeader title="Mi Progreso" sub={progreso.diasComoMiembro != null ? `Desde tu alta: ${progreso.diasComoMiembro} días` : 'Tu viaje'} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Sesiones totales" value={progreso.totalSesiones}      color={COLORS.accent} icon="◎" />
        <StatCard label="Racha actual"     value={`${progreso.racha} días`}     color={COLORS.green}  icon="✦" />
        <StatCard label="PRs registrados"  value={progreso.totalPRs}            color={COLORS.purple} icon="★" />
        <StatCard label="Peso actual"      value={progreso.pesoActual != null ? `${progreso.pesoActual} kg` : '—'} color={COLORS.blue} icon="⚖" />
        <StatCard label="Δ vs inicial"
                  value={progreso.diffPeso == null ? '—' : `${progreso.diffPeso > 0 ? '+' : ''}${progreso.diffPeso} kg`}
                  color={progreso.diffPeso == null ? COLORS.muted : progreso.diffPeso < 0 ? COLORS.green : COLORS.accent}
                  icon="±" />
      </div>

      {/* Heatmap */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Actividad — últimos 90 días</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)', gap: 3 }}>
          {heatmap.map((d) => {
            const bg = d.count === 0 ? COLORS.border
                     : d.count === 1 ? `${COLORS.green}55`
                     : d.count === 2 ? `${COLORS.green}99`
                     : COLORS.green;
            return (
              <div key={d.iso} title={`${d.iso}${d.count ? ` · ${d.count} sesion${d.count > 1 ? 'es' : ''}` : ''}`}
                   style={{ aspectRatio: '1 / 1', background: bg, borderRadius: 3 }} />
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: COLORS.muted, fontSize: 11 }}>
          Menos
          {[COLORS.border, `${COLORS.green}55`, `${COLORS.green}99`, COLORS.green].map((c, i) => (
            <span key={i} style={{ width: 12, height: 12, background: c, borderRadius: 2 }} />
          ))}
          Más
        </div>
      </div>

      {/* Sparkline peso */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Evolución de peso corporal</div>
        {pesoSeries.length < 2 ? (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Necesitas al menos 2 medidas para ver tendencia. Ve a <strong>Medidas</strong> y agrega una.</div>
        ) : (
          <div>
            <svg viewBox="0 0 600 60" style={{ width: '100%', height: 80 }}>
              <path d={path} fill="none" stroke={COLORS.blue} strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.muted, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
              <span>{fmtDate(pesoSeries[0].x)} · {pesoSeries[0].y} kg</span>
              <span>{fmtDate(pesoSeries.at(-1).x)} · {pesoSeries.at(-1).y} kg</span>
            </div>
          </div>
        )}
      </div>

      {/* PRs */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Récords personales ★</div>
        {!prs.length ? (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Aún no tienes PRs. Registra una sesión con peso y se calcularán automáticamente.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {prs.map((p) => (
              <div key={p.prId} style={{ background: COLORS.surface, borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${COLORS.purple}` }}>
                <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>{p.ejercicio}</div>
                <div style={{ color: COLORS.purple, fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                  {p.pesoMax} kg × {p.repsMax}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>Conseguido el {fmtDate(p.fechaPR)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Línea de tiempo</div>
        <div style={{ borderLeft: `2px solid ${COLORS.border}`, paddingLeft: 16 }}>
          {[
            ...workouts.slice(0, 15).map((w) => ({ tipo: 'workout', fecha: w.fecha, label: w.rutinaDia || 'Sesión libre', meta: `${(w.ejercicios || []).length} ejercicios` })),
            ...medidas.slice(0, 10).map((m) => ({ tipo: 'medida', fecha: m.fecha, label: 'Nueva medida', meta: `${m.pesoKg ? `${m.pesoKg} kg` : ''}${m.pctGrasa ? ` · ${m.pctGrasa}% grasa` : ''}` })),
          ].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 20).map((e, i) => {
            const c = e.tipo === 'workout' ? COLORS.green : COLORS.blue;
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14, position: 'relative' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, marginLeft: -22, marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ color: COLORS.subtle, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{fmtDate(e.fecha)}</div>
                  <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{e.label}</div>
                  {e.meta && <div style={{ color: COLORS.muted, fontSize: 12 }}>{e.meta}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
