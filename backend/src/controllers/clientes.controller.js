import * as repo from '../repositories/clientes.repo.js';
import { HttpError } from '../middleware/errorHandler.js';

export async function list(req, res, next) {
  try { res.json(await repo.listClientes(req.query)); } catch (e) { next(e); }
}
export async function getOne(req, res, next) {
  try {
    const c = await repo.getCliente(req.params.id);
    if (!c) return next(new HttpError(404, 'NOT_FOUND', 'Cliente no encontrado'));
    res.json(c);
  } catch (e) { next(e); }
}
export async function create(req, res, next) {
  try { res.status(201).json(await repo.createCliente(req.body)); } catch (e) { next(e); }
}
export async function update(req, res, next) {
  try { res.json(await repo.updateCliente(req.params.id, req.body)); } catch (e) { next(e); }
}
export async function remove(req, res, next) {
  try { await repo.deleteCliente(req.params.id); res.status(204).end(); } catch (e) { next(e); }
}
