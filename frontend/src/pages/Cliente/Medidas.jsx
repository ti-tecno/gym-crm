import { useEffect, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import FInput from '../../components/ui/FInput.jsx';
import { clientePortal } from '../../services/cliente.service.js';
import { fmtDate } from '../../utils/format.js';

const HOY = () => new Date().toISOString().slice(0, 10);

function delta(actual, anterior) {
  if (actual == null || anterior == null) return null;
  return Number((actual - anterior).toFixed(2));
}

export default function Medidas() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    fecha: HOY(), pesoKg: '', pctGrasa: '', pctMusculo: '',
    pecho: '', brazo: '', cintura: '', cadera: '', muslo: '', notas: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const reload = () => clientePortal.medidas().then(setItems).catch(() => setItems([]));
  useEffect(() => { reload(); }, []);

  const ultima = items[0];
  const previa = items[1];

  async function guardar(e) {
    e?.preventDefault?.();
    setSaving(true); setErr('');
    try {
      const num = (v) => v === '' ? undefined : Number(v);
      const payload = {
        fecha: form.fecha,
        pesoKg:     num(form.pesoKg),
        pctGrasa:   num(form.pctGrasa),
        pctMusculo: num(form.pctMusculo),
        perimetros: {
          pecho:   num(form.pecho),
          brazo:   num(form.brazo),
          cintura: num(form.cintura),
          cadera:  num(form.cadera),
          muslo:   num(form.muslo),
        },
        notas: form.notas || undefined,
      };
      // limpia perimetros si están todos undefined
      const algunPer = Object.values(payload.perimetros).some((v) => v !== undefined);
      if (!algunPer) delete payload.perimetros;
      await clientePortal.addMedida(payload);
      setForm({ fecha: HOY(), pesoKg: '', pctGrasa: '', pctMusculo: '', pecho: '', brazo: '', cintura: '', cadera: '', muslo: '', notas: '' });
      reload();
    } catch (e2) {
      const d = e2?.response?.data;
      setErr(d?.details
        ? Object.entries(d.details).map(([k, v]) => `${k}: ${(v || []).join(', ')}`).join(' · ')
        : d?.error || 'No se pudo guardar');
    } finally { setSaving(false); }
  }

  function Card({ label, value, unit, prev }) {
    const d = delta(value, prev);
    const color = d == null ? COLORS.muted : d === 0 ? COLORS.subtle : d > 0 ? COLORS.accent : COLORS.green;
    return (
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ color: COLORS.muted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>{label}</div>
        <div style={{ color: value == null ? COLORS.muted : COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 800, marginTop: 4 }}>
          {value == null ? '—' : value}{value != null && <span style={{ fontSize: 13, color: COLORS.muted, marginLeft: 4 }}>{unit}</span>}
        </div>
        {d != null && (
          <div style={{ color, fontSize: 11, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
            {d > 0 ? '▲' : d < 0 ? '▼' : '–'} {Math.abs(d)} {unit}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Mis Medidas" sub="Registra peso y perímetros cada 2-4 semanas. Verás la tendencia comparada con tu medida anterior." />

      {/* Tarjetas con última medida + delta vs previa */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Card label="Peso"     value={ultima?.pesoKg}                  unit="kg" prev={previa?.pesoKg} />
        <Card label="% Grasa"  value={ultima?.pctGrasa}                unit="%"  prev={previa?.pctGrasa} />
        <Card label="% Músc."  value={ultima?.pctMusculo}              unit="%"  prev={previa?.pctMusculo} />
        <Card label="Pecho"    value={ultima?.perimetros?.pecho}       unit="cm" prev={previa?.perimetros?.pecho} />
        <Card label="Brazo"    value={ultima?.perimetros?.brazo}       unit="cm" prev={previa?.perimetros?.brazo} />
        <Card label="Cintura"  value={ultima?.perimetros?.cintura}     unit="cm" prev={previa?.perimetros?.cintura} />
        <Card label="Cadera"   value={ultima?.perimetros?.cadera}      unit="cm" prev={previa?.perimetros?.cadera} />
        <Card label="Muslo"    value={ultima?.perimetros?.muslo}       unit="cm" prev={previa?.perimetros?.muslo} />
      </div>

      {/* Formulario nueva medida */}
      <form onSubmit={guardar} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 22, marginBottom: 24 }}>
        <h3 style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Registrar medida nueva</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <FInput label="Fecha"      type="date"   value={form.fecha}      onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          <FInput label="Peso (kg)"  type="number" value={form.pesoKg}     onChange={(e) => setForm({ ...form, pesoKg: e.target.value })} />
          <FInput label="% Grasa"    type="number" value={form.pctGrasa}   onChange={(e) => setForm({ ...form, pctGrasa: e.target.value })} />
          <FInput label="% Músculo"  type="number" value={form.pctMusculo} onChange={(e) => setForm({ ...form, pctMusculo: e.target.value })} />
          <FInput label="Pecho (cm)" type="number" value={form.pecho}      onChange={(e) => setForm({ ...form, pecho: e.target.value })} />
          <FInput label="Brazo (cm)" type="number" value={form.brazo}      onChange={(e) => setForm({ ...form, brazo: e.target.value })} />
          <FInput label="Cintura (cm)" type="number" value={form.cintura}  onChange={(e) => setForm({ ...form, cintura: e.target.value })} />
          <FInput label="Cadera (cm)"  type="number" value={form.cadera}   onChange={(e) => setForm({ ...form, cadera: e.target.value })} />
          <FInput label="Muslo (cm)"   type="number" value={form.muslo}    onChange={(e) => setForm({ ...form, muslo: e.target.value })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>Notas</label>
          <textarea value={form.notas} maxLength={300} onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    placeholder="Hidratación, hora del día, etc."
                    style={{ width: '100%', marginTop: 6, background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', minHeight: 60, fontFamily: 'inherit', fontSize: 13 }} />
        </div>
        {err && <div style={{ marginTop: 10, color: COLORS.red, fontSize: 12 }}>{err}</div>}
        <button type="submit" disabled={saving}
          style={{ marginTop: 14, background: COLORS.green, color: '#000', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14 }}>
          {saving ? 'Guardando…' : 'Guardar medida'}
        </button>
      </form>

      {/* Histórico */}
      <h3 style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Histórico</h3>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {['Fecha', 'Peso', '% Grasa', '% Músc.', 'Pecho', 'Brazo', 'Cintura', 'Cadera', 'Muslo'].map((h) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: COLORS.muted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.medidaId} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td style={{ padding: '10px 14px', color: COLORS.subtle, fontFamily: "'DM Mono',monospace" }}>{fmtDate(m.fecha)}</td>
                <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace" }}>{m.pesoKg ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace" }}>{m.pctGrasa ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace" }}>{m.pctMusculo ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace" }}>{m.perimetros?.pecho ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace" }}>{m.perimetros?.brazo ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace" }}>{m.perimetros?.cintura ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace" }}>{m.perimetros?.cadera ?? '—'}</td>
                <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace" }}>{m.perimetros?.muslo ?? '—'}</td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: COLORS.muted }}>Aún no registras medidas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
