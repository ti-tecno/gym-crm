import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
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
  const item = { rutinaId: data.rutinaId || uuid(), updatedAt: new Date().toISOString(), ...data };
  await ddb.send(new PutCommand({ TableName: TABLES.RUTINAS_CLIENTES, Item: item }));
  return item;
}

export async function listRutinasCoach() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.RUTINAS_COACH }));
  return Items;
}

export async function upsertRutinaCoach(data) {
  const item = { rutinaId: data.rutinaId || uuid(), updatedAt: new Date().toISOString(), ...data };
  await ddb.send(new PutCommand({ TableName: TABLES.RUTINAS_COACH, Item: item }));
  return item;
}
