import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

export async function listIngresos() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.INGRESOS }));
  return Items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}

export async function getIngreso(id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.INGRESOS, Key: { ingresoId: id } }));
  return Item || null;
}

export async function createIngreso(data) {
  const item = {
    ingresoId: uuid(),
    categoria: 'General',
    createdAt: new Date().toISOString(),
    ...data,
  };
  await ddb.send(new PutCommand({ TableName: TABLES.INGRESOS, Item: item }));
  return item;
}

export async function updateIngreso(id, patch) {
  const current = await getIngreso(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await ddb.send(new PutCommand({ TableName: TABLES.INGRESOS, Item: next }));
  return next;
}

export async function deleteIngreso(id) {
  await ddb.send(new DeleteCommand({
    TableName: TABLES.INGRESOS, Key: { ingresoId: id },
    ConditionExpression: 'attribute_exists(ingresoId)',
  }));
}
