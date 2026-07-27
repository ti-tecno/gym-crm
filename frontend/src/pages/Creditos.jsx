import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import FInput from '../components/ui/FInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { creditosService } from '../services/modules.service.js';
import { fmtMoney, fmtDate } from '../utils/format.js';

const emptyForm = {
  legacyUsuario: '', concepto: '', montoRegistrado: '', saldoPendiente: '',
  comentarios: '', fecha: new Date().toISOString().slice(0, 10),
};

export default function Creditos() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [creditos, setCreditos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => creditosService.list().then(setCreditos).catch(() => setCreditos([]));
  useEffect(() => { refresh(); }, []);

  const totalPorCobrar = useMemo(
    () => creditos.filter((c) => c.estado === 'Pendiente').reduce((a, c) => a + Number(c.saldoPendiente || 0), 0),
    [creditos],
  );
  const pendientes = creditos.filter((c) => c.estado === 'Pendiente').length;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const montoRegistrado = Number(form.montoRegistrado);
    const saldoPendiente = form.saldoPendiente === '' ? 0 : Number(form.saldoPendiente);
    if (!form.legacyUsuario.trim() || !form.concepto.trim() || !Number.isFinite(montoRegistrado) || montoRegistrado <= 0 || !form.fecha) {
      setError('Revisa cliente, concepto, monto y fecha.');
      return;
    }
    setSaving(true);
    try {
      await creditosService.create({
        legacyUsuario: form.legacyUsuario.trim(),
        concepto: form.concepto.trim(),
        montoRegistrado,
        saldoPendiente,
        comentarios: form.comentarios.trim() || undefined,
        fecha: form.fecha,
      });
      setForm(emptyForm);
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo guardar el crédito.');
    } finally {
      setSaving(false);
    }
  };

  const marcarPagado = async (id) => {
    try { await creditosService.update(id, { saldoPendiente: 0, estado: 'Pagado' }); refresh(); } catch { /* noop */ }
  };

  const remove = async (id) => {
    if (!window.confirm('¿Eliminar este crédito?')) return;
    try { await creditosService.remove(id); refresh(); } catch { /* noop */ }
  };

  return (
    <div>
      <SectionHeader
        title="Créditos"
        sub="Saldos a favor y por cobrar (fiado)"
        action={isAdmin ? (showForm ? 'Cancelar' : '+ Agregar') : undefined}
        onAction={() => setShowForm((v) => !v)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Créditos Registrados" value={creditos.length} color={COLORS.accent} icon="▦" />
        <StatCard label="Pendientes de Cobro"  value={pendientes}      color={COLORS.red}    icon="◍" />
        <StatCard label="Total por Cobrar"     value={fmtMoney(totalPorCobrar)} color={COLORS.blue} icon="⬡" />
      </div>

      {showForm && isAdmin && (
        <form onSubmit={submit} style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14,
          padding: 20, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, alignItems: 'end',
        }}>
          <FInput label="Cliente" value={form.legacyUsuario}
                  onChange={(e) => setForm({ ...form, legacyUsuario: e.target.value })} />
          <FInput label="Concepto" value={form.concepto}
                  onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
          <FInput label="Fecha" type="date" value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          <FInput label="Monto Pagado" type="number" step="0.01" min="0" value={form.montoRegistrado}
                  onChange={(e) => setForm({ ...form, montoRegistrado: e.target.value })} />
          <FInput label="Falta por Cobrar" type="number" step="0.01" min="0" value={form.saldoPendiente}
                  onChange={(e) => setForm({ ...form, saldoPendiente: e.target.value })} />
          <FInput label="Comentarios (opcional)" value={form.comentarios}
                  onChange={(e) => setForm({ ...form, comentarios: e.target.value })} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" disabled={saving}
                    style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {saving ? 'Guardando…' : 'Guardar Crédito'}
            </button>
            {error && <span style={{ color: COLORS.red, fontSize: 12 }}>{error}</span>}
          </div>
        </form>
      )}

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {['Fecha', 'Cliente', 'Concepto', 'Monto Pagado', 'Falta', 'Estado', ...(isAdmin ? ['Acciones'] : [])].map((h) => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {creditos.map((c) => (
              <tr
                key={c.creditoId}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{ borderBottom: `1px solid ${COLORS.border}` }}
              >
                <td style={{ padding: '13px 18px', color: COLORS.muted, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{fmtDate(c.fecha)}</td>
                <td style={{ padding: '13px 18px', color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{c.cliente}</td>
                <td style={{ padding: '13px 18px', color: COLORS.muted, fontSize: 13 }}>{c.concepto}</td>
                <td style={{ padding: '13px 18px', color: COLORS.green, fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600 }}>{fmtMoney(c.montoRegistrado)}</td>
                <td style={{ padding: '13px 18px', color: c.saldoPendiente > 0 ? COLORS.red : COLORS.muted, fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600 }}>
                  {c.saldoPendiente > 0 ? fmtMoney(c.saldoPendiente) : '—'}
                </td>
                <td style={{ padding: '13px 18px' }}>
                  <span style={{
                    background: c.estado === 'Pendiente' ? `${COLORS.red}33` : `${COLORS.green}33`,
                    color: c.estado === 'Pendiente' ? COLORS.red : COLORS.green,
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  }}>
                    {c.estado}
                  </span>
                </td>
                {isAdmin && (
                  <td style={{ padding: '13px 18px', display: 'flex', gap: 8 }}>
                    {c.estado === 'Pendiente' && (
                      <button onClick={() => marcarPagado(c.creditoId)}
                              style={{ background: COLORS.green, color: '#000', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        Marcar pagado
                      </button>
                    )}
                    <button onClick={() => remove(c.creditoId)}
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
