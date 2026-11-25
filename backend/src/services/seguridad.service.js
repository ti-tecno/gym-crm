/**
 * Backoffice → Mercado Pago: credenciales cifradas en reposo, teléfono del administrador del sitio
 * y código de un solo uso (OTP) por WhatsApp que autoriza cada cambio.
 *
 * Fábrica con dependencias inyectadas (repositorio, usuarios, mensajero, llave, reloj) para
 * probarla sin DynamoDB ni red. El cableado real está en seguridad.js.
 *
 * Reglas:
 *  - Guardar o borrar credenciales y cambiar el teléfono exigen un código válido EN LA MISMA
 *    petición: verificarlo autoriza esa operación y nada más (no abre una sesión "verificada").
 *  - El código se liga a usuario + acción + destino; se guarda solo su HMAC; vale 10 min, un uso,
 *    5 intentos; un código nuevo invalida el anterior; 1 reenvío por minuto y 5 por hora.
 *  - Toda escritura es condicional por versión: dos verificaciones simultáneas del mismo código
 *    no pueden ganar las dos.
 *  - El OTP va al administrador y NO depende del interruptor de mensajería de clientes.
 *  - Nada de lo que se devuelve o se registra en el log contiene secretos, códigos, hashes ni el
 *    teléfono completo.
 */
import crypto from 'node:crypto';
import { ID_SEGURIDAD, idOtp } from '../repositories/seguridad.repo.js';
import { cifrar } from './cifrado.logic.js';
import {
  ACCION, CONTEXTO_SECRETO, CONTEXTO_TOKEN, ETIQUETA_ACCION, MENSAJE_VERIFICACION, OTP,
  codigoVigente, configMercadoPagoNoDisponible, enmascararTelefono, errorDeEntrega, evaluarLimites,
  evaluarVerificacion, generarCodigoOtp, hashOtp, normalizarCelularMx, resolverConfigMercadoPago,
  solicitudesRecientes, telefonoParaMensajero, ultimos4, urlWebhookMercadoPago, validarCredenciales,
} from './seguridad.logic.js';

export class ErrorSeguridad extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const REINTENTOS_ESCRITURA = 5;

export function crearServicioSeguridad({
  repo,
  verificarPassword,            // async (userId, password) → true | false | null (sin contraseña)
  mensajero,                    // { enviarPlantilla }
  mensajeroConfig,              // { conexionDisponible, canal }
  config,                       // parseSeguridadConfig(...)
  pimienta,                     // Buffer/string secreto del servidor para el HMAC del código
  envMp = () => ({}),           // variables de entorno crudas de Mercado Pago (se leen en cada llamada)
  apiPrefix = '/api/v1',
  logger,
  ahora = () => new Date(),
  generarCodigo = generarCodigoOtp,
}) {
  const leerSeguridad = () => repo.leer(ID_SEGURIDAD);

  // ── Configuración de Mercado Pago (punto único, sin caché) ──────────────────
  async function obtenerConfigMercadoPago() {
    let guardado;
    try {
      guardado = await leerSeguridad();
    } catch (e) {
      logger?.error('[mercadopago] No se pudo leer la configuración guardada', { err: e?.name || 'error' });
      return configMercadoPagoNoDisponible({ envRaw: envMp(), apiPrefix });
    }
    return resolverConfigMercadoPago({ guardado, envRaw: envMp(), llave: config.llave, apiPrefix });
  }

  /** Lee-modifica-escribe "sitio-seguridad" con reintento ante escrituras simultáneas. */
  async function actualizarSeguridad(cambiar) {
    for (let i = 0; i < REINTENTOS_ESCRITURA; i++) {
      const actual = await leerSeguridad();
      const siguiente = cambiar(actual ? { ...actual } : { settingsId: ID_SEGURIDAD });
      const escrito = await repo.escribir({ ...siguiente, settingsId: ID_SEGURIDAD }, actual ? actual.version ?? 0 : null);
      if (escrito) return escrito;
    }
    throw new ErrorSeguridad(409, 'CONFLICTO', 'Otra persona está cambiando esta configuración al mismo tiempo. Inténtalo de nuevo.');
  }

  // ── Código de un solo uso ──────────────────────────────────────────────────

  /**
   * Genera, guarda (solo el hash) y envía un código. `antesDeEnviar` (opcional) se ejecuta tras
   * revisar los límites: si devuelve un error se registra la solicitud (cuenta para el tope por
   * hora, así una contraseña incorrecta no se puede probar sin fin) y se lanza.
   */
  async function emitirCodigo({ userId, usuario, accion, destino, extra = {}, antesDeEnviar, ignorarReenvio = false }) {
    if (!mensajeroConfig?.conexionDisponible) {
      throw new ErrorSeguridad(503, 'MENSAJERO_NO_CONFIGURADO', 'El servicio de WhatsApp no está configurado en el servidor (MENSAJERO_URL / MENSAJERO_API_KEY), así que no se puede enviar el código.');
    }
    const now = ahora();
    const id = idOtp(userId);
    const previo = await repo.leer(id);
    const limite = evaluarLimites(previo, now, { ignorarReenvio });
    if (limite) throw new ErrorSeguridad(429, limite.code, limite.message, { esperaSeg: limite.esperaSeg });

    const solicitudes = [...solicitudesRecientes(previo, now), now.toISOString()];

    if (antesDeEnviar) {
      const fallo = await antesDeEnviar();
      if (fallo) {
        // Se registra el intento; el código vigente (si lo hay) no se toca.
        await repo.escribir({ ...(previo || { settingsId: id, userId }), solicitudes }, previo ? previo.version ?? 0 : null);
        throw fallo;
      }
    }

    const codigo = generarCodigo();
    const sal = crypto.randomBytes(16).toString('hex');
    const expiraAt = new Date(now.getTime() + OTP.VIGENCIA_MS).toISOString();
    const registro = {
      settingsId: id,
      userId,
      accion,
      destino,
      hash: hashOtp({ codigo, sal, pimienta, userId, accion, destino }),
      sal,
      estado: 'pendiente',
      intentos: 0,
      creadoAt: now.toISOString(),
      expiraAt,
      ultimoEnvioAt: now.toISOString(),
      solicitudes,
      telefonoAnterior: null,
      ...extra,
    };
    // Primero se guarda (reemplaza e invalida el anterior), luego se envía: si dos solicitudes
    // llegan juntas solo una gana.
    const escrito = await repo.escribir(registro, previo ? previo.version ?? 0 : null);
    if (!escrito) throw new ErrorSeguridad(429, 'REENVIO_PRONTO', 'Ya se está enviando un código. Espera un momento.', { esperaSeg: 5 });

    const r = await mensajero.enviarPlantilla({
      to: telefonoParaMensajero(destino),
      ...(mensajeroConfig.canal ? { channel: mensajeroConfig.canal } : {}),
      template: config.otpPlantilla,
      language: config.otpIdioma,
      parameters: { otpCode: codigo },
      idempotencyKey: `otp:${crypto.randomUUID()}`,
    });
    const fallo = errorDeEntrega(r, { plantilla: config.otpPlantilla });
    if (fallo) {
      // No queda un código válido que nadie recibió, y se puede volver a pedir sin esperar el minuto.
      await repo.escribir({ ...escrito, estado: 'anulado', hash: null, sal: null, ultimoEnvioAt: previo?.ultimoEnvioAt ?? null }, escrito.version);
      logger?.warn('[seguridad] No se pudo enviar el código de verificación', { por: usuario, accion, destino: enmascararTelefono(destino), resultado: r?.resultado, codigoError: fallo.code });
      throw new ErrorSeguridad(fallo.status, fallo.code, fallo.message);
    }
    logger?.info('[seguridad] Código de verificación enviado', { por: usuario, accion, destino: enmascararTelefono(destino) });
    return {
      enviado: true,
      accion,
      destino: enmascararTelefono(destino),
      expiraAt,
      reenvioDisponibleAt: new Date(now.getTime() + OTP.REENVIO_MS).toISOString(),
    };
  }

  /**
   * Verifica y CONSUME un código en una sola escritura condicional. Lanza si no es válido.
   * Devuelve el registro (para leer datos ligados, como telefonoAnterior).
   */
  async function consumirCodigo({ userId, usuario, accion, destino, codigo }) {
    const id = idOtp(userId);
    for (let i = 0; i < REINTENTOS_ESCRITURA; i++) {
      const now = ahora();
      const r = await repo.leer(id);
      const ev = evaluarVerificacion(r, { codigo, userId, accion, destino, pimienta, now });
      if (ev.resultado === 'ok') {
        const escrito = await repo.escribir({ ...r, estado: 'usado', hash: null, sal: null, usadoAt: now.toISOString() }, r.version ?? 0);
        if (!escrito) continue; // otra verificación llegó antes: se relee (y verá "usado")
        return r;
      }
      if (ev.resultado === 'incorrecto') {
        const agotado = ev.intentos >= OTP.MAX_INTENTOS;
        const escrito = await repo.escribir({ ...r, intentos: ev.intentos, ...(agotado ? { estado: 'agotado', hash: null, sal: null } : {}) }, r.version ?? 0);
        if (!escrito) continue;
        logger?.warn('[seguridad] Código de verificación incorrecto', { por: usuario, accion, intentosRestantes: ev.intentosRestantes });
        throw new ErrorSeguridad(400, agotado ? 'CODIGO_AGOTADO' : 'CODIGO_INCORRECTO',
          agotado ? 'Código incorrecto. Se agotaron los intentos; pide un código nuevo.' : `Código incorrecto. Te quedan ${ev.intentosRestantes} intento(s).`,
          { intentosRestantes: ev.intentosRestantes });
      }
      const code = { expirado: 'CODIGO_EXPIRADO', usado: 'CODIGO_USADO', agotado: 'CODIGO_AGOTADO', otra_accion: 'CODIGO_OTRA_ACCION', otro_destino: 'CODIGO_OTRO_DESTINO' }[ev.resultado] || 'SIN_CODIGO';
      throw new ErrorSeguridad(400, code, MENSAJE_VERIFICACION[ev.resultado] || MENSAJE_VERIFICACION.sin_codigo);
    }
    throw new ErrorSeguridad(409, 'CONFLICTO', 'No se pudo verificar el código por peticiones simultáneas. Inténtalo de nuevo.');
  }

  const codigoValido = (codigo) => {
    if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo.trim())) {
      throw new ErrorSeguridad(400, 'CODIGO_FORMATO', 'El código son 6 dígitos.');
    }
    return codigo.trim();
  };

  async function telefonoRegistrado() {
    const seg = await leerSeguridad();
    if (!seg?.adminTelefono) {
      throw new ErrorSeguridad(409, 'TELEFONO_NO_REGISTRADO', 'Primero registra el teléfono del administrador del sitio: ahí llegan los códigos.');
    }
    return seg;
  }

  // ── Operaciones expuestas ──────────────────────────────────────────────────

  /** Lo que ve el Backoffice. Nunca incluye valores completos, hashes ni el teléfono completo. */
  async function estado(userId) {
    const now = ahora();
    const [seg, otp] = await Promise.all([leerSeguridad(), repo.leer(idOtp(userId))]);
    const cfg = resolverConfigMercadoPago({ guardado: seg, envRaw: envMp(), llave: config.llave, apiPrefix });
    const mp = seg?.mercadoPago || null;
    const guardadas = Boolean(mp?.accessTokenCifrado || mp?.webhookSecretCifrado);
    const fuente = cfg.origen === 'backoffice'
      ? { accessToken: mp?.accessTokenUltimos4 ?? null, webhookSecret: mp?.webhookSecretUltimos4 ?? null, modoPrueba: cfg.ilegible ? mp?.modoPrueba === true : cfg.modoPrueba }
      : { accessToken: ultimos4(cfg.accessToken), webhookSecret: ultimos4(cfg.webhookSecret), modoPrueba: cfg.modoPrueba };
    const pendiente = codigoVigente(otp, now) ? {
      accion: otp.accion,
      etiqueta: ETIQUETA_ACCION[otp.accion] || otp.accion,
      destino: enmascararTelefono(otp.destino),
      expiraAt: otp.expiraAt,
      reenvioDisponibleAt: new Date(Date.parse(otp.ultimoEnvioAt) + OTP.REENVIO_MS).toISOString(),
      intentosRestantes: Math.max(0, OTP.MAX_INTENTOS - (Number(otp.intentos) || 0)),
    } : null;
    return {
      llaveMaestra: { disponible: config.llaveDisponible, aviso: config.avisoLlave },
      mensajero: { disponible: Boolean(mensajeroConfig?.conexionDisponible), plantilla: config.otpPlantilla },
      telefono: {
        registrado: Boolean(seg?.adminTelefono),
        enmascarado: enmascararTelefono(seg?.adminTelefono),
        actualizadoPor: seg?.adminTelefonoActualizadoPor ?? null,
        actualizadoAt: seg?.adminTelefonoActualizadoAt ?? null,
      },
      mercadoPago: {
        configurado: cfg.checkoutDisponible,
        webhookDisponible: cfg.webhookDisponible,
        origen: cfg.origen,
        guardadasEnBackoffice: guardadas,
        ilegible: cfg.ilegible === true,
        modoPrueba: fuente.accessToken ? fuente.modoPrueba : null,
        accessTokenUltimos4: fuente.accessToken,
        webhookSecretUltimos4: fuente.webhookSecret,
        actualizadoPor: guardadas ? mp?.actualizadoPor ?? null : null,
        actualizadoAt: guardadas ? mp?.actualizadoAt ?? null : null,
        webhookUrl: urlWebhookMercadoPago(cfg, apiPrefix),
        avisos: cfg.avisos,
      },
      codigoPendiente: pendiente,
      otp: { vigenciaMin: OTP.VIGENCIA_MS / 60_000, maxIntentos: OTP.MAX_INTENTOS, reenvioSeg: OTP.REENVIO_MS / 1000, maxPorHora: OTP.MAX_POR_HORA },
    };
  }

  /** Código al teléfono registrado para guardar/borrar credenciales o para empezar a cambiar el teléfono. */
  async function solicitarCodigo({ userId, usuario, accion }) {
    if (![ACCION.MP_GUARDAR, ACCION.MP_BORRAR, ACCION.TELEFONO_CAMBIAR].includes(accion)) {
      throw new ErrorSeguridad(400, 'ACCION_INVALIDA', 'Operación no reconocida.');
    }
    const seg = await telefonoRegistrado();
    if (accion === ACCION.MP_GUARDAR && !config.llaveDisponible) {
      throw new ErrorSeguridad(409, 'LLAVE_MAESTRA_FALTANTE', config.avisoLlave || 'Falta la llave maestra en el servidor.');
    }
    if (accion === ACCION.MP_BORRAR && !(seg.mercadoPago?.accessTokenCifrado || seg.mercadoPago?.webhookSecretCifrado)) {
      throw new ErrorSeguridad(409, 'SIN_CREDENCIALES_GUARDADAS', 'No hay credenciales guardadas en el Backoffice que borrar.');
    }
    logger?.info('[seguridad] Código de verificación solicitado', { por: usuario, accion });
    return emitirCodigo({ userId, usuario, accion, destino: seg.adminTelefono });
  }

  /**
   * Código al número NUEVO. Primera vez: exige la contraseña actual. Cambio: exige el código que
   * llegó al número actual (se consume aquí) y el registro del nuevo código guarda cuál era el
   * número anterior, para que la confirmación no se aplique si alguien lo cambió entretanto.
   */
  async function solicitarCodigoTelefonoNuevo({ userId, usuario, telefono, password, codigo }) {
    const nuevo = normalizarCelularMx(telefono);
    if (!nuevo) throw new ErrorSeguridad(400, 'TELEFONO_INVALIDO', 'Escribe un celular mexicano de 10 dígitos con WhatsApp (p. ej. 55 1234 5678).');
    const seg = await leerSeguridad();
    const actual = seg?.adminTelefono || null;

    if (!actual) {
      if (typeof password !== 'string' || !password) {
        throw new ErrorSeguridad(400, 'PASSWORD_REQUERIDA', 'Para registrar el teléfono por primera vez escribe tu contraseña actual.');
      }
      logger?.info('[seguridad] Código de verificación solicitado', { por: usuario, accion: ACCION.TELEFONO_CONFIRMAR, destino: enmascararTelefono(nuevo), primeraVez: true });
      return emitirCodigo({
        userId, usuario, accion: ACCION.TELEFONO_CONFIRMAR, destino: nuevo, extra: { telefonoAnterior: null },
        antesDeEnviar: async () => {
          const ok = await verificarPassword(userId, password);
          if (ok === null) return new ErrorSeguridad(409, 'SIN_PASSWORD', 'Tu cuenta no tiene contraseña (entras con Google). Pide que te asignen una para poder registrar el teléfono.');
          if (!ok) {
            logger?.warn('[seguridad] Contraseña incorrecta al registrar el teléfono del administrador', { por: usuario });
            return new ErrorSeguridad(400, 'PASSWORD_INCORRECTA', 'La contraseña no es correcta.');
          }
          return null;
        },
      });
    }

    if (nuevo === actual) throw new ErrorSeguridad(400, 'MISMO_TELEFONO', 'Ese ya es el teléfono registrado.');
    const cod = codigoValido(codigo);
    // Antes de gastar el código del número actual, se revisa que el siguiente envío sí sea posible.
    if (!mensajeroConfig?.conexionDisponible) {
      throw new ErrorSeguridad(503, 'MENSAJERO_NO_CONFIGURADO', 'El servicio de WhatsApp no está configurado en el servidor (MENSAJERO_URL / MENSAJERO_API_KEY), así que no se puede enviar el código.');
    }
    const limite = evaluarLimites(await repo.leer(idOtp(userId)), ahora(), { ignorarReenvio: true });
    if (limite) throw new ErrorSeguridad(429, limite.code, limite.message, { esperaSeg: limite.esperaSeg });

    await consumirCodigo({ userId, usuario, accion: ACCION.TELEFONO_CAMBIAR, destino: actual, codigo: cod });
    logger?.info('[seguridad] Código de verificación solicitado', { por: usuario, accion: ACCION.TELEFONO_CONFIRMAR, destino: enmascararTelefono(nuevo), anterior: enmascararTelefono(actual) });
    return emitirCodigo({ userId, usuario, accion: ACCION.TELEFONO_CONFIRMAR, destino: nuevo, extra: { telefonoAnterior: actual }, ignorarReenvio: true });
  }

  /** Confirma el número nuevo con el código que le llegó y lo guarda. */
  async function confirmarTelefono({ userId, usuario, telefono, codigo }) {
    const nuevo = normalizarCelularMx(telefono);
    if (!nuevo) throw new ErrorSeguridad(400, 'TELEFONO_INVALIDO', 'Escribe un celular mexicano de 10 dígitos con WhatsApp.');
    const cod = codigoValido(codigo);
    const registro = await consumirCodigo({ userId, usuario, accion: ACCION.TELEFONO_CONFIRMAR, destino: nuevo, codigo: cod });
    const anteriorEsperado = registro.telefonoAnterior || null;
    const now = ahora().toISOString();
    await actualizarSeguridad((seg) => {
      if ((seg.adminTelefono || null) !== anteriorEsperado) {
        throw new ErrorSeguridad(409, 'TELEFONO_CAMBIO_CONCURRENTE', 'El teléfono del administrador cambió mientras confirmabas. Vuelve a empezar.');
      }
      return { ...seg, adminTelefono: nuevo, adminTelefonoActualizadoPor: usuario, adminTelefonoActualizadoAt: now };
    });
    logger?.info(anteriorEsperado ? '[seguridad] Teléfono del administrador CAMBIADO' : '[seguridad] Teléfono del administrador REGISTRADO', {
      por: usuario, telefono: enmascararTelefono(nuevo), ...(anteriorEsperado ? { anterior: enmascararTelefono(anteriorEsperado) } : {}),
    });
    return estado(userId);
  }

  /** Guarda (cifradas) Access Token y clave secreta de webhooks. Efecto inmediato, sin reiniciar. */
  async function guardarCredenciales({ userId, usuario, accessToken, webhookSecret, codigo }) {
    if (!config.llaveDisponible) {
      throw new ErrorSeguridad(409, 'LLAVE_MAESTRA_FALTANTE', config.avisoLlave || 'Falta la llave maestra en el servidor.');
    }
    // El formato se revisa ANTES de gastar el código.
    const v = validarCredenciales({ accessToken, webhookSecret });
    if (!v.ok) throw new ErrorSeguridad(400, 'CREDENCIALES_INVALIDAS', 'Revisa el formato de las credenciales.', v.errores);
    const cod = codigoValido(codigo);
    const seg = await telefonoRegistrado();
    await consumirCodigo({ userId, usuario, accion: ACCION.MP_GUARDAR, destino: seg.adminTelefono, codigo: cod });

    const mercadoPago = {
      accessTokenCifrado: cifrar(v.accessToken, config.llave, CONTEXTO_TOKEN),
      webhookSecretCifrado: cifrar(v.webhookSecret, config.llave, CONTEXTO_SECRETO),
      accessTokenUltimos4: ultimos4(v.accessToken),
      webhookSecretUltimos4: ultimos4(v.webhookSecret),
      modoPrueba: v.accessToken.startsWith('TEST-'),
      llaveId: config.llaveId,
      actualizadoPor: usuario,
      actualizadoAt: ahora().toISOString(),
    };
    await actualizarSeguridad((s) => ({ ...s, mercadoPago }));
    logger?.info('[seguridad] Credenciales de Mercado Pago GUARDADAS desde el Backoffice', { por: usuario, modo: mercadoPago.modoPrueba ? 'prueba' : 'producción' });
    return estado(userId);
  }

  /** Borra las guardadas; desde ese momento se usan las variables de entorno (si las hay). */
  async function borrarCredenciales({ userId, usuario, codigo }) {
    const cod = codigoValido(codigo);
    const seg = await telefonoRegistrado();
    await consumirCodigo({ userId, usuario, accion: ACCION.MP_BORRAR, destino: seg.adminTelefono, codigo: cod });
    await actualizarSeguridad((s) => {
      const { mercadoPago: _, ...resto } = s;
      return resto;
    });
    logger?.info('[seguridad] Credenciales de Mercado Pago BORRADAS del Backoffice', { por: usuario });
    return estado(userId);
  }

  return {
    obtenerConfigMercadoPago,
    estado,
    solicitarCodigo,
    solicitarCodigoTelefonoNuevo,
    confirmarTelefono,
    guardarCredenciales,
    borrarCredenciales,
  };
}
