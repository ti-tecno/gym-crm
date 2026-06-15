import { useEffect, useMemo, useState } from "react";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import TabBar from "../components/ui/TabBar.jsx";
import { COLORS } from "../constants/theme.js";
import { settingsService } from "../services/modules.service.js";

function hexToRgba(hex, alpha) {
  const h = (hex || "#4A90D9").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const TABS = [
  { id: "packages", icon: "💳", label: "Paquetes" },
  { id: "schedule", icon: "🗓", label: "Horarios" },
];

function Card({ title, children, right }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, color: COLORS.text, fontSize: 16 }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function BackofficeContenido() {
  const [tab, setTab] = useState("packages");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [packages, setPackages] = useState([]);
  const [schedule, setSchedule] = useState({
    days: [],
    classColors: {},
    slots: [],
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await settingsService.admin();
        setPackages(Array.isArray(data.packages) ? data.packages : []);
        const nextSchedule = data.schedule || {
          days: [],
          classColors: {},
          slots: [],
        };
        const hasDays =
          Array.isArray(nextSchedule.days) && nextSchedule.days.length > 0;
        const hasSlots =
          Array.isArray(nextSchedule.slots) && nextSchedule.slots.length > 0;

        setSchedule(
          hasDays && hasSlots
            ? nextSchedule
            : {
                days: ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"],
                classColors: {
                  ZUMBA: "#E07840",
                  PILATES: "#3BAFC7",
                  "CARDIO BOX": "#3D8B66",
                  "MUAY THAI": "#C97088",
                  "DANZA URBANA": "#8B5BB5",
                  YOGA: "#C4B830",
                },
                slots: [
                  {
                    time: "8:00 – 8:50 a.m.",
                    classes: [null, "ZUMBA", null, "ZUMBA", null],
                  },
                  {
                    time: "9:00 – 9:50 a.m.",
                    classes: [
                      "PILATES",
                      "CARDIO BOX",
                      "PILATES",
                      "CARDIO BOX",
                      "ZUMBA",
                    ],
                  },
                ],
              },
        );
      } catch (e) {
        const status = e?.response?.status;
        const apiMsg = e?.response?.data?.error;
        const fallbackSchedule = {
          days: ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"],
          classColors: {
            ZUMBA: "#E07840",
            PILATES: "#3BAFC7",
            "CARDIO BOX": "#3D8B66",
            "MUAY THAI": "#C97088",
            "DANZA URBANA": "#8B5BB5",
            YOGA: "#C4B830",
          },
          slots: [
            {
              time: "8:00 – 8:50 a.m.",
              classes: [null, "ZUMBA", null, "ZUMBA", null],
            },
            {
              time: "9:00 – 9:50 a.m.",
              classes: [
                "PILATES",
                "CARDIO BOX",
                "PILATES",
                "CARDIO BOX",
                "ZUMBA",
              ],
            },
            {
              time: "10:00 – 10:50 a.m.",
              classes: [null, null, null, null, "PILATES"],
            },
          ],
        };

        setSchedule(fallbackSchedule);
        setPackages([]);

        if (status === 404) {
          setErr(
            "No existe configuración en backend todavía. Te muestro una tabla editable local para horarios.",
          );
        } else {
          setErr(apiMsg || "No se pudo cargar configuración");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const [newClass, setNewClass] = useState({ name: "", color: "#4A90D9" });
  const [addingClass, setAddingClass] = useState(false);

  const classNames = useMemo(
    () => Object.keys(schedule?.classColors || {}),
    [schedule],
  );

  function addClassType() {
    const name = newClass.name.trim().toUpperCase();
    if (!name || schedule.classColors[name]) return;
    setSchedule((prev) => ({
      ...prev,
      classColors: { ...prev.classColors, [name]: newClass.color },
    }));
    setNewClass({ name: "", color: "#4A90D9" });
    setAddingClass(false);
  }

  function removeClassType(name) {
    setSchedule((prev) => ({
      ...prev,
      classColors: Object.fromEntries(
        Object.entries(prev.classColors).filter(([k]) => k !== name),
      ),
      slots: prev.slots.map((s) => ({
        ...s,
        classes: s.classes.map((c) => (c === name ? null : c)),
      })),
    }));
  }

  function updateClassColor(name, color) {
    setSchedule((prev) => ({
      ...prev,
      classColors: { ...prev.classColors, [name]: color },
    }));
  }

  function addSlot() {
    setSchedule((prev) => ({
      ...prev,
      slots: [
        ...prev.slots,
        { time: "", classes: (prev.days || []).map(() => null) },
      ],
    }));
  }

  function removeSlot(ri) {
    setSchedule((prev) => ({
      ...prev,
      slots: prev.slots.filter((_, idx) => idx !== ri),
    }));
  }

  function setCell(ri, ci, value) {
    setSchedule((prev) => ({
      ...prev,
      slots: prev.slots.map((s, idx) =>
        idx === ri
          ? {
              ...s,
              classes: s.classes.map((c, cidx) =>
                cidx === ci ? value || null : c,
              ),
            }
          : s,
      ),
    }));
  }

  function setSlotTime(ri, value) {
    setSchedule((prev) => ({
      ...prev,
      slots: prev.slots.map((s, idx) =>
        idx === ri ? { ...s, time: value } : s,
      ),
    }));
  }

  function setDayName(di, value) {
    setSchedule((prev) => {
      const days = [...prev.days];
      days[di] = value;
      return { ...prev, days };
    });
  }

  const savePackages = async () => {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      await settingsService.updatePackages(packages);
      setMsg("Paquetes actualizados");
    } catch (e) {
      setErr(e?.response?.data?.error || "Error guardando paquetes");
    } finally {
      setSaving(false);
    }
  };

  const saveSchedule = async () => {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      await settingsService.updateSchedule(schedule);
      setMsg("Horarios actualizados");
    } catch (e) {
      setErr(e?.response?.data?.error || "Error guardando horarios");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div style={{ color: COLORS.muted }}>Cargando configuración…</div>;

  return (
    <div>
      <SectionHeader
        title="Backoffice de Contenido"
        sub="Administra paquetes y horarios del landing"
      />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {msg && (
        <div style={{ color: COLORS.green, marginBottom: 10 }}>{msg}</div>
      )}
      {err && <div style={{ color: COLORS.red, marginBottom: 10 }}>{err}</div>}

      {tab === "packages" && (
        <Card
          title="Paquetes y precios"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() =>
                  setPackages((prev) => [
                    ...prev,
                    {
                      id: `plan-${Date.now()}`,
                      nombre: "",
                      precio: 0,
                      periodo: "mes",
                      features: [],
                      color: COLORS.accent,
                      destacado: false,
                    },
                  ])
                }
                style={{
                  background: "transparent",
                  color: COLORS.accent,
                  border: `1px solid ${COLORS.accent}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                + Agregar plan
              </button>
              <button
                onClick={savePackages}
                disabled={saving}
                style={{
                  background: COLORS.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                {saving ? "Guardando…" : "Guardar paquetes"}
              </button>
            </div>
          }
        >
          <div style={{ display: "grid", gap: 12 }}>
            {packages.map((p, i) => (
              <div
                key={p.id || i}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 120px 140px",
                    gap: 8,
                  }}
                >
                  <input
                    value={p.id || ""}
                    onChange={(e) =>
                      setPackages((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, id: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="ID (ej: basico)"
                  />
                  <input
                    value={p.nombre || ""}
                    onChange={(e) =>
                      setPackages((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, nombre: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Nombre"
                  />
                  <input
                    type="number"
                    value={p.precio ?? 0}
                    onChange={(e) =>
                      setPackages((prev) =>
                        prev.map((x, idx) =>
                          idx === i
                            ? { ...x, precio: Number(e.target.value || 0) }
                            : x,
                        ),
                      )
                    }
                    placeholder="Precio"
                  />
                  <select
                    value={p.periodo || "mes"}
                    onChange={(e) =>
                      setPackages((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, periodo: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option value="mes">Mensual</option>
                    <option value="año">Anual</option>
                  </select>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: 8,
                    marginTop: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    value={p.color || ""}
                    onChange={(e) =>
                      setPackages((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, color: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Color HEX (#CF1B36)"
                  />
                  <label style={{ color: COLORS.muted, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={!!p.destacado}
                      onChange={(e) =>
                        setPackages((prev) =>
                          prev.map((x, idx) =>
                            idx === i
                              ? { ...x, destacado: e.target.checked }
                              : x,
                          ),
                        )
                      }
                    />{" "}
                    Destacado
                  </label>
                  <button
                    onClick={() =>
                      setPackages((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    style={{
                      background: COLORS.red,
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Eliminar
                  </button>
                </div>

                <textarea
                  value={(p.features || []).join("\n")}
                  onChange={(e) =>
                    setPackages((prev) =>
                      prev.map((x, idx) =>
                        idx === i
                          ? {
                              ...x,
                              features: e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }
                          : x,
                      ),
                    )
                  }
                  rows={4}
                  style={{ width: "100%", marginTop: 8 }}
                  placeholder="Una característica por línea"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "schedule" && (
        <>
          {/* ── Class type manager ───────────────────────────── */}
          <Card title="Tipos de clase">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {Object.entries(schedule.classColors || {}).map(([name, color]) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: hexToRgba(color, 0.12),
                    border: `1px solid ${hexToRgba(color, 0.5)}`,
                    borderRadius: 8,
                    padding: "5px 10px",
                  }}
                >
                  <input
                    type="color"
                    value={color}
                    title="Cambiar color"
                    onChange={(e) => updateClassColor(name, e.target.value)}
                    style={{
                      width: 20,
                      height: 20,
                      border: "none",
                      padding: 0,
                      borderRadius: 4,
                      cursor: "pointer",
                      background: "none",
                    }}
                  />
                  <span style={{ color, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                    {name}
                  </span>
                  <button
                    onClick={() => removeClassType(name)}
                    title="Eliminar clase"
                    style={{
                      background: "none",
                      border: "none",
                      color: COLORS.muted,
                      cursor: "pointer",
                      fontSize: 13,
                      lineHeight: 1,
                      padding: "0 2px",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {addingClass ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    value={newClass.name}
                    onChange={(e) =>
                      setNewClass((p) => ({ ...p, name: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && addClassType()}
                    placeholder="Nombre"
                    autoFocus
                    style={{ width: 120 }}
                  />
                  <input
                    type="color"
                    value={newClass.color}
                    onChange={(e) =>
                      setNewClass((p) => ({ ...p, color: e.target.value }))
                    }
                    style={{ width: 32, height: 32, border: "none", padding: 0, cursor: "pointer", borderRadius: 6 }}
                  />
                  <button
                    onClick={addClassType}
                    style={{
                      background: COLORS.accent,
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "5px 12px",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Agregar
                  </button>
                  <button
                    onClick={() => setAddingClass(false)}
                    style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 13 }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingClass(true)}
                  style={{
                    background: "transparent",
                    color: COLORS.accent,
                    border: `1px dashed ${COLORS.accent}`,
                    borderRadius: 8,
                    padding: "5px 12px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  + Nueva clase
                </button>
              )}
            </div>
          </Card>

          {/* ── Schedule grid ────────────────────────────────── */}
          <Card
            title="Cuadrícula de horarios"
            right={
              <button
                onClick={saveSchedule}
                disabled={saving}
                style={{
                  background: COLORS.accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {saving ? "Guardando…" : "Guardar horarios"}
              </button>
            }
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 5,
                  minWidth: 700,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ color: COLORS.muted, fontSize: 12, paddingBottom: 6, width: 140 }}>
                      Hora
                    </th>
                    {(schedule.days || []).map((d, di) => (
                      <th key={di} style={{ paddingBottom: 6 }}>
                        <input
                          value={d}
                          onChange={(e) => setDayName(di, e.target.value)}
                          style={{
                            width: "100%",
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: 11,
                            letterSpacing: 0.5,
                            color: COLORS.text,
                            background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: 6,
                            padding: "4px 2px",
                          }}
                        />
                      </th>
                    ))}
                    <th style={{ width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {(schedule.slots || []).map((slot, ri) => (
                    <tr key={ri}>
                      <td>
                        <input
                          value={slot.time || ""}
                          onChange={(e) => setSlotTime(ri, e.target.value)}
                          placeholder="ej. 9:00 – 9:50 a.m."
                          style={{
                            width: "100%",
                            fontSize: 12,
                            color: COLORS.muted,
                            background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: 6,
                            padding: "6px 8px",
                          }}
                        />
                      </td>
                      {(schedule.days || []).map((_, ci) => {
                        const cls = (slot.classes || [])[ci] ?? null;
                        const color = cls ? schedule.classColors[cls] : null;
                        return (
                          <td key={ci}>
                            <select
                              value={cls || ""}
                              onChange={(e) => setCell(ri, ci, e.target.value)}
                              style={{
                                width: "100%",
                                background: color
                                  ? hexToRgba(color, 0.18)
                                  : COLORS.surface,
                                color: color || COLORS.muted,
                                border: `1px solid ${color ? hexToRgba(color, 0.55) : COLORS.border}`,
                                borderRadius: 6,
                                padding: "6px 4px",
                                fontSize: 11,
                                fontWeight: cls ? 700 : 400,
                                cursor: "pointer",
                              }}
                            >
                              <option value="">—</option>
                              {classNames.map((cn) => (
                                <option key={cn} value={cn}>
                                  {cn}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => removeSlot(ri)}
                          title="Eliminar fila"
                          style={{
                            background: "none",
                            border: "none",
                            color: COLORS.muted,
                            cursor: "pointer",
                            fontSize: 16,
                            lineHeight: 1,
                            padding: 2,
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={addSlot}
              style={{
                marginTop: 10,
                background: "transparent",
                color: COLORS.accent,
                border: `1px dashed ${COLORS.accent}`,
                borderRadius: 8,
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              + Agregar franja horaria
            </button>
          </Card>
        </>
      )}
    </div>
  );
}
