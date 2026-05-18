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

  useEffect(() => {
    clientePortal.rutina().then(setRutina).catch(() => setRutina(null));
    clientePortal.programas().then(setProgramas).catch(() => setProgramas([]));
  }, []);

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {programas.map((p) => (
            <div key={p.rutinaId} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 20, position: 'relative', overflow: 'hidden' }}>
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
              <button style={{ width: '100%', background: COLORS.green, color: '#000', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Auto-asignarme
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
