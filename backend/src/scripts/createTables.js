import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import { ddbClient, TABLES } from '../config/dynamo.js';

const recreate = process.argv.includes('--recreate');

const tableDefs = [
  {
    TableName: TABLES.USERS,
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'email-index',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.REFRESH_TOKENS,
    KeySchema: [{ AttributeName: 'jti', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'jti', AttributeType: 'S' }],
    _ttl: 'expiresAt',
  },
  {
    TableName: TABLES.CLIENTES,
    KeySchema: [{ AttributeName: 'clienteId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'email-index',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.PLANES,
    KeySchema: [{ AttributeName: 'planId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'planId', AttributeType: 'S' },
      { AttributeName: 'nombre', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'nombre-index',
      KeySchema: [{ AttributeName: 'nombre', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.INSCRIPCIONES,
    KeySchema: [{ AttributeName: 'inscripcionId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'inscripcionId', AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'fechaRegistro', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'clienteId-fecha-index',
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'fechaRegistro', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.MEMBRESIAS,
    KeySchema: [{ AttributeName: 'membresiaId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'membresiaId', AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'fechaInicio', AttributeType: 'S' },
      { AttributeName: 'estado', AttributeType: 'S' },
      { AttributeName: 'fechaFin', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'clienteId-fecha-index',
        KeySchema: [
          { AttributeName: 'clienteId', KeyType: 'HASH' },
          { AttributeName: 'fechaInicio', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'estado-fechaFin-index',
        KeySchema: [
          { AttributeName: 'estado', KeyType: 'HASH' },
          { AttributeName: 'fechaFin', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: TABLES.PAGOS,
    KeySchema: [{ AttributeName: 'pagoId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'pagoId', AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'fecha', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'clienteId-fecha-index',
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'fecha', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.PRODUCTOS,
    KeySchema: [{ AttributeName: 'productoId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'productoId', AttributeType: 'S' },
      { AttributeName: 'codigo', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'codigo-index',
      KeySchema: [{ AttributeName: 'codigo', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.VENTA_PEDIDOS,
    KeySchema: [{ AttributeName: 'ventaId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'ventaId', AttributeType: 'S' },
      { AttributeName: 'fecha', AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'fecha-index',
        KeySchema: [{ AttributeName: 'fecha', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'clienteId-fecha-index',
        KeySchema: [
          { AttributeName: 'clienteId', KeyType: 'HASH' },
          { AttributeName: 'fecha', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: TABLES.VENTA_DETALLES,
    KeySchema: [{ AttributeName: 'ventaDetalleId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'ventaDetalleId', AttributeType: 'S' },
      { AttributeName: 'ventaId', AttributeType: 'S' },
      { AttributeName: 'productoId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ventaId-index',
        KeySchema: [{ AttributeName: 'ventaId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'productoId-index',
        KeySchema: [{ AttributeName: 'productoId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: TABLES.INVENTARIO_MOVIMIENTOS,
    KeySchema: [{ AttributeName: 'movimientoId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'movimientoId', AttributeType: 'S' },
      { AttributeName: 'productoId', AttributeType: 'S' },
      { AttributeName: 'fecha', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'productoId-fecha-index',
      KeySchema: [
        { AttributeName: 'productoId', KeyType: 'HASH' },
        { AttributeName: 'fecha', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.GASTOS,
    KeySchema: [{ AttributeName: 'gastoId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'gastoId', AttributeType: 'S' },
      { AttributeName: 'fecha', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'fecha-index',
      KeySchema: [{ AttributeName: 'fecha', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.INGRESOS,
    KeySchema: [{ AttributeName: 'ingresoId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'ingresoId', AttributeType: 'S' },
      { AttributeName: 'fecha', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'fecha-index',
      KeySchema: [{ AttributeName: 'fecha', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.CREDITOS,
    KeySchema: [{ AttributeName: 'creditoId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'creditoId', AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'fecha', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'clienteId-fecha-index',
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'fecha', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.CREDITO_ABONOS,
    KeySchema: [{ AttributeName: 'abonoId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'abonoId', AttributeType: 'S' },
      { AttributeName: 'creditoId', AttributeType: 'S' },
      { AttributeName: 'fecha', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'creditoId-fecha-index',
      KeySchema: [
        { AttributeName: 'creditoId', KeyType: 'HASH' },
        { AttributeName: 'fecha', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.INVENTARIO,
    KeySchema: [{ AttributeName: 'itemId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'itemId', AttributeType: 'S' }],
  },
  {
    TableName: TABLES.NOMINA,
    KeySchema: [{ AttributeName: 'empleadoId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'empleadoId', AttributeType: 'S' }],
  },
  {
    TableName: TABLES.RUTINAS_CLIENTES,
    KeySchema: [{ AttributeName: 'rutinaId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'rutinaId', AttributeType: 'S' }],
  },
  {
    TableName: TABLES.RUTINAS_COACH,
    KeySchema: [{ AttributeName: 'rutinaId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'rutinaId', AttributeType: 'S' }],
  },
  {
    TableName: TABLES.RECORDATORIOS,
    KeySchema: [{ AttributeName: 'recordatorioId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'recordatorioId', AttributeType: 'S' }],
  },
  {
    TableName: TABLES.SETTINGS,
    KeySchema: [{ AttributeName: 'settingsId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'settingsId', AttributeType: 'S' }],
  },
  {
    TableName: TABLES.WORKOUTS,
    KeySchema: [{ AttributeName: 'workoutId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'workoutId', AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'fecha', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'clienteId-fecha-index',
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'fecha', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.MEDIDAS,
    KeySchema: [{ AttributeName: 'medidaId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'medidaId', AttributeType: 'S' },
      { AttributeName: 'clienteId', AttributeType: 'S' },
      { AttributeName: 'fecha', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'clienteId-fecha-index',
      KeySchema: [
        { AttributeName: 'clienteId', KeyType: 'HASH' },
        { AttributeName: 'fecha', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    }],
  },
  {
    TableName: TABLES.PRS,
    KeySchema: [{ AttributeName: 'prId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'prId', AttributeType: 'S' },
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
    }],
  },
];

async function exists(name) {
  try {
    await ddbClient.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch (e) {
    if (e.name === 'ResourceNotFoundException') return false;
    throw e;
  }
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
    else {
      console.log(`  • ${def.TableName} ya existe`);
      return;
    }
  }
  console.log(`  ✓ Creando ${def.TableName}`);
  // On-demand: sin capacidad fija (el tráfico del gym cabe en centavos/mes).
  await ddbClient.send(new CreateTableCommand({ ...input, BillingMode: 'PAY_PER_REQUEST' }));
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
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
