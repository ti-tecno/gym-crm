import { api } from './api.js';

export const clientePortal = {
  dashboard:  ()       => api.get('/cliente/dashboard').then(r => r.data),
  membresia:  ()       => api.get('/cliente/membresia').then(r => r.data),
  rutina:     ()       => api.get('/cliente/rutina').then(r => r.data),
  programas:  ()       => api.get('/cliente/programas').then(r => r.data),
  asignarRutina: (rutinaId) => api.post('/cliente/rutina/asignar', { rutinaId }).then(r => r.data),

  workouts:   (params) => api.get('/cliente/workouts', { params }).then(r => r.data),
  addWorkout: (body)   => api.post('/cliente/workouts', body).then(r => r.data),

  medidas:    ()       => api.get('/cliente/medidas').then(r => r.data),
  addMedida:  (body)   => api.post('/cliente/medidas', body).then(r => r.data),

  prs:        ()       => api.get('/cliente/prs').then(r => r.data),

  perfil:       ()       => api.get('/cliente/perfil').then(r => r.data),
  updatePerfil: (body)   => api.put('/cliente/perfil', body).then(r => r.data),

  // Pago de membresía en línea (el monto lo decide el backend)
  pagos:      ()       => api.get('/cliente/pagos').then(r => r.data),
  checkout:   ()       => api.post('/cliente/pagos/checkout').then(r => r.data),
  pago:       (pagoId) => api.get(`/cliente/pagos/${encodeURIComponent(pagoId)}`).then(r => r.data),
};

// Liga pública /pagar/<token> (sin sesión). Usa el mismo cliente axios; sin sesión no lleva Bearer.
export const ligaPago = {
  datos:    (token)         => api.get(`/publico/pagar/${encodeURIComponent(token)}`).then(r => r.data),
  checkout: (token)         => api.post(`/publico/pagar/${encodeURIComponent(token)}/checkout`).then(r => r.data),
  pago:     (token, pagoId) => api.get(`/publico/pagar/${encodeURIComponent(token)}/pagos/${encodeURIComponent(pagoId)}`).then(r => r.data),
};
