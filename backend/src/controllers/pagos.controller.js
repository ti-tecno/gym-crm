import * as repo from '../repositories/pagos.repo.js';

export async function list(req, res, next) {
  try { res.json(await repo.listPagos(req.query)); } catch (e) { next(e); }
}
export async function create(req, res, next) {
  try { res.status(201).json(await repo.createPago(req.body)); } catch (e) { next(e); }
}
