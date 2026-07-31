import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '../../constants/theme.js';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import { clientePortal } from '../../services/cliente.service.js';

const NIVELES = { 'Principiante': COLORS.green, 'Intermedio': COLORS.accent, 'Avanzado': COLORS.red };

export default function MisRutinas() {
  const [rutina, setRutina] = useState(null);
  const [programas, setProgramas] = useState([]);
  const [tab, setTab] = useState('mia');
  const [asignando, setAsignando] = useState(null);
  const [error, setError] = useState('');
  const [pendingSwitch, setPendingSwitch] = useState(null); // { rutinaId, nombre } — esperando confirmación en el toast

  useEffect(() => {
    clientePortal.rutina().then(setRutina).catch(() => setRutina(null));
    clientePortal.programas().then(setProgramas).catch(() => setProgramas([]));
  }, []);

  const doAsignar = async (rutinaId) => {
    setError('');
    setAsignando(rutinaId);
    try {
      const actualizada = await clientePortal.asignarRutina(rutinaId);
      setRutina(actualizada);
      setTab('mia');
    } catch (e) {
      setError(e?.response?.data?.error || 'No fue posible asignarte este programa');
    } finally {
      setAsignando(null);
    }
  };

  const asignarme = (rutinaId, nombre) => {
    if (rutina?.programaId && rutina.programaId !== rutinaId) {
      setPendingSwitch({ rutinaId, nombre });
      return;
    }
    doAsignar(rutinaId);
  };

  return (
    <div>
      <SectionHeader title="Mis Rutinas" sub="Tu plan asignado y la biblioteca de programas grupales" />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: COLORS.surface, borderRadius: 10, padding: 4, marginBottom: 18, width: 'fit-content', border: `1px solid ${COLORS.border}` }}>
        {[{ id: 'mia', label: 'Mi rutina' }, { id: 'biblio', label: 'Biblioteca' }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: tab === t.id ? COLORS.green : 'transparent',
              color: tab === t.id ? '#000' : COLORS.muted,
              fontFamily: "'Barlow Condensed',sans-serif", fontWeight: tab === t.id ? 700 : 500, fontSize: 14,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'mia' && (
        !rutina ? (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 40, textAlign: 'center', color: COLORS.muted }}>
            Aún no tienes una rutina personal asignada. Explora la biblioteca y elige una plantilla, o espera la asignación de tu coach.
          </div>
        ) : (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ color: COLORS.muted, fontSize: 12 }}>Coach asignado: <strong style={{ color: COLORS.text }}>{rutina.coach}</strong></div>
                <div style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800 }}>
                  Semana {rutina.semana} · <span style={{ color: COLORS.accent }}>{rutina.objetivo}</span>
                </div>
              </div>
              <Link to="/mi/diario" style={{ background: COLORS.green, color: '#000', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 13 }}>
                + Registrar sesión
              </Link>
            </div>
            {!(rutina.dias || []).length && (
              <div style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}`, borderRadius: 12, padding: 20, textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>
                Ya estás inscrito en <strong style={{ color: COLORS.text }}>{rutina.objetivo}</strong>. Tu coach aún no cargó los días de entrenamiento — vuelve pronto para ver tu plan semanal.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {(rutina.dias || []).map((d, i) => (
                <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: COLORS.accent, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800 }}>{d.dia}</span>
                    <span style={{ color: COLORS.muted, fontSize: 11, background: COLORS.border, padding: '2px 8px', borderRadius: 20 }}>{d.musculo}</span>
                  </div>
                  {(d.ejercicios || []).map((ej, j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.accent, flexShrink: 0, marginTop: 5 }} />
                      <span style={{ color: COLORS.subtle, fontSize: 12 }}>{ej}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {tab === 'biblio' && (
        <div>
          {error && (
            <div style={{ color: COLORS.red, background: '#2b0d0d', border: `1px solid ${COLORS.red}44`, borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {programas.map((p) => {
            const yaInscrito = rutina?.programaId === p.rutinaId;
            return (
            <div key={p.rutinaId} style={{ background: COLORS.card, border: `1px solid ${yaInscrito ? COLORS.green : COLORS.border}`, borderRadius: 14, padding: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: NIVELES[p.nivel] || COLORS.accent }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800 }}>{p.nombre}</h3>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>Coach: {p.coach}</div>
                </div>
                <span style={{ background: `${NIVELES[p.nivel]}22`, color: NIVELES[p.nivel], padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{p.nivel}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: COLORS.subtle, marginBottom: 14 }}>
                <span>⏱ {p.duracion}</span>
                <span>◈ {p.clientes} inscritos</span>
              </div>
              <button
                onClick={() => asignarme(p.rutinaId, p.nombre)}
                disabled={asignando === p.rutinaId || yaInscrito}
                style={{
                  width: '100%', background: yaInscrito ? 'transparent' : COLORS.green, color: yaInscrito ? COLORS.green : '#000',
                  border: yaInscrito ? `1px solid ${COLORS.green}` : 'none', borderRadius: 8,
                  padding: '8px 0', fontWeight: 700, fontSize: 13,
                  cursor: (asignando === p.rutinaId || yaInscrito) ? 'not-allowed' : 'pointer',
                  opacity: asignando === p.rutinaId ? 0.6 : 1,
                }}
              >
                {yaInscrito ? '✓ Ya inscrito' : (asignando === p.rutinaId ? 'Asignando…' : 'Auto-asignarme')}
              </button>
            </div>
            );
          })}
          </div>
        </div>
      )}

      {pendingSwitch && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '14px 18px',
          boxShadow: '0 8px 28px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', gap: 16,
          maxWidth: 520, width: 'calc(100% - 32px)',
        }}>
          <span style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.4 }}>
            Sólo puedes estar inscrito en un programa a la vez. ¿Cambiar de <strong style={{ color: COLORS.accent }}>{rutina?.objetivo}</strong> a <strong style={{ color: COLORS.accent }}>{pendingSwitch.nombre}</strong>?
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setPendingSwitch(null)}
              style={{ background: 'transparent', color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={() => { const rid = pendingSwitch.rutinaId; setPendingSwitch(null); doAsignar(rid); }}
              style={{ background: COLORS.green, color: '#000', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Cambiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
