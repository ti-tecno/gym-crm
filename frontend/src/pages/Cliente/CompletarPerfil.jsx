import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../../constants/theme.js";
import SectionHeader from "../../components/ui/SectionHeader.jsx";
import FInput from "../../components/ui/FInput.jsx";
import { clientePortal } from "../../services/cliente.service.js";
import { useAuth } from "../../context/AuthContext.jsx";

const GENEROS = [
  { id: "H", label: "Hombre" },
  { id: "M", label: "Mujer" },
  { id: "Otro", label: "Otro" },
];

const CHECKS_SALUD = [
  ["cardiaco", "Problema cardiaco"],
  ["pecho", "Molestia al ejercicio"],
  ["ahogo", "Ahogo o fatiga leve"],
  ["mareo", "Mareo / desmayos"],
  ["neurologico", "Problema neurológico"],
  ["respiratorio", "Problema respiratorio"],
  ["osteoarticular", "Problemas músculo-articulares"],
  ["dolorReciente", "Dolor reciente"],
];

const BENEFICIOS = [
  "Salud y bienestar",
  "Recreación",
  "Acondicionamiento físico",
  "Aumento de masa muscular",
  "Bajar de peso",
  "Rendimiento deportivo",
];

/** Par de radios Sí/No compartido por los campos condicionados (alergias, medicamento actual, otro padecimiento). */
function SiNoRadios({ label: labelText, name, register, error }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={label}>{labelText}</label>
      <div style={{ display: "flex", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: COLORS.surface, border: `1px solid ${error ? COLORS.red : COLORS.border}`, borderRadius: 9, padding: "10px 14px", color: COLORS.text, fontSize: 13 }}>
          <input type="radio" value="si" {...register(name)} style={{ accentColor: COLORS.accent }} />
          Sí
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: COLORS.surface, border: `1px solid ${error ? COLORS.red : COLORS.border}`, borderRadius: 9, padding: "10px 14px", color: COLORS.text, fontSize: 13 }}>
          <input type="radio" value="no" {...register(name)} style={{ accentColor: COLORS.accent }} />
          No
        </label>
      </div>
      {error && <span style={{ color: COLORS.red, fontSize: 11 }}>{error}</span>}
    </div>
  );
}

const schema = z
  .object({
    apellido: z.string().trim().min(2, "Mínimo 2").max(60),
    telefono: z.string().regex(/^[\d\s\-()+]{7,20}$/, "Teléfono inválido"),
    fechaNacimiento: z.string().min(1, "Requerido"),
    edad: z.string().min(1, "Requerido"),
    genero: z.enum(["H", "M", "Otro"], { errorMap: () => ({ message: "Requerido" }) }),
    estudiante: z.boolean().optional(),
    matricula: z.string().max(40).optional().or(z.literal("")),
    peso: z.string().min(1, "Requerido"),
    grupoSanguineo: z.string().trim().min(1, "Requerido").max(12),
    alergiaTiene: z.enum(["si", "no"], { errorMap: () => ({ message: "Requerido" }) }),
    alergiaDetalle: z.string().trim().max(120).optional().or(z.literal("")),
    emergenciaNombre: z.string().trim().min(2, "Mínimo 2").max(60),
    emergenciaParentesco: z.string().trim().min(2, "Mínimo 2").max(40),
    emergenciaTelefono: z.string().regex(/^[\d\s\-()+]{7,20}$/, "Teléfono inválido"),
    cardiaco: z.boolean().optional(),
    pecho: z.boolean().optional(),
    ahogo: z.boolean().optional(),
    mareo: z.boolean().optional(),
    neurologico: z.boolean().optional(),
    respiratorio: z.boolean().optional(),
    osteoarticular: z.boolean().optional(),
    dolorReciente: z.boolean().optional(),
    factoresRiesgo: z.string().trim().min(1, "Requerido, escribe 'Ninguno' si no aplica").max(240),
    medicamentoTiene: z.enum(["si", "no"], { errorMap: () => ({ message: "Requerido" }) }),
    medicamentoDetalle: z.string().trim().max(240).optional().or(z.literal("")),
    otroPadecimientoTiene: z.enum(["si", "no"], { errorMap: () => ({ message: "Requerido" }) }),
    otroPadecimientoDetalle: z.string().trim().max(240).optional().or(z.literal("")),
    actividadHabitual: z.boolean().optional(),
    actividadTipo: z.string().max(80).optional().or(z.literal("")),
    frecuenciaSemanal: z.string().optional(),
    tiempoSesion: z.string().max(40).optional().or(z.literal("")),
    ultimaVezPrograma: z.string().trim().min(1, "Requerido").max(80),
    beneficios: z.array(z.string()).min(1, "Selecciona al menos un beneficio"),
    aceptoPrivacidad: z.boolean().refine(Boolean, "Debes aceptar el aviso de privacidad"),
    aceptoResponsiva: z.boolean().refine(Boolean, "Debes aceptar la responsiva"),
  })
  .superRefine((d, ctx) => {
    if (d.estudiante && !d.matricula?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["matricula"], message: "Requerido si eres estudiante" });
    }
    if (d.alergiaTiene === "si" && !d.alergiaDetalle?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alergiaDetalle"], message: "Especifica la alergia" });
    }
    if (d.medicamentoTiene === "si" && !d.medicamentoDetalle?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["medicamentoDetalle"], message: "Especifica el medicamento y dosis" });
    }
    if (d.actividadHabitual) {
      if (!d.actividadTipo?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actividadTipo"], message: "Requerido si practicas actividad física" });
      }
      if (!d.frecuenciaSemanal?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["frecuenciaSemanal"], message: "Requerido si practicas actividad física" });
      }
      if (!d.tiempoSesion?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tiempoSesion"], message: "Requerido si practicas actividad física" });
      }
    }
    if (d.otroPadecimientoTiene === "si" && !d.otroPadecimientoDetalle?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otroPadecimientoDetalle"], message: "Describe el padecimiento" });
    }
  });

function parseOptionalNumber(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const DEFAULTS = {
  apellido: "", telefono: "", fechaNacimiento: "", edad: "", genero: "",
  estudiante: false, matricula: "", peso: "",
  grupoSanguineo: "", alergiaTiene: "", alergiaDetalle: "",
  emergenciaNombre: "", emergenciaParentesco: "", emergenciaTelefono: "",
  cardiaco: false, pecho: false, ahogo: false, mareo: false, neurologico: false,
  respiratorio: false, osteoarticular: false, dolorReciente: false,
  factoresRiesgo: "", medicamentoTiene: "", medicamentoDetalle: "",
  otroPadecimientoTiene: "", otroPadecimientoDetalle: "",
  actividadHabitual: false, actividadTipo: "", frecuenciaSemanal: "", tiempoSesion: "",
  ultimaVezPrograma: "", beneficios: [],
  aceptoPrivacidad: false, aceptoResponsiva: false,
};

/** "Ninguna"/"Ninguno" (o vacío) → { tiene: "no" }; cualquier otro texto → { tiene: "si", detalle }. */
function textToSiNo(value) {
  const v = (value || "").trim();
  if (!v) return { tiene: "", detalle: "" };
  if (/^ningun[oa]$/i.test(v)) return { tiene: "no", detalle: "" };
  return { tiene: "si", detalle: v };
}

/** Aplana la respuesta de GET /cliente/perfil ({ apellido, telefono, inscripcion }) al shape plano del form. */

function toFormValues(perfil) {
  const insc = perfil.inscripcion || {};
  const salud = insc.salud || {};
  const habitos = insc.habitos || {};
  const emergencia = insc.emergencia || {};
  const alergia = textToSiNo(insc.alergiaMedicamentos);
  const medicamento = textToSiNo(salud.medicamentoActual);
  const otroPadecimiento = textToSiNo(salud.otroPadecimiento);
  return {
    apellido: perfil.apellido || "",
    telefono: perfil.telefono || "",
    fechaNacimiento: insc.fechaNacimiento || "",
    edad: insc.edad != null ? String(insc.edad) : "",
    genero: insc.genero || "",
    estudiante: !!insc.estudiante,
    matricula: insc.matricula || "",
    peso: insc.peso != null ? String(insc.peso) : "",
    grupoSanguineo: insc.grupoSanguineo || "",
    alergiaTiene: alergia.tiene,
    alergiaDetalle: alergia.detalle,
    emergenciaNombre: emergencia.nombre || "",
    emergenciaParentesco: emergencia.parentesco || "",
    emergenciaTelefono: emergencia.telefono || "",
    cardiaco: !!salud.cardiaco,
    pecho: !!salud.pecho,
    ahogo: !!salud.ahogo,
    mareo: !!salud.mareo,
    neurologico: !!salud.neurologico,
    respiratorio: !!salud.respiratorio,
    osteoarticular: !!salud.osteoarticular,
    dolorReciente: !!salud.dolorReciente,
    factoresRiesgo: salud.factoresRiesgo || "",
    medicamentoTiene: medicamento.tiene,
    medicamentoDetalle: medicamento.detalle,
    otroPadecimientoTiene: otroPadecimiento.tiene,
    otroPadecimientoDetalle: otroPadecimiento.detalle,
    actividadHabitual: !!habitos.actividadHabitual,
    actividadTipo: habitos.actividadTipo || "",
    frecuenciaSemanal: habitos.frecuenciaSemanal != null ? String(habitos.frecuenciaSemanal) : "",
    tiempoSesion: habitos.tiempoSesion || "",
    ultimaVezPrograma: habitos.ultimaVezPrograma || "",
    beneficios: habitos.beneficios || [],
    aceptoPrivacidad: !!habitos.aceptoPrivacidad,
    aceptoResponsiva: !!habitos.aceptoResponsiva,
  };
}

function toApiPayload(data) {
  return {
    apellido: data.apellido.trim(),
    telefono: data.telefono.trim(),
    fechaNacimiento: data.fechaNacimiento,
    edad: parseOptionalNumber(data.edad),
    genero: data.genero,
    estudiante: !!data.estudiante,
    matricula: data.matricula?.trim() || undefined,
    peso: parseOptionalNumber(data.peso),
    grupoSanguineo: data.grupoSanguineo.trim(),
    alergiaMedicamentos: data.alergiaTiene === "si" ? data.alergiaDetalle.trim() : "Ninguna",
    emergencia: {
      nombre: data.emergenciaNombre.trim(),
      parentesco: data.emergenciaParentesco.trim(),
      telefono: data.emergenciaTelefono.trim(),
    },
    salud: {
      cardiaco: !!data.cardiaco,
      pecho: !!data.pecho,
      ahogo: !!data.ahogo,
      mareo: !!data.mareo,
      neurologico: !!data.neurologico,
      respiratorio: !!data.respiratorio,
      osteoarticular: !!data.osteoarticular,
      dolorReciente: !!data.dolorReciente,
      factoresRiesgo: data.factoresRiesgo.trim(),
      medicamentoActual: data.medicamentoTiene === "si" ? data.medicamentoDetalle.trim() : "Ninguno",
      otroPadecimiento: data.otroPadecimientoDetalle?.trim() || undefined,
    },
    habitos: {
      actividadHabitual: !!data.actividadHabitual,
      actividadTipo: data.actividadTipo?.trim() || undefined,
      frecuenciaSemanal: parseOptionalNumber(data.frecuenciaSemanal),
      tiempoSesion: data.tiempoSesion?.trim() || undefined,
      ultimaVezPrograma: data.ultimaVezPrograma.trim(),
      beneficios: data.beneficios,
      aceptoPrivacidad: !!data.aceptoPrivacidad,
      aceptoResponsiva: !!data.aceptoResponsiva,
    },
  };
}

const label = { color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'DM Mono',monospace" };
const card = { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24, marginBottom: 20 };
const cardTitle = { color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 16 };

export default function CompletarPerfil() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { markProfileComplete } = useAuth();

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });
  const alergiaTiene = watch("alergiaTiene");
  const medicamentoTiene = watch("medicamentoTiene");
  const otroPadecimientoTiene = watch("otroPadecimientoTiene");

  useEffect(() => {
    clientePortal
      .perfil()
      .then((perfil) => reset(toFormValues(perfil)))
      .catch((e) => setLoadError(e?.response?.data?.error || "No se pudo cargar tu perfil"))
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data) => {
    setServerError("");
    try {
      await clientePortal.updatePerfil(toApiPayload(data));
      markProfileComplete();
      setDone(true);
    } catch (e) {
      const d = e?.response?.data;
      if (d?.details) {
        setServerError(Object.entries(d.details).map(([k, v]) => `${k}: ${(v || []).join(", ")}`).join(" · "));
      } else {
        setServerError(d?.error || "No fue posible guardar tu información");
      }
    }
  };

  if (loading) return <div style={{ color: COLORS.muted }}>Cargando…</div>;
  if (loadError) return <div style={{ color: COLORS.red }}>{loadError}</div>;

  if (done) {
    return (
      <div>
        <SectionHeader title="Mi Perfil" sub="Información de registro" />
        <div style={{ ...card, maxWidth: 520, textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#0d2b1a", border: `2px solid ${COLORS.green}`, display: "grid", placeItems: "center", fontSize: 26, margin: "0 auto 16px" }}>✓</div>
          <h3 style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>¡Listo!</h3>
          <p style={{ color: COLORS.muted, marginBottom: 20 }}>Tu información quedó actualizada.</p>
          <button
            onClick={() => navigate("/mi/resumen", { replace: true })}
            style={{ background: COLORS.accent, color: "#000", border: "none", borderRadius: 10, padding: "10px 28px", fontWeight: 700, cursor: "pointer" }}
          >
            Ir a Mi Resumen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Mi Perfil" sub="Completa la información que falta de tu registro" />

      <div style={{ ...card, maxWidth: 720, background: "#2b1a0d", borderColor: `${COLORS.accent}44` }}>
        <span style={{ color: COLORS.subtle, fontSize: 13 }}>
          Tu cuenta entró con Google o fue creada antes de este cuestionario, así que nos falta información de tu ficha de registro (contacto de emergencia, salud, hábitos). Complétala una sola vez para continuar.
        </span>
      </div>

      {serverError && (
        <div style={{ color: COLORS.red, background: "#2b0d0d", border: `1px solid ${COLORS.red}44`, borderRadius: 8, padding: "8px 12px", marginBottom: 16, maxWidth: 720 }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ maxWidth: 720 }}>
        <div style={card}>
          <div style={cardTitle}>Datos Personales</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <FInput label="Apellido *" placeholder="García" {...register("apellido")} error={errors.apellido?.message} />
            <FInput label="WhatsApp *" placeholder="555-000-0000" {...register("telefono")} error={errors.telefono?.message} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr .8fr .8fr", gap: 12, marginBottom: 16 }}>
            <FInput label="Fecha de nacimiento *" type="date" {...register("fechaNacimiento")} error={errors.fechaNacimiento?.message} />
            <FInput label="Edad *" type="number" inputMode="numeric" {...register("edad")} error={errors.edad?.message} />
            <FInput label="Peso (kg) *" type="number" inputMode="decimal" {...register("peso")} error={errors.peso?.message} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={label}>Género *</label>
              <select {...register("genero")} style={{ background: COLORS.surface, border: `1px solid ${errors.genero ? COLORS.red : COLORS.border}`, borderRadius: 9, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                <option value="">Seleccionar…</option>
                {GENEROS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
              {errors.genero?.message && <span style={{ color: COLORS.red, fontSize: 11 }}>{errors.genero.message}</span>}
            </div>
            <label style={{ ...label, display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end" }}>
              Estudiante
              <span style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "11px 14px", color: COLORS.text, textTransform: "none", fontSize: 13, letterSpacing: 0, fontFamily: "inherit" }}>
                <input type="checkbox" {...register("estudiante")} style={{ accentColor: COLORS.accent }} />
                Sí, aún estudio
              </span>
            </label>
          </div>
          <FInput label="Matrícula" placeholder="Obligatoria si eres estudiante" {...register("matricula")} error={errors.matricula?.message} />
        </div>

        <div style={card}>
          <div style={cardTitle}>Salud</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <FInput label="Grupo sanguíneo *" placeholder="O+, A-, etc." {...register("grupoSanguineo")} error={errors.grupoSanguineo?.message} />
            <SiNoRadios label="¿Alergia a medicamentos? *" name="alergiaTiene" register={register} error={errors.alergiaTiene?.message} />
          </div>
          {alergiaTiene === "si" && (
            <div style={{ marginBottom: 16 }}>
              <FInput label="¿Cuál alergia? *" placeholder="Penicilina, aspirina, etc." {...register("alergiaDetalle")} error={errors.alergiaDetalle?.message} />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <FInput label="Emergencia *" placeholder="Nombre completo" {...register("emergenciaNombre")} error={errors.emergenciaNombre?.message} />
            <FInput label="Parentesco *" placeholder="Madre, hermano, etc." {...register("emergenciaParentesco")} error={errors.emergenciaParentesco?.message} />
            <FInput label="Teléfono de emergencia *" placeholder="555-000-0000" {...register("emergenciaTelefono")} error={errors.emergenciaTelefono?.message} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...label, display: "block", marginBottom: 8 }}>Historial médico</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
              {CHECKS_SALUD.map(([name, l]) => (
                <label key={name} style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 13 }}>
                  <input type="checkbox" {...register(name)} style={{ accentColor: COLORS.accent }} />
                  {l}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={label}>Factores de riesgo *</label>
              <textarea rows={4} placeholder="Colesterol alto, diabetes... o 'Ninguno'" {...register("factoresRiesgo")}
                style={{ background: COLORS.surface, border: `1px solid ${errors.factoresRiesgo ? COLORS.red : COLORS.border}`, borderRadius: 9, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
              {errors.factoresRiesgo?.message && <span style={{ color: COLORS.red, fontSize: 11 }}>{errors.factoresRiesgo.message}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SiNoRadios label="¿Medicamento actual? *" name="medicamentoTiene" register={register} error={errors.medicamentoTiene?.message} />
              {medicamentoTiene === "si" && (
                <>
                  <textarea rows={3} placeholder="Cuál y dosis" {...register("medicamentoDetalle")}
                    style={{ background: COLORS.surface, border: `1px solid ${errors.medicamentoDetalle ? COLORS.red : COLORS.border}`, borderRadius: 9, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                  {errors.medicamentoDetalle?.message && <span style={{ color: COLORS.red, fontSize: 11 }}>{errors.medicamentoDetalle.message}</span>}
                </>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SiNoRadios label="¿Otro padecimiento?" name="otroPadecimientoTiene" register={register} error={errors.otroPadecimientoTiene?.message} />
              {otroPadecimientoTiene === "si" && (
                <>
                  <textarea rows={3} placeholder="Describe la condición marcada arriba" {...register("otroPadecimientoDetalle")}
                    style={{ background: COLORS.surface, border: `1px solid ${errors.otroPadecimientoDetalle ? COLORS.red : COLORS.border}`, borderRadius: 9, padding: "10px 14px", color: COLORS.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                  {errors.otroPadecimientoDetalle?.message && <span style={{ color: COLORS.red, fontSize: 11 }}>{errors.otroPadecimientoDetalle.message}</span>}
                </>
              )}
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Hábitos</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <FInput label="Actividad física habitual" placeholder="Obligatorio si practicas actividad física" {...register("actividadTipo")} error={errors.actividadTipo?.message} />
            <FInput label="Última vez en programa *" placeholder="Hace 3 meses, nunca, etc." {...register("ultimaVezPrograma")} error={errors.ultimaVezPrograma?.message} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <label style={{ ...label, display: "flex", flexDirection: "column", gap: 6 }}>
              ¿Practicas actividad física?
              <span style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "11px 14px", color: COLORS.text, textTransform: "none", fontSize: 13, letterSpacing: 0, fontFamily: "inherit" }}>
                <input type="checkbox" {...register("actividadHabitual")} style={{ accentColor: COLORS.accent }} />
                Sí, hago ejercicio
              </span>
            </label>
            <FInput label="Frecuencia semanal" placeholder="Obligatorio si practicas actividad física" type="number" inputMode="numeric" {...register("frecuenciaSemanal")} error={errors.frecuenciaSemanal?.message} />
            <FInput label="Tiempo por sesión" placeholder="Obligatorio si practicas actividad física" {...register("tiempoSesion")} error={errors.tiempoSesion?.message} />
          </div>
          <div>
            <label style={{ ...label, display: "block", marginBottom: 8 }}>Beneficios esperados * (elige al menos uno)</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
              {BENEFICIOS.map((b) => (
                <label key={b} style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.surface, border: `1px solid ${errors.beneficios ? COLORS.red : COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 13 }}>
                  <input type="checkbox" value={b} {...register("beneficios")} style={{ accentColor: COLORS.accent }} />
                  {b}
                </label>
              ))}
            </div>
            {errors.beneficios?.message && <span style={{ color: COLORS.red, fontSize: 11 }}>{errors.beneficios.message}</span>}
          </div>
        </div>

        <div style={card}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, color: COLORS.text, fontSize: 13, lineHeight: 1.45, marginBottom: 12 }}>
            <input type="checkbox" {...register("aceptoPrivacidad")} style={{ accentColor: COLORS.accent, marginTop: 2 }} />
            <span>Confirmo que leí y acepto el aviso de privacidad.</span>
          </label>
          {errors.aceptoPrivacidad?.message && <div style={{ color: COLORS.red, fontSize: 12, marginBottom: 12 }}>{errors.aceptoPrivacidad.message}</div>}
          <label style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.text, fontSize: 13, lineHeight: 1.45 }}>
            <input type="checkbox" {...register("aceptoResponsiva")} style={{ accentColor: COLORS.accent }} />
            Entiendo y acepto que la actividad física tiene riesgos y confirmo que la información médica proporcionada es correcta.
          </label>
          {errors.aceptoResponsiva?.message && <div style={{ color: COLORS.red, fontSize: 12, marginTop: 8 }}>{errors.aceptoResponsiva.message}</div>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ background: COLORS.green, color: "#000", border: "none", borderRadius: 10, padding: "12px 32px", fontWeight: 800, fontSize: 15, cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.6 : 1 }}
        >
          {isSubmitting ? "Guardando…" : "✓ Guardar mi información"}
        </button>
      </form>
    </div>
  );
}
