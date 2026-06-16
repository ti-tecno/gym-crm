import * as repo from '../repositories/inventario.repo.js';
import { HttpError } from '../middleware/errorHandler.js';

export async function list(_req, res, next)   { try { res.json(await repo.listInventario()); } catch (e) { next(e); } }
export async function create(req, res, next) { try { res.status(201).json(await repo.createItem(req.body)); } catch (e) { next(e); } }
export async function update(req, res, next) {
  try {
    const updated = await repo.updateItem(req.params.id, req.body);
    if (!updated) return next(new HttpError(404, 'NOT_FOUND', 'Item no encontrado'));
    res.json(updated);
  } catch (e) { next(e); }
}
export async function remove(req, res, next) { try { await repo.deleteItem(req.params.id); res.status(204).end(); } catch (e) { next(e); } }
