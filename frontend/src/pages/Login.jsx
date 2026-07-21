import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { COLORS } from "../constants/theme.js";
import FInput from "../components/ui/FInput.jsx";
import { isWhitelistedRoute, safeNext } from "../utils/safeRoute.js";

// ── Schemas ──
const loginSchema = z.object({
  email: z.string().email("Email inválido").max(120),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
});

const registerSchema = z
  .object({
    nombre: z.string().trim().min(2, "Mínimo 2").max(60),
    apellido: z
      .string()
      .trim()
      .min(2, "Mínimo 2")
      .max(60)
      .optional()
      .or(z.literal("")),
    email: z.string().email("Email inválido").max(120),
    telefono: z
      .string()
      .regex(/^[\d\s\-()+]{7,20}$/, "Teléfono inválido")
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(128)
      .regex(/[A-Z]/, "Incluye una mayúscula")
      .regex(/[a-z]/, "Incluye una minúscula")
      .regex(/\d/, "Incluye un número"),
    confirm: z.string().min(8).max(128),
    plan: z.enum(["Básico", "Premium", "Elite"]),
    fechaNacimiento: z.string().optional(),
    edad: z.string().optional(),
    genero: z.enum(["H", "M", "Otro"]).optional().or(z.literal("")),
    estudiante: z.boolean().optional(),
    matricula: z.string().max(40).optional().or(z.literal("")),
    peso: z.string().optional(),
    grupoSanguineo: z.string().max(12).optional().or(z.literal("")),
    alergiaMedicamentos: z.string().max(120).optional().or(z.literal("")),
    emergenciaNombre: z.string().max(60).optional().or(z.literal("")),
    emergenciaParentesco: z.string().max(40).optional().or(z.literal("")),
    emergenciaTelefono: z
      .string()
      .regex(/^[\d\s\-()+]{7,20}$/, "Teléfono inválido")
      .optional()
      .or(z.literal("")),
    cardiaco: z.boolean().optional(),
    pecho: z.boolean().optional(),
    ahogo: z.boolean().optional(),
    mareo: z.boolean().optional(),
    neurologico: z.boolean().optional(),
    respiratorio: z.boolean().optional(),
    osteoarticular: z.boolean().optional(),
    dolorReciente: z.boolean().optional(),
    factoresRiesgo: z.string().max(240).optional().or(z.literal("")),
    medicamentoActual: z.string().max(240).optional().or(z.literal("")),
    otroPadecimiento: z.string().max(240).optional().or(z.literal("")),
    actividadHabitual: z.boolean().optional(),
    actividadTipo: z.string().max(80).optional().or(z.literal("")),
    frecuenciaSemanal: z.string().optional(),
    tiempoSesion: z.string().max(40).optional().or(z.literal("")),
    ultimaVezPrograma: z.string().max(80).optional().or(z.literal("")),
    beneficios: z.array(z.string()).optional(),
    aceptoPrivacidad: z.boolean().refine(Boolean, "Debes aceptar el aviso de privacidad"),
    aceptoResponsiva: z.boolean().refine(Boolean, "Debes aceptar la responsiva"),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "No coinciden",
  });

// ── Rate limit cliente: 3 intentos / 60s ──
const ATTEMPT_KEY = "__loginAttempts";
function recordAttempt() {
  const now = Date.now();
  const arr = (window[ATTEMPT_KEY] || []).filter((t) => now - t < 60_000);
  arr.push(now);
  window[ATTEMPT_KEY] = arr;
  return arr.length;
}
function attemptsLeft() {
  const now = Date.now();
  const arr = (window[ATTEMPT_KEY] || []).filter((t) => now - t < 60_000);
  return Math.max(0, 3 - arr.length);
}

const PLANES = [
  { id: "Básico", precio: 450, color: COLORS.blue },
  { id: "Premium", precio: 850, color: COLORS.accent },
  { id: "Elite", precio: 1200, color: COLORS.purple },
];

const BENEFICIOS = [
  "Salud y bienestar",
  "Recreación",
  "Acondicionamiento físico",
  "Aumento de masa muscular",
  "Bajar de peso",
  "Rendimiento deportivo",
];

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

function parseOptionalNumber(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const STEP_1_FIELDS = [
  "nombre",
  "apellido",
  "email",
  "telefono",
  "fechaNacimiento",
  "edad",
  "genero",
  "estudiante",
  "matricula",
  "peso",
];

const STEP_2_FIELDS = [
  "grupoSanguineo",
  "alergiaMedicamentos",
  "emergenciaNombre",
  "emergenciaParentesco",
  "emergenciaTelefono",
  "cardiaco",
  "pecho",
  "ahogo",
  "mareo",
  "neurologico",
  "respiratorio",
  "osteoarticular",
  "dolorReciente",
  "factoresRiesgo",
  "medicamentoActual",
  "otroPadecimiento",
];

const STEP_3_FIELDS = [
  "actividadHabitual",
  "actividadTipo",
  "frecuenciaSemanal",
  "tiempoSesion",
  "ultimaVezPrograma",
  "beneficios",
  "aceptoPrivacidad",
  "password",
  "confirm",
  "aceptoResponsiva",
];

// Si el rol es CLIENTE forzamos su home aunque venga otro `next`
function homeForRol(rol) {
  return rol === "CLIENTE" ? "/mi/resumen" : "/dashboard";
}

export default function Login() {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [serverError, setServerError] = useState("");
  const [planSel, setPlanSel] = useState("Premium");
  const [registerStep, setRegisterStep] = useState(1);

  const { login, register: doRegister } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // ── Login form ──
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // ── Register form ──
  const regForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      email: "",
      telefono: "",
      password: "",
      confirm: "",
      plan: "Premium",
      fechaNacimiento: "",
      edad: "",
      genero: "",
      estudiante: false,
      matricula: "",
      peso: "",
      grupoSanguineo: "",
      alergiaMedicamentos: "",
      emergenciaNombre: "",
      emergenciaParentesco: "",
      emergenciaTelefono: "",
      cardiaco: false,
      pecho: false,
      ahogo: false,
      mareo: false,
      neurologico: false,
      respiratorio: false,
      osteoarticular: false,
      dolorReciente: false,
      factoresRiesgo: "",
      medicamentoActual: "",
      otroPadecimiento: "",
      actividadHabitual: false,
      actividadTipo: "",
      frecuenciaSemanal: "",
      tiempoSesion: "",
      ultimaVezPrograma: "",
      beneficios: [],
      aceptoPrivacidad: false,
      aceptoResponsiva: false,
    },
  });

  const goRegisterStep = async (nextStep, fields) => {
    const ok = await regForm.trigger(fields);
    if (ok) setRegisterStep(nextStep);
  };

  const goAfterLogin = (rol) => {
    const nextParam = params.get("next");
    const next =
      nextParam && isWhitelistedRoute(decodeURIComponent(nextParam))
        ? decodeURIComponent(nextParam)
        : safeNext(homeForRol(rol));
    navigate(next, { replace: true });
  };

  const onLogin = async (data) => {
    setServerError("");
    if (attemptsLeft() <= 0) {
      setServerError("Demasiados intentos. Espera 1 minuto.");
      return;
    }
    try {
      recordAttempt();
      const u = await login(data.email, data.password);
      goAfterLogin(u.rol);
    } catch (e) {
      setServerError(
        e?.response?.data?.error || "No fue posible iniciar sesión",
      );
      await new Promise((r) => setTimeout(r, 300 * (3 - attemptsLeft() + 1)));
    }
  };

  const onRegister = async (data) => {
    setServerError("");
    try {
      const fechaHoy = new Date();
      const fechaRegistro = fechaHoy.toISOString().slice(0, 10);
      const payload = {
        nombre: data.nombre.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        plan: planSel,
        inscripcion: {
          fecha: fechaRegistro,
          fechaNacimiento: data.fechaNacimiento || undefined,
          edad: parseOptionalNumber(data.edad),
          genero: data.genero || undefined,
          estudiante: !!data.estudiante,
          peso: parseOptionalNumber(data.peso),
          matricula: data.matricula?.trim() || undefined,
          grupoSanguineo: data.grupoSanguineo?.trim() || undefined,
          alergiaMedicamentos: data.alergiaMedicamentos?.trim() || undefined,
          emergencia: {
            nombre: data.emergenciaNombre?.trim() || undefined,
            parentesco: data.emergenciaParentesco?.trim() || undefined,
            telefono: data.emergenciaTelefono?.trim() || undefined,
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
            factoresRiesgo: data.factoresRiesgo?.trim() || undefined,
            medicamentoActual: data.medicamentoActual?.trim() || undefined,
            otroPadecimiento: data.otroPadecimiento?.trim() || undefined,
          },
          habitos: {
            actividadHabitual: !!data.actividadHabitual,
            actividadTipo: data.actividadTipo?.trim() || undefined,
            frecuenciaSemanal: parseOptionalNumber(data.frecuenciaSemanal),
            tiempoSesion: data.tiempoSesion?.trim() || undefined,
            ultimaVezPrograma: data.ultimaVezPrograma?.trim() || undefined,
            beneficios: data.beneficios || [],
            aceptoPrivacidad: !!data.aceptoPrivacidad,
            aceptoResponsiva: !!data.aceptoResponsiva,
          },
        },
      };
      if (data.apellido?.trim()) payload.apellido = data.apellido.trim();
      if (data.telefono?.trim()) payload.telefono = data.telefono.trim();
      const u = await doRegister(payload);
      goAfterLogin(u.rol);
    } catch (e) {
      const d = e?.response?.data;
      if (d?.details) {
        setServerError(
          Object.entries(d.details)
            .map(([k, v]) => `${k}: ${(v || []).join(", ")}`)
            .join(" · "),
        );
      } else {
        setServerError(d?.error || "No fue posible crear la cuenta");
      }
    }
  };

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        background: COLORS.bg,
        padding: 16,
      }}
    >
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 32,
          width: mode === "register" ? 760 : 380,
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: COLORS.accent,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              fontSize: 20,
              fontWeight: 800,
              color: "#000",
            }}
          >
            G
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              IronCore
            </div>
            <div
              style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2 }}
            >
              {mode === "login" ? "INICIAR SESIÓN" : "CREAR CUENTA DE CLIENTE"}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: COLORS.surface,
            borderRadius: 10,
            padding: 4,
            marginBottom: 18,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {[
            { id: "login", label: "Entrar" },
            { id: "register", label: "Crear cuenta" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id);
                setServerError("");
                if (t.id === "register") setRegisterStep(1);
              }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                background: mode === t.id ? COLORS.accent : "transparent",
                color: mode === t.id ? "#000" : COLORS.muted,
                fontFamily: "'Barlow Condensed',sans-serif",
                fontWeight: mode === t.id ? 700 : 500,
                fontSize: 14,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === "login" && (
          <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FInput
                label="Email"
                placeholder="correo@ironcore.mx"
                type="email"
                {...loginForm.register("email")}
                error={loginForm.formState.errors.email?.message}
              />
              <FInput
                label="Contraseña"
                placeholder="••••••••"
                type="password"
                {...loginForm.register("password")}
                error={loginForm.formState.errors.password?.message}
              />
            </div>
            {serverError && (
              <div
                style={{
                  marginTop: 14,
                  color: COLORS.red,
                  background: "#2b0d0d",
                  border: `1px solid ${COLORS.red}44`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                }}
              >
                {serverError}
              </div>
            )}
            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              style={{
                marginTop: 18,
                width: "100%",
                background: COLORS.accent,
                color: "#000",
                border: "none",
                borderRadius: 10,
                padding: "12px 0",
                fontWeight: 800,
                fontSize: 15,
                cursor: loginForm.formState.isSubmitting
                  ? "not-allowed"
                  : "pointer",
                opacity: loginForm.formState.isSubmitting ? 0.6 : 1,
                fontFamily: "'Barlow Condensed',sans-serif",
              }}
            >
              {loginForm.formState.isSubmitting ? "Entrando…" : "Entrar"}
            </button>
            <div
              style={{
                marginTop: 14,
                fontSize: 11,
                color: COLORS.muted,
                lineHeight: 1.7,
              }}
            >
              <Link
                to="/aviso-de-privacidad"
                style={{
                  color: COLORS.accent,
                  fontWeight: 600,
                  textDecoration: "underline",
                  textDecorationColor: `${COLORS.accent}66`,
                  textUnderlineOffset: 3,
                }}
              >
                Ver aviso de privacidad
              </Link>
            </div>
          </form>
        )}

        {mode === "register" && (
          <form
            onSubmit={regForm.handleSubmit(onRegister)}
            noValidate
            onKeyDown={(e) => {
              if (e.key === "Enter" && registerStep < 3) {
                e.preventDefault();
              }
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 18,
              }}
            >
              {["Datos", "Salud", "Confirmar"].map((label, index) => {
                const stepNumber = index + 1;
                const active = registerStep === stepNumber;
                const done = registerStep > stepNumber;
                return (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flex: stepNumber < 3 ? 1 : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          background: done
                            ? COLORS.green
                            : active
                              ? COLORS.accent
                              : COLORS.border,
                          color: done || active ? "#000" : COLORS.muted,
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {done ? "✓" : stepNumber}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: active ? COLORS.accent : COLORS.muted,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    {stepNumber < 3 && (
                      <div
                        style={{
                          flex: 1,
                          height: 2,
                          margin: "0 8px 18px",
                          background: done ? COLORS.green : COLORS.border,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {serverError && (
              <div
                style={{
                  color: COLORS.red,
                  background: "#2b0d0d",
                  border: `1px solid ${COLORS.red}44`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                {serverError}
              </div>
            )}

            {registerStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FInput
                    label="Nombre"
                    placeholder="Juan"
                    {...regForm.register("nombre")}
                    error={regForm.formState.errors.nombre?.message}
                  />
                  <FInput
                    label="Apellido"
                    placeholder="García"
                    {...regForm.register("apellido")}
                    error={regForm.formState.errors.apellido?.message}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FInput
                    label="Email"
                    placeholder="correo@ejemplo.com"
                    type="email"
                    {...regForm.register("email")}
                    error={regForm.formState.errors.email?.message}
                  />
                  <FInput
                    label="WhatsApp"
                    placeholder="555-000-0000"
                    {...regForm.register("telefono")}
                    error={regForm.formState.errors.telefono?.message}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.1fr .8fr .8fr", gap: 12 }}>
                  <FInput
                    label="Fecha de nacimiento"
                    type="date"
                    {...regForm.register("fechaNacimiento")}
                    error={regForm.formState.errors.fechaNacimiento?.message}
                  />
                  <FInput
                    label="Edad"
                    type="number"
                    inputMode="numeric"
                    {...regForm.register("edad")}
                    error={regForm.formState.errors.edad?.message}
                  />
                  <FInput
                    label="Peso (kg)"
                    type="number"
                    inputMode="decimal"
                    {...regForm.register("peso")}
                    error={regForm.formState.errors.peso?.message}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label
                      style={{
                        color: COLORS.muted,
                        fontSize: 11,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      Género
                    </label>
                    <select
                      {...regForm.register("genero")}
                      style={{
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 9,
                        padding: "10px 14px",
                        color: COLORS.text,
                        fontSize: 13,
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="">Seleccionar…</option>
                      {GENEROS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      color: COLORS.muted,
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      fontFamily: "'DM Mono',monospace",
                      justifyContent: "flex-end",
                    }}
                  >
                    Estudiante
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 9,
                        padding: "11px 14px",
                        color: COLORS.text,
                        textTransform: "none",
                        fontSize: 13,
                        letterSpacing: 0,
                        fontFamily: "inherit",
                      }}
                    >
                      <input
                        type="checkbox"
                        {...regForm.register("estudiante")}
                        style={{ accentColor: COLORS.accent }}
                      />
                      Sí, aún estudio
                    </span>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FInput
                    label="Matrícula"
                    placeholder="Opcional"
                    {...regForm.register("matricula")}
                    error={regForm.formState.errors.matricula?.message}
                  />
                  <div
                    style={{
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 9,
                      padding: "10px 14px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        color: COLORS.muted,
                        fontSize: 11,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      Plan elegido
                    </span>
                    <strong style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18 }}>
                      {planSel}
                    </strong>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {PLANES.map((p) => {
                    const on = planSel === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPlanSel(p.id)}
                        style={{
                          padding: "10px 6px",
                          borderRadius: 10,
                          background: on ? `${p.color}18` : COLORS.surface,
                          border: `2px solid ${on ? p.color : COLORS.border}`,
                          color: on ? p.color : COLORS.muted,
                          cursor: "pointer",
                          fontFamily: "'Barlow Condensed',sans-serif",
                          fontWeight: on ? 700 : 500,
                        }}
                      >
                        <div style={{ fontSize: 13 }}>{p.id}</div>
                        <div
                          style={{
                            fontSize: 11,
                            fontFamily: "'DM Mono',monospace",
                            marginTop: 2,
                          }}
                        >
                          ${p.precio}/mes
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => goRegisterStep(2, STEP_1_FIELDS)}
                    style={{
                      background: COLORS.accent,
                      color: "#000",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 24px",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "'Barlow Condensed',sans-serif",
                    }}
                  >
                    Continuar →
                  </button>
                </div>
              </div>
            )}

            {registerStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FInput
                    label="Grupo sanguíneo"
                    placeholder="O+, A-, etc."
                    {...regForm.register("grupoSanguineo")}
                    error={regForm.formState.errors.grupoSanguineo?.message}
                  />
                  <FInput
                    label="Alergia a medicamentos"
                    placeholder="Describe si aplica"
                    {...regForm.register("alergiaMedicamentos")}
                    error={regForm.formState.errors.alergiaMedicamentos?.message}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <FInput
                    label="Emergencia"
                    placeholder="Nombre completo"
                    {...regForm.register("emergenciaNombre")}
                    error={regForm.formState.errors.emergenciaNombre?.message}
                  />
                  <FInput
                    label="Parentesco"
                    placeholder="Madre, hermano, etc."
                    {...regForm.register("emergenciaParentesco")}
                    error={regForm.formState.errors.emergenciaParentesco?.message}
                  />
                  <FInput
                    label="Teléfono de emergencia"
                    placeholder="555-000-0000"
                    {...regForm.register("emergenciaTelefono")}
                    error={regForm.formState.errors.emergenciaTelefono?.message}
                  />
                </div>

                <div>
                  <label
                    style={{
                      color: COLORS.muted,
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      fontFamily: "'DM Mono',monospace",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Historial médico
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                      gap: 8,
                    }}
                  >
                    {CHECKS_SALUD.map(([name, label]) => (
                      <label
                        key={name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: COLORS.surface,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: 10,
                          padding: "10px 12px",
                          color: COLORS.text,
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="checkbox"
                          {...regForm.register(name)}
                          style={{ accentColor: COLORS.accent }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label
                      style={{
                        color: COLORS.muted,
                        fontSize: 11,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      Factores de riesgo
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Colesterol alto, diabetes, sedentarismo..."
                      {...regForm.register("factoresRiesgo")}
                      style={{
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 9,
                        padding: "10px 14px",
                        color: COLORS.text,
                        fontSize: 13,
                        outline: "none",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label
                      style={{
                        color: COLORS.muted,
                        fontSize: 11,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      Medicamento actual
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Cuál y dosis"
                      {...regForm.register("medicamentoActual")}
                      style={{
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 9,
                        padding: "10px 14px",
                        color: COLORS.text,
                        fontSize: 13,
                        outline: "none",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label
                      style={{
                        color: COLORS.muted,
                        fontSize: 11,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      Otro padecimiento
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Describe cualquier otro"
                      {...regForm.register("otroPadecimiento")}
                      style={{
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 9,
                        padding: "10px 14px",
                        color: COLORS.text,
                        fontSize: 13,
                        outline: "none",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setRegisterStep(1)}
                    style={{
                      background: COLORS.border,
                      color: COLORS.muted,
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 22px",
                      cursor: "pointer",
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    ← Atrás
                  </button>
                  <button
                    type="button"
                    onClick={() => goRegisterStep(3, STEP_2_FIELDS)}
                    style={{
                      background: COLORS.accent,
                      color: "#000",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 24px",
                      fontWeight: 800,
                      cursor: "pointer",
                      fontFamily: "'Barlow Condensed',sans-serif",
                    }}
                  >
                    Revisar →
                  </button>
                </div>
              </div>
            )}

            {registerStep === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FInput
                    label="Actividad física habitual"
                    placeholder="Qué haces normalmente"
                    {...regForm.register("actividadTipo")}
                    error={regForm.formState.errors.actividadTipo?.message}
                  />
                  <FInput
                    label="Última vez en programa"
                    placeholder="Hace 3 meses, nunca, etc."
                    {...regForm.register("ultimaVezPrograma")}
                    error={regForm.formState.errors.ultimaVezPrograma?.message}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      color: COLORS.muted,
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    ¿Practicas actividad física?
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 9,
                        padding: "11px 14px",
                        color: COLORS.text,
                        textTransform: "none",
                        fontSize: 13,
                        letterSpacing: 0,
                        fontFamily: "inherit",
                      }}
                    >
                      <input
                        type="checkbox"
                        {...regForm.register("actividadHabitual")}
                        style={{ accentColor: COLORS.accent }}
                      />
                      Sí, hago ejercicio
                    </span>
                  </label>

                  <FInput
                    label="Frecuencia semanal"
                    placeholder="3"
                    type="number"
                    inputMode="numeric"
                    {...regForm.register("frecuenciaSemanal")}
                    error={regForm.formState.errors.frecuenciaSemanal?.message}
                  />
                  <FInput
                    label="Tiempo por sesión"
                    placeholder="45 min"
                    {...regForm.register("tiempoSesion")}
                    error={regForm.formState.errors.tiempoSesion?.message}
                  />
                </div>

                <div>
                  <label
                    style={{
                      color: COLORS.muted,
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      fontFamily: "'DM Mono',monospace",
                      display: "block",
                      marginBottom: 8,
                    }}
                  >
                    Beneficios esperados
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                    {BENEFICIOS.map((b) => (
                      <label
                        key={b}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: COLORS.surface,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: 10,
                          padding: "10px 12px",
                          color: COLORS.text,
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="checkbox"
                          value={b}
                          {...regForm.register("beneficios")}
                          style={{ accentColor: COLORS.accent }}
                        />
                        {b}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <FInput
                    label="Contraseña"
                    placeholder="Mín. 8, A-a-9"
                    type="password"
                    {...regForm.register("password")}
                    error={regForm.formState.errors.password?.message}
                  />
                  <FInput
                    label="Confirmar contraseña"
                    placeholder="Repite"
                    type="password"
                    {...regForm.register("confirm")}
                    error={regForm.formState.errors.confirm?.message}
                  />
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    color: COLORS.text,
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    {...regForm.register("aceptoPrivacidad")}
                    style={{ accentColor: COLORS.accent, marginTop: 2 }}
                  />
                  <span>
                    Confirmo que leí y acepto el{" "}
                    <Link
                      to="/aviso-de-privacidad"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: COLORS.accent,
                        fontWeight: 700,
                        textDecoration: "underline",
                        textDecorationColor: `${COLORS.accent}66`,
                        textUnderlineOffset: 3,
                      }}
                    >
                      aviso de privacidad
                    </Link>
                    .
                  </span>
                </label>
                {regForm.formState.errors.aceptoPrivacidad?.message && (
                  <div style={{ color: COLORS.red, fontSize: 12 }}>
                    {regForm.formState.errors.aceptoPrivacidad.message}
                  </div>
                )}

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    color: COLORS.text,
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    {...regForm.register("aceptoResponsiva")}
                    style={{ accentColor: COLORS.accent }}
                  />
                  Entiendo y acepto que la actividad física tiene riesgos y confirmo que la información médica proporcionada es correcta.
                </label>
                {regForm.formState.errors.aceptoResponsiva?.message && (
                  <div style={{ color: COLORS.red, fontSize: 12 }}>
                    {regForm.formState.errors.aceptoResponsiva.message}
                  </div>
                )}

                <div
                  style={{
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                    padding: 16,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'DM Mono',monospace" }}>
                    Resumen
                  </div>
                  <div style={{ color: COLORS.text, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18 }}>
                    {regForm.getValues("nombre")} {regForm.getValues("apellido")}
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>
                    Plan {planSel} · {regForm.getValues("email")}
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>
                    Contacto de emergencia: {regForm.getValues("emergenciaNombre") || "—"}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setRegisterStep(2)}
                    style={{
                      background: COLORS.border,
                      color: COLORS.muted,
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 22px",
                      cursor: "pointer",
                      fontFamily: "'Barlow Condensed',sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    ← Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={regForm.formState.isSubmitting}
                    style={{
                      background: COLORS.green,
                      color: "#000",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px 24px",
                      fontWeight: 800,
                      cursor: regForm.formState.isSubmitting ? "not-allowed" : "pointer",
                      opacity: regForm.formState.isSubmitting ? 0.6 : 1,
                      fontFamily: "'Barlow Condensed',sans-serif",
                    }}
                  >
                    {regForm.formState.isSubmitting ? "Creando cuenta…" : "✓ Crear cuenta y entrar"}
                  </button>
                </div>

                <div style={{ marginTop: 4, fontSize: 11, color: COLORS.muted, lineHeight: 1.6 }}>
                  Tu membresía queda como <strong>Por vencer</strong> hasta tu primer pago en recepción.
                  <div style={{ marginTop: 8 }}>
                    <Link
                      to="/aviso-de-privacidad"
                      style={{
                        color: COLORS.accent,
                        fontWeight: 600,
                        textDecoration: "underline",
                        textDecorationColor: `${COLORS.accent}66`,
                        textUnderlineOffset: 3,
                      }}
                    >
                      Ver aviso de privacidad
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
