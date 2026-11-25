import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hoyMx, horaMx, normalizarFecha, diferenciaDias, etapaDeHoy, nombreEtapa, etapaManual, idempotencyKey,
  tipoPlantilla, evaluarCliente, parametrosPlantilla, fechaLegible, primerNombre, puedeAvanzar, estadosPrevios,
  ESTADO, pagoDelPeriodo, esIdRecordatorioPago, diasParaVencer, tieneTelefono,
} from '../src/services/recordatorioPago.logic.js';
import { parseMensajeroConfig, parseEtapas, parseHora } from '../src/config/mensajero.js';

const CID = '0b9c8f1e-2d3a-4b5c-8d7e-6f5a4b3c2d1e';

test('hoyMx usa la zona de México y no la del servidor', () => {
  // 23:30 en CDMX (UTC-6) sigue siendo el 24 aunque en UTC ya sea el 25
  assert.equal(hoyMx(new Date('2026-11-25T05:30:00Z')), '2026-11-24');
  assert.equal(hoyMx(new Date('2026-11-25T06:30:00Z')), '2026-11-25');
  // Verano: México ya no tiene horario de verano desde 2022 → sigue UTC-6
  assert.equal(hoyMx(new Date('2026-07-01T05:59:00Z')), '2026-06-30');
  assert.deepEqual(horaMx(new Date('2026-11-24T15:05:00Z')), { h: 9, m: 5 });
});

test('normalizarFecha acepta yyyy-mm-dd o ISO con hora y rechaza basura', () => {
  assert.equal(normalizarFecha('2026-12-05'), '2026-12-05');
  assert.equal(normalizarFecha('2026-12-05T00:00:00.000Z'), '2026-12-05');
  assert.equal(normalizarFecha('2026-02-31'), null);
  assert.equal(normalizarFecha('05/12/2026'), null);
  assert.equal(normalizarFecha(undefined), null);
});

test('etapa del día: 3 antes, el día, 3 después (cruces de mes y bisiesto)', () => {
  const etapas = [-3, 0, 3];
  assert.equal(etapaDeHoy('2026-11-27', '2026-11-24', etapas), -3);
  assert.equal(etapaDeHoy('2026-11-27', '2026-11-27', etapas), 0);
  assert.equal(etapaDeHoy('2026-11-27', '2026-11-30', etapas), 3);
  assert.equal(etapaDeHoy('2026-11-27', '2026-11-25', etapas), null);
  assert.equal(etapaDeHoy('2026-12-01', '2026-11-28', etapas), -3);
  assert.equal(etapaDeHoy('2028-03-01', '2028-02-27', etapas), -3); // 2028 es bisiesto
  assert.equal(etapaDeHoy('2026-12-30', '2027-01-02', etapas), 3);
  assert.equal(diferenciaDias('2026-11-24', '2026-11-27'), 3);
  assert.equal(diasParaVencer('2026-11-27', '2026-11-24'), 3);
});

test('idempotencyKey determinística y etapas con nombre', () => {
  assert.equal(nombreEtapa(-3), 'd-3');
  assert.equal(nombreEtapa(0), 'd0');
  assert.equal(nombreEtapa(3), 'd+3');
  assert.equal(etapaManual('2026-11-24'), 'manual-2026-11-24');
  const k = idempotencyKey(CID, '2026-11-27', 'd-3');
  assert.equal(k, `pago:${CID}:2026-11-27:d-3`);
  assert.equal(k, idempotencyKey(CID, '2026-11-27', 'd-3'));
  assert.ok(k.length <= 100);
  assert.ok(esIdRecordatorioPago(k));
  assert.ok(esIdRecordatorioPago(idempotencyKey(CID, '2026-11-27', 'd+3')));
  assert.ok(esIdRecordatorioPago(idempotencyKey(CID, '2026-11-27', etapaManual('2026-11-24'))));
  assert.ok(!esIdRecordatorioPago('event_reminder:7:d7'));
  assert.ok(!esIdRecordatorioPago(`pago:${CID}:2026-11-27:d0;DROP`));
});

test('plantilla según días que faltan', () => {
  assert.equal(tipoPlantilla(3), 'antes');
  assert.equal(tipoPlantilla(0), 'hoy');
  assert.equal(tipoPlantilla(-3), 'despues');
});

test('evaluarCliente: a quién le toca y a quién no', () => {
  const etapas = [-3, 0, 3];
  const base = { clienteId: CID, nombre: 'Ana', telefono: '55 1234 5678', monto: 500, vencimiento: '2026-11-27' };
  assert.deepEqual(evaluarCliente(base, '2026-11-24', etapas), { vencimiento: '2026-11-27', offset: -3, etapa: 'd-3', dias: 3 });
  assert.equal(evaluarCliente(base, '2026-11-25', etapas), null);
  assert.equal(evaluarCliente({ ...base, vencimiento: undefined }, '2026-11-24', etapas), null);
  assert.equal(evaluarCliente({ ...base, telefono: '' }, '2026-11-24', etapas).omitir, 'Sin teléfono registrado');
  assert.equal(evaluarCliente({ ...base, telefono: '12345' }, '2026-11-24', etapas).omitir, 'Sin teléfono registrado');
  assert.ok(evaluarCliente({ ...base, monto: 0 }, '2026-11-24', etapas).omitir);
  assert.ok(tieneTelefono('+52 (55) 1234-5678'));
});

test('parámetros de plantilla con nombre, monto y fecha legibles', () => {
  assert.match(fechaLegible('2026-12-05'), /^sábado,? 5 de diciembre$/);
  assert.equal(primerNombre('CARLOS PÉREZ'), 'Carlos');
  const p = parametrosPlantilla({ nombre: 'maría josé', monto: 1450 }, '2026-12-05');
  assert.equal(p.body.nombre, 'María');
  assert.equal(p.body.monto, '$1,450');
  assert.match(p.body.fecha, /5 de diciembre/);
});

test('estados solo avanzan: enviado → entregado → leído, o fallido', () => {
  assert.ok(puedeAvanzar(ESTADO.ENVIANDO, ESTADO.ENVIADO));
  assert.ok(puedeAvanzar(ESTADO.ENVIADO, ESTADO.ENTREGADO));
  assert.ok(puedeAvanzar(ESTADO.ENTREGADO, ESTADO.LEIDO));
  assert.ok(puedeAvanzar(ESTADO.ENVIADO, ESTADO.LEIDO));     // 'read' sin 'delivered' previo
  assert.ok(puedeAvanzar(ESTADO.ENVIADO, ESTADO.FALLIDO));
  assert.ok(!puedeAvanzar(ESTADO.LEIDO, ESTADO.ENTREGADO));  // aviso tardío
  assert.ok(!puedeAvanzar(ESTADO.ENTREGADO, ESTADO.FALLIDO));
  assert.ok(!puedeAvanzar(ESTADO.FALLIDO, ESTADO.ENTREGADO));
  assert.ok(!puedeAvanzar(ESTADO.ENVIADO, ESTADO.ENVIADO));
  assert.ok(puedeAvanzar(undefined, ESTADO.ENVIADO));
  assert.ok(puedeAvanzar('Pendiente', ESTADO.ENVIADO));       // registros viejos
  assert.deepEqual(estadosPrevios(ESTADO.ENTREGADO), [ESTADO.ENVIANDO, ESTADO.ENVIADO]);
  assert.deepEqual(estadosPrevios(ESTADO.FALLIDO), [ESTADO.ENVIANDO, ESTADO.ENVIADO]);
  assert.deepEqual(estadosPrevios(ESTADO.LEIDO), [ESTADO.ENVIANDO, ESTADO.ENVIADO, ESTADO.ENTREGADO]);
});

test('pago del periodo: un pago exitoso en los 15 días previos al vencimiento cuenta', () => {
  const venc = '2026-11-27';
  assert.ok(pagoDelPeriodo([{ fecha: '2026-11-20T18:00:00.000Z', estado: 'Exitoso' }], venc));
  assert.ok(pagoDelPeriodo([{ fecha: '2026-11-29T18:00:00.000Z' }], venc));            // sin estado = Exitoso (default del esquema)
  assert.equal(pagoDelPeriodo([{ fecha: '2026-10-28T18:00:00.000Z', estado: 'Exitoso' }], venc), null); // periodo anterior
  assert.equal(pagoDelPeriodo([{ fecha: '2026-11-25T18:00:00.000Z', estado: 'Fallido' }], venc), null);
  assert.equal(pagoDelPeriodo([], venc), null);
});

test('configuración: opcional, nunca lanza, avisa lo que falta', () => {
  const vacia = parseMensajeroConfig({});
  assert.equal(vacia.envioDisponible, false);
  assert.equal(vacia.webhookDisponible, false);
  assert.deepEqual(vacia.etapas, [-3, 0, 3]);
  assert.deepEqual(vacia.hora, { h: 9, m: 0 });
  assert.ok(vacia.avisos.some((a) => a.includes('MENSAJERO_URL')));

  const completa = parseMensajeroConfig({
    MENSAJERO_URL: 'https://msg.example.test/v1/', MENSAJERO_API_KEY: 'msk_x', MENSAJERO_WEBHOOK_SECRET: 's',
    RECORDATORIO_PAGO_PLANTILLA_ANTES: 'a', RECORDATORIO_PAGO_PLANTILLA_HOY: 'h', RECORDATORIO_PAGO_PLANTILLA_DESPUES: 'd',
    RECORDATORIO_PAGO_HORA: '10:30', RECORDATORIO_PAGO_ETAPAS: '5, -5 ,0',
  });
  assert.equal(completa.url, 'https://msg.example.test');
  assert.equal(completa.envioDisponible, true);
  assert.deepEqual(completa.etapas, [-5, 0, 5]);
  assert.deepEqual(completa.hora, { h: 10, m: 30 });
  assert.equal('autoActivo' in completa, false, 'el interruptor no vive en env');

  const mala = parseMensajeroConfig({ MENSAJERO_URL: 'no es url', RECORDATORIO_PAGO_HORA: '25:00', RECORDATORIO_PAGO_ETAPAS: 'x' });
  assert.equal(mala.envioDisponible, false);
  assert.deepEqual(mala.hora, { h: 9, m: 0 });
  assert.equal(mala.avisos.length >= 3, true);

  // Solo se exigen plantillas de las etapas configuradas
  const soloAntes = parseMensajeroConfig({ MENSAJERO_URL: 'http://x.test', MENSAJERO_API_KEY: 'k', RECORDATORIO_PAGO_ETAPAS: '-3', RECORDATORIO_PAGO_PLANTILLA_ANTES: 'a' });
  assert.equal(soloAntes.envioDisponible, true);
  assert.equal(parseEtapas('-3,0,3,100'), null);
  assert.equal(parseHora('9:7'), null);
});
