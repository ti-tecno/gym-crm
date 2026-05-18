import { useEffect, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import { rutinasService } from '../services/modules.service.js';

const NIVELES = { 'Principiante': COLORS.green, 'Intermedio': COLORS.accent, 'Avanzado': COLORS.red };

export default function RutinasCoach() {
  const [rutinas, setRutinas] = useState([]);
  useEffect(() => { rutinasService.listCoach().then(setRutinas).catch(() => setRutinas([])); }, []);

  return (
    <div>
      <SectionHeader title="Rutinas del Coach" sub="Plantillas de clases y programas grupales" action="+ Nueva Rutina" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18, marginBottom: 20 }}>
        {rutinas.map((r) => (
          <div key={r.rutinaId}
               onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
               onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
               style={{
                 background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14,
                 padding: 24, position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s',
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
              {[['⏱', r.duracion, 'Duración'], ['◈', r.clientes, 'Clientes']].map(([icon, val, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: COLORS.accent, fontSize: 16 }}>{icon}</span>
                  <div>
                    <div style={{ color: COLORS.text, fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700 }}>{val}</div>
                    <div style={{ color: COLORS.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {['Ver Rutina', 'Asignar', 'Editar'].map((btn, j) => (
                <button key={j} style={{
                  background: j === 0 ? COLORS.accent : COLORS.border,
                  color: j === 0 ? '#000' : COLORS.muted,
                  border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                  fontWeight: j === 0 ? 700 : 400,
                }}>
                  {btn}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
