import * as repo from '../repositories/rutinas.repo.js';

export async function listClientes(_req, res, next) { try { res.json(await repo.listRutinasClientes()); } catch (e) { next(e); } }
export async function upsertCliente(req, res, next) { try { res.json(await repo.upsertRutinaCliente(req.body)); } catch (e) { next(e); } }

export async function listCoach(_req, res, next) { try { res.json(await repo.listRutinasCoach()); } catch (e) { next(e); } }
export async function upsertCoach(req, res, next) { try { res.json(await repo.upsertRutinaCoach(req.body)); } catch (e) { next(e); } }
