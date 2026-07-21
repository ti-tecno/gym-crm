import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import env from './env.js';

const baseConfig = {
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
};

if (env.DYNAMODB_ENDPOINT) baseConfig.endpoint = env.DYNAMODB_ENDPOINT;

export const ddbClient = new DynamoDBClient(baseConfig);

export const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: { wrapNumbers: false },
});

export const TABLES = {
  USERS: `${env.DYNAMODB_TABLE_PREFIX}users`,
  CLIENTES: `${env.DYNAMODB_TABLE_PREFIX}clientes`,
  PLANES: `${env.DYNAMODB_TABLE_PREFIX}planes`,
  INSCRIPCIONES: `${env.DYNAMODB_TABLE_PREFIX}inscripciones`,
  MEMBRESIAS: `${env.DYNAMODB_TABLE_PREFIX}membresias`,
  PAGOS: `${env.DYNAMODB_TABLE_PREFIX}pagos`,
  PRODUCTOS: `${env.DYNAMODB_TABLE_PREFIX}productos`,
  VENTA_PEDIDOS: `${env.DYNAMODB_TABLE_PREFIX}venta_pedidos`,
  VENTA_DETALLES: `${env.DYNAMODB_TABLE_PREFIX}venta_detalles`,
  INVENTARIO: `${env.DYNAMODB_TABLE_PREFIX}inventario`,
  INVENTARIO_MOVIMIENTOS: `${env.DYNAMODB_TABLE_PREFIX}inventario_movimientos`,
  NOMINA: `${env.DYNAMODB_TABLE_PREFIX}nomina`,
  GASTOS: `${env.DYNAMODB_TABLE_PREFIX}gastos`,
  CREDITOS: `${env.DYNAMODB_TABLE_PREFIX}creditos`,
  CREDITO_ABONOS: `${env.DYNAMODB_TABLE_PREFIX}credito_abonos`,
  RUTINAS_CLIENTES: `${env.DYNAMODB_TABLE_PREFIX}rutinas_clientes`,
  RUTINAS_COACH: `${env.DYNAMODB_TABLE_PREFIX}rutinas_coach`,
  RECORDATORIOS: `${env.DYNAMODB_TABLE_PREFIX}recordatorios`,
  SETTINGS: `${env.DYNAMODB_TABLE_PREFIX}settings`,
  REFRESH_TOKENS: `${env.DYNAMODB_TABLE_PREFIX}refresh_tokens`,
  LOGIN_ATTEMPTS: `${env.DYNAMODB_TABLE_PREFIX}login_attempts`,
  // Portal CLIENTE — progreso
  WORKOUTS: `${env.DYNAMODB_TABLE_PREFIX}workouts`,
  MEDIDAS: `${env.DYNAMODB_TABLE_PREFIX}medidas`,
  PRS: `${env.DYNAMODB_TABLE_PREFIX}prs`,
};
