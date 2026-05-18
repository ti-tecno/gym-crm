import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import { clientePortal } from '../../services/cliente.service.js';
import { fmtDate } from '../../utils/format.js';

const HOY = () => new Date().toISOString().slice(0, 10);

/**
 * "Diario de entrenamientos" — el cliente:
 *  1) Carga su rutina del día (o entrenamiento libre).
 *  2) Marca cada serie: reps reales, peso real, RPE 1–10.
 *  3) Guarda → el backend crea workout + recalcula PRs.
 *
 * UX checklist: minimiza fricción. Sólo escribes números, todo lo demás
 * (fecha, músculo, día) se infiere de la rutina.
 */
export default function Diario() {
  const [rutina, setRutina] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [diaIdx, setDiaIdx] = useState(0);
  const [fecha, setFecha] = useState(HOY());
  const [notas, setNotas] = useState('');
  const [duracion, setDuracion] = useState('');
  const [ejercicios, setEjercicios] = useState([]); // editable
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    clientePortal.rutina().then(setRutina).catch(() => setRutina(null));
    clientePortal.workouts({ limit: 10 }).then(setWorkouts).catch(() => setWorkouts([]));
  }, []);

  const dia = rutina?.dias?.[diaIdx];

  // Cuando cambia el día seleccionado, precarga ejercicios con series vacías
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
        series: Array.from({ length: nSeries }, () => ({ reps: repsObj, peso: 0, rpe: 7, completada: false })),
      };
    }));
  }, [diaIdx, rutina]);

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
      const last = copy[ei].series.at(-1) || { reps: 10, peso: 0, rpe: 7 };
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
              rpe: s.rpe ? Number(s.rpe) : undefined,
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
          <select value={diaIdx} onChange={(e) => setDiaIdx(Number(e.target.value))}
                  style={{ background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
            {(rutina?.dias || []).map((d, i) => <option key={i} value={i}>{d.dia} — {d.musculo}</option>)}
            {!rutina && <option>(Sin rutina asignada — sesión libre)</option>}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 18, color: COLORS.text }}>
                {ej.nombre}
                <span style={{ color: COLORS.muted, fontSize: 12, marginLeft: 10, fontFamily: 'inherit' }}>{ej.musculo}</span>
              </div>
              <button onClick={() => addSerie(ei)} style={{ background: COLORS.surface, color: COLORS.green, border: `1px solid ${COLORS.green}44`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                + Serie
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: COLORS.muted, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', width: 40 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Reps</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Peso (kg)</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>RPE</th>
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
                    <td style={{ padding: '4px 8px' }}>
                      <input type="number" min={1} max={10} value={s.rpe || ''} onChange={(e) => updateSerie(ei, si, 'rpe', e.target.value)}
                             style={{ width: 50, background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '5px 8px', fontFamily: "'DM Mono',monospace" }} />
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

        {!ejercicios.length && (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 30, textAlign: 'center', color: COLORS.muted }}>
            Selecciona un día de tu rutina arriba para empezar a registrar.
          </div>
        )}
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

        <button onClick={guardar} disabled={saving || !ejercicios.length}
          style={{ marginTop: 14, background: COLORS.green, color: '#000', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 800, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: "'Barlow Condensed',sans-serif" }}>
          {saving ? 'Guardando…' : '✓ Guardar sesión'}
        </button>
      </div>

      {/* Últimas sesiones */}
      <div style={{ marginTop: 28 }}>
        <h3 style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Últimas sesiones</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {workouts.map((w) => (
            <div key={w.workoutId} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ color: COLORS.accent, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{fmtDate(w.fecha)}</div>
              <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 14, marginTop: 2 }}>{w.rutinaDia || 'Libre'}</div>
              <div style={{ color: COLORS.subtle, fontSize: 12, marginTop: 6 }}>
                {(w.ejercicios || []).length} ejercicios · {w.duracionMin ? `${w.duracionMin} min` : '—'}
              </div>
            </div>
          ))}
          {!workouts.length && <div style={{ color: COLORS.muted, fontSize: 13 }}>Aún no registras sesiones.</div>}
        </div>
      </div>
    </div>
  );
}
