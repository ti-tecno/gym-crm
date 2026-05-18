import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

function calcEstado(cantidad, minimo) {
  if (cantidad < minimo / 2) return 'Crítico';
  if (cantidad <= minimo)    return 'Bajo';
  return 'OK';
}

export async function listInventario() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.INVENTARIO }));
  return Items;
}

export async function getItem(id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.INVENTARIO, Key: { itemId: id } }));
  return Item || null;
}

export async function createItem(data) {
  const item = {
    itemId: uuid(),
    createdAt: new Date().toISOString(),
    ...data,
    estado: calcEstado(data.cantidad, data.minimo),
  };
  await ddb.send(new PutCommand({ TableName: TABLES.INVENTARIO, Item: item }));
  return item;
}

export async function updateItem(id, patch) {
  const current = await getItem(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  next.estado = calcEstado(next.cantidad ?? current.cantidad, next.minimo ?? current.minimo);
  next.updatedAt = new Date().toISOString();
  await ddb.send(new PutCommand({ TableName: TABLES.INVENTARIO, Item: next }));
  return next;
}

export async function deleteItem(id) {
  await ddb.send(new DeleteCommand({
    TableName: TABLES.INVENTARIO, Key: { itemId: id },
    ConditionExpression: 'attribute_exists(itemId)',
  }));
}
