import * as repo from '../repositories/recordatorios.repo.js';

export async function list(_req, res, next)   { try { res.json(await repo.listRecordatorios()); } catch (e) { next(e); } }
export async function create(req, res, next) { try { res.status(201).json(await repo.createRecordatorio(req.body)); } catch (e) { next(e); } }
export async function update(req, res, next) { try { res.json(await repo.updateRecordatorio(req.params.id, req.body)); } catch (e) { next(e); } }
