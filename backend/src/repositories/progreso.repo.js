/**
 * Repositorio de progreso del cliente.
 * Tres tablas: workouts (sesiones de entrenamiento), medidas (antropométricas), prs (records personales).
 * Todas las consultas se hacen por clienteId vía GSI clienteId-fecha.
 */
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { ddb, TABLES } from '../config/dynamo.js';

// ────────── WORKOUTS ──────────
export async function createWorkout(data) {
  const item = {
    workoutId: uuid(),
    createdAt: new Date().toISOString(),
    ...data,
  };
  await ddb.send(new PutCommand({ TableName: TABLES.WORKOUTS, Item: item }));
  return item;
}

export async function listWorkoutsByCliente(clienteId, { limit = 50, desde, hasta } = {}) {
  const params = {
    TableName: TABLES.WORKOUTS,
    IndexName: 'clienteId-fecha-index',
    KeyConditionExpression: '#c = :c',
    ExpressionAttributeNames: { '#c': 'clienteId' },
    ExpressionAttributeValues: { ':c': clienteId },
    ScanIndexForward: false,
    Limit: limit,
  };
  if (desde && hasta) {
    params.KeyConditionExpression += ' AND #f BETWEEN :d AND :h';
    params.ExpressionAttributeNames['#f'] = 'fecha';
    params.ExpressionAttributeValues[':d'] = desde;
    params.ExpressionAttributeValues[':h'] = hasta;
  }
  const { Items = [] } = await ddb.send(new QueryCommand(params));
  return Items;
}

export async function getWorkout(workoutId, clienteId) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.WORKOUTS, Key: { workoutId } }));
  if (!Item || Item.clienteId !== clienteId) return null; // ownership check
  return Item;
}

// ────────── MEDIDAS ──────────
export async function createMedida(data) {
  const item = {
    medidaId: uuid(),
    createdAt: new Date().toISOString(),
    ...data,
  };
  await ddb.send(new PutCommand({ TableName: TABLES.MEDIDAS, Item: item }));
  return item;
}

export async function listMedidasByCliente(clienteId, { limit = 100 } = {}) {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TABLES.MEDIDAS,
    IndexName: 'clienteId-fecha-index',
    KeyConditionExpression: '#c = :c',
    ExpressionAttributeNames: { '#c': 'clienteId' },
    ExpressionAttributeValues: { ':c': clienteId },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return Items;
}

// ────────── PRs (Personal Records) ──────────
export async function listPRsByCliente(clienteId) {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TABLES.PRS,
    IndexName: 'clienteId-ejercicio-index',
    KeyConditionExpression: '#c = :c',
    ExpressionAttributeNames: { '#c': 'clienteId' },
    ExpressionAttributeValues: { ':c': clienteId },
  }));
  return Items;
}

export async function getPR(clienteId, ejercicio) {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TABLES.PRS,
    IndexName: 'clienteId-ejercicio-index',
    KeyConditionExpression: '#c = :c AND #e = :e',
    ExpressionAttributeNames: { '#c': 'clienteId', '#e': 'ejercicio' },
    ExpressionAttributeValues: { ':c': clienteId, ':e': ejercicio },
    Limit: 1,
  }));
  return Items[0] || null;
}

export async function upsertPR(data) {
  // data: { clienteId, ejercicio, pesoMax, repsMax, fechaPR, workoutId }
  const existing = await getPR(data.clienteId, data.ejercicio);
  const isNew = !existing
    || data.pesoMax > (existing.pesoMax || 0)
    || (data.pesoMax === (existing.pesoMax || 0) && data.repsMax > (existing.repsMax || 0));

  if (!isNew) return { record: existing, isNew: false };

  const item = {
    prId: existing?.prId || uuid(),
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: TABLES.PRS, Item: item }));
  return { record: item, isNew: true };
}

/**
 * Recalcula y actualiza PRs a partir de un workout recién creado.
 * Devuelve la lista de PRs nuevos (para mostrar "¡Nuevo récord!").
 */
export async function recalcPRsFromWorkout(workout) {
  const newPRs = [];
  for (const ej of (workout.ejercicios || [])) {
    const pesoMax = Math.max(0, ...(ej.series || []).map((s) => Number(s.peso || 0)));
    const repsMax = Math.max(0, ...(ej.series || []).map((s) => Number(s.reps || 0)));
    if (!ej.nombre || (pesoMax === 0 && repsMax === 0)) continue;
    const { record, isNew } = await upsertPR({
      clienteId: workout.clienteId,
      ejercicio: ej.nombre,
      pesoMax, repsMax,
      fechaPR: workout.fecha,
      workoutId: workout.workoutId,
    });
    if (isNew) newPRs.push(record);
  }
  return newPRs;
}

/** Calcula la racha actual de días consecutivos con al menos un workout. */
export function calcRacha(workouts) {
  if (!workouts?.length) return 0;
  const fechas = [...new Set(workouts.map((w) => w.fecha))].sort().reverse();
  let racha = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const f of fechas) {
    const d = new Date(f); d.setHours(0, 0, 0, 0);
    const diff = Math.round((cursor - d) / 86_400_000);
    if (diff === 0 || diff === racha) { racha += 1; cursor = d; }
    else break;
  }
  return racha;
}
