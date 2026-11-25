import { useState } from 'react';
import { COLORS } from '../constants/theme.js';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import TabBar from '../components/ui/TabBar.jsx';
import Accordion from '../components/ui/Accordion.jsx';
import Callout from '../components/ui/Callout.jsx';

const S = { color: COLORS.text, fontWeight: 600 };

const SHARED_BADGE = { text: 'Compartido', color: COLORS.green, bg: '#0d2b1a' };
const SHARED_COACH_BADGE = { text: 'Compartido con COACH', color: COLORS.green, bg: '#0d2b1a' };
const ADMIN_BADGE = { text: 'Solo Admin', color: COLORS.accent, bg: `${COLORS.accent}22` };

const SHARED_ITEMS = [
  {
    icon: '⬡',
    title: 'Dashboard',
    tag: '/dashboard',
    badge: SHARED_BADGE,
    dek: 'Panorama general del gimnasio, de solo lectura.',
    children: (
      <ul>
        <li>Indicadores clave: clientes activos, ingresos recientes, membresías por vencer en 7 días, artículos con stock bajo.</li>
        <li>Gráfica semanal de asistencia y lista de los últimos pagos registrados.</li>
        <li>Banner de alertas del sistema cuando algo requiere atención.</li>
      </ul>
    ),
  },
  {
    icon: '◈',
    title: 'Clientes & Pagos',
    tag: '/clientes',
    badge: SHARED_BADGE,
    dek: 'El módulo de trabajo diario con los miembros: cuatro pestañas.',
    children: (
      <>
        <p><b style={S}>Lista</b> — buscador y filtro por plan. Por cliente: <b style={S}>💳 Pagar</b> (va a Registrar pago con ese cliente), <b style={S}>🔔</b> (va a Recordatorios) y <b style={S}>✏ Editar</b> (nombre, correo, plan, tipo de mensualidad, vencimiento, monto o estado). "+ Nuevo" va a Registro.</p>
        <Callout variant="note" title="No existe botón para eliminar un cliente">
          Si necesitas dar de baja un registro por error o duplicado, hazlo desde el respaldo de datos correspondiente — no hay acción de "eliminar" en esta pantalla.
        </Callout>
        <p><b style={S}>Registro Autónomo</b> — asistente de 3 pasos para dar de alta a un cliente en persona: plan, datos personales, confirmar.</p>
        <p><b style={S}>Registrar pago</b> — para pagos <b style={S}>ya cobrados en mostrador</b> (efectivo, transferencia o tarjeta en la terminal; aquí no se capturan datos de tarjeta). Elige al cliente, revisa el monto y la vigencia que tendrá, y registra. El pago <b style={S}>renueva la membresía</b> (mueve la fecha de vencimiento) y, si la mensajería está encendida, el cliente recibe por WhatsApp su comprobante. Los clientes también pueden pagar en línea con Mercado Pago desde su portal o con la liga del recordatorio; esos pagos se confirman y renuevan solos.</p>
        <p><b style={S}>Recordatorios</b> — clientes que vencen en los próximos 7 días o vencieron hace hasta 15, calculados desde la fecha de vencimiento de su ficha. Muestra el estado real de cada recordatorio por WhatsApp (Enviado, Entregado, Leído o Fallido con su motivo) y el botón <b style={S}>Enviar</b> (recepción y administración) para mandarlo a mano. El envío automático es diario, 3 días antes, el día del vencimiento y 3 días después; no se envía a quien no tiene teléfono ni a quien ya tiene un pago registrado en el periodo. Cada recordatorio lleva un botón <b style={S}>Pagar ahora</b> con la liga de pago en línea del cliente. Arriba aparecen los clientes que <b style={S}>respondieron</b> por WhatsApp: puedes marcarlos atendidos o ir a <b style={S}>Registrar pago</b>. Una respuesta como "ya pagué" no renueva nada; solo un pago registrado o confirmado lo hace.</p>
        <Callout variant="note" title="Uso actual: solo consulta">
          Esta pantalla sirve para monitorear vencimientos — los botones de envío de la tabla todavía no están conectados a ninguna acción, así que el aviso a cada cliente debe hacerse manualmente por ahora.
        </Callout>
      </>
    ),
  },
  {
    icon: '◐',
    title: 'Rutinas Coach',
    tag: '/rutinas/coach',
    badge: SHARED_COACH_BADGE,
    dek: 'La biblioteca de programas que los clientes ven en "Mis Rutinas → Biblioteca".',
    children: (
      <ul>
        <li><b style={S}>"+ Nueva Rutina"</b> — nombre, nivel (Principiante/Intermedio/Avanzado), duración, coach asignado, y días de entrenamiento con grupo muscular y ejercicios.</li>
        <li>Cada tarjeta muestra duración, clientes que la siguen y días; puedes <b style={S}>expandir</b>, <b style={S}>editar</b> o <b style={S}>eliminar</b> (con confirmación).</li>
      </ul>
    ),
  },
  {
    icon: '◷',
    title: 'Rutinas Clientes',
    tag: '/rutinas/clientes',
    badge: SHARED_COACH_BADGE,
    dek: 'Consulta, por cliente, qué programa tiene asignado.',
    children: (
      <p>Selecciona un cliente para ver su rutina activa: coach, semana, objetivo y detalle día por día. Es de <b style={S}>solo consulta</b> — para crear o modificar programas usa Rutinas Coach; la asignación la hace cada cliente desde su portal (Biblioteca → "Auto-asignarme").</p>
    ),
  },
];

const ADMIN_ITEMS = [
  {
    icon: '▦',
    title: 'Inventario',
    tag: '/inventario',
    badge: ADMIN_BADGE,
    dek: 'Monitoreo del stock del gimnasio.',
    children: (
      <>
        <ul>
          <li>Indicadores de total de artículos, valor total y artículos con stock bajo.</li>
          <li>Tabla con artículo, categoría, cantidad (barra visual de stock), mínimo, precio y estado.</li>
        </ul>
        <Callout variant="note" title="Uso actual: solo consulta">
          El botón "+ Agregar" del encabezado todavía no da de alta artículos nuevos. Por ahora esta pantalla sirve para revisar el inventario, no para editarlo.
        </Callout>
      </>
    ),
  },
  {
    icon: '◎',
    title: 'Nómina',
    tag: '/nomina',
    badge: ADMIN_BADGE,
    dek: 'Control de pagos al personal.',
    children: (
      <>
        <ul>
          <li>Indicadores de número de empleados, nómina total del mes y pagos pendientes.</li>
          <li>Lista de empleados con puesto, horas, salario y estado. Botón <b style={S}>"Pagar"</b> en cada pendiente.</li>
        </ul>
        <Callout variant="note" title="Uso actual: solo pago, no alta">
          No hay botón para dar de alta un nuevo empleado desde esta pantalla — solo puedes pagar a los que ya existen en el sistema.
        </Callout>
      </>
    ),
  },
  {
    icon: '◍',
    title: 'Gastos',
    tag: '/gastos',
    badge: ADMIN_BADGE,
    dek: 'Registro de egresos del gimnasio.',
    children: (
      <ol>
        <li>Presiona <b style={S}>"+ Agregar"</b>: descripción, monto, método (Efectivo/Tarjeta/Transferencia) y fecha.</li>
        <li>Cada gasto queda en la tabla, con indicadores de total registrado y total del mes.</li>
        <li>Usa <b style={S}>"Eliminar"</b> en cualquier fila para quitar un registro (con confirmación).</li>
      </ol>
    ),
  },
  {
    icon: '◆',
    title: 'Ingresos',
    tag: '/ingresos',
    badge: ADMIN_BADGE,
    dek: 'Entradas de dinero fuera de los pagos de membresía.',
    children: (
      <p>Funciona igual que Gastos — <b style={S}>"+ Agregar"</b>, tabla con indicadores, y <b style={S}>"Eliminar"</b> por fila — con un campo adicional opcional para asociar el ingreso a un cliente.</p>
    ),
  },
  {
    icon: '⚖',
    title: 'Créditos',
    tag: '/creditos',
    badge: ADMIN_BADGE,
    dek: 'Control de saldos "a crédito" o fiado.',
    children: (
      <ul>
        <li>Indicadores de créditos registrados, pendientes de cobro y total por cobrar.</li>
        <li><b style={S}>"+ Agregar"</b>: cliente, concepto, fecha, monto pagado, saldo pendiente y comentarios.</li>
        <li>Por registro: <b style={S}>"Marcar pagado"</b> (salda a cero) o <b style={S}>"Eliminar"</b>.</li>
      </ul>
    ),
  },
  {
    icon: '⚙',
    title: 'Backoffice de Contenido',
    tag: '/admin/contenido',
    badge: ADMIN_BADGE,
    dek: 'Edita lo que ve el público en la landing page, controla la mensajería por WhatsApp y configura Mercado Pago.',
    children: (
      <>
        <ul>
          <li><b style={S}>Paquetes</b> — alta/edición/eliminación de planes públicos: nombre, precio, periodo, color, "Destacado" y beneficios.</li>
          <li><b style={S}>Promociones</b> — tarjetas de promoción: nombre, insignia, precio, periodo, color y descripción.</li>
          <li><b style={S}>Coaches</b> — alta/edición/eliminación de coaches del carrusel: nombre, especialidad, descripción y foto.</li>
          <li><b style={S}>Horarios</b> — parrilla semanal: tipos de clase con color, días, franjas horarias y qué clase corre en cada celda.</li>
          <li><b style={S}>Mensajería</b> — interruptor de los WhatsApp de IronCore (arranca <b style={S}>apagado</b>): recordatorios de pago y mensaje de pago recibido. Muestra además, en solo lectura, si SofIA activó el servicio de mensajería; para que salgan mensajes deben estar encendidos los dos. También indica si el servidor está conectado al mensajero y a Mercado Pago, y a quién le toca mensaje hoy. Apagado, no se envía nada (los pagos se registran igual). Se guarda al instante, sin botón de guardar.</li>
          <li><b style={S}>Mercado Pago</b> — credenciales del pago en línea (Access Token y clave secreta de webhooks) y <b style={S}>teléfono del administrador del sitio</b>. Muestra si el pago en línea está configurado, si las credenciales salen de aquí o del servidor, si son de prueba o de producción y solo sus últimos 4 caracteres, además de la URL del webhook para pegar en Mercado Pago. <b style={S}>Cada cambio pide un código de 6 dígitos</b> que llega por WhatsApp al teléfono del administrador (vale 10 minutos y sirve una sola vez, solo para esa operación). Primero registra el teléfono: escribe el celular y tu contraseña, y confirma con el código que llega a ese número. Para cambiarlo después llega un código al número actual y luego otro al nuevo. Al guardar solo se revisa el formato de las credenciales, no se prueban con Mercado Pago: haz un pago de prueba después. Si el código no se puede enviar (WhatsApp sin activar por SofIA, número sin WhatsApp, plantilla aún no aprobada) la pantalla lo dice; no hay otra forma de hacer el cambio.</li>
        </ul>
        <Callout variant="tip" title="Recuerda guardar cada pestaña">
          Cada pestaña tiene su propio botón de guardado ("Guardar paquetes", "Guardar coaches", etc.) — los cambios no se guardan solos al cambiar de pestaña.
        </Callout>
      </>
    ),
  },
];

const ROLE_ROWS = [
  ['Dashboard', true, true, true],
  ['Clientes & Pagos', true, true, true],
  ['Rutinas Coach / Rutinas Clientes', true, true, false],
  ['Inventario, Nómina, Gastos, Ingresos, Créditos', true, false, false],
  ['Backoffice de Contenido', true, false, false],
];

export default function ManualAdministrador() {
  const [tab, setTab] = useState('shared');

  return (
    <div>
      <SectionHeader title="Manual del Administrador" sub="Guía operativa del panel de staff" />

      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 14,
          padding: '20px 24px',
          marginBottom: 24,
        }}
      >
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 12 }}>
          Roles y accesos
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                {['Módulo', 'ADMIN', 'COACH', 'RECEP'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: COLORS.muted, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_ROWS.map(([label, admin, coach, recep]) => (
                <tr key={label} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '10px 12px', color: COLORS.text, fontSize: 13.5 }}>{label}</td>
                  <td style={{ padding: '10px 12px', color: admin ? COLORS.green : COLORS.muted, fontWeight: 600 }}>{admin ? '✓' : '—'}</td>
                  <td style={{ padding: '10px 12px', color: coach ? COLORS.green : COLORS.muted, fontWeight: 600 }}>{coach ? '✓' : '—'}</td>
                  <td style={{ padding: '10px 12px', color: recep ? COLORS.green : COLORS.muted, fontWeight: 600 }}>{recep ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout variant="note" title="Un detalle que genera tickets de soporte">
          El menú lateral de COACH y RECEP muestra enlaces a Inventario, Nómina, Gastos, Ingresos y Créditos aunque no tengan permiso — si hacen clic ahí, el sistema los redirige fuera. No es un error: esos módulos simplemente no están disponibles para su rol.
        </Callout>
      </div>

      <TabBar
        tabs={[
          { id: 'shared', icon: '◈', label: 'Compartido con tu equipo' },
          { id: 'admin', icon: '⚙', label: 'Exclusivo de Administrador' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'shared' ? <Accordion items={SHARED_ITEMS} /> : <Accordion items={ADMIN_ITEMS} />}

      <div style={{ marginTop: 24 }}>
        <Callout variant="crit" title="Cuentas de staff — esto no se hace desde el panel">
          El panel no tiene una pantalla para crear cuentas de staff ni para asignar o cambiar roles (ADMIN/COACH/RECEP). El único alta disponible desde la interfaz es para <b style={S}>clientes</b> (pestaña "Crear cuenta" del login, o "Registro Autónomo" en Clientes &amp; Pagos). Para dar de alta a un nuevo coach, recepcionista o administrador, o cambiar el rol de alguien, contacta al equipo técnico que administra el sistema — se hace directamente en la base de datos.
        </Callout>
      </div>
    </div>
  );
}
