/**
 * Lógica pura de pagos (sin BD, sin red, sin env): estados, transiciones con Mercado Pago,
 * validación de lo que reporta la pasarela y datos del mensaje "pago recibido".
 */
import crypto from 'node:crypto';
import { fechaLegible, montoLegible, primerNombre } from './recordatorioPago.logic.js';

export const MONEDA = 'MXN';

export const ESTADO_PAGO = {
  PENDIENTE: 'Pendiente',
  EXITOSO: 'Exitoso',
  RECHAZADO: 'Rechazado',
  CANCELADO: 'Cancelado',
  REEMBOLSADO: 'Reembolsado',
  CONTRACARGO: 'Contracargo',
};

/** Métodos de cobro en mostrador (la tarjeta se cobra en la terminal, nunca aquí). */
export const METODOS_MOSTRADOR = ['efectivo', 'transferencia', 'tarjeta'];

/**
 * Folio del pago (también es su PK y el external_reference en Mercado Pago).
 * 'TXN-' + 10 hexadecimales aleatorios (40 bits); el repositorio reintenta si choca.
 */
export function generarPagoId(randomBytes = crypto.randomBytes) {
  return 'TXN-' + randomBytes(5).toString('hex').toUpperCase();
}

/** Folios aceptados como referencia externa (incluye los viejos 'TXN-' + 6 dígitos). */
export function esPagoId(v) {
  return typeof v === 'string' && /^TXN-[0-9A-F]{4,16}$/.test(v);
}

/** pagoId del registro creado cuando llega un segundo pago aprobado para la misma preferencia. */
export const pagoIdDerivado = (mpPaymentId) => `MP-${mpPaymentId}`;

/**
 * status de Mercado Pago (GET /v1/payments/{id}) → estado local.
 * null = no cambia el estado local (in_mediation: disputa abierta, el dinero sigue retenido).
 */
export function estadoDesdeMercadoPago(status) {
  switch (status) {
    case 'approved': return ESTADO_PAGO.EXITOSO;
    case 'pending':
    case 'in_process':
    case 'authorized': return ESTADO_PAGO.PENDIENTE;
    case 'rejected': return ESTADO_PAGO.RECHAZADO;
    case 'cancelled': return ESTADO_PAGO.CANCELADO;
    case 'refunded': return ESTADO_PAGO.REEMBOLSADO;
    case 'charged_back': return ESTADO_PAGO.CONTRACARGO;
    default: return null;
  }
}

/** Transiciones válidas para el MISMO pago de Mercado Pago. */
const TRANSICIONES = {
  [ESTADO_PAGO.PENDIENTE]: [ESTADO_PAGO.EXITOSO, ESTADO_PAGO.RECHAZADO, ESTADO_PAGO.CANCELADO],
  [ESTADO_PAGO.EXITOSO]: [ESTADO_PAGO.REEMBOLSADO, ESTADO_PAGO.CONTRACARGO],
  [ESTADO_PAGO.REEMBOLSADO]: [],
  [ESTADO_PAGO.CONTRACARGO]: [ESTADO_PAGO.REEMBOLSADO],
  [ESTADO_PAGO.RECHAZADO]: [],
  [ESTADO_PAGO.CANCELADO]: [],
};

export function transicionValida(actual, nuevo) {
  return (TRANSICIONES[actual] || []).includes(nuevo);
}

/**
 * Qué hacer con el pago local `pago` ante el pago de Mercado Pago `mp`.
 * Una preferencia puede generar varios pagos en MP (un rechazo y luego un reintento, una ficha
 * OXXO y luego tarjeta…). El pago local queda "ligado" (mpPaymentId) al pago de MP que manda:
 *   - Mismo pago de MP (o aún sin ligar): se sigue la tabla de transiciones.
 *   - Otro pago de MP aprobado: si el local no se había cobrado, lo toma; si ya estaba cobrado,
 *     es dinero recibido dos veces → 'duplicado' (se registra aparte y también renueva).
 *   - Otro pago de MP pendiente: solo toma un local rechazado/cancelado.
 * @returns {{ accion: 'ignorar'|'ligar'|'transicion'|'duplicado', nuevo?, motivo? }}
 */
export function decidirAccion(pago, mp) {
  const nuevo = estadoDesdeMercadoPago(mp?.status);
  if (!nuevo) return { accion: 'ignorar', motivo: 'estado_sin_efecto' };
  const id = String(mp.id);
  const ligado = pago.mpPaymentId != null ? String(pago.mpPaymentId) : null;
  const actual = pago.estado;

  if (!ligado || ligado === id) {
    if (actual === nuevo) return ligado ? { accion: 'ignorar', motivo: 'sin_cambio' } : { accion: 'ligar', nuevo };
    if (transicionValida(actual, nuevo)) return { accion: 'transicion', nuevo };
    return { accion: 'ignorar', motivo: 'transicion_invalida' };
  }

  const sinCobrar = [ESTADO_PAGO.PENDIENTE, ESTADO_PAGO.RECHAZADO, ESTADO_PAGO.CANCELADO].includes(actual);
  if (nuevo === ESTADO_PAGO.EXITOSO) {
    return sinCobrar ? { accion: 'transicion', nuevo } : { accion: 'duplicado', nuevo };
  }
  if (nuevo === ESTADO_PAGO.PENDIENTE && [ESTADO_PAGO.RECHAZADO, ESTADO_PAGO.CANCELADO].includes(actual)) {
    return { accion: 'transicion', nuevo };
  }
  return { accion: 'ignorar', motivo: 'otro_pago_de_mp' };
}

/**
 * ¿Lo que dice Mercado Pago cuadra con lo que cobramos? Devuelve el motivo si no, o null.
 * `referencia` es el folio que se mandó como external_reference.
 */
export function motivoDiscrepancia(pago, mp, referencia) {
  if (String(mp?.external_reference || '') !== referencia) return 'La referencia del pago en Mercado Pago no corresponde a este folio';
  if (mp.currency_id !== MONEDA) return `Moneda inesperada (${mp.currency_id || 'sin moneda'})`;
  const cobrado = Number(mp.transaction_amount);
  if (!Number.isFinite(cobrado) || Math.abs(cobrado - Number(pago.monto)) > 0.005) {
    return `Monto inesperado: Mercado Pago reporta ${Number.isFinite(cobrado) ? cobrado : '?'} y el folio es por ${pago.monto}`;
  }
  return null;
}

/** Campos de Mercado Pago que se guardan en el pago local (sin datos de tarjeta). */
export function camposMercadoPago(mp) {
  return {
    mpPaymentId: String(mp.id),
    mpStatus: mp.status || null,
    mpStatusDetail: mp.status_detail || null,
    mpTipo: mp.payment_type_id || null,
    mpMedio: mp.payment_method_id || null,
    mpLiveMode: typeof mp.live_mode === 'boolean' ? mp.live_mode : null,
  };
}

/** Medio legible para el historial. */
export function medioLegible(pago) {
  if (pago.origen === 'mercadopago' || pago.metodo === 'mercadopago') {
    const t = pago.mpTipo;
    if (t === 'ticket') return pago.mpMedio === 'oxxo' ? 'OXXO' : 'Efectivo (Mercado Pago)';
    if (t === 'bank_transfer') return 'SPEI';
    if (t === 'credit_card') return 'Tarjeta de crédito';
    if (t === 'debit_card') return 'Tarjeta de débito';
    return 'Mercado Pago';
  }
  return { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta (terminal)' }[pago.metodo] || pago.metodo || '—';
}

// ── Mensaje "pago recibido" ─────────────────────────────────────────────────

/** Llave determinística: un solo mensaje por pago. */
export const idempotencyKeyPagoRecibido = (pagoId) => `pagorecibido:${pagoId}`;

/** Valida que un id de recordatorio venga del mensaje de pago recibido (los webhooks traen datos externos). */
export function esIdPagoRecibido(id) {
  return typeof id === 'string' && /^pagorecibido:(TXN-[0-9A-F]{4,16}|MP-\d{1,20})$/.test(id);
}

/** Variables con nombre de ironcore_pago_recibido: {{nombre}}, {{monto}}, {{folio}}, {{fecha}}. */
export function parametrosPagoRecibido(cliente, pago, vencimiento) {
  return {
    body: {
      nombre: primerNombre(cliente.nombre) || 'Hola',
      monto: montoLegible(pago.monto),
      folio: pago.pagoId,
      fecha: fechaLegible(vencimiento),
    },
  };
}
