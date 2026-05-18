import { api } from './api.js';

export const dashboardService = {
  summary: () => api.get('/dashboard/summary').then(r => r.data),
};

export const clientesService = {
  list:   (params = {}) => api.get('/clientes', { params }).then(r => r.data),
  get:    (id)          => api.get(`/clientes/${id}`).then(r => r.data),
  create: (body)        => api.post('/clientes', body).then(r => r.data),
  update: (id, body)    => api.put(`/clientes/${id}`, body).then(r => r.data),
  remove: (id)          => api.delete(`/clientes/${id}`).then(r => r.data),
};

export const pagosService = {
  list:   (params = {}) => api.get('/pagos', { params }).then(r => r.data),
  create: (body)        => api.post('/pagos', body).then(r => r.data),
};

export const inventarioService = {
  list:   ()            => api.get('/inventario').then(r => r.data),
  create: (body)        => api.post('/inventario', body).then(r => r.data),
  update: (id, body)    => api.put(`/inventario/${id}`, body).then(r => r.data),
  remove: (id)          => api.delete(`/inventario/${id}`).then(r => r.data),
};

export const nominaService = {
  list:   ()            => api.get('/nomina').then(r => r.data),
  create: (body)        => api.post('/nomina', body).then(r => r.data),
  pagar:  (id)          => api.post(`/nomina/${id}/pagar`).then(r => r.data),
};

export const rutinasService = {
  listClientes:  ()           => api.get('/rutinas/clientes').then(r => r.data),
  upsertCliente: (body)       => api.post('/rutinas/clientes', body).then(r => r.data),
  listCoach:     ()           => api.get('/rutinas/coach').then(r => r.data),
  upsertCoach:   (body)       => api.post('/rutinas/coach', body).then(r => r.data),
};

export const recordatoriosService = {
  list:   ()            => api.get('/recordatorios').then(r => r.data),
  create: (body)        => api.post('/recordatorios', body).then(r => r.data),
  update: (id, body)    => api.put(`/recordatorios/${id}`, body).then(r => r.data),
};
