/**
 * Lógica pura del recordatorio de pago por WhatsApp (sin BD, sin red, sin env).
 * Todo lo que depende de "hoy" recibe la fecha como parámetro para poder probarse.
 */

export const ZONA = 'America/Mexico_City';

/** Días hacia atrás que se consideran "pago reciente" respecto al vencimiento (ver ventanaPagoReciente). */
export const DIAS_PAGO_RECIENTE = 15;

const ISO_DIA = /^(\d{4})-(\d{2})-(\d{2})/;
const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Fecha de hoy (yyyy-mm-dd) en la zona de México. */
export function hoyMx(now = new Date()) {
  return fmtDia.format(now);
}

/** Hora y minuto actuales en la zona de México. */
export function horaMx(now = new Date()) {
  const [h, m] = fmtHora.format(now).split(':').map(Number);
  return { h, m };
}

/** Normaliza un vencimiento ('2026-12-05' o '2026-12-05T00:00:00.000Z') a 'yyyy-mm-dd'; null si no sirve. */
export function normalizarFecha(valor) {
  if (typeof valor !== 'string') return null;
  const m = valor.trim().match(ISO_DIA);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1) return null; // 2026-02-31 y similares
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const aUtc = (iso) => { const [y, mo, d] = iso.split('-').map(Number); return Date.UTC(y, mo - 1, d); };

/** Días de calendario de `desde` a `hasta` (ambos yyyy-mm-dd). Positivo si `hasta` es posterior. */
export function diferenciaDias(desde, hasta) {
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000);
}

/** Suma días a una fecha yyyy-mm-dd. */
export function sumarDias(iso, dias) {
  return new Date(aUtc(iso) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Días que faltan para el vencimiento (negativo = ya venció). */
export function diasParaVencer(vencimiento, hoy) {
  return diferenciaDias(hoy, vencimiento);
}

/**
 * Etapa que le toca hoy a un vencimiento, o null. Las etapas son días relativos al
 * vencimiento: -3 = tres días antes, 0 = el día que vence, 3 = tres días después.
 */
export function etapaDeHoy(vencimiento, hoy, etapas) {
  const relativo = diferenciaDias(vencimiento, hoy);
  return etapas.includes(relativo) ? relativo : null;
}

/** Nombre de etapa para llaves y registros: -3 → "d-3", 0 → "d0", 3 → "d+3". */
export function nombreEtapa(offset) {
  if (offset === 0) return 'd0';
  return offset > 0 ? `d+${offset}` : `d${offset}`;
}

/**
 * Etapa de un envío manual: uno por día y por teléfono. Lleva los últimos 4 dígitos porque
 * el mensajero conserva la llave cuando falla por el destinatario (número sin WhatsApp):
 * si recepción corrige el teléfono, la llave cambia y el reintento sí sale.
 */
export function etapaManual(hoy, telefono = '') {
  const ultimos = String(telefono).replace(/\D/g, '').slice(-4);
  return ultimos ? `manual-${hoy}-${ultimos}` : `manual-${hoy}`;
}

/** Llave determinística: misma persona + mismo vencimiento + misma etapa = un solo mensaje. */
export function idempotencyKey(clienteId, vencimiento, etapa) {
  return `pago:${clienteId}:${vencimiento}:${etapa}`;
}

/** Qué plantilla usar según cuántos días faltan. */
export function tipoPlantilla(dias) {
  if (dias > 0) return 'antes';
  if (dias === 0) return 'hoy';
  return 'despues';
}

/** ¿Tiene un teléfono con al menos 10 dígitos? (el mensajero hace la validación final). */
export function tieneTelefono(telefono) {
  return typeof telefono === 'string' && telefono.replace(/\D/g, '').length >= 10;
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * "lunes 30 de noviembre" — mismo formato que el ejemplo con el que se aprobaron las
 * plantillas en Meta. Se arma a mano (sin Intl) para no depender de comas o de la versión de ICU.
 */
export function fechaLegible(iso) {
  const d = new Date(aUtc(iso));
  return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export function montoLegible(monto) {
  const n = Number(monto);
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Primer nombre con mayúscula inicial ("CARLOS PÉREZ" → "Carlos"). */
export function primerNombre(nombre) {
  const p = String(nombre || '').trim().split(/\s+/)[0] || '';
  return p ? p.charAt(0).toLocaleUpperCase('es-MX') + p.slice(1).toLocaleLowerCase('es-MX') : '';
}

/** Variables con nombre de las plantillas: {{nombre}}, {{monto}}, {{fecha}}. */
export function parametrosPlantilla(cliente, vencimiento) {
  return {
    body: {
      nombre: primerNombre(cliente.nombre) || 'Hola',
      monto: montoLegible(cliente.monto),
      fecha: fechaLegible(vencimiento),
    },
  };
}

/**
 * Inicio de la ventana en la que un pago "Exitoso" cuenta como pago del periodo que vence.
 * Registrar un pago NO mueve clientes.vencimiento (ver informe), así que sin esta guarda se le
 * seguiría recordando a quien ya pagó en recepción hasta que alguien edite la fecha a mano.
 */
export function ventanaPagoReciente(vencimiento) {
  return sumarDias(vencimiento, -DIAS_PAGO_RECIENTE);
}

/** Día (yyyy-mm-dd, zona México) de un pago: acepta '2026-11-20' o un ISO con hora. */
export function diaDePago(fecha) {
  if (typeof fecha !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : hoyMx(d);
}

/** ¿Algún pago exitoso cae dentro de la ventana del vencimiento? Devuelve ese pago o null. */
export function pagoDelPeriodo(pagos, vencimiento) {
  const desde = ventanaPagoReciente(vencimiento);
  return (pagos || []).find((p) => (p.estado ?? 'Exitoso') === 'Exitoso' && (diaDePago(p.fecha) || '') >= desde) || null;
}

/** Valida que un id venga de este módulo (los webhooks traen datos externos). */
export function esIdRecordatorioPago(id) {
  return typeof id === 'string' && /^pago:[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}:[A-Za-z0-9+-]{1,24}$/i.test(id);
}

/**
 * Decide si a un cliente le toca recordatorio hoy. Devuelve { etapa, offset, dias } o
 * { omitir: 'motivo' } / null si no le toca.
 */
export function evaluarCliente(cliente, hoy, etapas) {
  const vencimiento = normalizarFecha(cliente?.vencimiento);
  if (!vencimiento) return null;
  const offset = etapaDeHoy(vencimiento, hoy, etapas);
  if (offset === null) return null;
  const base = { vencimiento, offset, etapa: nombreEtapa(offset), dias: diasParaVencer(vencimiento, hoy) };
  if (!tieneTelefono(cliente.telefono)) return { ...base, omitir: 'Sin teléfono registrado' };
  if (!(Number(cliente.monto) > 0)) return { ...base, omitir: 'Sin monto de mensualidad registrado' };
  return base;
}

// ── Estados locales del recordatorio ─────────────────────────────────────────

export const ESTADO = {
  ENVIANDO: 'Enviando',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  LEIDO: 'Leído',
  FALLIDO: 'Fallido',
};

const DESDE_MENSAJERO = {
  sending: ESTADO.ENVIANDO,
  sent: ESTADO.ENVIADO,
  delivered: ESTADO.ENTREGADO,
  read: ESTADO.LEIDO,
  failed: ESTADO.FALLIDO,
};

export function estadoLocal(statusMensajero) {
  return DESDE_MENSAJERO[statusMensajero] || null;
}

const RANGO = { [ESTADO.ENVIANDO]: 1, [ESTADO.ENVIADO]: 2, [ESTADO.ENTREGADO]: 3, [ESTADO.LEIDO]: 4 };

/** Estados que ya cuentan como "se le mandó" (no se vuelve a enviar). */
export const ESTADOS_EXITOSOS = [ESTADO.ENVIADO, ESTADO.ENTREGADO, ESTADO.LEIDO];

/**
 * ¿Se puede pasar de `actual` a `nuevo`? Solo avanza: Enviando → Enviado → Entregado → Leído.
 * Fallido puede llegar mientras no se haya entregado; un aviso tardío nunca retrocede.
 * Sin estado previo (o legado 'Pendiente'/'Programado') se acepta cualquiera.
 */
export function puedeAvanzar(actual, nuevo) {
  if (!nuevo || actual === nuevo) return false;
  if (!actual || !(actual in RANGO) && actual !== ESTADO.FALLIDO) return true;
  if (actual === ESTADO.FALLIDO) return false;
  if (nuevo === ESTADO.FALLIDO) return RANGO[actual] < RANGO[ESTADO.ENTREGADO];
  return RANGO[nuevo] > RANGO[actual];
}

/** Lista de estados desde los que se puede llegar a `nuevo` (para condiciones de DynamoDB). */
export function estadosPrevios(nuevo) {
  return [ESTADO.ENVIANDO, ESTADO.ENVIADO, ESTADO.ENTREGADO, ESTADO.LEIDO, ESTADO.FALLIDO]
    .filter((e) => puedeAvanzar(e, nuevo));
}

// ── Respuestas del mensajero ─────────────────────────────────────────────────

/** Motivo de falla legible a partir del objeto Mensaje o del error del mensajero. */
export function motivoDeMensaje(message) {
  const e = message?.error;
  if (!e) return null;
  return e.reason || e.message || (e.code ? `Error ${e.code}` : null);
}

/**
 * Traduce la respuesta HTTP del mensajero a un resultado para IronCore.
 * @returns {{ resultado, estado, mensajeId, motivo, reintentable, detener }}
 *   resultado: enviado | duplicado | no_permitido | telefono_invalido | limite_diario | envio_fallido | error
 *   reintentable: true si la tarea automática puede volver a intentarlo con la misma llave
 *                 (el envío manual siempre puede reintentar mientras no se haya enviado)
 *   detener:   true si la corrida automática debe parar (límite diario o configuración rota)
 */
export function interpretarRespuesta(status, body) {
  const message = body?.message || null;
  const err = body?.error || {};
  const code = err.code || null;
  const mensajeId = message?.id || null;
  const base = { mensajeId, telefono: message?.phone || null, reintentable: false, detener: false };

  if (status === 201 || (status === 200 && !body?.duplicate)) {
    return { ...base, resultado: 'enviado', estado: estadoLocal(message?.status) || ESTADO.ENVIADO, motivo: motivoDeMensaje(message) };
  }
  if (status === 200 && body?.duplicate) {
    // Un duplicado puede ser un mensaje que ya había fallado: se respeta su estado real.
    const estado = estadoLocal(message?.status) || ESTADO.ENVIADO;
    return { ...base, resultado: 'duplicado', estado, motivo: estado === ESTADO.FALLIDO ? (motivoDeMensaje(message) || 'El envío anterior falló') : null };
  }
  if (status === 403 && code === 'RECIPIENT_NOT_ALLOWED') {
    return { ...base, resultado: 'no_permitido', estado: ESTADO.FALLIDO, motivo: 'Mensajero en modo prueba (sandbox): este teléfono no está en la lista permitida' };
  }
  if (status === 422) {
    return { ...base, resultado: 'telefono_invalido', estado: ESTADO.FALLIDO, motivo: 'El teléfono registrado no es un número de WhatsApp válido; corrígelo en la ficha del cliente' };
  }
  if (status === 429) {
    return { ...base, resultado: 'limite_diario', estado: ESTADO.FALLIDO, reintentable: true, detener: true, motivo: 'Se alcanzó el límite diario de mensajes del mensajero; se puede reintentar más tarde' };
  }
  if (status === 502 && code === 'SEND_FAILED') {
    const reintentable = err.retryable === true;
    return {
      ...base,
      resultado: 'envio_fallido',
      estado: ESTADO.FALLIDO,
      reintentable,
      motivo: motivoDeMensaje(message) || err.message || 'WhatsApp rechazó el envío',
    };
  }
  // 401 llave inválida, 403 app desactivada / canal no permitido, 400 plantilla mal armada,
  // 503 canal sin configurar…: afectan a todos los envíos, así que la corrida se detiene.
  const detener = [400, 401, 403, 503].includes(status);
  return {
    ...base,
    resultado: 'error',
    estado: ESTADO.FALLIDO,
    reintentable: true,
    detener,
    motivo: `Error del mensajero (${status}${code ? ` ${code}` : ''})${err.message ? `: ${err.message}` : ''}`,
  };
}
