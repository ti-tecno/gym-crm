import { PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
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

export async function createPago(data) {
  const now = new Date();
  const item = {
    pagoId: 'TXN-' + Date.now().toString().slice(-6),
    fecha: now.toISOString(),
    createdAt: now.toISOString(),
    ...data,
  };
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
