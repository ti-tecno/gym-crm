import fs from 'node:fs';
import path from 'node:path';
import { v5 as uuidv5 } from 'uuid';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';

const NAMESPACE = uuidv5('ironcore-gastos-csv', uuidv5.URL);

const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes('--dry-run');
const csvPath = resolveCsvPath(cliArgs.find((arg) => !arg.startsWith('-')));

function resolveCsvPath(input) {
  if (input) return path.resolve(input);
  return path.resolve(process.cwd(), '..', 'gastos.csv');
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

function parseMetodo(raw) {
  const t = normalizeKey(raw);
  if (!t) return 'Efectivo';
  if (t.includes('tarjeta')) return 'Tarjeta';
  if (t.includes('transferencia') || t.includes('tranferencia')) return 'Transferencia';
  if (t.includes('efectivo')) return 'Efectivo';
  return 'Efectivo';
}

function loadRows(filePath) {
  if (!fs.existsSync(filePath)) fail(`No encuentro el CSV: ${filePath}`);
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  const headerIdx = rows.findIndex((r) => normalizeKey(r[1]) === 'gasto');
  if (headerIdx === -1) fail('No encontré la fila de encabezado (columna "Gasto") en el CSV.');
  return rows.slice(headerIdx + 1);
}

function buildRecords(rows) {
  const records = [];
  const flaggedDates = [];
  const flaggedMontos = [];

  rows.forEach((row, idx) => {
    const csvRow = idx + 8; // preamble + header + 1-index
    const descripcionRaw = row[1];
    const descripcion = normalizeText(descripcionRaw);
    if (!descripcion) return;

    const montoRaw = row[2];
    const metodoRaw = row[3];
    const fechaRaw = row[4];

    const monto = asMonto(montoRaw);
    const fecha = parseFecha(fechaRaw);
    const metodo = parseMetodo(metodoRaw);

    if (!fecha) { flaggedDates.push({ csvRow, descripcion, fechaRaw: normalizeText(fechaRaw) }); return; }
    if (monto === null || monto <= 0) { flaggedMontos.push({ csvRow, descripcion, montoRaw: normalizeText(montoRaw) }); return; }

    records.push({
      gastoId: uuidv5(`gastos.csv:${csvRow}:${fecha}:${normalizeKey(descripcion)}:${monto}`, NAMESPACE),
      descripcion,
      monto,
      metodo,
      fecha,
      categoria: 'Importado',
      sourceFile: 'gastos.csv',
      sourceRow: csvRow,
    });
  });

  return { records, flaggedDates, flaggedMontos };
}

async function main() {
  const rows = loadRows(csvPath);
  const { records, flaggedDates, flaggedMontos } = buildRecords(rows);

  console.log(`▶ CSV: ${path.basename(csvPath)} — ${rows.length} filas de datos`);
  console.log(`▶ Gastos a importar: ${records.length}`);
  if (dryRun) console.log('▶ Modo dry-run: no se escribirá nada\n');

  if (flaggedDates.length) {
    console.warn(`⚠ ${flaggedDates.length} fila(s) con fecha ilegible (se omiten):`);
    for (const f of flaggedDates) console.warn(`   • fila ${f.csvRow} (${f.descripcion}): "${f.fechaRaw}"`);
  }
  if (flaggedMontos.length) {
    console.warn(`⚠ ${flaggedMontos.length} fila(s) con monto inválido o cero (se omiten):`);
    for (const f of flaggedMontos) console.warn(`   • fila ${f.csvRow} (${f.descripcion}): "${f.montoRaw}"`);
  }

  if (!dryRun) {
    for (const record of records) {
      await ddb.send(new PutCommand({ TableName: TABLES.GASTOS, Item: record }));
    }
  }

  console.log('\n▶ Resultado:');
  console.log(`  • ${dryRun ? 'a importar' : 'importados'}: ${records.length}`);
  console.log(`  • omitidos (fecha ilegible): ${flaggedDates.length}`);
  console.log(`  • omitidos (monto inválido): ${flaggedMontos.length}`);
  console.log(dryRun ? '▶ Nada escrito (dry-run)' : '▶ Migración aplicada');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
