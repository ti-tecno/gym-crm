import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLES } from '../config/dynamo.js';
import { updateCliente, deleteCliente } from '../repositories/clientes.repo.js';

const dryRun = process.argv.includes('--dry-run');

const REF_TABLES = [
  { table: TABLES.PAGOS, label: 'pagos' },
  { table: TABLES.RUTINAS_CLIENTES, label: 'rutinas_clientes' },
  { table: TABLES.RECORDATORIOS, label: 'recordatorios' },
  { table: TABLES.MEDIDAS, label: 'medidas' },
  { table: TABLES.WORKOUTS, label: 'workouts' },
  { table: TABLES.PRS, label: 'prs' },
];

// Fields that describe membership/contact state; only filled on the survivor when missing, never overwritten.
const MERGE_FIELDS = ['email', 'telefono', 'plan', 'estado', 'vencimiento', 'notasImportacion', 'matricula', 'origenImportacion', 'csvRow'];

function normalizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scanAll(table) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function completeness(c) {
  return (c.email ? 10 : 0) + (c.vencimiento ? 5 : 0) + (c.plan ? 3 : 0) + (c.telefono ? 2 : 0) + (c.notasImportacion ? 1 : 0);
}

async function main() {
  const clientes = await scanAll(TABLES.CLIENTES);

  const refCounts = new Map();
  for (const { table } of REF_TABLES) {
    const rows = await scanAll(table);
    for (const row of rows) {
      if (!row.clienteId) continue;
      refCounts.set(row.clienteId, (refCounts.get(row.clienteId) || 0) + 1);
    }
  }

  const byName = new Map();
  for (const c of clientes) {
    const key = normalizeKey(c.nombre);
    if (!key) continue;
    (byName.get(key) || byName.set(key, []).get(key)).push(c);
  }
  const groups = [...byName.entries()].filter(([, v]) => v.length > 1);

  console.log(`▶ ${clientes.length} clientes, ${groups.length} grupo(s) de nombre duplicado`);
  if (dryRun) console.log('▶ Modo dry-run: no se escribirá ni borrará nada\n');

  const stats = { survivorsUpdated: 0, losersDeleted: 0, skippedAmbiguous: 0, fieldsFilledTotal: 0 };
  const skipped = [];

  for (const [name, group] of groups) {
    const scored = group.map((c) => ({
      c,
      ref: refCounts.get(c.clienteId) || 0,
      complete: completeness(c),
    }));

    const withRefs = scored.filter((s) => s.ref > 0);
    if (withRefs.length > 1) {
      // More than one record in this group has external references — ambiguous, needs manual review.
      skipped.push({ name, group });
      stats.skippedAmbiguous++;
      continue;
    }

    scored.sort((a, b) =>
      b.ref - a.ref ||
      b.complete - a.complete ||
      new Date(a.c.createdAt || 0) - new Date(b.c.createdAt || 0)
    );
    const [survivor, ...losers] = scored.map((s) => s.c);

    const patch = {};
    for (const loser of losers.sort((a, b) => completeness(b) - completeness(a))) {
      for (const field of MERGE_FIELDS) {
        const current = patch[field] !== undefined ? patch[field] : survivor[field];
        if ((current === undefined || current === null || current === '') && loser[field] !== undefined && loser[field] !== null && loser[field] !== '') {
          patch[field] = loser[field];
        }
      }
    }
    if (patch.email) patch.email = String(patch.email).toLowerCase().trim();
    else if (survivor.email) patch.email = String(survivor.email).toLowerCase().trim();

    // Drop no-op keys (already equal to survivor's current value)
    for (const field of Object.keys(patch)) {
      if (patch[field] === survivor[field]) delete patch[field];
    }

    if (Object.keys(patch).length) {
      if (!dryRun) await updateCliente(survivor.clienteId, patch);
      stats.survivorsUpdated++;
      stats.fieldsFilledTotal += Object.keys(patch).length;
    }

    for (const loser of losers) {
      if (!dryRun) await deleteCliente(loser.clienteId);
      stats.losersDeleted++;
    }
  }

  console.log('\n▶ Resultado:');
  console.log(`  • sobrevivientes actualizados (campos completados): ${stats.survivorsUpdated} (${stats.fieldsFilledTotal} campos en total)`);
  console.log(`  • duplicados eliminados: ${stats.losersDeleted}`);
  console.log(`  • grupos omitidos por ambigüedad (más de un registro con referencias externas): ${stats.skippedAmbiguous}`);
  if (skipped.length) {
    console.log('\n⚠ Grupos omitidos (requieren revisión manual):');
    for (const { name, group } of skipped.slice(0, 20)) {
      console.log(`   • ${name}:`, group.map((c) => `[${c.clienteId.slice(0, 8)} pagos=${refCounts.get(c.clienteId) || 0}]`).join(' | '));
    }
  }
  console.log(dryRun ? '\n▶ Nada escrito (dry-run)' : '\n▶ Deduplicación aplicada');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
