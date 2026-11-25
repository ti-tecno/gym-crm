import * as repo from '../repositories/gastos.repo.js';
import { HttpError } from '../middleware/errorHandler.js';

export async function list(_req, res, next)  { try { res.json(await repo.listGastos()); } catch (e) { next(e); } }
export async function create(req, res, next) { try { res.status(201).json(await repo.createGasto(req.body)); } catch (e) { next(e); } }
export async function update(req, res, next) {
  try {
    const updated = await repo.updateGasto(req.params.id, req.body);
    if (!updated) return next(new HttpError(404, 'NOT_FOUND', 'Gasto no encontrado'));
    res.json(updated);
  } catch (e) { next(e); }
}
export async function remove(req, res, next) { try { await repo.deleteGasto(req.params.id); res.status(204).end(); } catch (e) { next(e); } }
