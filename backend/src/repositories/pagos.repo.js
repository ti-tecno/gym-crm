import { GetCommand, PutCommand, QueryCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

export async function listPagos({ clienteId, limit = 20 } = {}) {
  if (clienteId) {
    const { Items = [] } = await ddb.send(new QueryCommand({
      TableName: TABLES.PAGOS,
      IndexName: 'clienteId-fecha-index',
      KeyConditionExpression: '#c = :c',
      ExpressionAttributeNames: { '#c': 'clienteId' },
      ExpressionAttributeValues: { ':c': clienteId },
      ScanIndexForward: false,
      Limit: limit,
    }));
    return Items;
  }
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.PAGOS, Limit: limit }));
  return Items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, limit);
}

export async function getPago(pagoId) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.PAGOS, Key: { pagoId }, ConsistentRead: true }));
  return Item || null;
}

/** Alta simple (pago Pendiente del checkout). Lanza ConditionalCheckFailedException si el folio existe. */
export async function createPago(item) {
  await ddb.send(new PutCommand({
    TableName: TABLES.PAGOS,
    Item: item,
    ConditionExpression: 'attribute_not_exists(pagoId)',
  }));
  return item;
}

export async function bulkCreatePagos(items) {
  // En escenarios grandes usar BatchWrite con 25 items por lote
  for (const it of items) {
    await ddb.send(new PutCommand({ TableName: TABLES.PAGOS, Item: { pagoId: uuid(), ...it } }));
  }
}

// ── Escrituras condicionales (idempotencia y concurrencia) ─────────────────────

function sets(campos, names, values, prefijo) {
  return Object.entries(campos).filter(([, v]) => v !== undefined).map(([k, v], i) => {
    names[`#${prefijo}${i}`] = k; values[`:${prefijo}${i}`] = v; return `#${prefijo}${i} = :${prefijo}${i}`;
  });
}

function opPago({ pagoId, nuevo, esperado, set = {}, quitar = [] }) {
  if (nuevo) {
    return { Put: { TableName: TABLES.PAGOS, Item: nuevo, ConditionExpression: 'attribute_not_exists(pagoId)' } };
  }
  const names = { '#e': 'estado', '#mp': 'mpPaymentId', '#u': 'updatedAt' };
  const values = { ':e': esperado.estado, ':now': new Date().toISOString() };
  const s = sets(set, names, values, 'p');
  s.push('#u = :now');
  const cond = ['attribute_exists(pagoId)', '#e = :e'];
  if (esperado.mpPaymentId == null) cond.push('attribute_not_exists(#mp)');
  else { values[':mp'] = esperado.mpPaymentId; cond.push('#mp = :mp'); }
  if (esperado.sinRenovacion) { names['#r'] = 'renovacion'; cond.push('attribute_not_exists(#r)'); }
  const rem = quitar.map((k, i) => { names[`#q${i}`] = k; return `#q${i}`; });
  return {
    Update: {
      TableName: TABLES.PAGOS,
      Key: { pagoId },
      UpdateExpression: 'SET ' + s.join(', ') + (rem.length ? ' REMOVE ' + rem.join(', ') : ''),
      ConditionExpression: cond.join(' AND '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    },
  };
}

function opCliente({ clienteId, vencimientoPrevio, set }) {
  const names = { '#v': 'vencimiento', '#u': 'updatedAt' };
  const values = { ':now': new Date().toISOString() };
  const s = sets(set, names, values, 'c');
  s.push('#u = :now');
  // Bloqueo optimista: solo si nadie movió el vencimiento desde que se leyó.
  let cond = 'attribute_exists(clienteId) AND ';
  if (vencimientoPrevio == null) cond += 'attribute_not_exists(#v)';
  else { values[':vp'] = vencimientoPrevio; cond += '#v = :vp'; }
  return {
    Update: {
      TableName: TABLES.CLIENTES,
      Key: { clienteId },
      UpdateExpression: 'SET ' + s.join(', '),
      ConditionExpression: cond,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    },
  };
}

/**
 * Guarda un pago (alta `nuevo` o cambio condicionado a `esperado`) y, si se pasa `cliente`,
 * mueve su vencimiento en la MISMA transacción: o se aplican ambos o ninguno.
 *
 * - nuevo:    item completo; falla si el pagoId ya existe.
 * - esperado: { estado, mpPaymentId (null = sin ligar), sinRenovacion } leídos antes.
 * - cliente:  { clienteId, vencimientoPrevio (tal como se leyó, null si no tenía), set }.
 *
 * @returns {{ ok: true } | { ok: false, conflicto: 'pago'|'cliente' }}
 */
export async function guardarPago({ pagoId, nuevo, esperado, set, quitar, cliente }) {
  const pago = opPago({ pagoId, nuevo, esperado, set, quitar });
  try {
    if (!cliente) {
      if (pago.Put) await ddb.send(new PutCommand(pago.Put));
      else await ddb.send(new UpdateCommand(pago.Update));
      return { ok: true };
    }
    await ddb.send(new TransactWriteCommand({ TransactItems: [pago, opCliente(cliente)] }));
    return { ok: true };
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') return { ok: false, conflicto: 'pago' };
    if (err?.name === 'TransactionCanceledException') {
      const r = err.CancellationReasons || [];
      if (r[0]?.Code === 'ConditionalCheckFailed') return { ok: false, conflicto: 'pago' };
      if (r[1]?.Code === 'ConditionalCheckFailed') return { ok: false, conflicto: 'cliente' };
      // TransactionConflict: otra transacción tocaba los mismos registros; se reintenta.
      if (r.some((x) => x?.Code === 'TransactionConflict')) return { ok: false, conflicto: 'cliente' };
    }
    throw err;
  }
}

/** Marca un pago para revisión manual sin cambiar su estado (idempotente). */
export async function marcarRevision(pagoId, motivo, extra = {}) {
  const names = { '#r': 'requiereRevision', '#m': 'revisionMotivo', '#u': 'updatedAt' };
  const values = { ':t': true, ':m': motivo, ':now': new Date().toISOString() };
  const s = ['#r = :t', '#m = :m', '#u = :now', ...sets(extra, names, values, 'x')];
  await ddb.send(new UpdateCommand({
    TableName: TABLES.PAGOS,
    Key: { pagoId },
    UpdateExpression: 'SET ' + s.join(', '),
    ConditionExpression: 'attribute_exists(pagoId)',
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}
