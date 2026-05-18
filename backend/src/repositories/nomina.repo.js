import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

export async function listEmpleados() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.NOMINA }));
  return Items;
}

export async function getEmpleado(id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.NOMINA, Key: { empleadoId: id } }));
  return Item || null;
}

export async function createEmpleado(data) {
  const item = { empleadoId: uuid(), createdAt: new Date().toISOString(), ...data };
  await ddb.send(new PutCommand({ TableName: TABLES.NOMINA, Item: item }));
  return item;
}

export async function setEmpleadoEstado(id, estado) {
  const { Attributes } = await ddb.send(new UpdateCommand({
    TableName: TABLES.NOMINA, Key: { empleadoId: id },
    UpdateExpression: 'SET #s = :s, updatedAt = :now',
    ExpressionAttributeNames: { '#s': 'estado' },
    ExpressionAttributeValues: { ':s': estado, ':now': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
    ConditionExpression: 'attribute_exists(empleadoId)',
  }));
  return Attributes;
}
