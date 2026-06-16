import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { COLORS } from '../../constants/theme.js';
import FInput from '../../components/ui/FInput.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { clientesService } from '../../services/modules.service.js';
import { initials } from '../../utils/format.js';

const PLANES = [
  { id: 'Básico',  precio: 450,  color: COLORS.blue,   features: ['Acceso Lun–Vie', 'Área de pesas', 'Casillero'] },
  { id: 'Premium', precio: 850,  color: COLORS.accent, popular: true, features: ['Acceso 7 días', 'Clases grupales', '1 sesión coach/mes', 'Casillero'] },
  { id: 'Elite',   precio: 1200, color: COLORS.purple, features: ['Acceso 24/7', 'Clases ilimitadas', 'Coach personal', 'Nutrición', 'Casillero VIP'] },
];

const schema = z.object({
  nombre:   z.string().min(2, 'Mínimo 2').max(60),
  apellido: z.string().min(2, 'Mínimo 2').max(60),
  email:    z.string().email('Email inválido').max(120),
  telefono: z.string().regex(/^[\d\s\-()+]{7,20}$/, 'Teléfono inválido').optional().or(z.literal('')),
  objetivo: z.string().max(60).optional(),
});

export default function RegistroAutonomo() {
  const [step, setStep] = useState(1);
  const [planSel, setPlanSel] = useState('Premium');
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', apellido: '', email: '', telefono: '', objetivo: '' },
  });

  const onConfirm = async () => {
    setServerError('');
    const v = getValues();
    try {
      const today = new Date();
      const venc = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

      // Construimos el payload limpiando strings vacíos para que el backend los trate como opcionales.
      const payload = {
        nombre: v.nombre.trim(),
        email: v.email.trim().toLowerCase(),
        plan: planSel,
        monto: PLANES.find((p) => p.id === planSel).precio,
        vencimiento: venc.toISOString().slice(0, 10),
        estado: 'Activo',
      };
      if (v.apellido?.trim()) payload.apellido = v.apellido.trim();
      if (v.telefono?.trim()) payload.telefono = v.telefono.trim();
      if (v.objetivo?.trim()) payload.objetivo = v.objetivo.trim();

      await clientesService.create(payload);
      setDone(true);
    } catch (e) {
      // Mostramos errores de validación campo-a-campo si el backend los regresa
      const data = e?.response?.data;
      if (data?.details) {
        const lines = Object.entries(data.details).map(([k, msgs]) => `${k}: ${(msgs || []).join(', ')}`);
        setServerError(lines.join(' · '));
      } else {
        setServerError(data?.error || 'No fue posible registrar al cliente');
      }
    }
  };

  if (done) {
    const v = getValues();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '40px 0' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#0d2b1a', border: `2px solid ${COLORS.green}`, display: 'grid', placeItems: 'center', fontSize: 32 }}>✓</div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 800, margin: 0 }}>¡Registro Exitoso!</h3>
          <p style={{ color: COLORS.muted, marginTop: 8 }}>
            Correo de bienvenida enviado a <span style={{ color: COLORS.accent }}>{v.email}</span>
          </p>
        </div>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: '16px 32px', textAlign: 'center' }}>
          <div style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>Plan</div>
          <div style={{ color: COLORS.accent, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 800 }}>{planSel}</div>
        </div>
        <button onClick={() => { setStep(1); setDone(false); }}
                style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, cursor: 'pointer' }}>
          Nuevo Registro
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', maxWidth: 480, marginBottom: 32 }}>
        {['Plan', 'Datos', 'Confirmar'].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: step > i + 1 ? COLORS.green : step === i + 1 ? COLORS.accent : COLORS.border,
                color: step >= i + 1 ? '#000' : COLORS.muted,
                display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, transition: 'all 0.3s',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: step === i + 1 ? COLORS.accent : COLORS.muted }}>{s}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 2, background: step > i + 1 ? COLORS.green : COLORS.border, margin: '0 8px 18px' }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h3 style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Elige tu Plan</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
            {PLANES.map((p) => (
              <div key={p.id} onClick={() => setPlanSel(p.id)} style={{
                background: planSel === p.id ? `${p.color}14` : COLORS.card,
                border: `2px solid ${planSel === p.id ? p.color : COLORS.border}`,
                borderRadius: 16, padding: 24, cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
              }}>
                {p.popular && (
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: COLORS.accent, color: '#000', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>
                    POPULAR
                  </div>
                )}
                <div style={{ color: p.color, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800 }}>{p.id}</div>
                <div style={{ color: COLORS.text, fontFamily: "'DM Mono',monospace", fontSize: 26, fontWeight: 700, margin: '8px 0 16px' }}>
                  ${p.precio}<span style={{ fontSize: 12, color: COLORS.muted }}>/mes</span>
                </div>
                {p.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ color: COLORS.subtle, fontSize: 12 }}>{f}</span>
                  </div>
                ))}
                <div style={{
                  marginTop: 14, padding: '8px 0', borderRadius: 8,
                  background: planSel === p.id ? p.color : COLORS.border,
                  color: planSel === p.id ? '#000' : COLORS.muted,
                  textAlign: 'center', fontWeight: 700, fontSize: 13,
                }}>
                  {planSel === p.id ? '✓ Seleccionado' : 'Seleccionar'}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setStep(2)} style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Continuar →
          </button>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit(() => setStep(3))} noValidate style={{ maxWidth: 580 }}>
          <h3 style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Datos Personales</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <FInput label="Nombre"   placeholder="Juan"     {...register('nombre')}   error={errors.nombre?.message} />
            <FInput label="Apellido" placeholder="García"   {...register('apellido')} error={errors.apellido?.message} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <FInput label="Email"    placeholder="correo@ejemplo.com" type="email" {...register('email')}    error={errors.email?.message} />
            <FInput label="WhatsApp" placeholder="555-000-0000"                    {...register('telefono')} error={errors.telefono?.message} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", display: 'block', marginBottom: 6 }}>
              Objetivo
            </label>
            <select {...register('objetivo')}
                    style={{ width: '100%', background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: '10px 14px', color: COLORS.text, fontSize: 13, outline: 'none' }}>
              <option value="">Seleccionar…</option>
              <option>Pérdida de peso</option>
              <option>Ganar músculo</option>
              <option>Resistencia</option>
              <option>Salud general</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => setStep(1)} style={{ background: COLORS.border, color: COLORS.muted, border: 'none', borderRadius: 10, padding: '12px 24px', cursor: 'pointer' }}>← Atrás</button>
            <button type="submit" style={{ background: COLORS.accent, color: '#000', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Continuar →</button>
          </div>
        </form>
      )}

      {step === 3 && (() => {
        const v = getValues();
        const plan = PLANES.find((p) => p.id === planSel);
        return (
          <div style={{ maxWidth: 520 }}>
            <h3 style={{ color: COLORS.text, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Confirmar Registro</h3>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
                <Avatar initials={initials(`${v.nombre} ${v.apellido}`)} size={46} />
                <div>
                  <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 18, fontFamily: "'Barlow Condensed',sans-serif" }}>
                    {v.nombre} {v.apellido}
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: 13 }}>{v.email}</div>
                </div>
              </div>
              {[
                ['Plan', planSel],
                ['Mensualidad', '$' + plan.precio],
                ['WhatsApp', v.telefono || '—'],
                ['Objetivo', v.objetivo || '—'],
              ].map(([k, val]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>{k}</span>
                  <span style={{ color: COLORS.text, fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
            {serverError && (
              <div style={{ color: COLORS.red, background: '#2b0d0d', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12 }}>
                {serverError}
              </div>
            )}
            <div style={{ background: '#0d1a0d', border: `1px solid ${COLORS.green}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: COLORS.subtle }}>
              ✉ Se enviará correo con acceso al portal y link de pago en línea automáticamente.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(2)} style={{ background: COLORS.border, color: COLORS.muted, border: 'none', borderRadius: 10, padding: '12px 24px', cursor: 'pointer' }}>← Atrás</button>
              <button onClick={onConfirm} disabled={isSubmitting}
                      style={{ flex: 1, background: COLORS.green, color: '#000', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
                ✓ Confirmar Registro
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
