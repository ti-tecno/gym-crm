import * as repo from '../repositories/nomina.repo.js';

export async function list(_req, res, next)   { try { res.json(await repo.listEmpleados()); } catch (e) { next(e); } }
export async function create(req, res, next) { try { res.status(201).json(await repo.createEmpleado(req.body)); } catch (e) { next(e); } }
export async function pagar(req, res, next)  { try { res.json(await repo.setEmpleadoEstado(req.params.id, 'Pagado')); } catch (e) { next(e); } }
