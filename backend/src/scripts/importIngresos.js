import fs from 'node:fs';
import path from 'node:path';
import { v5 as uuidv5 } from 'uuid';
import { PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';

const NAMESPACE = uuidv5('ironcore-ingresos-csv', uuidv5.URL);

const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes('--dry-run');
const csvPath = resolveCsvPath(cliArgs.find((arg) => !arg.startsWith('-')));

function resolveCsvPath(input) {
  if (input) return path.resolve(input);
  return path.resolve(process.cwd(), '..', 'ingresos.csv');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip; \n closes the row */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function asMonto(raw) {
  const t = normalizeText(raw).replace(/[$\s]/g, '').replace(/,/g, '');
  if (!t || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };

function isoFromParts(day, month, year) {
  if (!day || !month) return null;
  if (year < 100) year += 2000;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return iso;
}

// "26-jun-24"
function parseDashDate(raw) {
  const t = normalizeText(raw);
  const m = t.match(/^(\d{1,2})-([a-záéíóúñ]{3})-(\d{2,4})$/i);
  if (!m) return null;
  const mon = MESES[normalizeKey(m[2])];
  if (!mon) return null;
  return isoFromParts(Number(m[1]), mon, Number(m[3]));
}

// "1/16/2025" (m/d/yyyy)
function parseSlashDate(raw) {
  const t = normalizeText(raw);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return isoFromParts(Number(m[2]), Number(m[1]), Number(m[3]));
}

// "22/012026" — malformed day/month+year with missing separator
function parseGlued(raw) {
  const t = normalizeText(raw);
  const m = t.match(/^(\d{1,2})\/(\d{2})(\d{4})$/);
  if (!m) return null;
  return isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
}

function parseFecha(raw) {
  return parseDashDate(raw) || parseSlashDate(raw) || parseGlued(raw);
}

// Normaliza variantes con errores tipográficos: "efctivo", "tarjerta", "tranferencia",
// pagos mixtos ("efectivo y tarjeta", "mixto", "tarjeta y efec") y valores basura ("4:30").
function parseMetodo(raw) {
  const t = normalizeKey(raw);
  if (!t) return 'Efectivo';
  const hasTarjeta = t.includes('tarj');
  const hasEfectivo = t.includes('efec') || (t.startsWith('ef') && t.includes('tivo'));
  const hasTransferencia = t.includes('ferenc');
  if (t.includes('mixt') || t === 'mix' || (hasTarjeta && hasEfectivo)) return 'Mixto';
  if (hasTransferencia) return 'Transferencia';
  if (hasTarjeta) return 'Tarjeta';
  if (hasEfectivo) return 'Efectivo';
  return 'Efectivo';
}

function loadRows(filePath) {
  if (!fs.existsSync(filePath)) fail(`No encuentro el CSV: ${filePath}`);
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  const headerIdx = rows.findIndex((r) => normalizeKey(r[1]) === 'usuario');
  if (headerIdx === -1) fail('No encontré la fila de encabezado (columna "Usuario") en el CSV.');
  return rows.slice(headerIdx + 1);
}

function buildRecords(rows) {
  const records = [];
  const flaggedDates = [];
  const flaggedMontos = [];

  rows.forEach((row, idx) => {
    const csvRow = idx + 14; // preámbulo + encabezado + índice base 1
    const usuario = normalizeText(row[1]);
    const descripcionRaw = row[2];
    const descripcion = normalizeText(descripcionRaw);
    if (!descripcion) return;

    const fechaRaw = row[3];
    const metodoRaw = row[4];
    const montoRaw = row[5];

    const monto = asMonto(montoRaw);
    const fecha = parseFecha(fechaRaw);
    const metodo = parseMetodo(metodoRaw);

    if (!fecha) { flaggedDates.push({ csvRow, descripcion, fechaRaw: normalizeText(fechaRaw) }); return; }
    if (monto === null || monto <= 0) { flaggedMontos.push({ csvRow, descripcion, montoRaw: normalizeText(montoRaw) }); return; }

    records.push({
      ingresoId: uuidv5(`ingresos.csv:${csvRow}:${fecha}:${normalizeKey(descripcion)}:${monto}`, NAMESPACE),
      cliente: usuario || undefined,
      descripcion,
      monto,
      metodo,
      fecha,
      categoria: 'Importado',
      sourceFile: 'ingresos.csv',
      sourceRow: csvRow,
    });
  });

  return { records, flaggedDates, flaggedMontos };
}

async function loadExistingKeys() {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: TABLES.INGRESOS }));
  return new Set(Items.map((it) => `${it.fecha}|${normalizeKey(it.descripcion)}|${it.monto}`));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// La tabla tiene 5 WCU aprovisionadas; escribir miles de filas seguidas dispara
// ProvisionedThroughputExceededException, así que reintenta con backoff exponencial.
async function putWithRetry(record, attempt = 0) {
  try {
    await ddb.send(new PutCommand({ TableName: TABLES.INGRESOS, Item: record }));
  } catch (err) {
    if (err.name === 'ProvisionedThroughputExceededException' && attempt < 10) {
      const delay = Math.min(200 * 2 ** attempt, 8000) + Math.random() * 200;
      await sleep(delay);
      return putWithRetry(record, attempt + 1);
    }
    throw err;
  }
}

async function main() {
  const rows = loadRows(csvPath);
  const { records, flaggedDates, flaggedMontos } = buildRecords(rows);

  console.log(`▶ CSV: ${path.basename(csvPath)} — ${rows.length} filas de datos`);
  console.log(`▶ Ingresos a importar: ${records.length}`);
  if (dryRun) console.log('▶ Modo dry-run: no se escribirá nada\n');

  if (flaggedDates.length) {
    console.warn(`⚠ ${flaggedDates.length} fila(s) con fecha ilegible (se omiten):`);
    for (const f of flaggedDates) console.warn(`   • fila ${f.csvRow} (${f.descripcion}): "${f.fechaRaw}"`);
  }
  if (flaggedMontos.length) {
    console.warn(`⚠ ${flaggedMontos.length} fila(s) con monto inválido o cero (se omiten):`);
    for (const f of flaggedMontos) console.warn(`   • fila ${f.csvRow} (${f.descripcion}): "${f.montoRaw}"`);
  }

  // Aviso informativo nada más: NO se usa para excluir filas de la escritura.
  // El ID determinístico (uuidv5 por fila de origen) ya hace la importación
  // idempotente; filtrar por fecha+descripción+monto además de eso descartaría
  // filas legítimas (p. ej. dos clientes distintos pagando la misma mensualidad
  // el mismo día) una vez que la primera ya quedó escrita en un run anterior.
  console.log('\n▶ Revisando coincidencias (fecha+descripción+monto) contra lo ya existente en la tabla…');
  const existingKeys = await loadExistingKeys();
  const possibleDupes = records.filter((r) => existingKeys.has(`${r.fecha}|${normalizeKey(r.descripcion)}|${r.monto}`));
  if (possibleDupes.length) {
    console.warn(`⚠ ${possibleDupes.length} fila(s) coinciden en fecha+descripción+monto con algo ya presente (puede ser una fila legítima repetida, no se omite):`);
    for (const d of possibleDupes.slice(0, 20)) console.warn(`   • fila ${d.sourceRow} (${d.fecha} ${d.descripcion} $${d.monto})`);
    if (possibleDupes.length > 20) console.warn(`   … y ${possibleDupes.length - 20} más`);
  }

  if (!dryRun) {
    for (const [i, record] of records.entries()) {
      await putWithRetry(record);
      await sleep(120); // ritmo moderado: la tabla sólo tiene 5 WCU aprovisionadas
      if ((i + 1) % 200 === 0) console.log(`   … ${i + 1}/${records.length} escritos`);
    }
  }

  console.log('\n▶ Resultado:');
  console.log(`  • filas válidas en el CSV: ${records.length}`);
  console.log(`  • coinciden con algo ya existente (informativo, igual se escriben): ${possibleDupes.length}`);
  console.log(`  • ${dryRun ? 'a escribir' : 'escritos (nuevos o sobrescritos sin cambio)'}: ${records.length}`);
  console.log(`  • omitidos (fecha ilegible): ${flaggedDates.length}`);
  console.log(`  • omitidos (monto inválido): ${flaggedMontos.length}`);
  console.log(dryRun ? '▶ Nada escrito (dry-run)' : '▶ Migración aplicada');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
