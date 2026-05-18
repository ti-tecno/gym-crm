import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { COLORS } from '../constants/theme.js';
import FInput from '../components/ui/FInput.jsx';
import { isWhitelistedRoute, safeNext } from '../utils/safeRoute.js';

// ── Schemas ──
const loginSchema = z.object({
  email:    z.string().email('Email inválido').max(120),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128),
});

const registerSchema = z.object({
  nombre:   z.string().trim().min(2, 'Mínimo 2').max(60),
  apellido: z.string().trim().min(2, 'Mínimo 2').max(60).optional().or(z.literal('')),
  email:    z.string().email('Email inválido').max(120),
  telefono: z.string().regex(/^[\d\s\-()+]{7,20}$/, 'Teléfono inválido').optional().or(z.literal('')),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128)
    .regex(/[A-Z]/, 'Incluye una mayúscula')
    .regex(/[a-z]/, 'Incluye una minúscula')
    .regex(/\d/,    'Incluye un número'),
  confirm:  z.string().min(8).max(128),
  plan:     z.enum(['Básico', 'Premium', 'Elite']),
}).refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'No coinciden' });

// ── Rate limit cliente: 3 intentos / 60s ──
const ATTEMPT_KEY = '__loginAttempts';
function recordAttempt() {
  const now = Date.now();
  const arr = (window[ATTEMPT_KEY] || []).filter((t) => now - t < 60_000);
  arr.push(now); window[ATTEMPT_KEY] = arr;
  return arr.length;
}
function attemptsLeft() {
  const now = Date.now();
  const arr = (window[ATTEMPT_KEY] || []).filter((t) => now - t < 60_000);
  return Math.max(0, 3 - arr.length);
}

const PLANES = [
  { id: 'Básico',  precio: 450,  color: COLORS.blue },
  { id: 'Premium', precio: 850,  color: COLORS.accent },
  { id: 'Elite',   precio: 1200, color: COLORS.purple },
];

// Si el rol es CLIENTE forzamos su home aunque venga otro `next`
function homeForRol(rol) { return rol === 'CLIENTE' ? '/mi/resumen' : '/dashboard'; }

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [serverError, setServerError] = useState('');
  const [planSel, setPlanSel] = useState('Premium');

  const { login, register: doRegister } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // ── Login form ──
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // ── Register form ──
  const regForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { nombre: '', apellido: '', email: '', telefono: '', password: '', confirm: '', plan: 'Premium' },
  });

  const goAfterLogin = (rol) => {
    const nextParam = params.get('next');
    const next = nextParam && isWhitelistedRoute(decodeURIComponent(nextParam))
      ? decodeURIComponent(nextParam)
      : safeNext(homeForRol(rol));
    navigate(next, { replace: true });
  };

  const onLogin = async (data) => {
    setServerError('');
    if (attemptsLeft() <= 0) { setServerError('Demasiados intentos. Espera 1 minuto.'); return; }
    try {
      recordAttempt();
      const u = await login(data.email, data.password);
      goAfterLogin(u.rol);
    } catch (e) {
      setServerError(e?.response?.data?.error || 'No fue posible iniciar sesión');
      await new Promise((r) => setTimeout(r, 300 * (3 - attemptsLeft() + 1)));
    }
  };

  const onRegister = async (data) => {
    setServerError('');
    try {
      const payload = {
        nombre: data.nombre.trim(),
        email:  data.email.trim().toLowerCase(),
        password: data.password,
        plan: planSel,
      };
      if (data.apellido?.trim()) payload.apellido = data.apellido.trim();
      if (data.telefono?.trim()) payload.telefono = data.telefono.trim();
      const u = await doRegister(payload);
      goAfterLogin(u.rol);
    } catch (e) {
      const d = e?.response?.data;
      if (d?.details) {
        setServerError(Object.entries(d.details).map(([k, v]) => `${k}: ${(v || []).join(', ')}`).join(' · '));
      } else {
        setServerError(d?.error || 'No fue posible crear la cuenta');
      }
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: COLORS.bg, padding: 16 }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 32, width: mode === 'register' ? 460 : 380, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, background: COLORS.accent, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 800, color: '#000' }}>G</div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800 }}>GymOS</div>
            <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2 }}>
              {mode === 'login' ? 'INICIAR SESIÓN' : 'CREAR CUENTA DE CLIENTE'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: COLORS.surface, borderRadius: 10, padding: 4, marginBottom: 18, border: `1px solid ${COLORS.border}` }}>
          {[
            { id: 'login',    label: 'Entrar' },
            { id: 'register', label: 'Crear cuenta' },
          ].map((t) => (
            <button key={t.id} type="button" onClick={() => { setMode(t.id); setServerError(''); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: mode === t.id ? COLORS.accent : 'transparent',
                color: mode === t.id ? '#000' : COLORS.muted,
                fontFamily: "'Barlow Condensed',sans-serif", fontWeight: mode === t.id ? 700 : 500, fontSize: 14,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'login' && (
          <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FInput label="Email"      placeholder="correo@gymos.mx" type="email"    {...loginForm.register('email')}    error={loginForm.formState.errors.email?.message} />
              <FInput label="Contraseña" placeholder="••••••••"        type="password" {...loginForm.register('password')} error={loginForm.formState.errors.password?.message} />
            </div>
            {serverError && (
              <div style={{ marginTop: 14, color: COLORS.red, background: '#2b0d0d', border: `1px solid ${COLORS.red}44`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                {serverError}
              </div>
            )}
            <button type="submit" disabled={loginForm.formState.isSubmitting}
              style={{
                marginTop: 18, width: '100%', background: COLORS.accent, color: '#000', border: 'none',
                borderRadius: 10, padding: '12px 0', fontWeight: 800, fontSize: 15,
                cursor: loginForm.formState.isSubmitting ? 'not-allowed' : 'pointer',
                opacity: loginForm.formState.isSubmitting ? 0.6 : 1,
                fontFamily: "'Barlow Condensed',sans-serif",
              }}>
              {loginForm.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
            </button>
            <div style={{ marginTop: 14, fontSize: 11, color: COLORS.muted, lineHeight: 1.7 }}>
              Demos: <code>admin@gymos.mx / Admin#2026</code> · <code>carlos@email.com / Cliente#2026</code>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={regForm.handleSubmit(onRegister)} noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <FInput label="Nombre"   placeholder="Juan"   {...regForm.register('nombre')}   error={regForm.formState.errors.nombre?.message} />
              <FInput label="Apellido" placeholder="García" {...regForm.register('apellido')} error={regForm.formState.errors.apellido?.message} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <FInput label="Email"    placeholder="correo@ejemplo.com" type="email" {...regForm.register('email')}    error={regForm.formState.errors.email?.message} />
              <FInput label="WhatsApp" placeholder="555-000-0000"                    {...regForm.register('telefono')} error={regForm.formState.errors.telefono?.message} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <FInput label="Contraseña"  placeholder="Mín. 8, A-a-9" type="password" {...regForm.register('password')} error={regForm.formState.errors.password?.message} />
              <FInput label="Confirmar"   placeholder="Repite"        type="password" {...regForm.register('confirm')}  error={regForm.formState.errors.confirm?.message} />
            </div>

            <label style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace" }}>
              Plan inicial
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 6, marginBottom: 14 }}>
              {PLANES.map((p) => {
                const on = planSel === p.id;
                return (
                  <button type="button" key={p.id} onClick={() => setPlanSel(p.id)}
                    style={{
                      padding: '10px 6px', borderRadius: 10,
                      background: on ? `${p.color}18` : COLORS.surface,
                      border: `2px solid ${on ? p.color : COLORS.border}`,
                      color: on ? p.color : COLORS.muted, cursor: 'pointer',
                      fontFamily: "'Barlow Condensed',sans-serif", fontWeight: on ? 700 : 500,
                    }}>
                    <div style={{ fontSize: 13 }}>{p.id}</div>
                    <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>${p.precio}/mes</div>
                  </button>
                );
              })}
            </div>

            {serverError && (
              <div style={{ color: COLORS.red, background: '#2b0d0d', border: `1px solid ${COLORS.red}44`, borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>
                {serverError}
              </div>
            )}

            <button type="submit" disabled={regForm.formState.isSubmitting}
              style={{
                width: '100%', background: COLORS.green, color: '#000', border: 'none',
                borderRadius: 10, padding: '12px 0', fontWeight: 800, fontSize: 15,
                cursor: regForm.formState.isSubmitting ? 'not-allowed' : 'pointer',
                opacity: regForm.formState.isSubmitting ? 0.6 : 1,
                fontFamily: "'Barlow Condensed',sans-serif",
              }}>
              {regForm.formState.isSubmitting ? 'Creando cuenta…' : '✓ Crear cuenta y entrar'}
            </button>

            <div style={{ marginTop: 12, fontSize: 11, color: COLORS.muted, lineHeight: 1.6 }}>
              Al crear tu cuenta aceptas los términos. Tu membresía queda como <strong>Por vencer</strong> hasta tu primer pago en recepción.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
