import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularRenovacion, estadoMembresia, mesesDelPeriodo, sumarMeses } from '../src/services/membresia.logic.js';

test('periodo: manda tipoMensualidad, luego el plan, y si no 1 mes', () => {
  assert.equal(mesesDelPeriodo({ tipoMensualidad: 'Mensual' }), 1);
  assert.equal(mesesDelPeriodo({ tipoMensualidad: '3 Meses' }), 3);
  assert.equal(mesesDelPeriodo({ tipoMensualidad: '6 Meses' }), 6);
  assert.equal(mesesDelPeriodo({ tipoMensualidad: 'Anual' }), 12);
  assert.equal(mesesDelPeriodo({ plan: 'Estudiante' }), 1);
  assert.equal(mesesDelPeriodo({ plan: 'Trimestre' }), 3);
  assert.equal(mesesDelPeriodo({ plan: 'Semestre' }), 6);
  assert.equal(mesesDelPeriodo({ plan: 'Anual' }), 12);
  assert.equal(mesesDelPeriodo({ plan: 'Trimestre', tipoMensualidad: 'Mensual' }), 1); // el tipo viene del último pago real
  assert.equal(mesesDelPeriodo({ plan: 'Premium' }), 1); // legacy
  assert.equal(mesesDelPeriodo({}), 1);
});

test('sumar meses: fin de mes se ajusta al último día, bisiesto y cambio de año', () => {
  assert.equal(sumarMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(sumarMeses('2028-01-31', 1), '2028-02-29'); // 2028 bisiesto
  assert.equal(sumarMeses('2028-02-29', 12), '2029-02-28');
  assert.equal(sumarMeses('2026-08-31', 3), '2026-11-30');
  assert.equal(sumarMeses('2026-11-15', 3), '2027-02-15');
  assert.equal(sumarMeses('2026-12-31', 6), '2027-06-30');
  assert.equal(sumarMeses('2026-03-31', 12), '2027-03-31');
});

test('estado: vencido < 0, por vencer ≤ 7 días, activo después (igual que el backfill)', () => {
  assert.equal(estadoMembresia('2026-11-23', '2026-11-24'), 'Vencido');
  assert.equal(estadoMembresia('2026-11-24', '2026-11-24'), 'Por vencer');
  assert.equal(estadoMembresia('2026-12-01', '2026-11-24'), 'Por vencer');
  assert.equal(estadoMembresia('2026-12-02', '2026-11-24'), 'Activo');
  assert.equal(estadoMembresia(null, '2026-11-24'), 'Vencido');
});

test('renovación vigente: se extiende desde el vencimiento actual', () => {
  const r = calcularRenovacion({ vencimiento: '2026-11-27', tipoMensualidad: 'Mensual' }, '2026-11-24');
  assert.equal(r.desde, 'vencimiento');
  assert.equal(r.vencimientoAnterior, '2026-11-27');
  assert.equal(r.vencimientoNuevo, '2026-12-27');
  assert.equal(r.estado, 'Activo');
  // Vence hoy: sigue vigente hoy
  assert.equal(calcularRenovacion({ vencimiento: '2026-11-24', plan: 'Trimestre' }, '2026-11-24').vencimientoNuevo, '2027-02-24');
  // Pagando por adelantado se acumula
  assert.equal(calcularRenovacion({ vencimiento: '2027-03-10', plan: 'Anual' }, '2026-11-24').vencimientoNuevo, '2028-03-10');
});

test('renovación vencida o sin fecha: desde el día del pago', () => {
  const r = calcularRenovacion({ vencimiento: '2026-10-01', plan: 'Semestre' }, '2026-11-24');
  assert.equal(r.desde, 'pago');
  assert.equal(r.vencimientoNuevo, '2027-05-24');
  assert.equal(calcularRenovacion({ vencimiento: '2026-11-23T00:00:00.000Z' }, '2026-11-24').vencimientoNuevo, '2026-12-24');
  assert.equal(calcularRenovacion({}, '2026-11-24').vencimientoNuevo, '2026-12-24');
  assert.equal(calcularRenovacion({ vencimiento: 'basura' }, '2026-11-24').vencimientoAnterior, null);
  // Pago el 31 vencido → fin de febrero
  assert.equal(calcularRenovacion({ vencimiento: '2026-01-01' }, '2026-01-31').vencimientoNuevo, '2026-02-28');
});
