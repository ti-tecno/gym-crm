import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';

/** Almacena el jti del refresh token; TTL maneja expiración. */
export async function saveRefresh({ jti, userId, expiresAt }) {
  await ddb.send(new PutCommand({
    TableName: TABLES.REFRESH_TOKENS,
    Item: { jti, userId, expiresAt: Math.floor(expiresAt / 1000) }, // TTL en segundos
  }));
}

export async function getRefresh(jti) {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLES.REFRESH_TOKENS, Key: { jti } }));
  return Item || null;
}

export async function revokeRefresh(jti) {
  await ddb.send(new DeleteCommand({ TableName: TABLES.REFRESH_TOKENS, Key: { jti } }));
}
