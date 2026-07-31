import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

export async function listRutinasClientes() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.RUTINAS_CLIENTES }));
  return Items;
}

export async function getRutinaCliente(id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.RUTINAS_CLIENTES, Key: { rutinaId: id } }));
  return Item || null;
}

export async function upsertRutinaCliente(data) {
  const item = { ...data, rutinaId: data.rutinaId || uuid(), updatedAt: new Date().toISOString() };
  await ddb.send(new PutCommand({ TableName: TABLES.RUTINAS_CLIENTES, Item: item }));
  return item;
}

export async function listRutinasCoach() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.RUTINAS_COACH }));
  return Items;
}

export async function getRutinaCoach(id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.RUTINAS_COACH, Key: { rutinaId: id } }));
  return Item || null;
}

export async function createRutinaCoach(data) {
  const item = { rutinaId: uuid(), updatedAt: new Date().toISOString(), ...data };
  await ddb.send(new PutCommand({ TableName: TABLES.RUTINAS_COACH, Item: item }));
  return item;
}

export async function updateRutinaCoach(id, patch) {
  const current = await getRutinaCoach(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await ddb.send(new PutCommand({ TableName: TABLES.RUTINAS_COACH, Item: next }));
  return next;
}

export async function deleteRutinaCoach(id) {
  await ddb.send(new DeleteCommand({
    TableName: TABLES.RUTINAS_COACH, Key: { rutinaId: id },
    ConditionExpression: 'attribute_exists(rutinaId)',
  }));
}
