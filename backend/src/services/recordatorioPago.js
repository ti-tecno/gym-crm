/**
 * Instancia real del recordatorio de pago (DynamoDB + mensajero) y su tarea diaria.
 *
 * La tarea corre dentro del proceso del backend (pm2, un solo proceso). Cada minuto revisa
 * si ya pasó la hora configurada (zona México) y si hoy no ha corrido; es segura ante
 * reinicios y ejecuciones dobles porque cada envío lleva idempotencyKey determinística y
 * los ya enviados se saltan localmente.
 */
import env from '../config/env.js';
import logger from '../config/logger.js';
import * as recordatoriosRepo from '../repositories/recordatorios.repo.js';
import * as clientesRepo from '../repositories/clientes.repo.js';
import * as pagosRepo from '../repositories/pagos.repo.js';
import * as settingsRepo from '../repositories/settings.repo.js';
import { crearClienteMensajero } from './mensajero.client.js';
import { crearServicioRecordatorioPago } from './recordatorioPago.service.js';
import { hoyMx, horaMx } from './recordatorioPago.logic.js';

const config = env.MENSAJERO;

export const recordatorioPago = crearServicioRecordatorioPago({
  config,
  mensajero: crearClienteMensajero({ url: config.url, apiKey: config.apiKey }),
  repo: recordatoriosRepo,
  clientes: clientesRepo,
  pagos: pagosRepo,
  settings: settingsRepo,
  logger,
});

const REINTENTO_MS = 60 * 60_000;   // tras límite diario / mensajero caído / error de BD
const TICK_MS = 60_000;

/** Arranca la tarea diaria. Devuelve una función para detenerla. Nunca lanza. */
export function iniciarTareaRecordatorioPago() {
  for (const aviso of config.avisos) logger.warn(`[recordatorio-pago] ${aviso}`);
  if (!config.envioDisponible) {
    logger.warn('[recordatorio-pago] Tarea diaria desactivada: falta configurar la conexión con el mensajero');
    return () => {};
  }

  let ultimaFecha = null;     // día (México) en que ya se completó la corrida
  let noAntesDe = 0;          // espera tras una corrida detenida o con error

  const tick = async () => {
    const ahora = new Date();
    const hoy = hoyMx(ahora);
    if (ultimaFecha === hoy || ahora.getTime() < noAntesDe || recordatorioPago.corriendo) return;
    const { h, m } = horaMx(ahora);
    if (h * 60 + m < config.hora.h * 60 + config.hora.m) return;

    try {
      const r = await recordatorioPago.correrDia();
      // Apagado: no se marca el día; si el admin lo enciende hoy, corre en el siguiente minuto.
      if (r.omitida === 'apagado' || r.omitida === 'en_curso') return;
      if (r.detenida === 'apagado') return;
      if (r.detenida) {
        noAntesDe = Date.now() + REINTENTO_MS;
        logger.warn('[recordatorio-pago] Corrida detenida; se reintenta en una hora', r);
        return;
      }
      ultimaFecha = hoy;
      logger.info('[recordatorio-pago] Corrida diaria completada', r);
    } catch (err) {
      noAntesDe = Date.now() + REINTENTO_MS;
      logger.error('[recordatorio-pago] Error en la corrida diaria', { err: err?.message });
    }
  };

  const timer = setInterval(() => { tick().catch(() => {}); }, TICK_MS);
  timer.unref();
  logger.info(`[recordatorio-pago] Tarea diaria lista: ${String(config.hora.h).padStart(2, '0')}:${String(config.hora.m).padStart(2, '0')} (America/Mexico_City), etapas ${config.etapas.join(',')}. El envío se enciende en Backoffice → Mensajería.`);
  return () => clearInterval(timer);
}
