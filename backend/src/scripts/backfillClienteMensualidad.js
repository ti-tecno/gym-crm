import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';
import { listClientes, updateCliente } from '../repositories/clientes.repo.js';
import { daysUntilIso } from '../utils/dates.js';

// Usa gym_ingresos (ya migrado desde ingresos.csv + inscripciones.csv) como fuente:
// por cada cliente, toma el ÚLTIMO pago cuya descripción sea reconocible como una
// mensualidad (no ventas de mostrador/agua/snacks) y actualiza monto, tipoMensualidad
// y vencimiento/estado en gym_clientes.

const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes('--dry-run');

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Clasificación manual y exhaustiva de las 168 descripciones distintas presentes en
// gym_ingresos (ver análisis previo). Prioriza duración explícita (3/6/12 meses) sobre
// el default "mensual". Todo lo que sea consumo de mostrador (agua, snacks, monster,
// pre-entreno, etc.) o un caso ambiguo de baja frecuencia se excluye deliberadamente:
// es preferible no tocar el registro del cliente a adivinar mal.
const DOCE_MESES = ['anualidad', 'anual', '12 meses'];
const SEIS_MESES = ['6 meses', 'semestre'];
const TRES_MESES = [
  '3 meses', 'trimestre', 'tres meses', '#3 meses', '3x2', 'promo 3x2',
  'promocion de 3 meses', 'promoción de 3 meses', 'inscripcion y 3 meses',
];
const UN_MES = [
  'mensualidad', 'mensualida', 'mensulidad', 'mesualidad', 'mansualidad', 'mensualidad0',
  'estudiante', 'estudiuante', 'inscripcion', 'unica mensualidad',
  'summer promo', 'completo summer promo', '2 x summer promo',
  'hotsale', 'abono promo hotsale', 'promo de 1 peso', 'promocion de alfonso',
  'promo alfonso', 'promo de alfonso', 'promoción de alfonso', 'promo semana santa',
  'promo back to school', 'spooky promo', 'espooky promo', 'estudiante spooky promo',
  'promocion extra f', 'promo extrafitness', 'promo verano', 'promo 10 de mayo',
  'promo pareja', 'promo san valentin', 'promo inscipcion gratis',
  'visita 1 mes', '1 mes visita', '3 dias a la semana x $300 al mes',
];
// Palabras sueltas cuya sola presencia basta para marcar "mensual" (cubren typos de
// "mensualidad"/"estudiante"/"inscripcion" combinados con otra palabra, p.ej.
// "mensualidad e inscripción", "estudiante e inscripcion", "mensualidad estudiante").
const UN_MES_KEYWORDS = ['mensualidad', 'mensualida', 'mensulidad', 'mesualidad', 'mansualidad', 'estudiante', 'estudiuante', 'inscripcion', 'inscripción', 'inscipcion', 'inscrcipcion', 'incripcion'];

function classifyDuracion(descripcionRaw) {
  const k = normalizeKey(descripcionRaw);
  if (DOCE_MESES.some((p) => k.includes(p))) return { meses: 12, tipo: 'Anual' };
  if (SEIS_MESES.some((p) => k.includes(p))) return { meses: 6, tipo: '6 Meses' };
  if (TRES_MESES.some((p) => k.includes(p))) return { meses: 3, tipo: '3 Meses' };
  if (UN_MES.includes(k) || UN_MES_KEYWORDS.some((p) => k.includes(p))) return { meses: 1, tipo: 'Mensual' };
  return null; // excluido: consumo de mostrador, día/semana de visita, o caso ambiguo
}

function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

function classifyEstado(diasRestantes) {
  if (diasRestantes === null) return 'Vencido';
  if (diasRestantes < 0) return 'Vencido';
  if (diasRestantes <= 7) return 'Por vencer';
  return 'Activo';
}

async function loadIngresos() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: TABLES.INGRESOS, ExclusiveStartKey }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function buildClienteIndex(clientes) {
  const byName = new Map(); // normalizedName -> Set(clienteId)
  for (const c of clientes) {
    const key = normalizeKey(c.nombre);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, new Set());
    byName.get(key).add(c.clienteId);
  }
  return byName;
}

async function main() {
  const [clientes, ingresos] = await Promise.all([listClientes({ all: true }), loadIngresos()]);
  const clientesById = new Map(clientes.map((c) => [c.clienteId, c]));
  const nameIndex = buildClienteIndex(clientes);

  let excluded = 0;
  let noNombre = 0;
  let sinMatch = 0;
  let colisiones = 0;
  const colisionSamples = [];
  const noMatchSamples = new Map(); // nombre -> count

  // clienteId -> mejor candidato (el de fecha más reciente)
  const candidatos = new Map();

  for (const row of ingresos) {
    const clase = classifyDuracion(row.descripcion);
    if (!clase) { excluded++; continue; }
    const nombreRaw = normalizeText(row.cliente);
    if (!nombreRaw) { noNombre++; continue; }
    const key = normalizeKey(nombreRaw);
    const ids = nameIndex.get(key);
    if (!ids || ids.size === 0) {
      sinMatch++;
      noMatchSamples.set(nombreRaw, (noMatchSamples.get(nombreRaw) || 0) + 1);
      continue;
    }
    if (ids.size > 1) {
      colisiones++;
      if (colisionSamples.length < 15) colisionSamples.push(nombreRaw);
      continue;
    }
    const clienteId = [...ids][0];
    const prev = candidatos.get(clienteId);
    if (!prev || row.fecha > prev.fecha) {
      candidatos.set(clienteId, { ...row, ...clase });
    }
  }

  const updates = [];
  for (const [clienteId, cand] of candidatos) {
    const cliente = clientesById.get(clienteId);
    const vencimiento = addMonths(cand.fecha, cand.meses);
    const estado = classifyEstado(daysUntilIso(vencimiento));
    updates.push({
      clienteId,
      nombre: cliente.nombre,
      before: { monto: cliente.monto, tipoMensualidad: cliente.tipoMensualidad, vencimiento: cliente.vencimiento, estado: cliente.estado },
      after: { monto: cand.monto, tipoMensualidad: cand.tipo, vencimiento, estado },
      fechaPago: cand.fecha,
      descripcion: cand.descripcion,
    });
  }

  console.log(`▶ Clientes en gym_clientes: ${clientes.length}`);
  console.log(`▶ Filas en gym_ingresos: ${ingresos.length}`);
  console.log(`▶ Excluidas (consumo/ambiguo, no son mensualidad): ${excluded}`);
  console.log(`▶ Sin nombre de cliente en la fila: ${noNombre}`);
  console.log(`▶ Sin match exacto contra gym_clientes: ${sinMatch}`);
  console.log(`▶ Colisiones (nombre coincide con más de un cliente, se omiten): ${colisiones}`);
  if (colisionSamples.length) console.log(`   ejemplos: ${colisionSamples.join(', ')}`);
  console.log(`▶ Clientes a actualizar: ${updates.length}`);

  const vencidos = updates.filter((u) => u.after.estado === 'Vencido').length;
  const porVencer = updates.filter((u) => u.after.estado === 'Por vencer').length;
  const activos = updates.filter((u) => u.after.estado === 'Activo').length;
  console.log(`   • quedarán Activo: ${activos}  Por vencer: ${porVencer}  Vencido: ${vencidos}`);

  console.log('\n▶ Muestra de 15 actualizaciones:');
  for (const u of updates.slice(0, 15)) {
    console.log(`   • ${u.nombre} — "${u.descripcion}" (${u.fechaPago}, $${u.after.monto}) → monto:${u.before.monto ?? '—'}→${u.after.monto} tipo:${u.before.tipoMensualidad ?? '—'}→${u.after.tipoMensualidad} venc:${u.before.vencimiento ?? '—'}→${u.after.vencimiento} estado:${u.before.estado ?? '—'}→${u.after.estado}`);
  }

  console.log('\n▶ Nombres sin match más frecuentes (10):');
  [...noMatchSamples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([n, c]) => console.log(`   • ${n} (${c}x)`));

  if (!dryRun) {
    for (const u of updates) {
      await updateCliente(u.clienteId, u.after);
    }
    console.log('\n▶ Migración aplicada');
  } else {
    console.log('\n▶ Nada escrito (dry-run)');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
