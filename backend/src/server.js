import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';

function resolveIfExists(filePath) {
  if (!filePath) return null;
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  return fs.existsSync(abs) ? abs : null;
}

const keyPath = resolveIfExists(env.TLS_KEY_PATH);
const certPath = resolveIfExists(env.TLS_CERT_PATH);

const server = (keyPath && certPath)
  ? https.createServer(
      {
        key: fs.readFileSync(keyPath, 'utf8'),
        cert: fs.readFileSync(certPath, 'utf8'),
      },
      app,
    )
  : http.createServer(app);

server.setTimeout(env.REQUEST_TIMEOUT_MS);

if (!keyPath || !certPath) {
  logger.warn('TLS no configurado (TLS_KEY_PATH/TLS_CERT_PATH). Iniciando en HTTP.');
}

server.listen(env.PORT, () => {
  const protocol = keyPath && certPath ? 'https' : 'http';
  logger.info(`IronCore API escuchando en ${protocol}://localhost:${env.PORT}${env.API_PREFIX}`);
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
