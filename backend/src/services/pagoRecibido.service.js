/**
 * WhatsApp "pago recibido" (plantilla ironcore_pago_recibido) tras cada pago que pasa a Exitoso.
 *
 * Reutiliza el cliente del mensajero, el interruptor gym_settings.mensajeria.activo y el
 * registro en gym_recordatorios del recordatorio de pago (mismas funciones del repositorio),
 * con `origen: 'pago_recibido'` y recordatorioId = idempotencyKey = `pagorecibido:<pagoId>`.
 *
 * `notificar` NUNCA lanza: un fallo del mensajero (o de su registro) no afecta al pago.
 */
import { ESTADO, ESTADOS_EXITOSOS, estadoLocal, estadosPrevios, motivoDeMensaje, tieneTelefono } from './recordatorioPago.logic.js';
import { esIdPagoRecibido, idempotencyKeyPagoRecibido, parametrosPagoRecibido } from './pagos.logic.js';

const nombreCompleto = (c) => [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || 'Cliente';

export function crearServicioPagoRecibido({ config, mensajero, repo, settings, logger, now = () => new Date() }) {
  /**
   * @returns {{ resultado: 'sin_configurar'|'apagado'|'sin_telefono'|'ya_enviado'|'enviado'|'duplicado'|'fallido'|'error', motivo? }}
   */
  async function notificar({ pago, cliente, vencimiento }) {
    try {
      if (!config.pagoRecibidoDisponible) return { resultado: 'sin_configurar' };
      const m = await settings.getMensajeria();
      if (m?.activo !== true) return { resultado: 'apagado' };
      if (!cliente || !tieneTelefono(cliente.telefono)) return { resultado: 'sin_telefono' };

      const id = idempotencyKeyPagoRecibido(pago.pagoId);
      const reservado = await repo.iniciarEnvioPago(id, {
        clienteId: cliente.clienteId,
        tipo: 'WhatsApp',
        origen: 'pago_recibido',
        pagoId: pago.pagoId,
        monto: Number(pago.monto),
        vencimiento,
        plantilla: config.plantillaPagoRecibido,
        modo: 'auto',
        enviadoPor: 'automático',
      }, ESTADOS_EXITOSOS);
      if (!reservado) return { resultado: 'ya_enviado' };

      const r = await mensajero.enviarPlantilla({
        to: cliente.telefono,
        ...(config.canal ? { channel: config.canal } : {}),
        template: config.plantillaPagoRecibido,
        language: config.idioma,
        parameters: parametrosPagoRecibido(cliente, pago, vencimiento),
        ref: `cliente:${cliente.clienteId}`,
        metadata: { refLabel: nombreCompleto(cliente), recordatorioId: id, pagoId: pago.pagoId, clienteId: cliente.clienteId },
        idempotencyKey: id,
      });

      const fallo = r.estado === ESTADO.FALLIDO;
      await repo.registrarResultadoPago(id, {
        estado: r.estado,
        estadosPrevios: [...new Set([ESTADO.ENVIANDO, ...estadosPrevios(r.estado)])],
        mensajeId: r.mensajeId || undefined,
        motivoFalla: fallo ? r.motivo : null,
        reintentable: fallo ? r.reintentable : undefined,
        resultado: r.resultado,
        enviadoAt: fallo ? undefined : now().toISOString(),
      });
      if (fallo) {
        logger.warn('Mensaje de pago recibido no enviado', { pagoId: pago.pagoId, resultado: r.resultado, motivo: r.motivo });
        return { resultado: 'fallido', motivo: r.motivo };
      }
      return { resultado: r.resultado };
    } catch (err) {
      logger.error('Error al enviar el mensaje de pago recibido (el pago no se afecta)', { pagoId: pago?.pagoId, err: err?.message });
      return { resultado: 'error', motivo: err?.message };
    }
  }

  /** `message.status` de un mensaje de pago recibido (firma ya verificada). Idempotente. */
  async function procesarWebhook(evento) {
    if (evento?.event !== 'message.status') return { ignorado: 'evento' };
    const data = evento.data || {};
    const id = data.metadata?.recordatorioId || data.idempotencyKey;
    if (!esIdPagoRecibido(id) || typeof data.id !== 'string') return { ignorado: 'ajeno' };
    const estado = estadoLocal(data.status);
    if (!estado || estado === ESTADO.ENVIANDO) return { ignorado: 'estado' };
    const cambiado = await repo.avanzarEstadoPago(id, {
      mensajeId: data.id,
      estado,
      estadosPrevios: estadosPrevios(estado),
      motivoFalla: estado === ESTADO.FALLIDO ? (motivoDeMensaje(data) || 'WhatsApp no pudo entregar el mensaje') : undefined,
    });
    return { actualizado: cambiado, estado };
  }

  return { notificar, procesarWebhook };
}
