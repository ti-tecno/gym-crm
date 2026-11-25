import { HttpError } from '../middleware/errorHandler.js';
import * as repo from '../repositories/rutinas.repo.js';

export async function listClientes(_req, res, next) { try { res.json(await repo.listRutinasClientes()); } catch (e) { next(e); } }
export async function upsertCliente(req, res, next) { try { res.json(await repo.upsertRutinaCliente(req.body)); } catch (e) { next(e); } }

export async function listCoach(_req, res, next) { try { res.json(await repo.listRutinasCoach()); } catch (e) { next(e); } }

export async function createCoach(req, res, next) {
  try { res.status(201).json(await repo.createRutinaCoach(req.body)); } catch (e) { next(e); }
}

export async function updateCoach(req, res, next) {
  try {
    const updated = await repo.updateRutinaCoach(req.params.id, req.body);
    if (!updated) return next(new HttpError(404, 'NOT_FOUND', 'Rutina no encontrada'));
    res.json(updated);
  } catch (e) { next(e); }
}

export async function deleteCoach(req, res, next) {
  try { await repo.deleteRutinaCoach(req.params.id); res.status(204).end(); } catch (e) { next(e); }
}
