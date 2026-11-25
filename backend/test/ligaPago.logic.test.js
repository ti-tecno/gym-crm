import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearTokenLiga, expiracionLiga, verificarTokenLiga } from '../src/services/ligaPago.logic.js';

const S = 'secreto-de-prueba-de-ligas-de-pago-0123';
const A = '0b9c8f1e-2d3a-4b5c-8d7e-6f5a4b3c2d1e';
const B = '11111111-2222-4333-8444-555555555555';

test('liga: token válido, seguro para URL, identifica al cliente y expira', () => {
  const exp = expiracionLiga('2026-11-27', '2026-11-24');
  assert.equal(exp, '2027-02-10'); // vencimiento + 75 días
  const t = crearTokenLiga(A, exp, S);
  assert.match(t, /^[A-Za-z0-9_-]{47}$/);
  assert.equal(encodeURIComponent(t), t);
  assert.equal(verificarTokenLiga(t, S, '2026-11-24'), A);
  assert.equal(verificarTokenLiga(t, S, '2027-02-10'), A);
  assert.equal(verificarTokenLiga(t, S, '2027-02-11'), null); // expirado
  // Ya vencido hace mucho: la liga cuenta desde hoy
  assert.equal(expiracionLiga('2026-01-01', '2026-11-24'), '2027-02-07');
});

test('liga: alterada, de otro secreto, mal formada o con otro cliente no sirve', () => {
  const t = crearTokenLiga(A, '2027-01-01', S);
  // Cambiar un carácter del clienteId o de la firma
  for (const i of [3, 10, 30, 46]) {
    const c = t[i] === 'A' ? 'B' : 'A';
    assert.equal(verificarTokenLiga(t.slice(0, i) + c + t.slice(i + 1), S, '2026-11-24'), null, `posición ${i}`);
  }
  assert.equal(verificarTokenLiga(t, 'otro-secreto-de-prueba-de-ligas-00000', '2026-11-24'), null);
  // Intento de "liga de otro cliente": se copia la firma de A sobre el id de B
  const tb = crearTokenLiga(B, '2027-01-01', S);
  const falso = tb.slice(0, 25) + t.slice(25);
  assert.notEqual(verificarTokenLiga(falso, S, '2026-11-24'), A);
  assert.equal(verificarTokenLiga(falso, S, '2026-11-24'), null);
  assert.equal(verificarTokenLiga(tb, S, '2026-11-24'), B);
  for (const malo of ['', 'abc', t + 'x', t.slice(1), t.replace(/./, '*'), null, 42, '../../etc/passwd']) {
    assert.equal(verificarTokenLiga(malo, S, '2026-11-24'), null);
  }
  assert.equal(verificarTokenLiga(t, '', '2026-11-24'), null);
  assert.equal(crearTokenLiga('no-uuid', '2027-01-01', S), null);
  assert.equal(crearTokenLiga(A, '2027-01-01', ''), null);
});
