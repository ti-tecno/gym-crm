import http from 'node:http';
import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';

const server = http.createServer(app);
server.setTimeout(env.REQUEST_TIMEOUT_MS);

server.listen(env.PORT, () => {
  logger.info(`GymOS API escuchando en http://localhost:${env.PORT}${env.API_PREFIX}`);
});

function shutdown(signal) {
  logger.info(`Recibida ${signal}. Cerrando…`);
  server.close((err) => {
    if (err) { logger.error('Error cerrando servidor', { err: err.message }); process.exit(1); }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err: err.message });
  process.exit(1);
});
