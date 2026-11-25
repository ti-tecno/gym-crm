import { useEffect, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import FInput from '../components/ui/FInput.jsx';
import { rutinasService } from '../services/modules.service.js';

const NIVELES = { 'Principiante': COLORS.green, 'Intermedio': COLORS.accent, 'Avanzado': COLORS.red };
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const emptyForm = { nombre: '', nivel: 'Principiante', duracion: '', coach: '', dias: [] };
const fieldLabel = { color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" };

export default function RutinasCoach() {
  const [rutinas, setRutinas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const refresh = () => rutinasService.listCoach().then(setRutinas).catch(() => setRutinas([]));
  useEffect(() => { refresh(); }, []);

  const nuevaRutina = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const editar = (r) => {
    setEditingId(r.rutinaId);
    setForm({
      nombre: r.nombre || '', nivel: r.nivel || 'Principiante', duracion: r.duracion || '', coach: r.coach || '',
      dias: (r.dias || []).map((d) => ({ dia: d.dia, musculo: d.musculo || '', ejercicios: [...(d.ejercicios || [])] })),
    });
    setError('');
    setShowForm(true);
  };

  const cancelar = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const addDia = () => {
    const usados = new Set(form.dias.map((d) => d.dia));
    const siguiente = DIAS_SEMANA.find((d) => !usados.has(d)) || DIAS_SEMANA[0];
    setForm({ ...form, dias: [...form.dias, { dia: siguiente, musculo: '', ejercicios: [''] }] });
  };

  const removeDia = (di) => setForm({ ...form, dias: form.dias.filter((_, i) => i !== di) });

  const updateDiaField = (di, field, value) => {
    const dias = form.dias.map((d, i) => (i === di ? { ...d, [field]: value } : d));
    setForm({ ...form, dias });
  };

  const addEjercicio = (di) => {
    const dias = form.dias.map((d, i) => (i === di ? { ...d, ejercicios: [...d.ejercicios, ''] } : d));
    setForm({ ...form, dias });
  };

  const updateEjercicio = (di, ei, value) => {
    const dias = form.dias.map((d, i) => (i === di ? { ...d, ejercicios: d.ejercicios.map((ej, j) => (j === ei ? value : ej)) } : d));
    setForm({ ...form, dias });
  };

  const removeEjercicio = (di, ei) => {
    const dias = form.dias.map((d, i) => (i === di ? { ...d, ejercicios: d.ejercicios.filter((_, j) => j !== ei) } : d));
    setForm({ ...form, dias });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim() || !form.duracion.trim() || !form.coach.trim()) {
      setError('Completa nombre, duración y coach.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(), nivel: form.nivel, duracion: form.duracion.trim(), coach: form.coach.trim(),
        dias: form.dias.map((d) => ({
          dia: d.dia,
          musculo: d.musculo.trim(),
          ejercicios: d.ejercicios.map((ej) => ej.trim()).filter(Boolean),
        })),
      };
      if (editingId) await rutinasService.updateCoach(editingId, payload);
      else await rutinasService.createCoach(payload);
      cancelar();
      refresh();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar la rutina.');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta rutina? Los clientes ya inscritos no se ven afectados.')) return;
    setDeletingId(id);
    try {
      await rutinasService.removeCoach(id);
      refresh();
    } catch {
      setError('No se pudo eliminar la rutina.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <SectionHeader
        title="Rutinas del Coach"
        sub="Plantillas de clases y programas grupales"
        action={showForm ? 'Cancelar' : '+ Nueva Rutina'}
        onAction={showForm ? cancelar : nuevaRutina}
      />

      {showForm && (
        <form onSubmit={submit} style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14,
          padding: 20, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, alignItems: 'end',
        }}>
          <FInput label="Nombre" value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>Nivel</label>
            <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })}
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: '10px 14px', color: COLORS.text, fontSize: 13 }}>
              {Object.keys(NIVELES).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <FInput label="Duración" placeholder="8 semanas" value={form.duracion}
                  onChange={(e) => setForm({ ...form, duracion: e.target.value })} />
          <FInput label="Coach" value={form.coach}
                  onChange={(e) => setForm({ ...form, coach: e.target.value })} />

          <div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={fieldLabel}>Días y ejercicios</label>
              <button type="button" onClick={addDia}
                style={{ background: COLORS.surface, color: COLORS.green, border: `1px solid ${COLORS.green}44`, borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
                + Día
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {form.dias.map((d, di) => (
                <div key={di} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto', gap: 10, marginBottom: 10, alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={fieldLabel}>Día</label>
                      <select value={d.dia} onChange={(e) => updateDiaField(di, 'dia', e.target.value)}
                              style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', color: COLORS.text, fontSize: 13 }}>
                        {DIAS_SEMANA.map((ds) => <option key={ds} value={ds}>{ds}</option>)}
                      </select>
                    </div>
                    <FInput label="Músculo / enfoque" placeholder="Pecho, piernas, etc." value={d.musculo}
                            onChange={(e) => updateDiaField(di, 'musculo', e.target.value)} />
                    <button type="button" onClick={() => removeDia(di)}
                            style={{ background: 'transparent', color: COLORS.muted, border: 'none', cursor: 'pointer', fontSize: 16, padding: '8px' }}>
                      ×
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {d.ejercicios.map((ej, ei) => (
                      <div key={ei} style={{ display: 'flex', gap: 8 }}>
                        <input value={ej} onChange={(e) => updateEjercicio(di, ei, e.target.value)}
                               placeholder="Press Plano 4x10"
                               style={{ flex: 1, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 10px', color: COLORS.text, fontSize: 13, fontFamily: 'inherit' }} />
                        <button type="button" onClick={() => removeEjercicio(di, ei)}
                                style={{ background: 'transparent', color: COLORS.muted, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                          ×
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addEjercicio(di)}
                            style={{ alignSelf: 'flex-start', background: 'transparent', color: COLORS.accent, border: 'none', fontSize: 12, cursor: 'pointer', padding: '4px 0' }}>
                      + Ejercicio
                    </button>
                  </div>
                </div>
              ))}
              {!form.dias.length && (
                <div style={{ color: COLORS.muted, fontSize: 12 }}>Sin días todavía — agrega uno con "+ Día".</div>
              )}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" disabled={saving}
                    style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {saving ? 'Guardando…' : (editingId ? 'Guardar Cambios' : 'Crear Rutina')}
            </button>
            {error && <span style={{ color: COLORS.red, fontSize: 12 }}>{error}</span>}
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18, marginBottom: 20 }}>
        {rutinas.map((r) => (
          <div key={r.rutinaId}
               style={{
                 background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14,
                 padding: 24, position: 'relative', overflow: 'hidden',
               }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: NIVELES[r.nivel] || COLORS.accent }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800 }}>{r.nombre}</h3>
                <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Coach: {r.coach}</div>
              </div>
              <span style={{ background: `${NIVELES[r.nivel]}22`, color: NIVELES[r.nivel], padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, height: 'fit-content' }}>
                {r.nivel}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
              {[['⏱', r.duracion, 'Duración'], ['◈', r.clientes || 0, 'Clientes'], ['▤', (r.dias || []).length, 'Días']].map(([icon, val, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: COLORS.accent, fontSize: 16 }}>{icon}</span>
                  <div>
                    <div style={{ color: COLORS.text, fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700 }}>{val}</div>
                    <div style={{ color: COLORS.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: expandedId === r.rutinaId ? 16 : 0 }}>
              {!!(r.dias || []).length && (
                <button onClick={() => setExpandedId(expandedId === r.rutinaId ? null : r.rutinaId)}
                  style={{ background: 'transparent', color: COLORS.accent, border: `1px solid ${COLORS.accent}44`, borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
                  {expandedId === r.rutinaId ? 'Ocultar días' : 'Ver días'}
                </button>
              )}
              <button onClick={() => editar(r)}
                style={{ background: COLORS.border, color: COLORS.text, border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
                Editar
              </button>
              <button onClick={() => eliminar(r.rutinaId)} disabled={deletingId === r.rutinaId}
                style={{
                  background: 'transparent', color: COLORS.red, border: `1px solid ${COLORS.red}44`, borderRadius: 8,
                  padding: '7px 14px', fontSize: 12, cursor: deletingId === r.rutinaId ? 'not-allowed' : 'pointer',
                  opacity: deletingId === r.rutinaId ? 0.6 : 1,
                }}>
                {deletingId === r.rutinaId ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>

            {expandedId === r.rutinaId && (
              // Mismo formato de tarjeta que "Mi rutina" en el portal del cliente — así el
              // coach previsualiza exactamente lo que el cliente verá al auto-asignarse.
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {(r.dias || []).map((d, i) => (
                  <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ color: COLORS.accent, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800 }}>{d.dia}</span>
                      <span style={{ color: COLORS.muted, fontSize: 10, background: COLORS.border, padding: '2px 8px', borderRadius: 20 }}>{d.musculo}</span>
                    </div>
                    {(d.ejercicios || []).map((ej, j) => (
                      <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.accent, flexShrink: 0, marginTop: 5 }} />
                        <span style={{ color: COLORS.subtle, fontSize: 12 }}>{ej}</span>
                      </div>
                    ))}
                    {!(d.ejercicios || []).length && (
                      <span style={{ color: COLORS.muted, fontSize: 11 }}>Sin ejercicios</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {!rutinas.length && (
          <div style={{ gridColumn: '1 / -1', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 40, textAlign: 'center', color: COLORS.muted }}>
            Aún no hay rutinas en la biblioteca. Crea la primera con "+ Nueva Rutina".
          </div>
        )}
      </div>
    </div>
  );
}
