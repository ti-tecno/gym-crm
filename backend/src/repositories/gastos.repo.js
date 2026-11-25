import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

export async function listGastos() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.GASTOS }));
  return Items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}

export async function getGasto(id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.GASTOS, Key: { gastoId: id } }));
  return Item || null;
}

export async function createGasto(data) {
  const item = {
    gastoId: uuid(),
    categoria: 'General',
    createdAt: new Date().toISOString(),
    ...data,
  };
  await ddb.send(new PutCommand({ TableName: TABLES.GASTOS, Item: item }));
  return item;
}

export async function updateGasto(id, patch) {
  const current = await getGasto(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await ddb.send(new PutCommand({ TableName: TABLES.GASTOS, Item: next }));
  return next;
}

export async function deleteGasto(id) {
  await ddb.send(new DeleteCommand({
    TableName: TABLES.GASTOS, Key: { gastoId: id },
    ConditionExpression: 'attribute_exists(gastoId)',
  }));
}
