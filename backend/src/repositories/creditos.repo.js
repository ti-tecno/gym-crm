import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

// Los créditos importados del workbook legacy sólo tienen clienteId (FK real a
// gym_clientes); los capturados a mano desde este módulo guardan el nombre
// directo en legacyUsuario. Resolvemos ambos a un único campo `cliente` de salida.
async function resolveNombre(item, cache) {
  if (item.legacyUsuario) return item.legacyUsuario;
  if (!item.clienteId) return null;
  if (cache.has(item.clienteId)) return cache.get(item.clienteId);
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.CLIENTES, Key: { clienteId: item.clienteId } }));
  const nombre = Item?.nombre || null;
  cache.set(item.clienteId, nombre);
  return nombre;
}

export async function listCreditos() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.CREDITOS }));
  const cache = new Map();
  const withNombre = await Promise.all(
    Items.map(async (it) => ({ ...it, cliente: (await resolveNombre(it, cache)) || 'Sin nombre' })),
  );
  return withNombre.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}

export async function getCredito(id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.CREDITOS, Key: { creditoId: id } }));
  return Item || null;
}

export async function createCredito(data) {
  const item = {
    creditoId: uuid(),
    createdAt: new Date().toISOString(),
    estado: data.saldoPendiente > 0 ? 'Pendiente' : 'Pagado',
    ...data,
  };
  await ddb.send(new PutCommand({ TableName: TABLES.CREDITOS, Item: item }));
  return item;
}

export async function updateCredito(id, patch) {
  const current = await getCredito(id);
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  if (patch.saldoPendiente !== undefined && patch.estado === undefined) {
    next.estado = patch.saldoPendiente > 0 ? 'Pendiente' : 'Pagado';
  }
  await ddb.send(new PutCommand({ TableName: TABLES.CREDITOS, Item: next }));
  return next;
}

export async function deleteCredito(id) {
  await ddb.send(new DeleteCommand({
    TableName: TABLES.CREDITOS, Key: { creditoId: id },
    ConditionExpression: 'attribute_exists(creditoId)',
  }));
}
