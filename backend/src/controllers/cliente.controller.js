/**
 * Controlador del portal CLIENTE.
 * Todos los handlers ignoran cualquier ID en URL/body y se basan en req.user.cid
 * (clienteId derivado del JWT). Esto evita IDOR — un cliente nunca puede consultar/modificar otro.
 */
import { HttpError } from '../middleware/errorHandler.js';
import { getCliente } from '../repositories/clientes.repo.js';
import { listRutinasClientes, listRutinasCoach } from '../repositories/rutinas.repo.js';
import * as progreso from '../repositories/progreso.repo.js';
import { daysUntilIso } from '../utils/dates.js';

function requireCid(req) {
  const cid = req.user?.cid;
  if (!cid) throw new HttpError(403, 'NO_CLIENTE_LINKED', 'Tu usuario no tiene perfil de cliente vinculado');
  return cid;
}

// ── Membresía ──
export async function membresia(req, res, next) {
  try {
    const cid = requireCid(req);
    const c = await getCliente(cid);
    if (!c) return next(new HttpError(404, 'CLIENTE_NOT_FOUND', 'Cliente no encontrado'));
    const diasRestantes = daysUntilIso(c.vencimiento);
    res.json({
      nombre: c.nombre,
      email: c.email,
      plan: c.plan,
      monto: c.monto,
      vencimiento: c.vencimiento,
      diasRestantes,
      estado: c.estado,
      alta: c.createdAt,
    });
  } catch (e) { next(e); }
}

// ── Rutinas ──
export async function miRutina(req, res, next) {
  try {
    const cid = requireCid(req);
    const all = await listRutinasClientes();
    const mia = all.find((r) => r.clienteId === cid) || null;
    res.json(mia);
  } catch (e) { next(e); }
}

/** Biblioteca de plantillas grupales que el cliente puede consultar. */
export async function programas(_req, res, next) {
  try { res.json(await listRutinasCoach()); } catch (e) { next(e); }
}

// ── Workouts (diario) ──
export async function listWorkouts(req, res, next) {
  try {
    const cid = requireCid(req);
    const { desde, hasta, limit } = req.query;
    const items = await progreso.listWorkoutsByCliente(cid, { desde, hasta, limit });
    res.json(items);
  } catch (e) { next(e); }
}

export async function createWorkout(req, res, next) {
  try {
    const cid = requireCid(req);
    const workout = await progreso.createWorkout({ clienteId: cid, ...req.body });
    // Recalcula PRs automáticamente
    const nuevosPRs = await progreso.recalcPRsFromWorkout(workout);
    res.status(201).json({ workout, nuevosPRs });
  } catch (e) { next(e); }
}

// ── Medidas ──
export async function listMedidas(req, res, next) {
  try {
    const cid = requireCid(req);
    res.json(await progreso.listMedidasByCliente(cid, { limit: req.query.limit }));
  } catch (e) { next(e); }
}

export async function createMedida(req, res, next) {
  try {
    const cid = requireCid(req);
    const m = await progreso.createMedida({ clienteId: cid, ...req.body });
    res.status(201).json(m);
  } catch (e) { next(e); }
}

// ── PRs ──
export async function listPRs(req, res, next) {
  try {
    const cid = requireCid(req);
    res.json(await progreso.listPRsByCliente(cid));
  } catch (e) { next(e); }
}

// ── Dashboard del cliente (todo agregado en una llamada) ──
export async function dashboardCliente(req, res, next) {
  try {
    const cid = requireCid(req);
    const [cliente, workouts, medidas, prs, rutinas] = await Promise.all([
      getCliente(cid),
      progreso.listWorkoutsByCliente(cid, { limit: 90 }),
      progreso.listMedidasByCliente(cid, { limit: 50 }),
      progreso.listPRsByCliente(cid),
      listRutinasClientes(),
    ]);
    if (!cliente) return next(new HttpError(404, 'CLIENTE_NOT_FOUND', 'Cliente no encontrado'));

    const totalSesiones = workouts.length;
    const racha = progreso.calcRacha(workouts);
    const últimoEntreno = workouts[0]?.fecha || null;
    const pesoActual = medidas.find((m) => m.pesoKg)?.pesoKg || null;
    const pesoInicial = [...medidas].reverse().find((m) => m.pesoKg)?.pesoKg || null;
    const diffPeso = pesoActual && pesoInicial ? Number((pesoActual - pesoInicial).toFixed(2)) : null;
    const rutina = rutinas.find((r) => r.clienteId === cid) || null;

    res.json({
      membresia: {
        plan: cliente.plan,
        estado: cliente.estado,
        vencimiento: cliente.vencimiento,
        diasRestantes: daysUntilIso(cliente.vencimiento),
        monto: cliente.monto,
      },
      progreso: {
        totalSesiones,
        racha,
        últimoEntreno,
        pesoActual,
        pesoInicial,
        diffPeso,
        totalPRs: prs.length,
        diasComoMiembro: cliente.createdAt
          ? Math.floor((Date.now() - new Date(cliente.createdAt)) / 86_400_000)
          : null,
      },
      rutina,
      ultimosWorkouts: workouts.slice(0, 5),
      ultimasMedidas: medidas.slice(0, 5),
      prsRecientes: prs.slice(0, 6),
    });
  } catch (e) { next(e); }
}
