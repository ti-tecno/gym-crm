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
