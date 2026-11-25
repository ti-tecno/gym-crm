/**
 * Respuestas de clientes por WhatsApp (`message.received` del mensajero). Lógica pura.
 *
 * Se guardan en el propio cliente (gym_clientes.respuestasWhatsapp, las más recientes primero),
 * sin índices ni tablas nuevas. El texto es dato NO confiable: se guarda tal cual (recortado) y
 * el frontend lo muestra como texto, nunca como HTML.
 *
 * Regla de negocio: una respuesta ("ya pagué") NO cambia ningún estado ni renueva nada. Solo
 * un pago real (Mercado Pago confirmado o registrado en recepción) renueva; cuando ocurre, las
 * respuestas pendientes de ese cliente se dan por atendidas.
 */

export const MAX_RESPUESTAS = 20;
export const MAX_TEXTO = 1000;

const REF_CLIENTE = /^cliente:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const texto = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);

/**
 * Extrae la respuesta de un evento del mensajero. El entrante hereda `ref` (cliente:<id>) y
 * `metadata` del último saliente (SPEC §6); sin `ref` no se puede ligar a un cliente.
 * @returns {{ clienteId, respuesta } | { ignorado }}
 */
export function extraerRespuesta(evento) {
  if (evento?.event !== 'message.received') return { ignorado: 'evento' };
  const d = evento.data || {};
  if (typeof d.id !== 'string' || !d.id || d.id.length > 100) return { ignorado: 'id' };
  if (d.direction && d.direction !== 'in') return { ignorado: 'direccion' };
  const m = typeof d.ref === 'string' ? d.ref.match(REF_CLIENTE) : null;
  if (!m) return { ignorado: 'sin_cliente' };
  const recordatorioId = typeof d.metadata?.recordatorioId === 'string' ? d.metadata.recordatorioId.slice(0, 120) : null;
  return {
    clienteId: m[1].toLowerCase(),
    respuesta: {
      id: d.id,
      texto: texto(d.text, MAX_TEXTO),
      tipo: texto(d.msgType, 30) || null,
      perfil: texto(d.profileName, 80) || null,
      telefono: texto(d.phone, 20) || null,
      recibidoAt: typeof d.createdAt === 'string' && !Number.isNaN(Date.parse(d.createdAt)) ? d.createdAt : (evento.createdAt || null),
      recordatorioId,
      origen: recordatorioId?.startsWith('pagorecibido:') ? 'pago_recibido' : (recordatorioId?.startsWith('pago:') ? 'recordatorio' : null),
      atendida: false,
    },
  };
}

/** Lista con la respuesta agregada al principio, o null si ya estaba (evento repetido). */
export function agregarRespuesta(lista, r) {
  const actual = Array.isArray(lista) ? lista : [];
  if (actual.some((x) => x.id === r.id)) return null;
  return [r, ...actual]
    .sort((a, b) => String(b.recibidoAt || '').localeCompare(String(a.recibidoAt || '')))
    .slice(0, MAX_RESPUESTAS);
}

/** Marca como atendida una respuesta (o todas las pendientes si `id` es null). null si no cambia nada. */
export function atender(lista, id, { por, at, motivo }) {
  const actual = Array.isArray(lista) ? lista : [];
  let cambio = false;
  const nueva = actual.map((x) => {
    if (x.atendida || (id && x.id !== id)) return x;
    cambio = true;
    return { ...x, atendida: true, atendidaPor: por || null, atendidaAt: at, atendidaMotivo: motivo || null };
  });
  return cambio ? nueva : null;
}

export const pendientes = (lista) => (Array.isArray(lista) ? lista.filter((x) => !x.atendida) : []);
