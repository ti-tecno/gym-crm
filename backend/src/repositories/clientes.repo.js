import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

export async function getClienteByEmail(email) {
  const { Items } = await ddb.send(new QueryCommand({
    TableName: TABLES.CLIENTES,
    IndexName: 'email-index',
    KeyConditionExpression: '#e = :e',
    ExpressionAttributeNames: { '#e': 'email' },
    ExpressionAttributeValues: { ':e': email.toLowerCase() },
    Limit: 1,
  }));
  return Items?.[0] || null;
}

export async function listClientes({ q, plan, estado, limit = 50 } = {}) {
  const expr = [];
  const names = {};
  const values = {};
  if (plan)   { expr.push('#p = :p'); names['#p'] = 'plan';   values[':p'] = plan; }
  if (estado) { expr.push('#s = :s'); names['#s'] = 'estado'; values[':s'] = estado; }
  if (q)      { expr.push('contains(#n, :q)'); names['#n'] = 'nombre'; values[':q'] = q; }

  const params = { TableName: TABLES.CLIENTES, Limit: limit };
  if (expr.length) {
    params.FilterExpression = expr.join(' AND ');
    params.ExpressionAttributeNames = names;
    params.ExpressionAttributeValues = values;
  }
  const { Items = [] } = await ddb.send(new ScanCommand(params));
  return Items;
}

export async function getCliente(id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.CLIENTES, Key: { clienteId: id } }));
  return Item || null;
}

export async function createCliente(data) {
  const item = { clienteId: uuid(), createdAt: new Date().toISOString(), ...data };
  await ddb.send(new PutCommand({
    TableName: TABLES.CLIENTES,
    Item: item,
    ConditionExpression: 'attribute_not_exists(clienteId)',
  }));
  return item;
}

export async function updateCliente(id, patch) {
  const fields = Object.keys(patch);
  if (!fields.length) return getCliente(id);
  const names = {};
  const values = { ':now': new Date().toISOString() };
  const sets = fields.map((k, i) => { names[`#k${i}`] = k; values[`:v${i}`] = patch[k]; return `#k${i} = :v${i}`; });
  sets.push('updatedAt = :now');
  const { Attributes } = await ddb.send(new UpdateCommand({
    TableName: TABLES.CLIENTES,
    Key: { clienteId: id },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
    ConditionExpression: 'attribute_exists(clienteId)',
  }));
  return Attributes;
}

export async function deleteCliente(id) {
  await ddb.send(new DeleteCommand({
    TableName: TABLES.CLIENTES, Key: { clienteId: id },
    ConditionExpression: 'attribute_exists(clienteId)',
  }));
}
