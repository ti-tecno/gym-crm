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

export const gastosService = {
  list:   ()            => api.get('/gastos').then(r => r.data),
  create: (body)        => api.post('/gastos', body).then(r => r.data),
  update: (id, body)    => api.put(`/gastos/${id}`, body).then(r => r.data),
  remove: (id)          => api.delete(`/gastos/${id}`).then(r => r.data),
};

export const ingresosService = {
  list:   ()            => api.get('/ingresos').then(r => r.data),
  create: (body)        => api.post('/ingresos', body).then(r => r.data),
  update: (id, body)    => api.put(`/ingresos/${id}`, body).then(r => r.data),
  remove: (id)          => api.delete(`/ingresos/${id}`).then(r => r.data),
};

export const creditosService = {
  list:   ()            => api.get('/creditos').then(r => r.data),
  create: (body)        => api.post('/creditos', body).then(r => r.data),
  update: (id, body)    => api.put(`/creditos/${id}`, body).then(r => r.data),
  remove: (id)          => api.delete(`/creditos/${id}`).then(r => r.data),
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
  createCoach:   (body)       => api.post('/rutinas/coach', body).then(r => r.data),
  updateCoach:   (id, body)   => api.put(`/rutinas/coach/${id}`, body).then(r => r.data),
  removeCoach:   (id)         => api.delete(`/rutinas/coach/${id}`).then(r => r.data),
};

export const recordatoriosService = {
  list:   ()            => api.get('/recordatorios').then(r => r.data),
  create: (body)        => api.post('/recordatorios', body).then(r => r.data),
  update: (id, body)    => api.put(`/recordatorios/${id}`, body).then(r => r.data),
};

export const settingsService = {
  public:         ()            => api.get('/settings/public').then(r => r.data),
  admin:          ()            => api.get('/settings/admin').then(r => r.data),
  updatePackages: (packages)    => api.put('/settings/admin/packages', { packages }).then(r => r.data),
  updateSchedule: (schedule)    => api.put('/settings/admin/schedule', { schedule }).then(r => r.data),
  updateCalendar: (calendar)    => api.put('/settings/admin/calendar', { calendar }).then(r => r.data),
  updateCoaches:  (coaches)     => api.put('/settings/admin/coaches',  { coaches  }).then(r => r.data),
  uploadCoachImg: (file)        => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/upload/coaches', form, { __retryCount: 3 }).then(r => r.data);
  },
};
