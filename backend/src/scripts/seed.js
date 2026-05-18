import { v4 as uuid } from 'uuid';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';
import { hashPassword } from '../services/password.service.js';

const now = () => new Date().toISOString();

async function put(table, item) {
  await ddb.send(new PutCommand({ TableName: table, Item: item }));
}

async function seedUsers(clienteIds = {}) {
  const users = [
    { email: 'admin@gymos.mx',     nombre: 'Administrador',  rol: 'ADMIN', password: 'Admin#2026' },
    { email: 'coach@gymos.mx',     nombre: 'Marcos Herrera', rol: 'COACH', password: 'Coach#2026' },
    { email: 'recepcion@gymos.mx', nombre: 'Patricia Ruiz',  rol: 'RECEP', password: 'Recep#2026' },
    // Cliente demo vinculado al cliente "Carlos Mendoza"
    { email: 'carlos@email.com',   nombre: 'Carlos Mendoza', rol: 'CLIENTE', password: 'Cliente#2026',
      clienteId: clienteIds['carlos@email.com'] },
  ];
  for (const u of users) {
    const passwordHash = await hashPassword(u.password);
    await put(TABLES.USERS, {
      userId: uuid(), email: u.email, nombre: u.nombre, rol: u.rol,
      passwordHash, failedAttempts: 0, createdAt: now(),
      ...(u.clienteId ? { clienteId: u.clienteId } : {}),
    });
    console.log(`  • usuario ${u.email} (${u.rol})`);
  }
}

async function seedClientes() {
  const data = [
    { nombre: 'Carlos Mendoza',  email: 'carlos@email.com',  plan: 'Premium', estado: 'Activo',     vencimiento: '2026-06-15', monto: 850 },
    { nombre: 'Ana López',       email: 'ana@email.com',     plan: 'Básico',  estado: 'Activo',     vencimiento: '2026-06-02', monto: 450 },
    { nombre: 'Roberto Silva',   email: 'roberto@email.com', plan: 'Elite',   estado: 'Vencido',    vencimiento: '2026-04-28', monto: 1200 },
    { nombre: 'Valeria Torres',  email: 'valeria@email.com', plan: 'Premium', estado: 'Activo',     vencimiento: '2026-06-20', monto: 850 },
    { nombre: 'Diego Ramírez',   email: 'diego@email.com',   plan: 'Básico',  estado: 'Por vencer', vencimiento: '2026-05-12', monto: 450 },
    { nombre: 'Sofía Castro',    email: 'sofia@email.com',   plan: 'Elite',   estado: 'Activo',     vencimiento: '2026-07-30', monto: 1200 },
  ];
  const ids = {};
  for (const c of data) {
    const id = uuid(); ids[c.email] = id;
    await put(TABLES.CLIENTES, { clienteId: id, createdAt: now(), ...c });
    console.log(`  • cliente ${c.nombre}`);
  }
  return ids;
}

async function seedPagos(ids) {
  const pagos = [
    { cliente: 'carlos@email.com',  monto: 850,  metodo: 'tarjeta',       cardLast4: '4291', estado: 'Exitoso', fecha: '2026-05-09' },
    { cliente: 'sofia@email.com',   monto: 1200, metodo: 'transferencia', estado: 'Exitoso', fecha: '2026-05-08' },
    { cliente: 'valeria@email.com', monto: 850,  metodo: 'tarjeta',       cardLast4: '7734', estado: 'Exitoso', fecha: '2026-05-08' },
    { cliente: 'diego@email.com',   monto: 450,  metodo: 'tarjeta',       cardLast4: '1123', estado: 'Fallido', fecha: '2026-05-07' },
    { cliente: 'ana@email.com',     monto: 450,  metodo: 'transferencia', estado: 'Exitoso', fecha: '2026-05-06' },
  ];
  let n = 8817;
  for (const p of pagos) {
    await put(TABLES.PAGOS, {
      pagoId: 'TXN-' + (n++),
      clienteId: ids[p.cliente],
      monto: p.monto, metodo: p.metodo, cardLast4: p.cardLast4, estado: p.estado,
      fecha: p.fecha,
      createdAt: now(),
    });
  }
  console.log('  • pagos sembrados');
}

async function seedInventario() {
  const items = [
    { nombre: 'Mancuernas 10 kg',   categoria: 'Pesas',       cantidad: 12, minimo: 8,  precio: 320,   estado: 'OK' },
    { nombre: 'Barra Olímpica',     categoria: 'Barras',      cantidad: 3,  minimo: 5,  precio: 1800,  estado: 'Bajo' },
    { nombre: 'Cinta de Correr Pro',categoria: 'Cardio',      cantidad: 6,  minimo: 4,  precio: 12500, estado: 'OK' },
    { nombre: 'Bench de Press',     categoria: 'Bancos',      cantidad: 4,  minimo: 4,  precio: 2200,  estado: 'OK' },
    { nombre: 'Kettlebell 20 kg',   categoria: 'Pesas',       cantidad: 2,  minimo: 6,  precio: 680,   estado: 'Crítico' },
    { nombre: 'Cuerda de Saltar',   categoria: 'Accesorios',  cantidad: 18, minimo: 10, precio: 85,    estado: 'OK' },
  ];
  for (const i of items) await put(TABLES.INVENTARIO, { itemId: uuid(), createdAt: now(), ...i });
  console.log('  • inventario sembrado');
}

async function seedNomina() {
  const items = [
    { nombre: 'Marcos Herrera',  puesto: 'Coach Principal',  salario: 18500, horas: 160, estado: 'Pagado' },
    { nombre: 'Laura Vega',      puesto: 'Coach Funcional',  salario: 14000, horas: 140, estado: 'Pagado' },
    { nombre: 'Javier Mora',     puesto: 'Nutriólogo',       salario: 16000, horas: 120, estado: 'Pendiente' },
    { nombre: 'Patricia Ruiz',   puesto: 'Recepcionista',    salario: 9500,  horas: 160, estado: 'Pagado' },
    { nombre: 'Andrés Campos',   puesto: 'Mantenimiento',    salario: 8000,  horas: 160, estado: 'Pendiente' },
  ];
  for (const e of items) await put(TABLES.NOMINA, { empleadoId: uuid(), createdAt: now(), ...e });
  console.log('  • nómina sembrada');
}

async function seedRutinas(ids) {
  await put(TABLES.RUTINAS_CLIENTES, {
    rutinaId: uuid(),
    clienteId: ids['carlos@email.com'],
    coach: 'Marcos H.', semana: 8, objetivo: 'Hipertrofia',
    dias: [
      { dia: 'Lun', musculo: 'Pecho',    ejercicios: ['Press Plano 4x10', 'Aperturas 3x12', 'Push-ups 3x15'] },
      { dia: 'Mié', musculo: 'Espalda',  ejercicios: ['Jalón al Pecho 4x10', 'Remo 3x12', 'Facepull 3x15'] },
      { dia: 'Vie', musculo: 'Piernas',  ejercicios: ['Sentadilla 4x8', 'Prensa 3x12', 'Extensión 3x15'] },
    ],
    updatedAt: now(),
  });
  const programas = [
    { nombre: 'Full Body Funcional', nivel: 'Intermedio',    duracion: '55 min', clientes: 12, coach: 'Marcos H.' },
    { nombre: 'HIIT Explosivo',      nivel: 'Avanzado',      duracion: '40 min', clientes: 8,  coach: 'Laura V.' },
    { nombre: 'Yoga & Movilidad',    nivel: 'Principiante',  duracion: '60 min', clientes: 15, coach: 'Laura V.' },
    { nombre: 'Fuerza Base',         nivel: 'Intermedio',    duracion: '70 min', clientes: 10, coach: 'Marcos H.' },
  ];
  for (const p of programas) await put(TABLES.RUTINAS_COACH, { rutinaId: uuid(), updatedAt: now(), ...p });
  console.log('  • rutinas sembradas');
}

async function seedRecordatorios(ids) {
  const recs = [
    { cliente: 'diego@email.com',   dias: 3,  tipo: 'WhatsApp', estado: 'Enviado',    monto: 450 },
    { cliente: 'roberto@email.com', dias: -11,tipo: 'Email',    estado: 'Pendiente',  monto: 1200 },
    { cliente: 'ana@email.com',     dias: 7,  tipo: 'WhatsApp', estado: 'Programado', monto: 450 },
    { cliente: 'carlos@email.com',  dias: 37, tipo: 'Email',    estado: 'Programado', monto: 850 },
  ];
  for (const r of recs) {
    await put(TABLES.RECORDATORIOS, {
      recordatorioId: uuid(), createdAt: now(),
      clienteId: ids[r.cliente], dias: r.dias, tipo: r.tipo, estado: r.estado, monto: r.monto,
    });
  }
  console.log('  • recordatorios sembrados');
}

(async () => {
  console.log('▶ Sembrando datos demo en DynamoDB…');
  const ids = await seedClientes();           // primero clientes, para poder vincular el user CLIENTE
  await seedUsers(ids);
  await seedPagos(ids);
  await seedInventario();
  await seedNomina();
  await seedRutinas(ids);
  await seedRecordatorios(ids);
  console.log('✔ Seed completo');
})().catch((e) => { console.error(e); process.exit(1); });
