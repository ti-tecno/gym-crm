import * as repo from '../repositories/settings.repo.js';

export async function getPublic(_req, res, next) {
  try {
    const data = await repo.getPublicSettings();
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function getAdmin(_req, res, next) {
  try {
    const data = await repo.getSettings();
    res.json(data);
  } catch (e) {
    next(e);
  }
}

const PERIODOS_VALIDOS = ['trimestre', 'semestre', 'anualidad', 'mes', 'año'];

function normalizePeriodo(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'anio') return 'año';
  return PERIODOS_VALIDOS.includes(v) ? v : 'trimestre';
}

export async function updatePackages(req, res, next) {
  try {
    const input = Array.isArray(req.body?.packages) ? req.body.packages : [];
    const packages = input.map((pkg, idx) => ({
      id: String(pkg?.id || '').trim() || `plan-${idx + 1}`,
      nombre: String(pkg?.nombre || '').trim() || `Plan ${idx + 1}`,
      precio: Number.isFinite(Number(pkg?.precio)) ? Number(pkg.precio) : 0,
      periodo: normalizePeriodo(pkg?.periodo),
      features: Array.isArray(pkg?.features)
        ? pkg.features.map((f) => String(f).trim()).filter(Boolean)
        : [],
      color: String(pkg?.color || '').trim() || '#4A90D9',
      destacado: !!pkg?.destacado,
    }));
    const data = await repo.saveSettings({ packages });
    res.json({ packages: data.packages });
  } catch (e) {
    next(e);
  }
}

export async function updateSchedule(req, res, next) {
  try {
    const schedule = req.body?.schedule || { days: [], classColors: {}, slots: [] };
    const data = await repo.saveSettings({ schedule });
    res.json({ schedule: data.schedule });
  } catch (e) {
    next(e);
  }
}

export async function updateCalendar(req, res, next) {
  try {
    const calendar = Array.isArray(req.body?.calendar) ? req.body.calendar : [];
    const data = await repo.saveSettings({ calendar });
    res.json({ calendar: data.calendar });
  } catch (e) {
    next(e);
  }
}

export async function updateCoaches(req, res, next) {
  try {
    const input = Array.isArray(req.body?.coaches) ? req.body.coaches : [];
    const coaches = input.map((c, idx) => ({
      id: String(c?.id || '').trim() || `coach-${idx + 1}`,
      name: String(c?.name || '').trim() || `Coach ${idx + 1}`,
      role: String(c?.role || '').trim(),
      desc: String(c?.desc || '').trim(),
      image: String(c?.image || '').trim(),
    }));
    const data = await repo.saveSettings({ coaches });
    res.json({ coaches: data.coaches });
  } catch (e) {
    next(e);
  }
}
