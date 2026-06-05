import { DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';

const SEED_EMAILS = [
  'admin@IronCore.mx',
  'coach@IronCore.mx',
  'recepcion@IronCore.mx',
  'carlos@email.com',
];

const SEED_CLIENTE_EMAILS = [
  'carlos@email.com',
  'ana@email.com',
  'roberto@email.com',
  'valeria@email.com',
  'diego@email.com',
  'sofia@email.com',
];

const SEED_PAGO_IDS = ['TXN-8817', 'TXN-8818', 'TXN-8819', 'TXN-8820', 'TXN-8821'];

const SEED_INVENTARIO_NOMBRES = [
  'Mancuernas 10 kg', 'Barra Olímpica', 'Cinta de Correr Pro',
  'Bench de Press', 'Kettlebell 20 kg', 'Cuerda de Saltar',
];

const SEED_NOMINA_NOMBRES = [
  'Marcos Herrera', 'Laura Vega', 'Javier Mora', 'Patricia Ruiz', 'Andrés Campos',
];

const SEED_RUTINAS_COACH_NOMBRES = [
  'Full Body Funcional', 'HIIT Explosivo', 'Yoga & Movilidad', 'Fuerza Base',
];

async function del(table, key) {
  await ddb.send(new DeleteCommand({ TableName: table, Key: key }));
}

async function queryByEmail(table, email) {
  const { Items } = await ddb.send(new QueryCommand({
    TableName: table,
    IndexName: 'email-index',
    KeyConditionExpression: '#e = :e',
    ExpressionAttributeNames: { '#e': 'email' },
    ExpressionAttributeValues: { ':e': email },
  }));
  return Items || [];
}

async function clearUsers() {
  let count = 0;
  for (const email of SEED_EMAILS) {
    const items = await queryByEmail(TABLES.USERS, email);
    for (const item of items) {
      await del(TABLES.USERS, { userId: item.userId });
      count++;
    }
  }
  console.log(`  ✓ usuarios eliminados: ${count}`);
}

async function clearClientes() {
  let count = 0;
  for (const email of SEED_CLIENTE_EMAILS) {
    const items = await queryByEmail(TABLES.CLIENTES, email);
    for (const item of items) {
      await del(TABLES.CLIENTES, { clienteId: item.clienteId });
      count++;
    }
  }
  console.log(`  ✓ clientes eliminados: ${count}`);
}

async function clearPagos() {
  for (const pagoId of SEED_PAGO_IDS) {
    await del(TABLES.PAGOS, { pagoId });
  }
  console.log(`  ✓ pagos eliminados: ${SEED_PAGO_IDS.length}`);
}

async function scanAndDelete(table, pkField, filterAttr, seedValues) {
  const placeholders = seedValues.map((_, i) => `:v${i}`).join(', ');
  const exprValues = Object.fromEntries(seedValues.map((v, i) => [`:v${i}`, v]));

  const { Items } = await ddb.send(new ScanCommand({
    TableName: table,
    FilterExpression: `#attr IN (${placeholders})`,
    ExpressionAttributeNames: { '#attr': filterAttr },
    ExpressionAttributeValues: exprValues,
  }));

  for (const item of Items || []) {
    await del(table, { [pkField]: item[pkField] });
  }
  return (Items || []).length;
}

async function clearInventario() {
  const count = await scanAndDelete(TABLES.INVENTARIO, 'itemId', 'nombre', SEED_INVENTARIO_NOMBRES);
  console.log(`  ✓ inventario eliminado: ${count}`);
}

async function clearNomina() {
  const count = await scanAndDelete(TABLES.NOMINA, 'empleadoId', 'nombre', SEED_NOMINA_NOMBRES);
  console.log(`  ✓ nómina eliminada: ${count}`);
}

async function clearRutinasCoach() {
  const count = await scanAndDelete(TABLES.RUTINAS_COACH, 'rutinaId', 'nombre', SEED_RUTINAS_COACH_NOMBRES);
  console.log(`  ✓ rutinas coach eliminadas: ${count}`);
}

async function clearRutinasClientes() {
  // Todas las rutinas_clientes son datos de seed (coach = 'Marcos H.', objetivo = 'Hipertrofia')
  const { Items } = await ddb.send(new ScanCommand({
    TableName: TABLES.RUTINAS_CLIENTES,
    FilterExpression: '#coach = :c',
    ExpressionAttributeNames: { '#coach': 'coach' },
    ExpressionAttributeValues: { ':c': 'Marcos H.' },
  }));
  for (const item of Items || []) {
    await del(TABLES.RUTINAS_CLIENTES, { rutinaId: item.rutinaId });
  }
  console.log(`  ✓ rutinas clientes eliminadas: ${(Items || []).length}`);
}

async function clearRecordatorios() {
  // Todos los recordatorios son de seed; los identificamos por los clienteIds de seed
  // Primero obtenemos los clienteIds de seed
  const clienteIds = new Set();
  for (const email of SEED_CLIENTE_EMAILS) {
    const items = await queryByEmail(TABLES.CLIENTES, email);
    for (const item of items) clienteIds.add(item.clienteId);
  }

  if (clienteIds.size === 0) {
    // Los clientes ya fueron borrados; escanear por clienteIds directamente no funciona.
    // Hacer un scan completo con los emails hardcodeados no es posible en recordatorios.
    console.log('  ⚠ recordatorios: clientes ya eliminados, omitiendo (tabla vacía o sin seed)');
    return;
  }

  const { Items } = await ddb.send(new ScanCommand({ TableName: TABLES.RECORDATORIOS }));
  let count = 0;
  for (const item of Items || []) {
    if (clienteIds.has(item.clienteId)) {
      await del(TABLES.RECORDATORIOS, { recordatorioId: item.recordatorioId });
      count++;
    }
  }
  console.log(`  ✓ recordatorios eliminados: ${count}`);
}

(async () => {
  console.log('▶ Eliminando datos de seed…');
  // Recordatorios primero (dependen de clienteIds aún presentes)
  await clearRecordatorios();
  await clearRutinasClientes();
  await clearRutinasCoach();
  await clearPagos();
  await clearNomina();
  await clearInventario();
  await clearClientes();
  await clearUsers();
  console.log('✔ Seed eliminado');
})().catch((e) => { console.error(e); process.exit(1); });
