import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../../constants/theme.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { clientesService } from '../../services/modules.service.js';
import { fmtDate, fmtMoney, initials } from '../../utils/format.js';
import { sanitizeText } from '../../utils/sanitize.js';

export default function Lista({ onNuevo, onPagar, onRecordar }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = async (all = showAll) => {
    setLoadingList(true);
    try {
      const data = await clientesService.list(all ? { all: true } : { limit: 100 });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const cleanSearch = sanitizeText(search).toLowerCase();
  const filtered = useMemo(() => items.filter((c) =>
    (!plan || c.plan === plan) &&
    (!cleanSearch || c.nombre.toLowerCase().includes(cleanSearch))
  ), [items, plan, cleanSearch]);

  const openEditor = (cliente) => {
    setError('');
    setEditing({
      clienteId: cliente.clienteId,
      nombre: cliente.nombre || '',
      email: cliente.email || '',
      plan: cliente.plan || '',
      vencimiento: cliente.vencimiento ? String(cliente.vencimiento).slice(0, 10) : '',
      monto: cliente.monto ?? '',
      tipoMensualidad: cliente.tipoMensualidad || '',
      estado: cliente.estado || 'Activo',
    });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setError('');
  };

  const saveEditor = async (e) => {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        nombre: editing.nombre.trim(),
        email: editing.email.trim(),
        plan: editing.plan.trim(),
        estado: editing.estado,
      };
      if (editing.vencimiento) payload.vencimiento = editing.vencimiento;
      if (editing.monto !== '') payload.monto = Number(editing.monto);
      if (editing.tipoMensualidad) payload.tipoMensualidad = editing.tipoMensualidad;

      await clientesService.update(editing.clienteId, payload);
      await reload();
      setEditing(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'No fue posible guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const activos = items.filter((c) => c.estado === 'Activo').length;
  const vencidos = items.filter((c) => c.estado === 'Vencido').length;
  const ingresos = items.reduce((a, c) => a + Number(c.monto || 0), 0);
  const showingAll = showAll;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label={`Clientes ${showingAll ? '(todos)' : '(100)'}`} value={items.length} color={COLORS.accent} icon="◈" />
        <StatCard label="Mensualidad Activa" value={fmtMoney(ingresos)} color={COLORS.green}  icon="◎" />
        <StatCard label="Vencidos"       value={vencidos}        color={COLORS.red}    icon="◷" />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            maxLength={60} placeholder="Buscar cliente…"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 14px', color: COLORS.text, fontSize: 13, flex: 1, outline: 'none', fontFamily: 'inherit' }}
          />
          <select
            value={plan} onChange={(e) => setPlan(e.target.value)}
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 12px', color: COLORS.subtle, fontSize: 13, outline: 'none' }}
          >
            <option value="">Todos los planes</option>
            <option>Básico</option><option>Premium</option><option>Elite</option>
          </select>
          <button
            type="button"
            onClick={async () => {
              const next = !showAll;
              setShowAll(next);
              await reload(next);
            }}
            disabled={loadingList}
            style={{
              background: showingAll ? `${COLORS.blue}22` : COLORS.surface,
              color: showingAll ? COLORS.blue : COLORS.muted,
              border: `1px solid ${showingAll ? COLORS.blue : COLORS.border}`,
              borderRadius: 8,
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: 13,
              cursor: loadingList ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loadingList ? 'Cargando…' : showingAll ? 'Ver 100' : 'Cargar todos'}
          </button>
          <button onClick={onNuevo} style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Nuevo
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {['Cliente', 'Plan', 'Mensualidad', 'Vencimiento', 'Monto', 'Estado', 'Acciones'].map((h) => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.clienteId}
                  onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  style={{ borderBottom: `1px solid ${COLORS.border}`, transition: 'background 0.15s' }}>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar initials={initials(c.nombre)} size={32} />
                    <div>
                      <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>{c.nombre}</div>
                      <div style={{ color: COLORS.muted, fontSize: 11 }}>{c.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 18px', color: COLORS.subtle, fontSize: 13 }}>{c.plan}</td>
                <td style={{ padding: '13px 18px', color: COLORS.subtle, fontSize: 13 }}>{c.tipoMensualidad || '—'}</td>
                <td style={{ padding: '13px 18px', color: COLORS.subtle, fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{fmtDate(c.vencimiento)}</td>
                <td style={{ padding: '13px 18px', color: COLORS.green, fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{fmtMoney(c.monto)}</td>
                <td style={{ padding: '13px 18px' }}><Badge text={c.estado} /></td>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={onPagar} style={{ background: `${COLORS.accent}22`, color: COLORS.accent, border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>💳 Pagar</button>
                    <button onClick={onRecordar} style={{ background: `${COLORS.blue}22`, color: COLORS.blue, border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>🔔</button>
                    <button onClick={() => openEditor(c)} style={{ background: COLORS.border, color: COLORS.muted, border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>✏</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          onClick={closeEditor}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(640px, 100%)',
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 18,
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
              padding: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
              <div>
                <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>
                  Editar cliente
                </div>
                <h3 style={{ margin: '6px 0 0', color: COLORS.text, fontSize: 28, fontFamily: "'Barlow Condensed',sans-serif" }}>
                  {editing.nombre || 'Sin nombre'}
                </h3>
              </div>
              <button
                onClick={closeEditor}
                disabled={saving}
                style={{
                  background: 'transparent',
                  color: COLORS.muted,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  width: 34,
                  height: 34,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveEditor} style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>Nombre</span>
                  <input
                    value={editing.nombre}
                    onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', color: COLORS.text, outline: 'none' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>Email</span>
                  <input
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', color: COLORS.text, outline: 'none' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>Plan</span>
                  <select
                    value={editing.plan}
                    onChange={(e) => setEditing({ ...editing, plan: e.target.value })}
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', color: COLORS.text, outline: 'none' }}
                  >
                    <option value="">Selecciona un plan</option>
                    <option value="Básico">Básico</option>
                    <option value="Premium">Premium</option>
                    <option value="Elite">Elite</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>Tipo de Mensualidad</span>
                  <select
                    value={editing.tipoMensualidad}
                    onChange={(e) => setEditing({ ...editing, tipoMensualidad: e.target.value })}
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', color: COLORS.text, outline: 'none' }}
                  >
                    <option value="">Sin definir</option>
                    <option value="Mensual">Mensual</option>
                    <option value="3 Meses">3 Meses</option>
                    <option value="6 Meses">6 Meses</option>
                    <option value="Anual">Anual</option>
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>Vencimiento</span>
                  <input
                    type="date"
                    value={editing.vencimiento}
                    onChange={(e) => setEditing({ ...editing, vencimiento: e.target.value })}
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', color: COLORS.text, outline: 'none' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>Monto</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.monto}
                    onChange={(e) => setEditing({ ...editing, monto: e.target.value })}
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', color: COLORS.text, outline: 'none' }}
                  />
                </label>
              </div>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>Estado</span>
                  <select
                    value={editing.estado}
                    onChange={(e) => setEditing({ ...editing, estado: e.target.value })}
                    style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 12px', color: COLORS.text, outline: 'none' }}
                  >
                    <option value="Activo">Activo</option>
                    <option value="Por vencer">Por vencer</option>
                    <option value="Vencido">Vencido</option>
                  </select>
                </label>

              {error && (
                <div style={{ color: COLORS.red, fontSize: 13, background: `${COLORS.red}12`, border: `1px solid ${COLORS.red}30`, borderRadius: 10, padding: '10px 12px' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  style={{
                    background: 'transparent',
                    color: COLORS.muted,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    padding: '10px 14px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: COLORS.accent,
                    color: '#000',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontWeight: 700,
                    cursor: saving ? 'wait' : 'pointer',
                  }}
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
