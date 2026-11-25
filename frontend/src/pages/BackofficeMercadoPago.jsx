import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import FInput from '../components/ui/FInput.jsx';
import { settingsService } from '../services/modules.service.js';

const AMBAR = '#F5A623';

function Fila({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, flexWrap: 'wrap' }}>
      <div style={{ color: COLORS.muted, width: 190, flexShrink: 0 }}>{label}</div>
      <div style={{ color: COLORS.text, wordBreak: 'break-all' }}>{children}</div>
    </div>
  );
}

function Boton({ children, onClick, disabled, peligro, secundario, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: secundario ? 'transparent' : peligro ? COLORS.red : COLORS.accent,
        color: secundario ? COLORS.text : '#fff',
        border: secundario ? `1px solid ${COLORS.border}` : 'none',
        borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

const ultimos = (u4) => (u4 ? `••••••••${u4}` : '—');
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-MX') : '');
const ORIGEN = {
  backoffice: 'Guardadas en este Backoffice (cifradas)',
  entorno: 'Variables de entorno del servidor',
  ninguno: 'Ninguna',
};

// Mismo criterio que el backend (solo formato; no se consulta a Mercado Pago).
const tokenValido = (t) => /^(APP_USR|TEST)-[A-Za-z0-9_-]{20,300}$/.test(t.trim());
const secretoValido = (s) => /^[A-Za-z0-9_-]{16,256}$/.test(s.trim());

// Errores tras los cuales el código ya no sirve: se regresa al inicio del paso.
const CODIGO_MUERTO = ['CODIGO_AGOTADO', 'CODIGO_EXPIRADO', 'CODIGO_USADO', 'SIN_CODIGO', 'CODIGO_OTRA_ACCION', 'CODIGO_OTRO_DESTINO', 'TELEFONO_CAMBIO_CONCURRENTE'];

/** Captura de un código de 6 dígitos con su vigencia. */
function CapturaCodigo({ op, codigo, setCodigo, onConfirmar, confirmar, onCancelar, ocupado, peligro }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginTop: 12 }}>
      <div style={{ fontSize: 13, color: COLORS.text, marginBottom: 8 }}>
        Te enviamos un código por WhatsApp a <b>{op.destino}</b>. Vale 10 minutos y sirve una sola vez, solo para esta operación
        {op.expiraAt ? ` (vence ${new Date(op.expiraAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })})` : ''}.
        Si no te llega en un minuto, cancela y vuelve a pedirlo.
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ width: 160 }}>
          <FInput label="Código" inputMode="numeric" maxLength={6} value={codigo} placeholder="000000"
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </div>
        <Boton onClick={onConfirmar} disabled={ocupado || codigo.length !== 6} peligro={peligro}>{confirmar}</Boton>
        <Boton secundario onClick={onCancelar} disabled={ocupado}>Cancelar</Boton>
      </div>
    </div>
  );
}

/**
 * Backoffice → Mercado Pago (solo ADMIN): credenciales de Mercado Pago (cifradas en el servidor)
 * y teléfono del administrador del sitio. Todo cambio pide un código de un solo uso por WhatsApp.
 * Las credenciales nunca regresan del servidor: solo se ven sus últimos 4 caracteres.
 */
export default function BackofficeMercadoPago({ Card }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState({});
  const [msg, setMsg] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Operación en curso: { tipo, destino, expiraAt }. tipo: mp_guardar | mp_borrar | tel_alta | tel_cambio_actual | tel_cambio_nuevo
  const [op, setOp] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [token, setToken] = useState('');
  const [secreto, setSecreto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [cambiandoTel, setCambiandoTel] = useState(false);

  const cargar = useCallback(() => settingsService.seguridad()
    .then((d) => { setData(d); setError(''); })
    .catch((e) => setError(e?.response?.data?.error || 'No fue posible consultar la configuración')), []);

  useEffect(() => { cargar(); }, [cargar]);

  const limpiarTodo = () => {
    setOp(null); setCodigo(''); setToken(''); setSecreto(''); setTelefono(''); setPassword(''); setCambiandoTel(false); setErrores({});
  };

  /** Corre una petición; ante error lo muestra y, si el código ya no sirve, regresa al inicio. */
  const correr = async (fn, { exito, alFallar } = {}) => {
    setOcupado(true); setError(''); setMsg(''); setErrores({});
    try {
      const r = await fn();
      if (exito) setMsg(exito);
      return r;
    } catch (e) {
      const d = e?.response?.data || {};
      setError(d.error || 'No se pudo completar la operación');
      if (d.code === 'CREDENCIALES_INVALIDAS' && d.details) setErrores(d.details);
      if (CODIGO_MUERTO.includes(d.code)) { setOp(null); setCodigo(''); }
      if (alFallar) alFallar(d);
      return null;
    } finally {
      setOcupado(false);
    }
  };

  if (!data) return <div style={{ color: error ? COLORS.red : COLORS.muted }}>{error || 'Cargando…'}</div>;

  const { llaveMaestra, mensajero, telefono: tel, mercadoPago: mp } = data;

  // ── Teléfono ────────────────────────────────────────────────────────────
  const pedirAlta = async () => {
    const r = await correr(() => settingsService.codigoTelefonoNuevo({ telefono, password }));
    if (r) { setOp({ tipo: 'tel_alta', destino: r.destino, expiraAt: r.expiraAt }); setPassword(''); setCodigo(''); }
  };
  const pedirCambio = async () => {
    const r = await correr(() => settingsService.pedirCodigo('telefono_cambiar'));
    if (r) { setOp({ tipo: 'tel_cambio_actual', destino: r.destino, expiraAt: r.expiraAt }); setCodigo(''); }
  };
  const pedirAlNuevo = async () => {
    const r = await correr(() => settingsService.codigoTelefonoNuevo({ telefono, codigo }), {
      // Si el envío al número nuevo falla, el código del número actual ya se usó: se empieza de nuevo.
      alFallar: (d) => { if (!['CODIGO_INCORRECTO', 'TELEFONO_INVALIDO', 'MISMO_TELEFONO', 'MENSAJERO_NO_CONFIGURADO', 'LIMITE_POR_HORA'].includes(d.code)) { setOp(null); setCodigo(''); } },
    });
    if (r) { setOp({ tipo: 'tel_cambio_nuevo', destino: r.destino, expiraAt: r.expiraAt }); setCodigo(''); }
  };
  const confirmarTel = async () => {
    const r = await correr(() => settingsService.confirmarTelefono(telefono, codigo), { exito: 'Teléfono del administrador guardado.' });
    if (r) { setData(r); limpiarTodo(); }
  };

  // ── Credenciales ────────────────────────────────────────────────────────
  const pedirGuardar = async () => {
    const errs = {};
    if (!tokenValido(token)) errs.accessToken = 'Debe empezar con APP_USR- (producción) o TEST- (prueba), sin espacios.';
    if (!secretoValido(secreto)) errs.webhookSecret = 'Al menos 16 letras o números, sin espacios.';
    if (Object.keys(errs).length) { setErrores(errs); setError('Revisa el formato de las credenciales.'); return; }
    const r = await correr(() => settingsService.pedirCodigo('mp_guardar'));
    if (r) { setOp({ tipo: 'mp_guardar', destino: r.destino, expiraAt: r.expiraAt }); setCodigo(''); }
  };
  const guardar = async () => {
    const r = await correr(() => settingsService.guardarMercadoPago(token.trim(), secreto.trim(), codigo), { exito: 'Credenciales guardadas. Ya están en uso (no hace falta reiniciar).' });
    if (r) { setData(r); limpiarTodo(); }
  };
  const pedirBorrar = async () => {
    if (!window.confirm('¿Borrar las credenciales de Mercado Pago guardadas en el Backoffice?\n\nSi el servidor tiene credenciales en variables de entorno, se usarán esas; si no, el pago en línea se apaga.')) return;
    const r = await correr(() => settingsService.pedirCodigo('mp_borrar'));
    if (r) { setOp({ tipo: 'mp_borrar', destino: r.destino, expiraAt: r.expiraAt }); setCodigo(''); }
  };
  const borrar = async () => {
    const r = await correr(() => settingsService.borrarMercadoPago(codigo), { exito: 'Credenciales borradas del Backoffice.' });
    if (r) { setData(r); limpiarTodo(); }
  };

  const cancelar = () => { setOp(null); setCodigo(''); setError(''); };
  const enCurso = Boolean(op);
  const puedeGuardar = llaveMaestra.disponible && tel.registrado && mensajero.disponible;

  return (
    <>
      {msg && <div style={{ color: COLORS.green, marginBottom: 10 }}>{msg}</div>}
      {error && <div style={{ color: COLORS.red, marginBottom: 10 }}>{error}</div>}

      {!mensajero.disponible && (
        <div style={{ color: AMBAR, fontSize: 13, marginBottom: 10 }}>
          El servidor no está conectado al servicio de WhatsApp (MENSAJERO_URL / MENSAJERO_API_KEY). Sin él no se pueden enviar códigos
          y, por lo tanto, no se puede registrar el teléfono ni cambiar credenciales desde aquí.
        </div>
      )}

      {/* ── Teléfono del administrador ─────────────────────────────────── */}
      <Card title="Teléfono del administrador del sitio">
        <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>
          A este WhatsApp llegan los códigos de un solo uso que autorizan cambiar las credenciales de Mercado Pago o este mismo teléfono.
          Es independiente del interruptor de Mensajería (que solo gobierna los mensajes a clientes), pero SofIA debe tener activo el servicio.
        </div>
        <Fila label="Teléfono">
          {tel.registrado
            ? <><b>{tel.enmascarado}</b>{tel.actualizadoAt ? <span style={{ color: COLORS.muted }}> · {fecha(tel.actualizadoAt)}{tel.actualizadoPor ? ` por ${tel.actualizadoPor}` : ''}</span> : null}</>
            : <span style={{ color: AMBAR }}>Sin registrar</span>}
        </Fila>

        {!tel.registrado && !enCurso && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12, alignItems: 'end' }}>
            <FInput label="Celular con WhatsApp (10 dígitos)" inputMode="tel" value={telefono} placeholder="55 1234 5678" onChange={(e) => setTelefono(e.target.value)} />
            <FInput label="Tu contraseña actual" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Boton onClick={pedirAlta} disabled={ocupado || !mensajero.disponible || !telefono || !password}>Enviar código a ese número</Boton>
          </div>
        )}
        {op?.tipo === 'tel_alta' && (
          <CapturaCodigo op={op} codigo={codigo} setCodigo={setCodigo} onConfirmar={confirmarTel} confirmar="Confirmar teléfono" onCancelar={cancelar} ocupado={ocupado} />
        )}

        {tel.registrado && !enCurso && !cambiandoTel && (
          <div style={{ marginTop: 12 }}>
            <Boton secundario onClick={() => { setCambiandoTel(true); setError(''); setMsg(''); }} disabled={ocupado || !mensajero.disponible}>Cambiar teléfono</Boton>
          </div>
        )}
        {tel.registrado && cambiandoTel && !enCurso && (
          <div style={{ marginTop: 12, fontSize: 13, color: COLORS.text }}>
            <div style={{ marginBottom: 8 }}>
              Paso 1 de 2: te enviaremos un código al teléfono <b>actual</b> ({tel.enmascarado}). Si ya no tienes ese teléfono, no se puede cambiar
              desde aquí: consulta el procedimiento de recuperación con quien administra el servidor.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Boton onClick={pedirCambio} disabled={ocupado}>Enviar código al teléfono actual</Boton>
              <Boton secundario onClick={() => setCambiandoTel(false)} disabled={ocupado}>Cancelar</Boton>
            </div>
          </div>
        )}
        {op?.tipo === 'tel_cambio_actual' && (
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 13, color: COLORS.text, marginBottom: 8 }}>
              Paso 1 de 2: escribe el código que llegó a <b>{op.destino}</b> y el número nuevo. Enseguida le enviaremos otro código al número nuevo.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
              <FInput label="Código del teléfono actual" inputMode="numeric" maxLength={6} value={codigo} placeholder="000000"
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              <FInput label="Celular nuevo (10 dígitos)" inputMode="tel" value={telefono} placeholder="55 1234 5678" onChange={(e) => setTelefono(e.target.value)} />
              <Boton onClick={pedirAlNuevo} disabled={ocupado || codigo.length !== 6 || !telefono}>Enviar código al número nuevo</Boton>
              <Boton secundario onClick={() => { cancelar(); setCambiandoTel(false); }} disabled={ocupado}>Cancelar</Boton>
            </div>
          </div>
        )}
        {op?.tipo === 'tel_cambio_nuevo' && (
          <>
            <div style={{ fontSize: 13, color: COLORS.text, marginTop: 12 }}>Paso 2 de 2: confirma el número nuevo.</div>
            <CapturaCodigo op={op} codigo={codigo} setCodigo={setCodigo} onConfirmar={confirmarTel} confirmar="Confirmar número nuevo"
              onCancelar={() => { cancelar(); setCambiandoTel(false); }} ocupado={ocupado} />
          </>
        )}
      </Card>

      {/* ── Mercado Pago ────────────────────────────────────────────────── */}
      <Card title="Credenciales de Mercado Pago">
        <Fila label="Pago en línea">
          <span style={{ color: mp.configurado ? COLORS.green : COLORS.red, fontWeight: 600 }}>
            {mp.configurado ? 'Configurado' : 'No configurado (no aparece el botón de pagar)'}
          </span>
        </Fila>
        <Fila label="De dónde salen">{ORIGEN[mp.origen] || mp.origen}</Fila>
        {mp.modoPrueba !== null && (
          <Fila label="Tipo de credenciales">
            <span style={{ color: mp.modoPrueba ? AMBAR : COLORS.green, fontWeight: 600 }}>
              {mp.modoPrueba ? 'PRUEBA (TEST-…): no se cobra dinero real' : 'Producción (APP_USR-…)'}
            </span>
          </Fila>
        )}
        <Fila label="Access Token">{ultimos(mp.accessTokenUltimos4)}</Fila>
        <Fila label="Clave secreta de webhooks">{ultimos(mp.webhookSecretUltimos4)}</Fila>
        {mp.actualizadoAt && <Fila label="Guardadas">{fecha(mp.actualizadoAt)}{mp.actualizadoPor ? ` por ${mp.actualizadoPor}` : ''}</Fila>}
        <Fila label="URL del webhook">
          {mp.webhookUrl
            ? (
              <>
                <code style={{ fontSize: 12 }}>{mp.webhookUrl}</code>{' '}
                <button type="button" onClick={() => navigator.clipboard?.writeText(mp.webhookUrl).then(() => setMsg('URL copiada.'))}
                  style={{ background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
                  Copiar
                </button>
                <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
                  Pégala en Mercado Pago → Tus integraciones → tu aplicación → Webhooks (evento “Pagos”), en modo productivo y de prueba.
                  Al guardar ahí, Mercado Pago muestra la “clave secreta”: esa va abajo.
                </div>
              </>
            )
            : <span style={{ color: AMBAR }}>Falta PUBLIC_API_URL (HTTPS) en el servidor</span>}
        </Fila>
        {mp.avisos?.length > 0 && (
          <ul style={{ color: mp.ilegible ? COLORS.red : AMBAR, fontSize: 12, margin: '12px 0 0', paddingLeft: 18 }}>
            {mp.avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}

        <h4 style={{ color: COLORS.text, fontSize: 14, margin: '18px 0 6px' }}>Guardar credenciales nuevas</h4>
        {!llaveMaestra.disponible && (
          <div style={{ color: AMBAR, fontSize: 13, marginBottom: 8 }}>
            {llaveMaestra.aviso} Quien administra el servidor debe agregar esa llave (ver docs/PAGO_EN_LINEA.md) y reiniciar el backend.
          </div>
        )}
        {llaveMaestra.disponible && !tel.registrado && (
          <div style={{ color: AMBAR, fontSize: 13, marginBottom: 8 }}>Primero registra arriba el teléfono del administrador: ahí llega el código que autoriza el cambio.</div>
        )}
        <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>
          Se guardan cifradas y desde ese momento tienen prioridad sobre las del servidor, sin reiniciar. Solo se revisa el formato:
          <b> no se comprueba con Mercado Pago</b> que sean correctas, así que después haz un pago de prueba. Nunca se vuelven a mostrar completas.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          <FInput label="Access Token" type="password" value={token} placeholder="APP_USR-… o TEST-…" disabled={!puedeGuardar || enCurso}
            error={errores.accessToken} onChange={(e) => setToken(e.target.value)} />
          <FInput label="Clave secreta de webhooks" type="password" value={secreto} disabled={!puedeGuardar || enCurso}
            error={errores.webhookSecret} onChange={(e) => setSecreto(e.target.value)} />
        </div>
        {op?.tipo !== 'mp_guardar' && (
          <div style={{ marginTop: 10 }}>
            <Boton onClick={pedirGuardar} disabled={ocupado || enCurso || !puedeGuardar || !token || !secreto}>Enviar código para guardar</Boton>
          </div>
        )}
        {op?.tipo === 'mp_guardar' && (
          <CapturaCodigo op={op} codigo={codigo} setCodigo={setCodigo} onConfirmar={guardar} confirmar="Guardar credenciales" onCancelar={cancelar} ocupado={ocupado} />
        )}

        {mp.guardadasEnBackoffice && (
          <>
            <h4 style={{ color: COLORS.text, fontSize: 14, margin: '18px 0 6px' }}>Borrar las guardadas</h4>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>
              Al borrarlas se usan las variables de entorno del servidor, si las hay; si no, el pago en línea se apaga.
            </div>
            {op?.tipo !== 'mp_borrar' && (
              <Boton peligro onClick={pedirBorrar} disabled={ocupado || enCurso || !tel.registrado || !mensajero.disponible}>Enviar código para borrar</Boton>
            )}
            {op?.tipo === 'mp_borrar' && (
              <CapturaCodigo op={op} codigo={codigo} setCodigo={setCodigo} onConfirmar={borrar} confirmar="Borrar credenciales" onCancelar={cancelar} ocupado={ocupado} peligro />
            )}
          </>
        )}
      </Card>
    </>
  );
}
