import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import { clientePortal } from '../../services/cliente.service.js';
import { fmtDate } from '../../utils/format.js';

const HOY = () => new Date().toISOString().slice(0, 10);

// Mismas abreviaturas que el enum `dia` del backend (rutina.schema.js): Lun..Dom.
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
function diaAbrevDe(fechaIso) {
  const d = new Date(`${fechaIso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : DIAS_SEMANA[d.getDay()];
}

/**
 * "Diario de entrenamientos" — el cliente:
 *  1) Carga su rutina del día (o entrenamiento libre).
 *  2) Marca cada serie: reps reales, peso real.
 *  3) Guarda → el backend crea workout + recalcula PRs.
 *
 * UX checklist: minimiza fricción. El día se auto-sugiere según la fecha
 * elegida (editable), y los ejercicios/músculo se infieren de ese día.
 */
export default function Diario() {
  const [rutina, setRutina] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [fecha, setFecha] = useState(HOY());
  const [notas, setNotas] = useState('');
  const [duracion, setDuracion] = useState('');
  const [ejercicios, setEjercicios] = useState([]); // editable
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [expandedWorkoutId, setExpandedWorkoutId] = useState(null);

  useEffect(() => {
    clientePortal.rutina().then(setRutina).catch(() => setRutina(null));
    clientePortal.workouts({ limit: 10 }).then(setWorkouts).catch(() => setWorkouts([]));
  }, []);

  // El día se auto-sugiere según la fecha elegida, pero el cliente puede
  // elegir otro día de su rutina asignada (p. ej. entrenó "Martes" en miércoles).
  const [diaKey, setDiaKey] = useState('');
  useEffect(() => {
    const auto = diaAbrevDe(fecha);
    const match = rutina?.dias?.find((d) => d.dia === auto);
    setDiaKey(match ? match.dia : '');
  }, [fecha, rutina]);

  const dia = useMemo(() => rutina?.dias?.find((d) => d.dia === diaKey) || null, [rutina, diaKey]);

  // Cuando cambia el día (por la fecha) o la rutina, precarga ejercicios con series vacías
  useEffect(() => {
    if (!dia) { setEjercicios([]); return; }
    setEjercicios(dia.ejercicios.map((str) => {
      // Parsea "Press Plano 4x10" → { nombre: 'Press Plano', series: 4, reps: 10 }
      const m = str.match(/^(.+?)\s+(\d+)\s*[xX]\s*(\d+)/);
      const nombre = m ? m[1] : str;
      const nSeries = m ? Number(m[2]) : 3;
      const repsObj = m ? Number(m[3]) : 10;
      return {
        nombre,
        musculo: dia.musculo,
        series: Array.from({ length: nSeries }, () => ({ reps: repsObj, peso: 0, completada: false })),
      };
    }));
  }, [dia]);

  const totalSeries = useMemo(() => ejercicios.reduce((a, e) => a + e.series.length, 0), [ejercicios]);
  const hechas = useMemo(() => ejercicios.reduce((a, e) => a + e.series.filter((s) => s.completada).length, 0), [ejercicios]);

  function updateSerie(ei, si, field, value) {
    setEjercicios((prev) => {
      const copy = structuredClone(prev);
      copy[ei].series[si][field] = field === 'completada' ? value : Number(value);
      return copy;
    });
  }

  function addSerie(ei) {
    setEjercicios((prev) => {
      const copy = structuredClone(prev);
      const last = copy[ei].series.at(-1) || { reps: 10, peso: 0 };
      copy[ei].series.push({ ...last, completada: false });
      return copy;
    });
  }

  function removeSerie(ei, si) {
    setEjercicios((prev) => {
      const copy = structuredClone(prev);
      copy[ei].series.splice(si, 1);
      if (!copy[ei].series.length) copy.splice(ei, 1);
      return copy;
    });
  }

  function addEjercicio() {
    setEjercicios((prev) => [
      ...prev,
      { nombre: '', musculo: dia?.musculo || '', series: [{ reps: 10, peso: 0, completada: false }] },
    ]);
  }

  function removeEjercicio(ei) {
    setEjercicios((prev) => prev.filter((_, i) => i !== ei));
  }

  function updateNombreEjercicio(ei, value) {
    setEjercicios((prev) => {
      const copy = structuredClone(prev);
      copy[ei].nombre = value;
      return copy;
    });
  }

  async function guardar() {
    setSaving(true); setFeedback(null);
    try {
      const payload = {
        fecha,
        rutinaDia: dia ? `${dia.dia} - ${dia.musculo}` : 'Libre',
        duracionMin: duracion ? Number(duracion) : undefined,
        notas: notas || undefined,
        ejercicios: ejercicios
          .filter((e) => e.series.length)
          .map((e) => ({
            nombre: e.nombre,
            musculo: e.musculo,
            series: e.series.map((s) => ({
              reps: Number(s.reps) || 0,
              peso: Number(s.peso) || 0,
              completada: !!s.completada,
            })),
          })),
      };
      const { workout, nuevosPRs } = await clientePortal.addWorkout(payload);
      setWorkouts((prev) => [workout, ...prev].slice(0, 10));
      setFeedback({ ok: true, prs: nuevosPRs });
      // reset series completadas
      setEjercicios((prev) => prev.map((e) => ({ ...e, series: e.series.map((s) => ({ ...s, completada: false })) })));
    } catch (e) {
      const d = e?.response?.data;
      const msg = d?.details
        ? Object.entries(d.details).map(([k, v]) => `${k}: ${(v || []).join(', ')}`).join(' · ')
        : d?.error || 'No se pudo guardar';
      setFeedback({ ok: false, msg });
    } finally { setSaving(false); }
  }

  return (
    <div>
      <SectionHeader title="Diario de Entrenamientos" sub="Marca cada serie conforme las completas. Tus PRs se actualizan automáticamente." />

      {/* Cabecera de sesión */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 16, display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 14, alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11, color: COLORS.muted }}>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                 style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', marginTop: 4 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11, color: COLORS.muted }}>
          Día de la rutina
          <select value={diaKey} onChange={(e) => setDiaKey(e.target.value)} disabled={!rutina?.dias?.length}
                  style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
            <option value="">{rutina?.dias?.length ? 'Sesión libre' : 'Sin rutina asignada (sesión libre)'}</option>
            {(rutina?.dias || []).map((d, i) => <option key={i} value={d.dia}>{d.dia} — {d.musculo}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11, color: COLORS.muted, width: 110 }}>
          Duración (min)
          <input type="number" min={0} max={480} value={duracion} onChange={(e) => setDuracion(e.target.value)}
                 placeholder="60"
                 style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', marginTop: 4, width: '100%' }} />
        </label>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Progreso</div>
          <div style={{ color: COLORS.green, fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700 }}>
            {hechas}/{totalSeries}
          </div>
        </div>
      </div>

      {/* Ejercicios */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ejercicios.map((ej, ei) => (
          <div key={ei} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
              <input value={ej.nombre} onChange={(e) => updateNombreEjercicio(ei, e.target.value)}
                     placeholder="Nombre del ejercicio"
                     style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 18, padding: '2px 0', outline: 'none' }} />
              <button onClick={() => addSerie(ei)} style={{ background: COLORS.surface, color: COLORS.green, border: `1px solid ${COLORS.green}44`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                + Serie
              </button>
              <button onClick={() => removeEjercicio(ei)} style={{ background: 'transparent', color: COLORS.muted, border: 'none', cursor: 'pointer', fontSize: 16 }}>
                ×
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: COLORS.muted, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', width: 40 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Reps</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Peso (kg)</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px' }}>✓</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {ej.series.map((s, si) => (
                  <tr key={si} style={{ background: s.completada ? `${COLORS.green}08` : 'transparent' }}>
                    <td style={{ color: COLORS.muted, padding: '4px 0' }}>{si + 1}</td>
                    <td style={{ padding: '4px 8px' }}>
                      <input type="number" min={0} max={500} value={s.reps} onChange={(e) => updateSerie(ei, si, 'reps', e.target.value)}
                             style={{ width: 60, background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '5px 8px', fontFamily: "'DM Mono',monospace" }} />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <input type="number" min={0} max={1000} step="0.5" value={s.peso} onChange={(e) => updateSerie(ei, si, 'peso', e.target.value)}
                             style={{ width: 70, background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '5px 8px', fontFamily: "'DM Mono',monospace" }} />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!s.completada} onChange={(e) => updateSerie(ei, si, 'completada', e.target.checked)}
                             style={{ width: 18, height: 18, cursor: 'pointer', accentColor: COLORS.green }} />
                    </td>
                    <td style={{ padding: '4px 0', textAlign: 'right' }}>
                      <button onClick={() => removeSerie(ei, si)} style={{ background: 'transparent', color: COLORS.muted, border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <button onClick={addEjercicio}
          style={{ background: COLORS.surface, color: COLORS.text, border: `1px dashed ${COLORS.border}`, borderRadius: 14, padding: 16, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Ejercicio
        </button>
      </div>

      {/* Notas y guardar */}
      <div style={{ marginTop: 16, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18 }}>
        <label style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>
          Notas (opcional)
        </label>
        <textarea value={notas} maxLength={500} onChange={(e) => setNotas(e.target.value)}
                  placeholder="¿Cómo te sentiste? Algo que ajustar la próxima vez…"
                  style={{ width: '100%', minHeight: 70, marginTop: 6, background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />

        {feedback?.ok && (
          <div style={{ marginTop: 12, color: COLORS.green, background: '#0d2b1a', border: `1px solid ${COLORS.green}44`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
            ✓ Sesión guardada
            {feedback.prs?.length > 0 && (
              <> · <strong>¡{feedback.prs.length} nuevo{feedback.prs.length > 1 ? 's' : ''} récord{feedback.prs.length > 1 ? 's' : ''}!</strong> {feedback.prs.map((p) => p.ejercicio).join(', ')}</>
            )}
          </div>
        )}
        {feedback && !feedback.ok && (
          <div style={{ marginTop: 12, color: COLORS.red, background: '#2b0d0d', border: `1px solid ${COLORS.red}44`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{feedback.msg}</div>
        )}

        {!ejercicios.length && (
          <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 12 }}>Agrega al menos un ejercicio (botón "+ Ejercicio" arriba) para poder guardar.</div>
        )}

        <button onClick={guardar} disabled={saving || !ejercicios.length}
          style={{ marginTop: 14, background: COLORS.green, color: '#000', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 800, fontSize: 15, cursor: (saving || !ejercicios.length) ? 'not-allowed' : 'pointer', opacity: (saving || !ejercicios.length) ? 0.6 : 1, fontFamily: "'Barlow Condensed',sans-serif" }}>
          {saving ? 'Guardando…' : '✓ Guardar sesión'}
        </button>
      </div>

      {/* Últimas sesiones */}
      <div style={{ marginTop: 28 }}>
        <h3 style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Últimas sesiones</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, alignItems: 'start' }}>
          {workouts.map((w) => {
            const expanded = expandedWorkoutId === w.workoutId;
            return (
            <div key={w.workoutId}
                 onClick={() => setExpandedWorkoutId(expanded ? null : w.workoutId)}
                 style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: COLORS.accent, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{fmtDate(w.fecha)}</div>
                <span style={{ color: COLORS.muted, fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
              </div>
              <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 14, marginTop: 2 }}>{w.rutinaDia || 'Libre'}</div>
              <div style={{ color: COLORS.subtle, fontSize: 12, marginTop: 6 }}>
                {(w.ejercicios || []).length} ejercicios · {w.duracionMin ? `${w.duracionMin} min` : '—'}
              </div>

              {expanded && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                  {(w.ejercicios || []).map((ej, ei) => (
                    <div key={ei} style={{ marginBottom: 10 }}>
                      <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 13 }}>
                        {ej.nombre}
                        {ej.musculo && <span style={{ color: COLORS.muted, fontSize: 11, marginLeft: 8, fontWeight: 400 }}>{ej.musculo}</span>}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {(ej.series || []).map((s, si) => (
                          <span key={si} style={{
                            fontFamily: "'DM Mono',monospace", fontSize: 11, padding: '3px 8px', borderRadius: 20,
                            background: s.completada ? `${COLORS.green}18` : COLORS.surface,
                            color: s.completada ? COLORS.green : COLORS.subtle,
                            border: `1px solid ${s.completada ? COLORS.green + '44' : COLORS.border}`,
                          }}>
                            {s.reps}×{s.peso}kg{s.completada ? ' ✓' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {w.notas && (
                    <div style={{ color: COLORS.subtle, fontSize: 12, fontStyle: 'italic', marginTop: 8 }}>"{w.notas}"</div>
                  )}
                </div>
              )}
            </div>
            );
          })}
          {!workouts.length && <div style={{ color: COLORS.muted, fontSize: 13 }}>Aún no registras sesiones.</div>}
        </div>
      </div>
    </div>
  );
}
