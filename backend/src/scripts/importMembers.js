import fs from 'node:fs';
import path from 'node:path';
import { getClienteByEmail, createCliente, updateCliente } from '../repositories/clientes.repo.js';

const cliArgs = process.argv.slice(2);
const dryRun = cliArgs.includes('--dry-run');
const csvPath = resolveCsvPath(cliArgs.find((arg) => !arg.startsWith('-')));

function resolveCsvPath(input) {
  if (input) return path.resolve(input);
  return path.resolve(process.cwd(), '..', 'ironmembers.csv');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toTitleCase(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

function asNumber(value) {
  const t = normalizeText(value);
  if (!t || t === '#VALUE!') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
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

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };

function isoFromParts(day, month, year) {
  if (!day || !month) return null;
  if (year < 100) year += 2000;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return iso;
}

// "23-jun-25" / "1-mar-26"
function parseFinalizaDate(raw) {
  const t = normalizeText(raw);
  const m = t.match(/^(\d{1,2})-([a-záéíóúñ]{3})-(\d{2,4})$/i);
  if (!m) return null;
  const mon = MESES[normalizeKey(m[2])];
  if (!mon) return null;
  return isoFromParts(Number(m[1]), mon, Number(m[3]));
}

// "23/05/25"
function parseSlashDate(raw) {
  const t = normalizeText(raw);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  return isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
}

function classifyPlan(dias) {
  if (dias === null || dias <= 0) return 'Básico';
  if (dias <= 45) return 'Básico';
  if (dias <= 150) return 'Premium';
  return 'Elite';
}

function classifyEstado(diasRestantes) {
  if (diasRestantes === null) return 'Vencido';
  if (diasRestantes < 0) return 'Vencido';
  if (diasRestantes <= 7) return 'Por vencer';
  return 'Activo';
}

function buildNotas({ matricula, formato, serie, detalle, inicioIso, inicioRaw }) {
  const parts = [];
  if (matricula) parts.push(`Matrícula/obs: ${matricula}`);
  if (formato) parts.push(`Formato: ${formato}`);
  if (serie) parts.push(`Serie: ${serie}`);
  if (detalle) parts.push(`Detalle: ${detalle}`);
  if (inicioIso) parts.push(`Inicio legado: ${inicioIso}`);
  else if (inicioRaw) parts.push(`Inicio legado (sin parsear): ${inicioRaw}`);
  return parts.join(' | ') || undefined;
}

function loadRows(filePath) {
  if (!fs.existsSync(filePath)) fail(`No encuentro el CSV: ${filePath}`);
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  const headerIdx = rows.findIndex((r) => normalizeKey(r[7]) === 'correo');
  if (headerIdx === -1) fail('No encontré la fila de encabezado (columna "Correo") en el CSV.');
  return rows.slice(headerIdx + 1);
}

function buildRecords(rows) {
  const flaggedDates = [];
  const flaggedMembresia = [];
  const withEmail = new Map(); // email -> { record, names: [] }
  const withoutEmail = [];

  rows.forEach((row, idx) => {
    const csvRow = idx + 8; // +6 preamble lines + 1 header + 1-index
    const nombreRaw = row[1];
    if (!normalizeText(nombreRaw)) return;

    const inicioRaw = row[2];
    const diasRaw = row[3];
    const finalizaRaw = row[4];
    const membresiaRaw = row[5];
    const telefonoRaw = row[6];
    const emailRaw = row[7];
    const matriculaRaw = row[8];
    const formatoRaw = row[9];
    const serieRaw = row[10];
    const detalleRaw = row[11];

    const inicioIso = parseSlashDate(inicioRaw);
    const finalizaIso = parseFinalizaDate(finalizaRaw);
    if (!finalizaIso && normalizeText(finalizaRaw)) flaggedDates.push({ csvRow, nombre: nombreRaw, finalizaRaw });

    const dias = asNumber(diasRaw);
    const diasRestantes = asNumber(membresiaRaw);
    if (diasRestantes === null && normalizeText(membresiaRaw)) flaggedMembresia.push({ csvRow, nombre: nombreRaw, membresiaRaw });

    const email = normalizeText(emailRaw).toLowerCase();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const record = compact({
      nombre: toTitleCase(nombreRaw),
      email: emailValid ? email : undefined,
      telefono: normalizeText(telefonoRaw) || undefined,
      plan: classifyPlan(dias),
      estado: classifyEstado(diasRestantes),
      vencimiento: finalizaIso || undefined,
      notasImportacion: buildNotas({
        matricula: normalizeText(matriculaRaw),
        formato: normalizeText(formatoRaw),
        serie: normalizeText(serieRaw),
        detalle: normalizeText(detalleRaw),
        inicioIso,
        inicioRaw: normalizeText(inicioRaw),
      }),
      origenImportacion: 'ironmembers.csv',
      csvRow,
    });

    if (emailValid) {
      const prev = withEmail.get(email);
      withEmail.set(email, { record, names: [...(prev?.names || []), record.nombre] });
    } else {
      withoutEmail.push(record);
    }
  });

  const collisions = [...withEmail.entries()].filter(([, v]) => new Set(v.names).size > 1);
  for (const [email] of collisions) withEmail.delete(email);

  return { withEmail, withoutEmail, flaggedDates, flaggedMembresia, collisions };
}

async function upsertByEmail(email, record) {
  const existing = await getClienteByEmail(email);
  if (existing) {
    if (!dryRun) await updateCliente(existing.clienteId, record);
    return 'updated';
  }
  if (!dryRun) await createCliente(record);
  return 'created';
}

async function main() {
  const rows = loadRows(csvPath);
  const { withEmail, withoutEmail, flaggedDates, flaggedMembresia, collisions } = buildRecords(rows);

  console.log(`▶ CSV: ${path.basename(csvPath)} — ${rows.length} filas de datos`);
  console.log(`▶ Con correo (upsert por email): ${withEmail.size}`);
  console.log(`▶ Sin correo (siempre se crean como nuevos): ${withoutEmail.length}`);
  if (dryRun) console.log('▶ Modo dry-run: no se escribirá nada\n');

  if (collisions.length) {
    console.warn(`⚠ ${collisions.length} correo(s) compartidos por más de una persona en el CSV — se omiten por completo (revisar y re-importar manualmente):`);
    for (const [email, v] of collisions) console.warn(`   • ${email}: ${[...new Set(v.names)].join(' / ')}`);
  }
  if (flaggedDates.length) {
    console.warn(`⚠ ${flaggedDates.length} fila(s) con "Finaliza" ilegible (se importan sin vencimiento):`);
    for (const f of flaggedDates.slice(0, 15)) console.warn(`   • fila ${f.csvRow} (${normalizeText(f.nombre)}): "${f.finalizaRaw}"`);
  }
  if (flaggedMembresia.length) {
    console.warn(`⚠ ${flaggedMembresia.length} fila(s) con columna "Membresía" ilegible (estado forzado a Vencido):`);
    for (const f of flaggedMembresia.slice(0, 15)) console.warn(`   • fila ${f.csvRow} (${normalizeText(f.nombre)}): "${f.membresiaRaw}"`);
  }

  const counts = { created: 0, updated: 0, createdNoEmail: 0 };

  for (const [email, { record }] of withEmail) {
    const result = await upsertByEmail(email, record);
    counts[result]++;
  }

  for (const record of withoutEmail) {
    if (!dryRun) await createCliente(record);
    counts.createdNoEmail++;
  }

  console.log('\n▶ Resultado:');
  console.log(`  • creados (con correo, nuevos): ${counts.created}`);
  console.log(`  • actualizados (con correo, existentes): ${counts.updated}`);
  console.log(`  • creados sin correo (no se deduplican; re-ejecutar el script los duplicará): ${counts.createdNoEmail}`);
  console.log(`  • omitidos por correo compartido: ${collisions.reduce((n, [, v]) => n + v.names.length, 0)}`);
  console.log(dryRun ? '▶ Nada escrito (dry-run)' : '▶ Migración aplicada');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
