import { CreateTableCommand, DeleteTableCommand, DescribeTableCommand, UpdateTimeToLiveCommand, waitUntilTableExists, waitUntilTableNotExists } from '@aws-sdk/client-dynamodb';
import { ddbClient, TABLES } from '../config/dynamo.js';

const recreate = process.argv.includes('--recreate');

const tableDefs = [
  {
    TableName: TABLES.USERS,
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email',  AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'email-index',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.REFRESH_TOKENS,
    KeySchema: [{ AttributeName: 'jti', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'jti', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    _ttl: 'expiresAt',
  },
  {
    TableName: TABLES.CLIENTES,
    KeySchema: [{ AttributeName: 'clienteId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'email',     AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'email-index',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.PAGOS,
    KeySchema: [{ AttributeName: 'pagoId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'pagoId',    AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'fecha',     AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'clienteId-fecha-index',
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'fecha',     KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.INVENTARIO,
    KeySchema: [{ AttributeName: 'itemId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'itemId', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.NOMINA,
    KeySchema: [{ AttributeName: 'empleadoId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'empleadoId', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.RUTINAS_CLIENTES,
    KeySchema: [{ AttributeName: 'rutinaId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'rutinaId', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.RUTINAS_COACH,
    KeySchema: [{ AttributeName: 'rutinaId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'rutinaId', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.RECORDATORIOS,
    KeySchema: [{ AttributeName: 'recordatorioId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'recordatorioId', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.SETTINGS,
    KeySchema: [{ AttributeName: 'settingsId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'settingsId', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  // ── Portal CLIENTE: progreso ──
  {
    TableName: TABLES.WORKOUTS,
    KeySchema: [{ AttributeName: 'workoutId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'workoutId', AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'fecha',     AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'clienteId-fecha-index',
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'fecha',     KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.MEDIDAS,
    KeySchema: [{ AttributeName: 'medidaId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'medidaId',  AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'fecha',     AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'clienteId-fecha-index',
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'fecha',     KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.PRS,
    KeySchema: [{ AttributeName: 'prId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'prId',      AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'ejercicio', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'clienteId-ejercicio-index',
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'ejercicio', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
];

async function exists(name) {
  try { await ddbClient.send(new DescribeTableCommand({ TableName: name })); return true; }
  catch (e) { if (e.name === 'ResourceNotFoundException') return false; throw e; }
}

async function dropTable(name) {
  console.log(`  ✗ Borrando ${name}`);
  await ddbClient.send(new DeleteTableCommand({ TableName: name }));
  await waitUntilTableNotExists({ client: ddbClient, maxWaitTime: 60 }, { TableName: name });
}

async function createOne(def) {
  const { _ttl, ...input } = def;
  if (await exists(def.TableName)) {
    if (recreate) await dropTable(def.TableName);
    else { console.log(`  • ${def.TableName} ya existe`); return; }
  }
  console.log(`  ✓ Creando ${def.TableName}`);
  await ddbClient.send(new CreateTableCommand(input));
  await waitUntilTableExists({ client: ddbClient, maxWaitTime: 60 }, { TableName: def.TableName });
  if (_ttl) {
    await ddbClient.send(new UpdateTimeToLiveCommand({
      TableName: def.TableName,
      TimeToLiveSpecification: { AttributeName: _ttl, Enabled: true },
    })).catch((e) => console.warn(`    (TTL no aplicado: ${e.message})`));
  }
}

(async () => {
  console.log(`▶ ${recreate ? 'Recreando' : 'Creando'} tablas DynamoDB…`);
  for (const def of tableDefs) await createOne(def);
  console.log('✔ Listo');
})().catch((e) => { console.error(e); process.exit(1); });
