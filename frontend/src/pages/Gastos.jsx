import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import FInput from '../components/ui/FInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { gastosService } from '../services/modules.service.js';
import { fmtMoney, fmtDate } from '../utils/format.js';

const METODOS = ['Efectivo', 'Tarjeta', 'Transferencia'];

const emptyForm = { descripcion: '', monto: '', metodo: 'Efectivo', fecha: new Date().toISOString().slice(0, 10) };

export default function Gastos() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [gastos, setGastos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => gastosService.list().then(setGastos).catch(() => setGastos([]));
  useEffect(() => { refresh(); }, []);

  const totalMes = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return gastos.filter((g) => (g.fecha || '').startsWith(ym)).reduce((a, g) => a + Number(g.monto || 0), 0);
  }, [gastos]);
  const totalGeneral = gastos.reduce((a, g) => a + Number(g.monto || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const monto = Number(form.monto);
    if (!form.descripcion.trim() || !Number.isFinite(monto) || monto <= 0 || !form.fecha) {
      setError('Revisa descripción, monto y fecha.');
      return;
    }
    setSaving(true);
    try {
      await gastosService.create({ descripcion: form.descripcion.trim(), monto, metodo: form.metodo, fecha: form.fecha });
      setForm(emptyForm);
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar el gasto.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    try { await gastosService.remove(id); refresh(); } catch { /* noop */ }
  };

  return (
    <div>
      <SectionHeader
        title="Gastos"
        sub="Control de egresos del gimnasio"
        action={isAdmin ? (showForm ? 'Cancelar' : '+ Agregar') : undefined}
        onAction={() => setShowForm((v) => !v)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Gastos Registrados" value={gastos.length} color={COLORS.accent} icon="▦" />
        <StatCard label="Total General"      value={fmtMoney(totalGeneral)} color={COLORS.red} icon="◎" />
        <StatCard label="Total Este Mes"     value={fmtMoney(totalMes)}     color={COLORS.blue} icon="⬡" />
      </div>

      {showForm && isAdmin && (
        <form onSubmit={submit} style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14,
          padding: 20, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, alignItems: 'end',
        }}>
          <FInput label="Descripción" value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <FInput label="Monto" type="number" step="0.01" min="0" value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>Método</label>
            <select value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: '10px 14px', color: COLORS.text, fontSize: 13 }}>
              {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <FInput label="Fecha" type="date" value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" disabled={saving}
                    style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {saving ? 'Guardando…' : 'Guardar Gasto'}
            </button>
            {error && <span style={{ color: COLORS.red, fontSize: 12 }}>{error}</span>}
          </div>
        </form>
      )}

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {['Fecha', 'Descripción', 'Método', 'Monto', ...(isAdmin ? ['Acciones'] : [])].map((h) => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr
                key={g.gastoId}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{ borderBottom: `1px solid ${COLORS.border}` }}
              >
                <td style={{ padding: '13px 18px', color: COLORS.muted, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{fmtDate(g.fecha)}</td>
                <td style={{ padding: '13px 18px', color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{g.descripcion}</td>
                <td style={{ padding: '13px 18px' }}>
                  <span style={{ background: COLORS.border, color: COLORS.subtle, padding: '3px 10px', borderRadius: 20, fontSize: 11 }}>
                    {g.metodo}
                  </span>
                </td>
                <td style={{ padding: '13px 18px', color: COLORS.red, fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600 }}>{fmtMoney(g.monto)}</td>
                {isAdmin && (
                  <td style={{ padding: '13px 18px' }}>
                    <button onClick={() => remove(g.gastoId)}
                            style={{ background: COLORS.border, color: COLORS.muted, border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
