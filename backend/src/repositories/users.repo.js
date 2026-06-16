import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';

export async function getUserById(userId) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.USERS, Key: { userId } }));
  return Item || null;
}

export async function getUserByEmail(email) {
  const { Items } = await ddb.send(new QueryCommand({
    TableName: TABLES.USERS,
    IndexName: 'email-index',
    KeyConditionExpression: '#e = :e',
    ExpressionAttributeNames: { '#e': 'email' },
    ExpressionAttributeValues: { ':e': email.toLowerCase() },
    Limit: 1,
  }));
  return Items?.[0] || null;
}

export async function createUser(user) {
  await ddb.send(new PutCommand({
    TableName: TABLES.USERS,
    Item: user,
    ConditionExpression: 'attribute_not_exists(userId)',
  }));
  return user;
}

export async function incrementFailedAttempts(userId) {
  await ddb.send(new UpdateCommand({
    TableName: TABLES.USERS,
    Key: { userId },
    UpdateExpression: 'SET failedAttempts = if_not_exists(failedAttempts, :zero) + :one, lastFailedAt = :now',
    ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': new Date().toISOString() },
  }));
}

export async function resetFailedAttempts(userId) {
  await ddb.send(new UpdateCommand({
    TableName: TABLES.USERS,
    Key: { userId },
    UpdateExpression: 'SET failedAttempts = :zero REMOVE lockedUntil',
    ExpressionAttributeValues: { ':zero': 0 },
  }));
}

export async function lockUser(userId, untilIso) {
  await ddb.send(new UpdateCommand({
    TableName: TABLES.USERS,
    Key: { userId },
    UpdateExpression: 'SET lockedUntil = :u',
    ExpressionAttributeValues: { ':u': untilIso },
  }));
}
