/**
 * Renovación de membresía (lógica pura: sin BD, sin red, sin env).
 *
 * Fuente de verdad del vencimiento: gym_clientes.vencimiento (yyyy-mm-dd).
 * Periodos y estados se calculan igual que el resto del sistema:
 *   - meses por plan: PLAN_MESES de auth.controller.js (registro del cliente)
 *   - meses por tipoMensualidad: classifyDuracion de scripts/backfillClienteMensualidad.js
 *   - estado: classifyEstado del mismo script (vencido < 0 días, "Por vencer" ≤ 7, si no "Activo")
 * Diferencia deliberada: al sumar meses, un día que no existe en el mes destino se ajusta al
 * último día del mes (31 ene + 1 mes = 28/29 feb) en lugar de desbordarse al mes siguiente
 * como hace `new Date(y, m + n, d)` (31 ene + 1 mes = 3 mar).
 */
import { diferenciaDias, normalizarFecha } from './recordatorioPago.logic.js';

/** gym_clientes.tipoMensualidad → meses (valores de validators/cliente.schema.js). */
export const MESES_POR_TIPO = { Mensual: 1, '3 Meses': 3, '6 Meses': 6, Anual: 12 };

/** gym_clientes.plan → meses (mismo mapa que PLAN_MESES en auth.controller.js). */
export const MESES_POR_PLAN = { Mensual: 1, Estudiante: 1, Trimestre: 3, Semestre: 6, Anual: 12 };

/** Días antes del vencimiento a partir de los cuales el estado es "Por vencer". */
export const DIAS_POR_VENCER = 7;

/**
 * Meses que cubre un pago del cliente. Manda `tipoMensualidad` (viene del último pago real,
 * igual que `monto`); si no hay, el plan; si tampoco (planes legacy Básico/Premium/Elite), 1 mes
 * como hace el registro (`PLAN_MESES[plan] || 1`).
 */
export function mesesDelPeriodo(cliente) {
  return MESES_POR_TIPO[cliente?.tipoMensualidad] || MESES_POR_PLAN[cliente?.plan] || 1;
}

/** "1 mes", "3 meses", "1 año". */
export function etiquetaPeriodo(meses) {
  if (meses === 12) return '1 año';
  return meses === 1 ? '1 mes' : `${meses} meses`;
}

const diasDelMes = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Suma meses de calendario a yyyy-mm-dd; si el día no existe en el mes destino, usa el último. */
export function sumarMeses(iso, meses) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = (m - 1) + meses;
  const yy = y + Math.floor(total / 12);
  const mm0 = ((total % 12) + 12) % 12;
  const dd = Math.min(d, diasDelMes(yy, mm0));
  return `${String(yy).padStart(4, '0')}-${String(mm0 + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** Estado de la membresía en `hoy` (ambos yyyy-mm-dd). */
export function estadoMembresia(vencimiento, hoy) {
  const v = normalizarFecha(vencimiento);
  if (!v) return 'Vencido';
  const dias = diferenciaDias(hoy, v);
  if (dias < 0) return 'Vencido';
  if (dias <= DIAS_POR_VENCER) return 'Por vencer';
  return 'Activo';
}

/**
 * Cuánto avanza el vencimiento con un pago hecho el día `fechaPago` (yyyy-mm-dd, zona México).
 * Vigente (vence hoy o después): se extiende desde su vencimiento actual.
 * Vencida o sin fecha válida: desde el día del pago.
 * @returns {{ meses, desde: 'vencimiento'|'pago', base, vencimientoAnterior, vencimientoNuevo, estado }}
 */
export function calcularRenovacion(cliente, fechaPago, hoy = fechaPago) {
  const meses = mesesDelPeriodo(cliente);
  const anterior = normalizarFecha(cliente?.vencimiento);
  const vigente = Boolean(anterior) && anterior >= fechaPago;
  const base = vigente ? anterior : fechaPago;
  const vencimientoNuevo = sumarMeses(base, meses);
  return {
    meses,
    desde: vigente ? 'vencimiento' : 'pago',
    base,
    vencimientoAnterior: anterior,
    vencimientoNuevo,
    estado: estadoMembresia(vencimientoNuevo, hoy),
  };
}
