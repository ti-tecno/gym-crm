function filled(v) {
  return typeof v === 'string' ? v.trim().length > 0 : v != null;
}

/**
 * Determina si un registro de gym_clientes tiene el cuestionario de registro completo
 * (mismas reglas obligatorias/condicionadas que el formulario de auto-registro).
 * Cuentas creadas antes de este cuestionario, por staff, o vinculadas a Google sin
 * pasar por el registro completo lo tendrán en false hasta que se complete vía
 * PUT /cliente/perfil.
 */
export function isPerfilCompleto(cliente) {
  if (!cliente) return false;
  const insc = cliente.inscripcion || {};
  const salud = insc.salud || {};
  const habitos = insc.habitos || {};
  const emergencia = insc.emergencia || {};

  if (!filled(cliente.apellido)) return false;
  if (!filled(cliente.telefono)) return false;
  if (!filled(insc.fechaNacimiento)) return false;
  if (!filled(insc.edad)) return false;
  if (!filled(insc.genero)) return false;
  if (!filled(insc.peso)) return false;
  if (!filled(insc.grupoSanguineo)) return false;
  if (!filled(insc.alergiaMedicamentos)) return false;
  if (!filled(emergencia.nombre)) return false;
  if (!filled(emergencia.parentesco)) return false;
  if (!filled(emergencia.telefono)) return false;
  if (!filled(salud.factoresRiesgo)) return false;
  if (!filled(salud.medicamentoActual)) return false;
  if (!filled(habitos.ultimaVezPrograma)) return false;
  if (!Array.isArray(habitos.beneficios) || habitos.beneficios.length === 0) return false;
  if (!habitos.aceptoPrivacidad) return false;
  if (!habitos.aceptoResponsiva) return false;

  if (insc.estudiante && !filled(insc.matricula)) return false;
  if (habitos.actividadHabitual) {
    if (!filled(habitos.actividadTipo)) return false;
    if (!filled(habitos.frecuenciaSemanal)) return false;
    if (!filled(habitos.tiempoSesion)) return false;
  }
  return true;
}
