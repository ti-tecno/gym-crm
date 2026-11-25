/**
 * Respuestas de clientes por WhatsApp: guardado desde el webhook, listado para recepción y
 * "atendida". Fábrica con dependencias inyectadas; cableado real en pagos.js.
 * Ver reglas en respuestas.logic.js (una respuesta nunca renueva ni cambia estados).
 */
import { agregarRespuesta, atender, extraerRespuesta, pendientes } from './respuestas.logic.js';

const MAX_INTENTOS = 5;
const nombreCompleto = (c) => [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || 'Cliente';

export class ErrorRespuesta extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function crearServicioRespuestas({ clientes, logger, now = () => new Date() }) {
  /** Lee-modifica-escribe con bloqueo optimista (respuestasVersion). `cambiar` devuelve la lista nueva o null. */
  async function modificar(clienteId, cambiar) {
    for (let i = 0; i < MAX_INTENTOS; i += 1) {
      const c = await clientes.getCliente(clienteId);
      if (!c) return { sinCliente: true };
      const nueva = cambiar(c.respuestasWhatsapp);
      if (!nueva) return { cambiado: false };
      const ok = await clientes.guardarRespuestasWhatsapp(clienteId, nueva, c.respuestasVersion ?? null);
      if (ok) return { cambiado: true, lista: nueva };
    }
    throw new Error('Conflicto persistente al guardar respuestas de WhatsApp');
  }

  /** `message.received` (firma ya verificada). Idempotente por data.id. */
  async function procesarWebhook(evento) {
    const r = extraerRespuesta(evento);
    if (r.ignorado) return { ignorado: r.ignorado };
    const res = await modificar(r.clienteId, (lista) => agregarRespuesta(lista, r.respuesta));
    if (res.sinCliente) return { ignorado: 'cliente_inexistente' };
    if (res.cambiado) logger.info('Respuesta de WhatsApp de un cliente', { clienteId: r.clienteId, mensajeId: r.respuesta.id });
    return { guardada: res.cambiado };
  }

  /** Clientes con respuestas sin atender (las más recientes primero). */
  async function listarPendientes() {
    const lista = await clientes.listClientes({ all: true });
    return lista
      .map((c) => ({ c, p: pendientes(c.respuestasWhatsapp) }))
      .filter(({ p }) => p.length)
      .map(({ c, p }) => ({
        clienteId: c.clienteId,
        nombre: nombreCompleto(c),
        telefono: c.telefono || null,
        vencimiento: c.vencimiento || null,
        estado: c.estado || null,
        monto: Number(c.monto) || 0,
        respuestas: p,
      }))
      .sort((a, b) => String(b.respuestas[0].recibidoAt || '').localeCompare(String(a.respuestas[0].recibidoAt || '')));
  }

  async function marcarAtendida(clienteId, respuestaId, usuario) {
    const r = await modificar(clienteId, (lista) => atender(lista, respuestaId, { por: usuario, at: now().toISOString(), motivo: 'Marcada por recepción' }));
    if (r.sinCliente) throw new ErrorRespuesta(404, 'NOT_FOUND', 'Cliente no encontrado');
    return { ok: true, cambiado: r.cambiado };
  }

  /** Tras un pago real: las respuestas pendientes de ese cliente quedan atendidas. */
  async function atenderPorPago(clienteId, pagoId) {
    const r = await modificar(clienteId, (lista) => atender(lista, null, { por: 'automático', at: now().toISOString(), motivo: `Pago ${pagoId} registrado` }));
    return { cambiado: Boolean(r.cambiado) };
  }

  return { procesarWebhook, listarPendientes, marcarAtendida, atenderPorPago };
}
