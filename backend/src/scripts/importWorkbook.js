import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { v5 as uuidv5 } from 'uuid';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';

const LEGACY_NAMESPACE = uuidv5('ironcore-legacy-workbook', uuidv5.URL);
const cliArgs = process.argv.slice(2);
const workbookPath = resolveWorkbookPath(cliArgs.find((arg) => !arg.startsWith('-')));
const dryRun = cliArgs.includes('--dry-run');

function resolveWorkbookPath(input) {
  if (input) return path.resolve(input);
  return path.resolve(process.cwd(), '..', 'Iron core gym - Version 08.07.25.xlsx');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function excelSerialToIso(raw, date1904 = false) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const n = asNumber(raw);
  if (!Number.isFinite(n)) return null;
  const epoch = date1904 ? 24107 : 25569;
  const ms = Math.round((n - epoch) * 86400000);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function parseMethod(value) {
  const t = normalizeKey(value);
  if (!t) return null;
  if (t.includes('tarjeta')) return 'tarjeta';
  if (t.includes('transferencia') || t.includes('tranferencia')) return 'transferencia';
  if (t.includes('efectivo')) return 'efectivo';
  return t;
}

function parseState(value) {
  const t = normalizeText(value);
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function makeId(kind, sourceKey) {
  return uuidv5(`${kind}:${sourceKey}`, LEGACY_NAMESPACE);
}

function rowValue(row, idx) {
  return row?.values?.[idx] ?? null;
}

function rowText(row, idx) {
  return normalizeText(rowValue(row, idx));
}

function rowNumber(row, idx) {
  return asNumber(rowValue(row, idx));
}

function isLikelyName(value) {
  const t = normalizeText(value);
  return !!t && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(t);
}

function isLegacyPersonRow(value) {
  const key = normalizeKey(value);
  if (!key) return false;
  if (/^columna\d+$/.test(key)) return false;
  return !['inscripciones', 'membresia', 'usuario'].includes(key);
}

function loadWorkbook(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`No encuentro el workbook: ${filePath}`);
  }

  const python = `
import json, sys, zipfile, xml.etree.ElementTree as ET, re, pathlib
path = pathlib.Path(sys.argv[1])
ns = {
  'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}

def col_to_idx(ref):
  m = re.match(r'([A-Z]+)(\\d+)', ref or '')
  if not m:
    return 0
  col = m.group(1)
  n = 0
  for ch in col:
    n = n * 26 + (ord(ch) - 64)
  return n - 1

with zipfile.ZipFile(path) as z:
  shared = []
  if 'xl/sharedStrings.xml' in z.namelist():
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in root.findall('a:si', ns):
      shared.append(''.join(t.text or '' for t in si.iterfind('.//a:t', ns)))

  wb = ET.fromstring(z.read('xl/workbook.xml'))
  wbpr = wb.find('a:workbookPr', ns)
  date1904 = bool(wbpr is not None and wbpr.attrib.get('date1904') in ('1', 'true', 'True'))

  rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
  rid_to_target = {r.attrib['Id']: r.attrib['Target'] for r in rels}

  out = {'date1904': date1904, 'sheets': {}}
  for sheet in wb.find('a:sheets', ns):
    name = sheet.attrib['name']
    rid = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
    target = rid_to_target[rid]
    xml = ET.fromstring(z.read('xl/' + target))
    rows = []
    for row in xml.findall('.//a:sheetData/a:row', ns):
      vals = {}
      for c in row.findall('a:c', ns):
        idx = col_to_idx(c.attrib.get('r'))
        t = c.attrib.get('t')
        v = c.find('a:v', ns)
        val = None
        if t == 's' and v is not None:
          val = shared[int(v.text)]
        elif t == 'inlineStr':
          val = ''.join(x.text or '' for x in c.findall('.//a:t', ns))
        elif t == 'b' and v is not None:
          val = v.text == '1'
        elif v is not None:
          val = v.text
        vals[idx] = val
      if vals:
        max_idx = max(vals)
        rows.append({'r': int(row.attrib.get('r', len(rows) + 1)), 'values': [vals.get(i) for i in range(max_idx + 1)]})
    out['sheets'][name] = { 'rows': rows }

print(json.dumps(out, ensure_ascii=False))
`;

  const result = spawnSync('python3', ['-c', python, filePath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    fail(result.stderr || result.stdout || 'No fue posible leer el workbook');
  }

  return JSON.parse(result.stdout);
}

const workbook = loadWorkbook(workbookPath);

const state = {
  plans: new Map(),
  clients: new Map(),
  products: new Map(),
  inscripciones: [],
  membresias: [],
  pagos: [],
  ventas: [],
  ventaDetalles: [],
  inventarioMovimientos: [],
  gastos: [],
  creditos: [],
  counts: {},
};

function clientKeyFromName(name) {
  const key = normalizeKey(name);
  return key ? `name:${key}` : null;
}

function ensureClient(name, patch = {}) {
  const key = clientKeyFromName(name);
  if (!key) return null;
  const existing = state.clients.get(key);
  const next = existing || {
    clienteId: makeId('cliente', key),
    nombre: normalizeText(name),
    createdAt: new Date().toISOString(),
  };
  if (patch.nombre && !next.nombre) next.nombre = normalizeText(patch.nombre);
  for (const field of ['email', 'telefono', 'matricula', 'fechaNacimiento', 'genero']) {
    if (patch[field] && !next[field]) next[field] = patch[field];
  }
  state.clients.set(key, next);
  return next.clienteId;
}

function ensurePlan(dias, origin = {}) {
  const duration = asNumber(dias);
  if (!duration) return null;
  const key = `dias:${duration}`;
  if (state.plans.has(key)) return state.plans.get(key).planId;
  const plan = {
    planId: makeId('plan', key),
    nombre: `Plan ${duration} dias`,
    duracionDias: duration,
    activo: true,
    sourceSheet: origin.sourceSheet,
    sourceRow: origin.sourceRow,
  };
  state.plans.set(key, plan);
  return plan.planId;
}

function ensureProduct({ codigo, nombre }, origin = {}) {
  const code = normalizeText(codigo);
  const name = normalizeText(nombre);
  const key = code ? `codigo:${normalizeKey(code)}` : `nombre:${normalizeKey(name)}`;
  if (key === 'nombre:') return null;
  const existing = state.products.get(key);
  if (existing) return existing.productoId;
  const product = {
    productoId: makeId('producto', key),
    codigo: code || normalizeKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    nombre: name || code,
    activo: true,
    sourceSheet: origin.sourceSheet,
    sourceRow: origin.sourceRow,
  };
  state.products.set(key, product);
  return product.productoId;
}

function processMembresiaSheet(rows, date1904) {
  for (const row of rows) {
    if (row.r < 3) continue;
    const nombre = rowText(row, 1);
    if (!isLikelyName(nombre) || !isLegacyPersonRow(nombre)) continue;
    const clienteId = ensureClient(nombre, {
      telefono: rowText(row, 6) || undefined,
      email: rowText(row, 7) || undefined,
      matricula: rowText(row, 8) || undefined,
    });
    const dias = rowNumber(row, 3);
    const fechaInicio = excelSerialToIso(rowValue(row, 2), date1904);
    const fechaFin = excelSerialToIso(rowValue(row, 4), date1904);
    const planId = ensurePlan(dias, { sourceSheet: 'Membresía', sourceRow: row.r });
    state.membresias.push({
      membresiaId: makeId('membresia', `membresia:${row.r}:${normalizeKey(nombre)}:${fechaInicio || ''}`),
      ...(clienteId ? { clienteId } : {}),
      planId,
      ...(fechaInicio ? { fechaInicio } : {}),
      ...(fechaFin ? { fechaFin } : {}),
      estado: fechaFin && fechaFin >= new Date().toISOString().slice(0, 10) ? 'Activo' : 'Vencido',
      legacyMembresiaValor: rowValue(row, 5) ?? null,
      sourceSheet: 'Membresía',
      sourceRow: row.r,
    });
  }
}

function processInscripcionesSheet(rows, date1904) {
  for (const row of rows) {
    if (row.r < 3) continue;
    const nombre = rowText(row, 1);
    if (!isLikelyName(nombre) || !isLegacyPersonRow(nombre)) continue;
    const fechaRegistro = excelSerialToIso(rowValue(row, 2), date1904);
    if (!fechaRegistro) continue;
    const clienteId = ensureClient(nombre);
    state.inscripciones.push({
      inscripcionId: makeId('inscripcion', `inscripciones:${row.r}:${normalizeKey(nombre)}:${rowText(row, 2)}`),
      ...(clienteId ? { clienteId } : {}),
      fechaRegistro,
      estadoRegistro: parseState(rowValue(row, 3)) || 'Pagado',
      sourceSheet: 'Inscripciones',
      sourceRow: row.r,
    });
  }
}

function processRegistroEntradas(rows, date1904) {
  for (const row of rows) {
    if (row.r < 8) continue;
    const usuario = rowText(row, 1);
    const descripcion = rowText(row, 2);
    const fecha = excelSerialToIso(rowValue(row, 3), date1904);
    const metodo = parseMethod(rowValue(row, 4));
    const monto = asNumber(rowValue(row, 5));
    if (!fecha || !monto) continue;
    const clienteId = isLikelyName(usuario) ? ensureClient(usuario) : null;
    state.pagos.push({
      pagoId: makeId('pago', `registro:${row.r}:${normalizeKey(usuario)}:${fecha}:${monto}:${descripcion}`),
      ...(clienteId ? { clienteId } : {}),
      fecha,
      monto,
      metodo: metodo || 'efectivo',
      estado: 'Exitoso',
      concepto: descripcion || 'Registro de entrada',
      legacyUsuario: isLikelyName(usuario) ? undefined : usuario || undefined,
      sourceSheet: 'Registro de entradas',
      sourceRow: row.r,
    });
  }
}

function processVentasSheet(rows, date1904) {
  const header = rows.find((row) => row.r === 1);
  if (header) {
    for (const idx of [0, 1, 2, 3]) {
      const nombre = rowText(header, idx);
      if (nombre) ensureProduct({ codigo: nombre, nombre }, { sourceSheet: 'ventas', sourceRow: header.r });
    }
  }

  for (const row of rows) {
    if (row.r < 4) continue;
    const codigo = rowText(row, 5);
    const producto = rowText(row, 6);
    const cantidad = asNumber(rowValue(row, 7));
    const fecha = excelSerialToIso(rowValue(row, 8), date1904);
    const monto = asNumber(rowValue(row, 9));
    const metodo = parseMethod(rowValue(row, 10));
    if (!producto || !fecha || !monto) continue;

    const productoId = ensureProduct({ codigo, nombre: producto }, { sourceSheet: 'ventas', sourceRow: row.r });
    const ventaId = makeId('venta', `ventas:${row.r}:${fecha}:${normalizeKey(producto)}:${monto}:${metodo || ''}`);
    state.ventas.push({
      ventaId,
      fecha,
      metodo: metodo || 'efectivo',
      estado: 'Cerrada',
      total: monto,
      sourceSheet: 'ventas',
      sourceRow: row.r,
    });
    state.ventaDetalles.push({
      ventaDetalleId: makeId('venta-detalle', `ventas:${row.r}:${normalizeKey(producto)}:${fecha}`),
      ventaId,
      productoId,
      cantidad: cantidad ?? 1,
      precioUnitario: cantidad && cantidad > 0 ? Number((monto / cantidad).toFixed(2)) : monto,
      subtotal: monto,
      sourceSheet: 'ventas',
      sourceRow: row.r,
    });
    state.inventarioMovimientos.push({
      movimientoId: makeId('inv-mov', `ventas:${row.r}:${normalizeKey(producto)}:${fecha}`),
      productoId,
      fecha,
      tipoMovimiento: 'salida',
      cantidad: cantidad ?? 1,
      referenciaTipo: 'venta',
      referenciaId: ventaId,
      observaciones: 'Importado desde hoja ventas',
      sourceSheet: 'ventas',
      sourceRow: row.r,
    });
  }
}

function processGastosSheet(rows, date1904) {
  for (const row of rows) {
    if (row.r < 3) continue;
    const descripcion = rowText(row, 1);
    const monto = asNumber(rowValue(row, 2));
    const metodo = parseMethod(rowValue(row, 3));
    const fecha = excelSerialToIso(rowValue(row, 4), date1904);
    if (!descripcion || !fecha || !monto) continue;
    state.gastos.push({
      gastoId: makeId('gasto', `gastos:${row.r}:${fecha}:${normalizeKey(descripcion)}:${monto}`),
      fecha,
      categoria: 'legacy',
      descripcion,
      monto,
      metodo: metodo || 'efectivo',
      sourceSheet: 'Gastos y Saldos',
      sourceRow: row.r,
    });
  }
}

function processCreditoSheet(rows, date1904) {
  for (const row of rows) {
    if (row.r < 3) continue;
    const nombre = rowText(row, 1);
    const descripcion = rowText(row, 2);
    const fecha = excelSerialToIso(rowValue(row, 3), date1904);
    const monto = asNumber(rowValue(row, 4));
    const faltante = asNumber(rowValue(row, 5));
    const comentarios = rowText(row, 6);
    if (!descripcion || !fecha) continue;
    const clienteId = isLikelyName(nombre) ? ensureClient(nombre) : null;
    state.creditos.push({
      creditoId: makeId('credito', `credito:${row.r}:${normalizeKey(nombre)}:${fecha}:${descripcion}`),
      ...(clienteId ? { clienteId } : {}),
      fecha,
      concepto: descripcion,
      montoRegistrado: monto,
      saldoPendiente: faltante,
      estado: faltante && faltante > 0 ? 'Pendiente' : 'Pagado',
      comentarios: comentarios || undefined,
      legacyUsuario: isLikelyName(nombre) ? undefined : nombre || undefined,
      sourceSheet: 'credito',
      sourceRow: row.r,
    });
  }
}

function reportCounts(label, n) {
  state.counts[label] = (state.counts[label] || 0) + n;
}

function items(map) {
  return [...map.values()];
}

async function put(table, item) {
  if (dryRun) return;
  await ddb.send(new PutCommand({ TableName: table, Item: item }));
}

async function flush() {
  const clientItems = items(state.clients).map((c) => ({
    ...c,
    updatedAt: new Date().toISOString(),
  }));

  const planItems = items(state.plans);
  const productItems = items(state.products);

  for (const item of clientItems) await put(TABLES.CLIENTES, item);
  for (const item of planItems) await put(TABLES.PLANES, item);
  for (const item of state.inscripciones) await put(TABLES.INSCRIPCIONES, item);
  for (const item of state.membresias) await put(TABLES.MEMBRESIAS, item);
  for (const item of state.pagos) await put(TABLES.PAGOS, item);
  for (const item of productItems) await put(TABLES.PRODUCTOS, item);
  for (const item of state.ventas) await put(TABLES.VENTA_PEDIDOS, item);
  for (const item of state.ventaDetalles) await put(TABLES.VENTA_DETALLES, item);
  for (const item of state.inventarioMovimientos) await put(TABLES.INVENTARIO_MOVIMIENTOS, item);
  for (const item of state.gastos) await put(TABLES.GASTOS, item);
  for (const item of state.creditos) await put(TABLES.CREDITOS, item);

  reportCounts('clientes', clientItems.length);
  reportCounts('planes', planItems.length);
  reportCounts('inscripciones', state.inscripciones.length);
  reportCounts('membresias', state.membresias.length);
  reportCounts('pagos', state.pagos.length);
  reportCounts('productos', productItems.length);
  reportCounts('venta_pedidos', state.ventas.length);
  reportCounts('venta_detalles', state.ventaDetalles.length);
  reportCounts('inventario_movimientos', state.inventarioMovimientos.length);
  reportCounts('gastos', state.gastos.length);
  reportCounts('creditos', state.creditos.length);
}

async function main() {
  const sheets = workbook.sheets || {};
  const date1904 = !!workbook.date1904;

  if (!sheets['Membresía'] || !sheets['Inscripciones']) {
    fail('El workbook no tiene las hojas esperadas para la migracion.');
  }

  processMembresiaSheet(sheets['Membresía'].rows || [], date1904);
  processInscripcionesSheet(sheets['Inscripciones'].rows || [], date1904);
  processRegistroEntradas(sheets['Registro de entradas']?.rows || [], date1904);
  processVentasSheet(sheets['ventas']?.rows || [], date1904);
  processGastosSheet(sheets['Gastos y Saldos ']?.rows || sheets['Gastos y Saldos']?.rows || [], date1904);
  processCreditoSheet(sheets['credito']?.rows || [], date1904);

  await flush();

  console.log(`▶ Workbook: ${path.basename(workbookPath)}`);
  console.log(dryRun ? '▶ Modo dry-run: no se escribio nada' : '▶ Migracion aplicada');
  for (const [label, count] of Object.entries(state.counts)) {
    console.log(`  • ${label}: ${count}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
