import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { parseLlaveMaestra, parseSeguridadConfig } from '../src/config/seguridad.js';
import { cifrar, descifrar, ErrorCifrado } from '../src/services/cifrado.logic.js';
import {
  enmascararTelefono, errorDeEntrega, normalizarCelularMx, resolverConfigMercadoPago, validarCredenciales,
  generarCodigoOtp, OTP,
} from '../src/services/seguridad.logic.js';
import { crearServicioSeguridad, ErrorSeguridad } from '../src/services/seguridad.service.js';
import { crearRepoSeguridad, ID_SEGURIDAD } from '../src/repositories/seguridad.repo.js';
import { crearRutasSeguridad } from '../src/routes/seguridad.routes.js';
import { crearClienteMercadoPago } from '../src/services/mercadoPago.client.js';
import { interpretarRespuesta } from '../src/services/recordatorioPago.logic.js';

// ── Datos de prueba (ficticios) ──────────────────────────────────────────────
const LLAVE_B64 = crypto.randomBytes(32).toString('base64');
const OTRA_LLAVE_B64 = crypto.randomBytes(32).toString('base64');
const TOKEN = 'APP_USR-1234567890123456-112409-0123456789abcdef0123456789abcdef-987654321';
const TOKEN_TEST = 'TEST-1234567890123456-112409-fedcba9876543210fedcba9876543210-123456789';
const SECRETO = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
const TOKEN_ENV = 'APP_USR-9999999999999999-010101-envenvenvenvenvenvenvenvenvenv00-111111111';
const SECRETO_ENV = 'envsecretoenvsecretoenvsecreto00';
const ENV_MP = {
  MERCADOPAGO_ACCESS_TOKEN: TOKEN_ENV, MERCADOPAGO_WEBHOOK_SECRET: SECRETO_ENV,
  PUBLIC_API_URL: 'https://api.iron-core.mx', PUBLIC_FRONTEND_URL: 'https://iron-core.mx',
};
const ENV_SIN_MP = { PUBLIC_API_URL: 'https://api.iron-core.mx', PUBLIC_FRONTEND_URL: 'https://iron-core.mx' };
const TEL = '55 1234 5678';
const TEL_E164 = '+525512345678';
const TEL_NUEVO = '33 9876 5432';
const TEL_NUEVO_E164 = '+523398765432';
const ADMIN = { userId: 'u-admin-1', usuario: 'admin@ironcore.mx' };
const OTRO_ADMIN = { userId: 'u-admin-2', usuario: 'otro@ironcore.mx' };

const tick = () => new Promise((r) => setImmediate(r));
const clon = (x) => (x == null ? x : structuredClone(x));

/** gym_settings en memoria con la misma condición de versión que seguridad.repo.js. */
function repoEnMemoria() {
  const items = new Map();
  return {
    items,
    async leer(id) { await tick(); return clon(items.get(id) || null); },
    async escribir(item, versionEsperada) {
      await tick();
      const actual = items.get(item.settingsId);
      if (versionEsperada == null ? actual : (!actual || actual.version !== versionEsperada)) return null;
      const nuevo = { ...clon(item), version: (Number(versionEsperada) || 0) + 1 };
      items.set(item.settingsId, nuevo);
      return clon(nuevo);
    },
  };
}

/** Mensajero simulado: guarda lo que se le pide y responde lo que se le diga. */
function mensajeroFalso() {
  const envios = [];
  let respuesta = [201, { message: { id: 'm-1', status: 'sent' } }];
  let red = false;
  return {
    envios,
    responder(status, body) { respuesta = [status, body]; red = false; },
    caerRed() { red = true; },
    ultimoCodigo: () => envios.at(-1)?.parameters?.otpCode,
    async enviarPlantilla(p) {
      envios.push(clon(p));
      if (red) return { resultado: 'error', estado: 'Fallido', motivo: 'red', reintentable: true, detener: true, httpStatus: null };
      return { ...interpretarRespuesta(...respuesta), httpStatus: respuesta[0] };
    },
  };
}

function loggerFalso() {
  const lineas = [];
  const f = (nivel) => (msg, meta) => lineas.push({ nivel, msg, meta: clon(meta) });
  return { lineas, info: f('info'), warn: f('warn'), error: f('error'), debug: f('debug') };
}

function armar({ llave = LLAVE_B64, env = ENV_SIN_MP, conexion = true, password = 'Admin#2026', repo = repoEnMemoria() } = {}) {
  const reloj = { t: new Date('2026-11-24T18:00:00Z').getTime() };
  const mensajero = mensajeroFalso();
  const logger = loggerFalso();
  const entorno = { ...env };
  const servicio = crearServicioSeguridad({
    repo,
    verificarPassword: async (_userId, p) => (password === null ? null : p === password),
    mensajero,
    mensajeroConfig: { conexionDisponible: conexion, canal: 'default' },
    config: parseSeguridadConfig({ CREDENCIALES_LLAVE_MAESTRA: llave }),
    pimienta: Buffer.from('pimienta-de-prueba'),
    envMp: () => entorno,
    logger,
    ahora: () => new Date(reloj.t),
  });
  return { servicio, repo, mensajero, logger, reloj, entorno, avanzar: (ms) => { reloj.t += ms; } };
}

async function registrarTelefono(ctx, quien = ADMIN, tel = TEL) {
  await ctx.servicio.solicitarCodigoTelefonoNuevo({ ...quien, telefono: tel, password: 'Admin#2026' });
  await ctx.servicio.confirmarTelefono({ ...quien, telefono: tel, codigo: ctx.mensajero.ultimoCodigo() });
}

async function guardarCredenciales(ctx, { token = TOKEN, secreto = SECRETO } = {}) {
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' });
  return ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: token, webhookSecret: secreto, codigo: ctx.mensajero.ultimoCodigo() });
}

const rechaza = (p, code) => assert.rejects(p, (e) => { assert.ok(e instanceof ErrorSeguridad, `ErrorSeguridad, no ${e}`); assert.equal(e.code, code); return true; });

/** Nada sensible en un objeto (respuesta de la API o líneas de log). */
function sinSecretos(obj, extra = []) {
  const s = JSON.stringify(obj);
  for (const prohibido of [TOKEN, TOKEN_TEST, SECRETO, TOKEN_ENV, SECRETO_ENV, '5512345678', '3398765432', ...extra]) {
    assert.ok(!s.includes(prohibido), `no debe aparecer ${prohibido.slice(0, 6)}…`);
  }
  for (const campo of ['hash', 'sal', 'accessTokenCifrado', 'webhookSecretCifrado', 'otpCode', 'adminTelefono']) {
    assert.ok(!s.includes(`"${campo}"`), `no debe aparecer el campo ${campo}`);
  }
}

// ── Cifrado ──────────────────────────────────────────────────────────────────

test('cifrado: ida y vuelta, IV distinto cada vez, sin texto en claro', () => {
  const { llave } = parseLlaveMaestra(LLAVE_B64);
  const a = cifrar(TOKEN, llave, 'mercadoPago.accessToken');
  const b = cifrar(TOKEN, llave, 'mercadoPago.accessToken');
  assert.notEqual(a, b);
  assert.ok(!a.includes(TOKEN) && !a.includes('APP_USR'));
  assert.equal(descifrar(a, llave, 'mercadoPago.accessToken'), TOKEN);
});

test('cifrado: dato alterado, llave equivocada, sin llave, campo cambiado', () => {
  const { llave } = parseLlaveMaestra(LLAVE_B64);
  const { llave: otra } = parseLlaveMaestra(OTRA_LLAVE_B64);
  const c = cifrar(SECRETO, llave, 'mercadoPago.webhookSecret');
  const partes = c.split('.');
  const cifradoAlterado = Buffer.from(partes[4], 'base64url'); cifradoAlterado[0] ^= 1;
  const alterado = [...partes.slice(0, 4), cifradoAlterado.toString('base64url')].join('.');
  const codigo = (fn) => { try { fn(); return null; } catch (e) { assert.ok(e instanceof ErrorCifrado); assert.ok(!e.message.includes(SECRETO)); return e.code; } };
  assert.equal(codigo(() => descifrar(alterado, llave, 'mercadoPago.webhookSecret')), 'DATO_ALTERADO');
  const tagAlterado = Buffer.from(partes[3], 'base64url'); tagAlterado[5] ^= 1;
  assert.equal(codigo(() => descifrar([...partes.slice(0, 3), tagAlterado.toString('base64url'), partes[4]].join('.'), llave, 'mercadoPago.webhookSecret')), 'DATO_ALTERADO');
  assert.equal(codigo(() => descifrar(c, otra, 'mercadoPago.webhookSecret')), 'LLAVE_DISTINTA');
  assert.equal(codigo(() => descifrar(c, null, 'mercadoPago.webhookSecret')), 'SIN_LLAVE');
  assert.equal(codigo(() => descifrar(c, llave, 'mercadoPago.accessToken')), 'DATO_ALTERADO'); // AAD
  assert.equal(codigo(() => descifrar('basura', llave, 'x')), 'FORMATO');
  assert.equal(codigo(() => cifrar('x', null, 'x')), 'SIN_LLAVE');
});

test('llave maestra: base64 o hex de 32 bytes; otra cosa se ignora con aviso', () => {
  assert.ok(parseLlaveMaestra(LLAVE_B64).llave);
  assert.ok(parseLlaveMaestra(crypto.randomBytes(32).toString('base64url')).llave);
  assert.ok(parseLlaveMaestra(crypto.randomBytes(32).toString('hex')).llave);
  for (const mala of ['', 'corta', crypto.randomBytes(16).toString('base64'), crypto.randomBytes(31).toString('hex')]) {
    const r = parseLlaveMaestra(mala);
    assert.equal(r.llave, null);
    assert.match(r.aviso, /CREDENCIALES_LLAVE_MAESTRA/);
  }
  const cfg = parseSeguridadConfig({});
  assert.equal(cfg.llaveDisponible, false);
  assert.equal(cfg.otpPlantilla, 'ironcore_codigo_verificacion');
  assert.equal(cfg.otpIdioma, 'es_MX');
});

// ── Lógica pura ──────────────────────────────────────────────────────────────

test('teléfono: celular mexicano normalizado y enmascarado', () => {
  for (const v of ['5512345678', '55 1234 5678', '(55) 1234-5678', '+52 55 1234 5678', '525512345678', '5215512345678', '+5215512345678']) {
    assert.equal(normalizarCelularMx(v), TEL_E164, v);
  }
  for (const v of ['', '12345', '0512345678', '1512345678', '+1 555 123 4567', '55123456789', 'abc5512345678', null]) {
    assert.equal(normalizarCelularMx(v), null, String(v));
  }
  assert.equal(enmascararTelefono(TEL_E164), '+52 •••••• 5678');
});

test('credenciales: solo formato, mensajes sin el valor', () => {
  assert.equal(validarCredenciales({ accessToken: TOKEN, webhookSecret: SECRETO }).ok, true);
  assert.equal(validarCredenciales({ accessToken: ` ${TOKEN_TEST} `, webhookSecret: SECRETO }).ok, true);
  const malo = validarCredenciales({ accessToken: 'token-de-otro-servicio-xxxxxxxxxxxx', webhookSecret: 'corta' });
  assert.equal(malo.ok, false);
  assert.ok(malo.errores.accessToken && malo.errores.webhookSecret);
  assert.ok(!JSON.stringify(malo.errores).includes('token-de-otro-servicio'));
  assert.equal(validarCredenciales({ accessToken: 'APP_USR-con espacio-1234567890123456', webhookSecret: SECRETO }).ok, false);
});

test('código: 6 dígitos con azar criptográfico', () => {
  const vistos = new Set();
  for (let i = 0; i < 200; i++) { const c = generarCodigoOtp(); assert.match(c, /^\d{6}$/); vistos.add(c); }
  assert.ok(vistos.size > 190);
});

// ── Prioridad Backoffice → entorno ───────────────────────────────────────────

test('resolverConfigMercadoPago: Backoffice gana, entorno de respaldo, ilegible = apagado sin respaldo', () => {
  const { llave } = parseLlaveMaestra(LLAVE_B64);
  const { llave: otra } = parseLlaveMaestra(OTRA_LLAVE_B64);
  const guardado = { mercadoPago: { accessTokenCifrado: cifrar(TOKEN, llave, 'mercadoPago.accessToken'), webhookSecretCifrado: cifrar(SECRETO, llave, 'mercadoPago.webhookSecret') } };

  const bo = resolverConfigMercadoPago({ guardado, envRaw: ENV_MP, llave });
  assert.equal(bo.origen, 'backoffice');
  assert.equal(bo.accessToken, TOKEN);
  assert.equal(bo.webhookSecret, SECRETO);
  assert.equal(bo.checkoutDisponible, true);
  assert.equal(bo.notificationUrl, 'https://api.iron-core.mx/api/v1/webhooks/mercadopago?source_news=webhooks');

  const ent = resolverConfigMercadoPago({ guardado: null, envRaw: ENV_MP, llave });
  assert.equal(ent.origen, 'entorno');
  assert.equal(ent.accessToken, TOKEN_ENV);

  assert.equal(resolverConfigMercadoPago({ guardado: null, envRaw: ENV_SIN_MP, llave }).origen, 'ninguno');

  for (const [l, patron] of [[otra, /otra llave/], [null, /falta CREDENCIALES_LLAVE_MAESTRA/]]) {
    const r = resolverConfigMercadoPago({ guardado, envRaw: ENV_MP, llave: l });
    assert.equal(r.ilegible, true);
    assert.equal(r.checkoutDisponible, false);
    assert.equal(r.webhookDisponible, false);
    assert.equal(r.accessToken, '', 'no cae a las de entorno');
    assert.match(r.avisos[0], patron);
  }
});

// ── Teléfono del administrador ───────────────────────────────────────────────

test('alta del teléfono: contraseña + código al número nuevo', async () => {
  const ctx = armar();
  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL }), 'PASSWORD_REQUERIDA');
  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: '12345', password: 'Admin#2026' }), 'TELEFONO_INVALIDO');
  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, password: 'mala' }), 'PASSWORD_INCORRECTA');
  assert.equal(ctx.mensajero.envios.length, 0, 'con contraseña incorrecta no se envía nada');

  const r = await ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, password: 'Admin#2026' });
  assert.equal(r.destino, '+52 •••••• 5678');
  const p = ctx.mensajero.envios[0];
  assert.equal(p.to, '525512345678');
  assert.equal(p.template, 'ironcore_codigo_verificacion');
  assert.equal(p.language, 'es_MX');
  assert.deepEqual(Object.keys(p.parameters), ['otpCode'], 'solo otpCode, sin body ni buttonUrlSuffix');
  assert.match(p.parameters.otpCode, /^\d{6}$/);
  assert.match(p.idempotencyKey, /^otp:/);

  // El código no se guarda en claro.
  const guardado = JSON.stringify([...ctx.repo.items.values()]);
  assert.ok(!guardado.includes(`"${p.parameters.otpCode}"`));

  const est = await ctx.servicio.confirmarTelefono({ ...ADMIN, telefono: TEL, codigo: p.parameters.otpCode });
  assert.equal(est.telefono.registrado, true);
  assert.equal(est.telefono.enmascarado, '+52 •••••• 5678');
  assert.equal(ctx.repo.items.get(ID_SEGURIDAD).adminTelefono, TEL_E164);
  sinSecretos(est);
  // Ya registrado: la contraseña sola ya no sirve para cambiarlo.
  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL_NUEVO, password: 'Admin#2026' }), 'CODIGO_FORMATO');
});

test('cuenta sin contraseña (Google): no puede registrar el teléfono', async () => {
  const ctx = armar({ password: null });
  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, password: 'x' }), 'SIN_PASSWORD');
});

test('cambio de teléfono: código al número actual y luego al nuevo', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);

  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'telefono_cambiar' });
  assert.equal(ctx.mensajero.envios.at(-1).to, '525512345678', 'primero al número actual');
  const codigoActual = ctx.mensajero.ultimoCodigo();

  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, codigo: codigoActual }), 'MISMO_TELEFONO');
  const r = await ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL_NUEVO, codigo: codigoActual });
  assert.equal(r.destino, '+52 •••••• 5432');
  assert.equal(ctx.mensajero.envios.at(-1).to, '523398765432', 'luego al número nuevo');
  const codigoNuevo = ctx.mensajero.ultimoCodigo();

  // El código del número nuevo no confirma otro número.
  await rechaza(ctx.servicio.confirmarTelefono({ ...ADMIN, telefono: '81 1111 2222', codigo: codigoNuevo }), 'CODIGO_OTRO_DESTINO');
  const est = await ctx.servicio.confirmarTelefono({ ...ADMIN, telefono: TEL_NUEVO, codigo: codigoNuevo });
  assert.equal(est.telefono.enmascarado, '+52 •••••• 5432');
  assert.equal(ctx.repo.items.get(ID_SEGURIDAD).adminTelefono, TEL_NUEVO_E164);

  // Bitácora: quién y qué, sin códigos ni números completos.
  assert.ok(ctx.logger.lineas.some((l) => /CAMBIADO/.test(l.msg) && l.meta.por === ADMIN.usuario));
  sinSecretos(ctx.logger.lineas, [codigoActual, codigoNuevo]);
});

test('cambio de teléfono: un código incorrecto del número actual no envía nada al nuevo', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'telefono_cambiar' });
  const n = ctx.mensajero.envios.length;
  const malo = ctx.mensajero.ultimoCodigo() === '000000' ? '111111' : '000000';
  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL_NUEVO, codigo: malo }), 'CODIGO_INCORRECTO');
  assert.equal(ctx.mensajero.envios.length, n);
});

// ── OTP ──────────────────────────────────────────────────────────────────────

test('OTP: sin teléfono registrado no hay código', async () => {
  const ctx = armar();
  await rechaza(ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }), 'TELEFONO_NO_REGISTRADO');
});

test('OTP: expirado a los 10 minutos', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' });
  const codigo = ctx.mensajero.ultimoCodigo();
  ctx.avanzar(OTP.VIGENCIA_MS + 1);
  await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo }), 'CODIGO_EXPIRADO');
  assert.equal(ctx.repo.items.get(ID_SEGURIDAD).mercadoPago, undefined);
});

test('OTP: un solo uso', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  await guardarCredenciales(ctx);
  const codigo = ctx.mensajero.ultimoCodigo();
  await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN_TEST, webhookSecret: SECRETO, codigo }), 'CODIGO_USADO');
  assert.equal(ctx.repo.items.get(ID_SEGURIDAD).mercadoPago.modoPrueba, false, 'no se aplicó el segundo');
});

test('OTP: 5 intentos y se invalida (aun con el código correcto después)', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' });
  const bueno = ctx.mensajero.ultimoCodigo();
  const malo = bueno === '000000' ? '111111' : '000000';
  for (let i = 1; i <= 4; i++) {
    await assert.rejects(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo: malo }),
      (e) => e.code === 'CODIGO_INCORRECTO' && e.details.intentosRestantes === 5 - i);
  }
  await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo: malo }), 'CODIGO_AGOTADO');
  await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo: bueno }), 'CODIGO_AGOTADO');
  assert.equal(ctx.repo.items.get(ID_SEGURIDAD).mercadoPago, undefined);
});

test('OTP: credenciales con formato inválido no gastan el código', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' });
  const codigo = ctx.mensajero.ultimoCodigo();
  await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: 'no-es-token', webhookSecret: SECRETO, codigo }), 'CREDENCIALES_INVALIDAS');
  await ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo });
});

test('OTP: reenvío una vez por minuto, tope por hora; el nuevo invalida al anterior', async () => {
  const ctx = armar();
  await registrarTelefono(ctx); // 1 solicitud
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }); // 2
  const primero = ctx.mensajero.ultimoCodigo();
  await assert.rejects(ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }), (e) => e.code === 'REENVIO_PRONTO' && e.details.esperaSeg > 0);
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }); // 3
  const segundo = ctx.mensajero.ultimoCodigo();
  if (primero !== segundo) {
    await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo: primero }), 'CODIGO_INCORRECTO');
  }
  ctx.avanzar(OTP.REENVIO_MS); await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }); // 4
  ctx.avanzar(OTP.REENVIO_MS); await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }); // 5
  ctx.avanzar(OTP.REENVIO_MS);
  await rechaza(ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }), 'LIMITE_POR_HORA');
  ctx.avanzar(OTP.HORA_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' });
});

test('OTP: contraseñas incorrectas cuentan para el tope por hora', async () => {
  const ctx = armar();
  for (let i = 0; i < OTP.MAX_POR_HORA; i++) {
    await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, password: `mala${i}` }), 'PASSWORD_INCORRECTA');
  }
  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, password: 'Admin#2026' }), 'LIMITE_POR_HORA');
});

test('OTP: un código de otra acción no sirve', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  await guardarCredenciales(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_borrar' });
  const codigoBorrar = ctx.mensajero.ultimoCodigo();
  await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN_TEST, webhookSecret: SECRETO, codigo: codigoBorrar }), 'CODIGO_OTRA_ACCION');
  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL_NUEVO, codigo: codigoBorrar }), 'CODIGO_OTRA_ACCION');
  // Sigue sirviendo para lo que se pidió.
  const est = await ctx.servicio.borrarCredenciales({ ...ADMIN, codigo: codigoBorrar });
  assert.equal(est.mercadoPago.guardadasEnBackoffice, false);
});

test('OTP: un código de otro usuario no sirve', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' });
  const codigo = ctx.mensajero.ultimoCodigo();
  await rechaza(ctx.servicio.guardarCredenciales({ ...OTRO_ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo }), 'SIN_CODIGO');
  // Aunque el otro usuario pida su propio código, el del primero no le sirve.
  await ctx.servicio.solicitarCodigo({ ...OTRO_ADMIN, accion: 'mp_guardar' });
  const delOtro = ctx.mensajero.ultimoCodigo();
  if (delOtro !== codigo) {
    await rechaza(ctx.servicio.guardarCredenciales({ ...OTRO_ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo }), 'CODIGO_INCORRECTO');
  }
  await ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo });
});

test('OTP: dos verificaciones simultáneas del mismo código, solo una gana', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' });
  const codigo = ctx.mensajero.ultimoCodigo();
  const resultados = await Promise.allSettled([
    ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo }),
    ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN_TEST, webhookSecret: SECRETO, codigo }),
    ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo }),
  ]);
  const ok = resultados.filter((r) => r.status === 'fulfilled');
  assert.equal(ok.length, 1, 'exactamente una');
  for (const r of resultados.filter((x) => x.status === 'rejected')) assert.equal(r.reason.code, 'CODIGO_USADO');
});

test('OTP: dos solicitudes simultáneas no dejan dos códigos válidos', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  const r = await Promise.allSettled([
    ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }),
    ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }),
  ]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
});

// ── Credenciales ─────────────────────────────────────────────────────────────

test('guardar sin OTP válido falla y no cambia nada', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo: '' }), 'CODIGO_FORMATO');
  await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo: '123456' }), 'CODIGO_USADO');
  await rechaza(ctx.servicio.borrarCredenciales({ ...ADMIN, codigo: '123456' }), 'CODIGO_USADO');
  assert.equal(ctx.repo.items.get(ID_SEGURIDAD).mercadoPago, undefined);
});

test('sin llave maestra: no se puede ni pedir el código para guardar', async () => {
  const ctx = armar({ llave: '' });
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  const n = ctx.mensajero.envios.length;
  await rechaza(ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' }), 'LLAVE_MAESTRA_FALTANTE');
  await rechaza(ctx.servicio.guardarCredenciales({ ...ADMIN, accessToken: TOKEN, webhookSecret: SECRETO, codigo: '123456' }), 'LLAVE_MAESTRA_FALTANTE');
  assert.equal(ctx.mensajero.envios.length, n);
  const est = await ctx.servicio.estado(ADMIN.userId);
  assert.equal(est.llaveMaestra.disponible, false);
  assert.match(est.llaveMaestra.aviso, /CREDENCIALES_LLAVE_MAESTRA/);
});

test('guardar: cifradas en reposo, prioridad sobre entorno y efecto inmediato sin reiniciar', async () => {
  const ctx = armar({ env: ENV_MP });
  // Cliente de MP real con fetch simulado y la misma función proveedora.
  const llamadas = [];
  const mp = crearClienteMercadoPago({
    obtenerConfig: ctx.servicio.obtenerConfigMercadoPago,
    fetchImpl: async (url, init) => { llamadas.push(init.headers.Authorization); return { ok: true, status: 200, json: async () => ({}) }; },
  });

  let cfg = await ctx.servicio.obtenerConfigMercadoPago();
  assert.equal(cfg.origen, 'entorno');
  await mp.obtenerPago('1');
  assert.equal(llamadas.at(-1), `Bearer ${TOKEN_ENV}`);

  await registrarTelefono(ctx);
  const est = await guardarCredenciales(ctx);
  cfg = await ctx.servicio.obtenerConfigMercadoPago();
  assert.equal(cfg.origen, 'backoffice');
  assert.equal(cfg.accessToken, TOKEN);
  assert.equal(cfg.webhookSecret, SECRETO);
  await mp.obtenerPago('1');
  assert.equal(llamadas.at(-1), `Bearer ${TOKEN}`, 'la siguiente llamada ya usa el nuevo');

  // En reposo: cifrado, solo últimos 4 en claro.
  const item = ctx.repo.items.get(ID_SEGURIDAD);
  assert.ok(!JSON.stringify(item).includes(TOKEN) && !JSON.stringify(item).includes(SECRETO));
  assert.match(item.mercadoPago.accessTokenCifrado, /^v1\./);
  assert.equal(item.mercadoPago.accessTokenUltimos4, TOKEN.slice(-4));

  // Lo que ve el Backoffice.
  assert.equal(est.mercadoPago.origen, 'backoffice');
  assert.equal(est.mercadoPago.configurado, true);
  assert.equal(est.mercadoPago.modoPrueba, false);
  assert.equal(est.mercadoPago.accessTokenUltimos4, TOKEN.slice(-4));
  assert.equal(est.mercadoPago.webhookSecretUltimos4, SECRETO.slice(-4));
  assert.equal(est.mercadoPago.webhookUrl, 'https://api.iron-core.mx/api/v1/webhooks/mercadopago');
  sinSecretos(est);
  sinSecretos(ctx.logger.lineas);
  assert.ok(ctx.logger.lineas.some((l) => /GUARDADAS/.test(l.msg) && l.meta.por === ADMIN.usuario));

  // Borrar → vuelven las de entorno, también sin reiniciar.
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_borrar' });
  const tras = await ctx.servicio.borrarCredenciales({ ...ADMIN, codigo: ctx.mensajero.ultimoCodigo() });
  assert.equal(tras.mercadoPago.origen, 'entorno');
  assert.equal(tras.mercadoPago.accessTokenUltimos4, TOKEN_ENV.slice(-4));
  await mp.obtenerPago('1');
  assert.equal(llamadas.at(-1), `Bearer ${TOKEN_ENV}`);
  assert.equal(ctx.repo.items.get(ID_SEGURIDAD).adminTelefono, TEL_E164, 'borrar credenciales no borra el teléfono');
});

test('credenciales de prueba se marcan como tales', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  const est = await guardarCredenciales(ctx, { token: TOKEN_TEST });
  assert.equal(est.mercadoPago.modoPrueba, true);
});

test('llave cambiada: Mercado Pago "no configurado" con aviso, sin caer al entorno y sin lanzar', async () => {
  const repo = repoEnMemoria();
  const a = armar({ repo, env: ENV_MP });
  await registrarTelefono(a);
  await guardarCredenciales(a);
  const b = armar({ repo, env: ENV_MP, llave: OTRA_LLAVE_B64 });
  const cfg = await b.servicio.obtenerConfigMercadoPago();
  assert.equal(cfg.checkoutDisponible, false);
  assert.equal(cfg.webhookDisponible, false);
  assert.equal(cfg.accessToken, '');
  const est = await b.servicio.estado(ADMIN.userId);
  assert.equal(est.mercadoPago.ilegible, true);
  assert.equal(est.mercadoPago.configurado, false);
  assert.equal(est.mercadoPago.accessTokenUltimos4, TOKEN.slice(-4), 'se siguen viendo los últimos 4 guardados');
  assert.match(est.mercadoPago.avisos[0], /otra llave/);
  sinSecretos(est);
  // Y se pueden borrar (sin necesitar la llave) para volver a capturarlas.
  b.avanzar(OTP.REENVIO_MS * 2);
  await b.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_borrar' });
  const tras = await b.servicio.borrarCredenciales({ ...ADMIN, codigo: b.mensajero.ultimoCodigo() });
  assert.equal(tras.mercadoPago.origen, 'entorno');
});

test('base de datos caída: obtenerConfigMercadoPago no lanza y queda apagado', async () => {
  const ctx = armar({ env: ENV_MP, repo: { leer: async () => { throw new Error('ddb caída'); }, escribir: async () => null } });
  const cfg = await ctx.servicio.obtenerConfigMercadoPago();
  assert.equal(cfg.checkoutDisponible, false);
  assert.match(cfg.avisos[0], /No se pudo leer/);
});

test('el código pendiente se informa sin el código ni el hash', async () => {
  const ctx = armar();
  await registrarTelefono(ctx);
  ctx.avanzar(OTP.REENVIO_MS);
  await ctx.servicio.solicitarCodigo({ ...ADMIN, accion: 'mp_guardar' });
  const codigo = ctx.mensajero.ultimoCodigo();
  const est = await ctx.servicio.estado(ADMIN.userId);
  assert.equal(est.codigoPendiente.accion, 'mp_guardar');
  assert.equal(est.codigoPendiente.destino, '+52 •••••• 5678');
  sinSecretos(est, [codigo]);
  assert.equal((await ctx.servicio.estado(OTRO_ADMIN.userId)).codigoPendiente, null);
});

// ── Fallos de entrega ────────────────────────────────────────────────────────

test('fallos de entrega: mensaje claro, no queda un código válido y se puede reintentar ya', async () => {
  const casos = [
    [403, { error: { code: 'CLIENT_DISABLED', message: 'x' } }, 'MENSAJERIA_INACTIVA', /SofIA/],
    [422, { error: { code: 'INVALID_PHONE', message: 'x' } }, 'TELEFONO_SIN_WHATSAPP', /WhatsApp/],
    [502, { error: { code: 'SEND_FAILED', retryable: true }, message: { id: 'm', status: 'failed', error: { code: 132001, reason: 'La plantilla no existe o no está aprobada' } } }, 'PLANTILLA_NO_APROBADA', /ironcore_codigo_verificacion.*aprobada/],
    [502, { error: { code: 'SEND_FAILED', retryable: false }, message: { id: 'm', status: 'failed', error: { code: 131026, reason: 'Sin WhatsApp' } } }, 'TELEFONO_SIN_WHATSAPP', /no tiene WhatsApp/],
    [429, { error: { code: 'DAILY_LIMIT' } }, 'LIMITE_MENSAJERO', /límite diario/],
    [401, { error: { code: 'UNAUTHORIZED' } }, 'MENSAJERO_LLAVE_INVALIDA', /MENSAJERO_API_KEY/],
    [403, { error: { code: 'RECIPIENT_NOT_ALLOWED' } }, 'MENSAJERO_SANDBOX', /prueba/],
  ];
  for (const [status, body, code, patron] of casos) {
    const ctx = armar();
    ctx.mensajero.responder(status, body);
    await assert.rejects(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, password: 'Admin#2026' }),
      (e) => { assert.equal(e.code, code, `${status}`); assert.match(e.message, patron); return true; });
    const enviado = ctx.mensajero.ultimoCodigo();
    await rechaza(ctx.servicio.confirmarTelefono({ ...ADMIN, telefono: TEL, codigo: enviado }), 'SIN_CODIGO');
    assert.equal((await ctx.servicio.estado(ADMIN.userId)).codigoPendiente, null);
    // Reintento inmediato (sin esperar el minuto) cuando ya funciona.
    ctx.mensajero.responder(201, { message: { id: 'm-2', status: 'sent' } });
    await ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, password: 'Admin#2026' });
    sinSecretos(ctx.logger.lineas, [enviado]);
  }
});

test('fallos de entrega: red caída y mensajero sin configurar', async () => {
  const ctx = armar();
  ctx.mensajero.caerRed();
  await rechaza(ctx.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, password: 'Admin#2026' }), 'MENSAJERO_SIN_CONEXION');
  const sin = armar({ conexion: false });
  await rechaza(sin.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL, password: 'Admin#2026' }), 'MENSAJERO_NO_CONFIGURADO');
  assert.equal(sin.mensajero.envios.length, 0);
  assert.equal((await sin.servicio.estado(ADMIN.userId)).mensajero.disponible, false);
});

test('cambio de teléfono: si el mensajero no está configurado no se gasta el código del número actual', async () => {
  const repo = repoEnMemoria();
  const a = armar({ repo });
  await registrarTelefono(a);
  a.avanzar(OTP.REENVIO_MS);
  await a.servicio.solicitarCodigo({ ...ADMIN, accion: 'telefono_cambiar' });
  const codigo = a.mensajero.ultimoCodigo();
  const b = armar({ repo, conexion: false });
  b.reloj.t = a.reloj.t;
  await rechaza(b.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL_NUEVO, codigo }), 'MENSAJERO_NO_CONFIGURADO');
  await a.servicio.solicitarCodigoTelefonoNuevo({ ...ADMIN, telefono: TEL_NUEVO, codigo });
});

test('errorDeEntrega: un envío aceptado no es error', () => {
  assert.equal(errorDeEntrega({ resultado: 'enviado', estado: 'Enviado' }), null);
  assert.equal(errorDeEntrega({ resultado: 'duplicado', estado: 'Entregado' }), null);
});

// ── Repositorio (escritura condicional) ──────────────────────────────────────

test('repositorio: escritura condicional por versión; conflicto = null', async () => {
  const comandos = [];
  class Get { constructor(i) { this.input = i; this.tipo = 'get'; } }
  class Put { constructor(i) { this.input = i; this.tipo = 'put'; } }
  let falla = false;
  const ddb = { async send(cmd) {
    comandos.push(cmd);
    if (cmd.tipo === 'get') return { Item: { settingsId: 'x', version: 3 } };
    if (falla) { const e = new Error('cond'); e.name = 'ConditionalCheckFailedException'; throw e; }
    return {};
  } };
  const repo = crearRepoSeguridad({ ddb, tabla: 'gym_settings', GetCommand: Get, PutCommand: Put });
  assert.deepEqual(await repo.leer('x'), { settingsId: 'x', version: 3 });
  assert.equal(comandos[0].input.ConsistentRead, true);
  const escrito = await repo.escribir({ settingsId: 'x', a: 1 }, 3);
  assert.equal(escrito.version, 4);
  assert.equal(comandos[1].input.ConditionExpression, '#v = :v');
  assert.equal(comandos[1].input.ExpressionAttributeValues[':v'], 3);
  await repo.escribir({ settingsId: 'y' }, null);
  assert.equal(comandos[2].input.ConditionExpression, 'attribute_not_exists(settingsId)');
  assert.equal(comandos[2].input.TableName, 'gym_settings');
  falla = true;
  assert.equal(await repo.escribir({ settingsId: 'x' }, 3), null);
});

// ── API (fetch contra un Express local con servicio real y repositorio simulado) ─

async function servidor(ctx) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, _res, next) => {
    const u = req.get('x-test-user');
    if (!u) { const e = new Error('Token requerido'); e.status = 401; e.code = 'NO_TOKEN'; return next(e); }
    req.user = JSON.parse(u);
    next();
  };
  const requireRole = (...roles) => (req, _res, next) => {
    if (!roles.includes(req.user.rol)) { const e = new Error('Sin permisos'); e.status = 403; e.code = 'FORBIDDEN'; return next(e); }
    next();
  };
  const requireCsrf = (req, _res, next) => {
    if (!req.get('X-CSRF-Token')) { const e = new Error('CSRF'); e.status = 403; e.code = 'CSRF_FAIL'; return next(e); }
    next();
  };
  app.use('/api/v1/settings/admin/seguridad', crearRutasSeguridad({ servicio: ctx.servicio, requireAuth, requireRole, requireCsrf }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.name === 'ZodError') return res.status(400).json({ error: 'Datos inválidos', code: 'VALIDATION_ERROR', details: err.flatten().fieldErrors });
    res.status(err.status || 500).json({ error: err.message, code: err.code, details: err.details });
  });
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}/api/v1/settings/admin/seguridad`;
  const llamar = async (method, path, body, { user = { sub: ADMIN.userId, email: ADMIN.usuario, rol: 'ADMIN' }, csrf = true } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': JSON.stringify(user) } : {}), ...(csrf ? { 'X-CSRF-Token': 't' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const texto = await res.text();
    return { status: res.status, texto, json: JSON.parse(texto), headers: res.headers };
  };
  return { llamar, cerrar: () => new Promise((r) => srv.close(r)) };
}

test('API: solo ADMIN, CSRF en cambios, validación y ninguna respuesta con secretos', async () => {
  const ctx = armar({ env: ENV_MP });
  const api = await servidor(ctx);
  try {
    assert.equal((await api.llamar('GET', '/', null, { user: null })).status, 401);
    assert.equal((await api.llamar('GET', '/', null, { user: { sub: 'r', rol: 'RECEP' } })).status, 403);
    assert.equal((await api.llamar('POST', '/codigo', { accion: 'mp_guardar' }, { csrf: false })).status, 403);
    assert.equal((await api.llamar('POST', '/codigo', { accion: 'otra' })).status, 400);
    assert.equal((await api.llamar('PUT', '/mercadopago', { accessToken: TOKEN, webhookSecret: SECRETO, codigo: '1', extra: 1 })).status, 400);

    const respuestas = [];
    const r0 = await api.llamar('GET', '/');
    assert.equal(r0.status, 200);
    assert.equal(r0.headers.get('cache-control'), 'no-store');
    assert.equal(r0.json.mercadoPago.origen, 'entorno');
    respuestas.push(r0.texto);

    respuestas.push((await api.llamar('POST', '/telefono/codigo', { telefono: TEL, password: 'Admin#2026' })).texto);
    const conf = await api.llamar('PUT', '/telefono', { telefono: TEL, codigo: ctx.mensajero.ultimoCodigo() });
    assert.equal(conf.status, 200);
    respuestas.push(conf.texto);

    // Sin código válido: 400 y nada guardado.
    const sin = await api.llamar('PUT', '/mercadopago', { accessToken: TOKEN, webhookSecret: SECRETO, codigo: '123456' });
    assert.equal(sin.status, 400);
    respuestas.push(sin.texto);
    // Formato inválido: los mensajes no repiten el valor.
    const fmt = await api.llamar('PUT', '/mercadopago', { accessToken: 'secreto-mal-puesto-123', webhookSecret: SECRETO, codigo: '123456' });
    assert.equal(fmt.json.code, 'CREDENCIALES_INVALIDAS');
    assert.ok(!fmt.texto.includes('secreto-mal-puesto-123'));
    respuestas.push(fmt.texto);

    ctx.avanzar(OTP.REENVIO_MS);
    const pedir = await api.llamar('POST', '/codigo', { accion: 'mp_guardar' });
    assert.equal(pedir.status, 200);
    respuestas.push(pedir.texto);
    const pronto = await api.llamar('POST', '/codigo', { accion: 'mp_guardar' });
    assert.equal(pronto.status, 429);
    assert.equal(pronto.json.code, 'REENVIO_PRONTO');
    const codigo = ctx.mensajero.ultimoCodigo();
    const guardar = await api.llamar('PUT', '/mercadopago', { accessToken: TOKEN, webhookSecret: SECRETO, codigo });
    assert.equal(guardar.status, 200);
    assert.equal(guardar.json.mercadoPago.origen, 'backoffice');
    respuestas.push(guardar.texto);
    respuestas.push((await api.llamar('GET', '/')).texto);
    const reuso = await api.llamar('PUT', '/mercadopago', { accessToken: TOKEN, webhookSecret: SECRETO, codigo });
    assert.equal(reuso.json.code, 'CODIGO_USADO');

    for (const t of respuestas) sinSecretos(JSON.parse(t), [codigo]);
  } finally {
    await api.cerrar();
  }
});
