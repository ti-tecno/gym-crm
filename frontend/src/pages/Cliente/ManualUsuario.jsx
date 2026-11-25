import { COLORS } from '../../constants/theme.js';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Accordion from '../../components/ui/Accordion.jsx';
import Callout from '../../components/ui/Callout.jsx';

const S = { color: COLORS.text, fontWeight: 600 };

const RouteTag = ({ children }) => (
  <span
    style={{
      fontFamily: "'DM Mono',monospace",
      fontSize: 11,
      color: COLORS.blue,
      background: '#0d1a2b',
      padding: '2px 9px',
      borderRadius: 20,
    }}
  >
    {children}
  </span>
);

const ITEMS = [
  {
    icon: '☺',
    title: 'Crear cuenta y entrar',
    tag: '/login',
    dek: 'Registro en 3 pasos, inicio de sesión y Google.',
    children: (
      <>
        <p>Todo empieza en la pantalla de acceso, con dos pestañas: <b style={S}>Entrar</b> y <b style={S}>Crear cuenta</b>.</p>
        <p><b style={S}>Crear tu cuenta</b> — formulario en 3 pasos:</p>
        <ol>
          <li><b style={S}>Datos personales:</b> nombre, apellido, correo, WhatsApp, fecha de nacimiento, género, si eres estudiante (con matrícula), tu peso, y el plan que quieres (Mensual, Estudiante, Trimestre, Semestre o Anual), con precios visibles.</li>
          <li><b style={S}>Salud:</b> grupo sanguíneo, alergias, contacto de emergencia, historial médico y cualquier medicamento o padecimiento que debamos conocer.</li>
          <li><b style={S}>Confirmar:</b> hábitos de actividad física, qué esperas lograr, tu contraseña, y la aceptación del aviso de privacidad y la carta responsiva. Al enviar, tu cuenta queda creada y entras automáticamente.</li>
        </ol>
        <Callout variant="note" title="Sobre tu membresía al registrarte">
          Tu cuenta nueva queda marcada como <b style={S}>"Por vencer"</b> hasta que liquides tu pago en recepción — el registro en línea no procesa el cobro.
        </Callout>
        <p><b style={S}>Entrar a tu cuenta</b> — usa tu correo y contraseña, o el botón <b style={S}>Iniciar sesión con Google</b>.</p>
        <Callout variant="tip" title="Si usas Google y no tienes cuenta todavía">
          El sistema no crea la cuenta por ti automáticamente: te lo indicará y te llevará directo a la pestaña de registro para completarlo una sola vez.
        </Callout>
        <p><b style={S}>Completa tu perfil (una sola vez)</b> — si tu cuenta se creó con Google o el registro quedó incompleto, la primera vez que entres se te pedirá completar tus datos en <RouteTag>/mi/completar-perfil</RouteTag> antes de ver el resto del portal.</p>
      </>
    ),
  },
  {
    icon: '⬡',
    title: 'Mi Resumen',
    tag: '/mi/resumen',
    dek: 'Tu pantalla de inicio: actividad y membresía de un vistazo.',
    children: (
      <>
        <ul>
          <li>Tarjetas con tus <b style={S}>sesiones totales</b>, tu <b style={S}>racha</b> de días activos, tus <b style={S}>récords personales (PRs)</b> y tu <b style={S}>peso actual</b>.</li>
          <li>Una tarjeta de <b style={S}>tu rutina actual</b> con el número de días y ejercicios, con acceso directo a verla completa o a registrar la sesión de hoy.</li>
          <li>Una tarjeta de <b style={S}>tu membresía</b>: plan, estado y fecha de vencimiento, con acceso al detalle.</li>
        </ul>
        <p>Si todavía no tienes una rutina asignada, aquí mismo verás una invitación para elegir una en Mis Rutinas.</p>
      </>
    ),
  },
  {
    icon: '◈',
    title: 'Membresía',
    tag: '/mi/membresia',
    dek: 'El detalle de tu plan, de solo lectura.',
    children: (
      <>
        <ul>
          <li>Estado de tu membresía: <b style={S}>Activa</b>, <b style={S}>Por vencer</b> o <b style={S}>Vencida</b>, con un mensaje explicando qué significa.</li>
          <li>Tu plan, tu mensualidad, la fecha de vencimiento y desde cuándo eres miembro.</li>
        </ul>
        <Callout variant="tip" title="¿Cómo pago o renuevo?">
          Con el botón <b style={S}>Pagar</b> de esta pantalla (o el botón "Pagar ahora" del recordatorio que te llega por WhatsApp) pagas en la página segura de Mercado Pago con tarjeta, OXXO o SPEI; tus datos de pago no pasan por IronCore. Cuando Mercado Pago confirma el pago, tu membresía se renueva sola y lo ves en "Mis pagos". También puedes pagar en recepción.
        </Callout>
      </>
    ),
  },
  {
    icon: '◷',
    title: 'Mis Rutinas',
    tag: '/mi/rutinas',
    dek: 'Tu rutina asignada, o elige una de la biblioteca.',
    children: (
      <>
        <p><b style={S}>Pestaña "Mi rutina"</b> — muestra tu programa asignado: coach, semana, objetivo y el detalle de ejercicios por día. Desde aquí puedes ir directo a registrar tu sesión de hoy en el Diario.</p>
        <p><b style={S}>Pestaña "Biblioteca"</b> — programas grupales disponibles (nivel, coach, duración, cuántos ya lo siguen). Botón <b style={S}>"Auto-asignarme"</b> para tomarlo tú mismo.</p>
        <Callout variant="note" title="Solo un programa a la vez">
          Si ya tienes una rutina y eliges otra de la biblioteca, el sistema te pedirá confirmar el cambio antes de reemplazarla.
        </Callout>
      </>
    ),
  },
  {
    icon: '✎',
    title: 'Diario',
    tag: '/mi/diario',
    dek: 'Registra cada entrenamiento: series, repeticiones y peso.',
    children: (
      <>
        <ol>
          <li>Elige la <b style={S}>fecha</b> y, si aplica, el día de tu rutina — se sugiere automáticamente. Si entrenaste algo distinto, marca "sesión libre".</li>
          <li>Cada ejercicio aparece precargado con sus series. Ajusta repeticiones y peso por serie, y marca cada serie como <b style={S}>completada</b>.</li>
          <li>¿Hiciste algo que no estaba en el plan? Usa <b style={S}>"+ Ejercicio"</b> para agregarlo, o elimina el que no realizaste.</li>
          <li>Agrega notas si quieres, y presiona <b style={S}>"Guardar sesión"</b>.</li>
        </ol>
        <Callout variant="tip" title="Récords automáticos">
          Si superas una marca anterior de peso o repeticiones, el sistema lo detecta solo y te lo muestra al guardar.
        </Callout>
        <p>Debajo del formulario encontrarás tus <b style={S}>últimas sesiones</b>, con el detalle de series y notas de cada una.</p>
      </>
    ),
  },
  {
    icon: '◐',
    title: 'Medidas',
    tag: '/mi/medidas',
    dek: 'Tu bitácora corporal: peso, composición y perímetros.',
    children: (
      <ul>
        <li>Tarjetas con tu última medición y cómo cambió respecto a la anterior (peso, % grasa, % músculo, pecho, brazo, cintura, cadera, muslo).</li>
        <li>Formulario para <b style={S}>registrar una medición nueva</b> con fecha y notas.</li>
        <li>Tabla con el historial completo de todas tus mediciones.</li>
      </ul>
    ),
  },
  {
    icon: '◎',
    title: 'Progreso',
    tag: '/mi/progreso',
    dek: 'La foto completa de tu evolución, de solo lectura.',
    children: (
      <ul>
        <li>Indicadores de sesiones, racha, PRs y peso actual frente a tu punto de partida.</li>
        <li>Un mapa de calor de tu actividad de los últimos 90 días.</li>
        <li>Una gráfica de la evolución de tu peso corporal.</li>
        <li>Tu lista de récords personales y una línea de tiempo que combina entrenamientos y mediciones.</li>
      </ul>
    ),
  },
  {
    icon: '☺',
    title: 'Mi Perfil',
    tag: '/mi/completar-perfil',
    dek: 'Tus datos personales y de salud, siempre editables.',
    children: (
      <p>Aquí puedes actualizar tu apellido, teléfono, fecha de nacimiento, datos de salud, contacto de emergencia, hábitos de actividad y lo que esperas lograr en el gimnasio. Guarda los cambios con <b style={S}>"Guardar mi información"</b>.</p>
    ),
  },
];

const FAQ = [
  ['¿Dónde pago mi mensualidad?', 'En línea desde Mi Membresía → Pagar (Mercado Pago: tarjeta, OXXO o SPEI), con el botón "Pagar ahora" de tu recordatorio por WhatsApp, o en recepción. Si pagas en OXXO o SPEI, tu membresía se renueva cuando Mercado Pago confirme el pago.'],
  ['¿Puedo tener dos rutinas a la vez?', 'No — al elegir una nueva desde la Biblioteca, la anterior se reemplaza (con confirmación previa).'],
  ['¿Cómo cierro sesión?', 'Usa el botón de cierre de sesión en la parte inferior del menú lateral.'],
  ['¿Mis datos de salud son privados?', 'Sí. Se usan únicamente para tu seguimiento en el gimnasio, conforme al aviso de privacidad que aceptaste al registrarte.'],
];

export default function ManualUsuario() {
  return (
    <div>
      <SectionHeader title="Manual del Usuario" sub="Cómo usar tu portal, paso a paso" />

      <Accordion items={ITEMS} />

      <div style={{ marginTop: 32 }}>
        <div
          style={{
            color: COLORS.muted,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            fontFamily: "'DM Mono',monospace",
            marginBottom: 12,
          }}
        >
          Preguntas frecuentes
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQ.map(([q, a]) => (
            <div
              key={q}
              style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 14,
                padding: '16px 20px',
              }}
            >
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text, marginBottom: 4 }}>
                {q}
              </div>
              <div style={{ color: COLORS.subtle, fontSize: 13.5 }}>{a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
