import { api } from './api.js';

export const clientePortal = {
  dashboard:  ()       => api.get('/cliente/dashboard').then(r => r.data),
  membresia:  ()       => api.get('/cliente/membresia').then(r => r.data),
  rutina:     ()       => api.get('/cliente/rutina').then(r => r.data),
  programas:  ()       => api.get('/cliente/programas').then(r => r.data),

  workouts:   (params) => api.get('/cliente/workouts', { params }).then(r => r.data),
  addWorkout: (body)   => api.post('/cliente/workouts', body).then(r => r.data),

  medidas:    ()       => api.get('/cliente/medidas').then(r => r.data),
  addMedida:  (body)   => api.post('/cliente/medidas', body).then(r => r.data),

  prs:        ()       => api.get('/cliente/prs').then(r => r.data),
};
