import { useEffect, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { clientesService, rutinasService } from '../services/modules.service.js';
import { initials } from '../utils/format.js';

export default function RutinasClientes() {
  const [clientes, setClientes] = useState([]);
  const [rutinas, setRutinas] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([clientesService.list({ limit: 100 }), rutinasService.listClientes()])
      .then(([cs, rs]) => {
        setClientes(cs);
        setRutinas(rs);
        if (cs.length) setSelected(cs[0].clienteId);
      })
      .catch(() => {});
  }, []);

  const cliente = clientes.find((c) => c.clienteId === selected);
  const rutina  = rutinas.find((r) => r.clienteId === selected) || { coach: '—', semana: 0, objetivo: '—', dias: [] };

  return (
    <div>
      <SectionHeader title="Rutinas de Clientes" sub="Seguimiento personalizado por cliente" action="+ Crear Rutina" />
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 12 }}>
          {clientes.map((c) => {
            const on = c.clienteId === selected;
            return (
              <div
                key={c.clienteId}
                onClick={() => setSelected(c.clienteId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10,
                  background: on ? `${COLORS.accent}18` : 'transparent',
                  border: on ? `1px solid ${COLORS.accent}44` : '1px solid transparent',
                  cursor: 'pointer', marginBottom: 4,
                }}
              >
                <Avatar initials={initials(c.nombre)} size={28} color={on ? COLORS.accent : COLORS.blue} />
                <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{c.nombre}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24 }}>
          {!cliente ? (
            <div style={{ color: COLORS.muted }}>Selecciona un cliente</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
                <Avatar initials={initials(cliente.nombre)} size={46} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800 }}>
                    {cliente.nombre}
                  </h3>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>
                    Coach: {rutina.coach} · Semana {rutina.semana} ·{' '}
                    <span style={{ color: COLORS.accent }}>{rutina.objetivo}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {rutina.dias.map((dia, i) => (
                  <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ color: COLORS.accent, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800 }}>
                        {dia.dia}
                      </span>
                      <span style={{ color: COLORS.muted, fontSize: 11, background: COLORS.border, padding: '2px 8px', borderRadius: 20 }}>
                        {dia.musculo}
                      </span>
                    </div>
                    {dia.ejercicios.map((ej, j) => (
                      <div key={j} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.accent, flexShrink: 0, marginTop: 4 }} />
                        <span style={{ color: COLORS.subtle, fontSize: 12 }}>{ej}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
