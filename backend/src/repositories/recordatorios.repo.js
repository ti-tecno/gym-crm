import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

export async function listRecordatorios() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.RECORDATORIOS }));
  return Items;
}

export async function getRecordatorio(id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.RECORDATORIOS, Key: { recordatorioId: id } }));
  return Item || null;
}

export async function createRecordatorio(data) {
  const item = { recordatorioId: uuid(), createdAt: new Date().toISOString(), ...data };
  await ddb.send(new PutCommand({ TableName: TABLES.RECORDATORIOS, Item: item }));
  return item;
}

export async function updateRecordatorio(id, patch) {
  const fields = Object.keys(patch);
  if (!fields.length) return getRecordatorio(id);
  const names = {};
  const values = { ':now': new Date().toISOString() };
  const sets = fields.map((k, i) => { names[`#k${i}`] = k; values[`:v${i}`] = patch[k]; return `#k${i} = :v${i}`; });
  sets.push('updatedAt = :now');
  const { Attributes } = await ddb.send(new UpdateCommand({
    TableName: TABLES.RECORDATORIOS,
    Key: { recordatorioId: id },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return Attributes;
}

// ── Recordatorio de pago por WhatsApp ────────────────────────────────────────
// Cada envío usa como recordatorioId su idempotencyKey (`pago:<clienteId>:<venc>:<etapa>`),
// así se encuentra con GetCommand sin índices nuevos. Los registros viejos (uuid, sin
// `origen`) se quedan como están.

export async function listRecordatoriosPago() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLES.RECORDATORIOS,
      FilterExpression: '#o = :o',
      ExpressionAttributeNames: { '#o': 'origen' },
      ExpressionAttributeValues: { ':o': 'pago' },
      ExclusiveStartKey,
    }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

const esCondicional = (err) => err?.name === 'ConditionalCheckFailedException';

function setExpr(campos, values, names, prefijo = 'f') {
  return Object.entries(campos).filter(([, v]) => v !== undefined).map(([k, v], i) => {
    names[`#${prefijo}${i}`] = k; values[`:${prefijo}${i}`] = v; return `#${prefijo}${i} = :${prefijo}${i}`;
  });
}

/**
 * Marca el intento como 'Enviando' antes de llamar al mensajero (si el proceso muere a la
 * mitad, la siguiente corrida reintenta con la misma llave y el mensajero no duplica).
 * Devuelve null si el recordatorio ya estaba enviado/entregado/leído.
 */
export async function iniciarEnvioPago(id, datos, estadosExitosos) {
  const now = new Date().toISOString();
  const names = { '#e': 'estado', '#c': 'createdAt', '#i': 'intentos', '#u': 'updatedAt' };
  const values = { ':enviando': 'Enviando', ':now': now, ':cero': 0, ':uno': 1 };
  const sets = setExpr(datos, values, names);
  sets.push('#e = :enviando', '#c = if_not_exists(#c, :now)', '#i = if_not_exists(#i, :cero) + :uno', '#u = :now');
  const exitosos = estadosExitosos.map((e, i) => { values[`:x${i}`] = e; return `:x${i}`; });
  try {
    const { Attributes } = await ddb.send(new UpdateCommand({
      TableName: TABLES.RECORDATORIOS,
      Key: { recordatorioId: id },
      UpdateExpression: 'SET ' + sets.join(', ') + ' REMOVE motivoFalla',
      ConditionExpression: `attribute_not_exists(recordatorioId) OR NOT (#e IN (${exitosos.join(', ')}))`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));
    return Attributes;
  } catch (err) {
    if (esCondicional(err)) return null;
    throw err;
  }
}

/**
 * Guarda el resultado del envío. El estado solo se escribe si el actual está en
 * `estadosPrevios` (un webhook rápido pudo haberlo adelantado a Entregado); el resto de
 * los campos se guarda siempre.
 */
export async function registrarResultadoPago(id, { estado, estadosPrevios, ...campos }) {
  const now = new Date().toISOString();
  const quitar = campos.motivoFalla == null ? ' REMOVE motivoFalla' : '';
  if (campos.motivoFalla == null) delete campos.motivoFalla;

  const armar = (conEstado) => {
    const names = { '#u': 'updatedAt' };
    const values = { ':now': now };
    const sets = setExpr(campos, values, names);
    sets.push('#u = :now');
    const params = {
      TableName: TABLES.RECORDATORIOS,
      Key: { recordatorioId: id },
      UpdateExpression: '',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    };
    if (conEstado) {
      names['#e'] = 'estado';
      values[':estado'] = estado;
      sets.push('#e = :estado');
      const prev = estadosPrevios.map((e, i) => { values[`:p${i}`] = e; return `:p${i}`; });
      params.ConditionExpression = prev.length ? `#e IN (${prev.join(', ')})` : 'attribute_exists(recordatorioId)';
    }
    params.UpdateExpression = 'SET ' + sets.join(', ') + (conEstado ? quitar : '');
    return params;
  };

  try {
    const { Attributes } = await ddb.send(new UpdateCommand(armar(true)));
    return Attributes;
  } catch (err) {
    if (!esCondicional(err)) throw err;
    const { Attributes } = await ddb.send(new UpdateCommand(armar(false)));
    return Attributes;
  }
}

/**
 * Avance de estado desde el webhook del mensajero. Solo aplica si el registro es de ese
 * mensaje (o aún no tiene mensajeId) y el estado actual puede avanzar al nuevo.
 * Devuelve true si cambió algo.
 */
export async function avanzarEstadoPago(id, { mensajeId, estado, estadosPrevios, motivoFalla }) {
  if (!estadosPrevios.length) return false;
  const names = { '#e': 'estado', '#m': 'mensajeId', '#u': 'updatedAt' };
  const values = { ':estado': estado, ':mid': mensajeId, ':now': new Date().toISOString() };
  const sets = ['#e = :estado', '#m = :mid', '#u = :now'];
  if (motivoFalla) { names['#f'] = 'motivoFalla'; values[':f'] = motivoFalla; sets.push('#f = :f'); }
  const prev = estadosPrevios.map((e, i) => { values[`:p${i}`] = e; return `:p${i}`; });
  try {
    await ddb.send(new UpdateCommand({
      TableName: TABLES.RECORDATORIOS,
      Key: { recordatorioId: id },
      UpdateExpression: 'SET ' + sets.join(', '),
      ConditionExpression: `attribute_exists(recordatorioId) AND (#m = :mid OR attribute_not_exists(#m)) AND #e IN (${prev.join(', ')})`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
    return true;
  } catch (err) {
    if (esCondicional(err)) return false;
    throw err;
  }
}
