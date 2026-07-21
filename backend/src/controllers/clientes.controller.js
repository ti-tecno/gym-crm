import * as repo from '../repositories/clientes.repo.js';
import * as progreso from '../repositories/progreso.repo.js';
import logger from '../config/logger.js';
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
  try {
    const cliente = await repo.createCliente(req.body);

    if (req.body?.inscripcion?.peso != null) {
      try {
        await progreso.createMedida({
          clienteId: cliente.clienteId,
          fecha: req.body.inscripcion.fecha || new Date().toISOString().slice(0, 10),
          pesoKg: req.body.inscripcion.peso,
          notas: 'Peso inicial al registrar cliente',
        });
      } catch (measureErr) {
        logger.warn('No se pudo guardar la medida inicial del cliente', {
          clienteId: cliente.clienteId,
          error: measureErr?.message,
        });
      }
    }

    res.status(201).json(cliente);
  } catch (e) { next(e); }
}
export async function update(req, res, next) {
  try { res.json(await repo.updateCliente(req.params.id, req.body)); } catch (e) { next(e); }
}
export async function remove(req, res, next) {
  try { await repo.deleteCliente(req.params.id); res.status(204).end(); } catch (e) { next(e); }
}
