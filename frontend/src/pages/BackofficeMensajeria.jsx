import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../constants/theme.js';
import { recordatoriosService, settingsService } from '../services/modules.service.js';
import { etapaLabel, etapaDeOffset, fmtDia } from '../utils/recordatorios.js';

function Fila({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
      <div style={{ color: COLORS.muted, width: 190, flexShrink: 0 }}>{label}</div>
      <div style={{ color: COLORS.text }}>{children}</div>
    </div>
  );
}

const Si = ({ ok, si = 'Sí', no = 'No' }) => <span style={{ color: ok ? COLORS.green : COLORS.red, fontWeight: 600 }}>{ok ? si : no}</span>;

/** Backoffice → Mensajería (solo ADMIN): interruptor del recordatorio de pago por WhatsApp. */
export default function BackofficeMensajeria({ Card }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => recordatoriosService.pago()
    .then((d) => { setData(d); setError(''); })
    .catch((e) => setError(e?.response?.data?.error || 'No fue posible consultar el estado de la mensajería')), []);

  useEffect(() => { cargar(); }, [cargar]);

  if (!data) return <div style={{ color: error ? COLORS.red : COLORS.muted }}>{error || 'Cargando…'}</div>;

  const { config, resumen, ultimaCorrida, items } = data;
  const tocanHoy = items.filter((i) => i.tocaHoy);
  const mensajero = data.mensajero || { estado: 'sin_conexion' };
  const pagoRecibido = data.pagoRecibido || {};
  const mp = data.mercadoPago || {};
  // El interruptor de IronCore se puede encender si hay algo que enviar (recordatorio o pago recibido).
  const algoConfigurado = config.envioDisponible || pagoRecibido.disponible;
  const sofia = {
    activa: { color: COLORS.green, texto: 'Activo (servicio contratado)' },
    inactiva: { color: COLORS.red, texto: 'Servicio de mensajería no activado por SofIA' },
    llave_invalida: { color: COLORS.red, texto: 'La llave del mensajero no es válida' },
    sin_configurar: { color: '#F5A623', texto: 'Sin configurar en el servidor' },
    sin_conexion: { color: '#F5A623', texto: 'Sin conexión con el mensajero' },
  }[mensajero.estado] || { color: '#F5A623', texto: mensajero.estado };
  const salen = config.activo && mensajero.estado === 'activa';

  const cambiar = async (activo) => {
    if (activo) {
      const texto = [
        '¿Encender el envío de mensajes por WhatsApp?',
        '',
        'Permite mandar recordatorios uno por uno con el botón “Enviar” de Clientes → Recordatorios, y el mensaje de pago recibido tras cada pago.',
        config.automatico
          ? `El envío automático diario está ENCENDIDO: hoy les toca recordatorio a ${resumen.tocanHoy} cliente(s) y saldrán a las ${config.hora} (o en el siguiente minuto si ya pasó esa hora).`
          : 'El envío automático diario está APAGADO: no sale ningún mensaje masivo, solo los que mandes a mano.',
        'Los mensajes se cobran por Meta y no se pueden deshacer.',
      ].join('\n');
      if (!window.confirm(texto)) return;
    }
    setGuardando(true); setMsg(''); setError('');
    try {
      await settingsService.updateMensajeria(activo);
      setMsg(activo ? 'Envío encendido.' : 'Envío apagado. No se enviará ningún mensaje más.');
      await cargar();
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarAutomatico = async (automatico) => {
    if (automatico) {
      const texto = [
        '¿Encender el envío AUTOMÁTICO diario?',
        '',
        `Cada día a las ${config.hora} (hora de México) se enviará el recordatorio a TODOS los clientes a los que les toque, sin revisarlos uno por uno.`,
        `Hoy les toca a ${resumen.tocanHoy} cliente(s).${config.activo ? ' Si ya pasó esa hora, se les enviará en el siguiente minuto.' : ''}`,
        'Revisa antes que los teléfonos, montos y vencimientos estén al día.',
      ].join('\n');
      if (!window.confirm(texto)) return;
    }
    setGuardando(true); setMsg(''); setError('');
    try {
      await settingsService.updateMensajeria({ automatico });
      setMsg(automatico ? 'Envío automático diario encendido.' : 'Envío automático diario apagado. Solo salen los mensajes enviados a mano.');
      await cargar();
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      {msg && <div style={{ color: COLORS.green, marginBottom: 10 }}>{msg}</div>}
      {error && <div style={{ color: COLORS.red, marginBottom: 10 }}>{error}</div>}

      <Card
        title="Recordatorio de pago por WhatsApp"
        right={(
          <button
            onClick={() => cambiar(!config.activo)}
            disabled={guardando || (!config.activo && !algoConfigurado)}
            title={!config.activo && !algoConfigurado ? 'Primero hay que configurar la conexión con el mensajero en el servidor' : ''}
            style={{
              background: config.activo ? COLORS.red : COLORS.green, color: '#000', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontWeight: 700, cursor: guardando ? 'wait' : 'pointer',
              opacity: (!config.activo && !algoConfigurado) ? 0.4 : 1,
            }}
          >
            {config.activo ? 'Apagar envío' : 'Encender envío'}
          </button>
        )}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 6 }}>
          <div>
            <div style={{ color: COLORS.muted, fontSize: 11 }}>1. Interruptor de IronCore (este)</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif", color: config.activo ? COLORS.green : '#F5A623' }}>
              {config.activo ? 'ENCENDIDO' : 'APAGADO'}
            </div>
          </div>
          <div>
            <div style={{ color: COLORS.muted, fontSize: 11 }}>2. Servicio en el mensajero (lo activa SofIA; solo lectura)</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: sofia.color, marginTop: 4 }}>{sofia.texto}</div>
          </div>
        </div>
        <div style={{ color: salen ? COLORS.green : '#F5A623', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          {salen ? 'Los dos están encendidos: los mensajes sí salen.' : 'Para que salga cualquier mensaje deben estar encendidos los dos.'}
        </div>
        <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 12 }}>
          {config.actualizadoAt
            ? `Último cambio: ${new Date(config.actualizadoAt).toLocaleString('es-MX')}${config.actualizadoPor ? ` por ${config.actualizadoPor}` : ''}.`
            : 'Nunca se ha encendido.'}
          {' '}Este interruptor gobierna <b>todos</b> los WhatsApp de IronCore: los recordatorios de pago (tarea diaria y botón “Enviar”) y el mensaje
          de <b>pago recibido</b> que sale tras cada pago exitoso. Apagado, los pagos se registran y renuevan igual, solo que sin mensaje.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '12px 14px', margin: '0 0 12px', border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ color: COLORS.muted, fontSize: 11 }}>Envío automático diario (a todos los que les toca)</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif", color: config.automatico ? COLORS.green : '#F5A623' }}>
              {config.automatico ? 'ENCENDIDO' : 'APAGADO · SOLO ENVÍO MANUAL'}
            </div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>
              {config.automatico
                ? `Cada día a las ${config.hora} se envía el recordatorio a todos los clientes en etapa.`
                : 'No sale ningún mensaje masivo. Con el interruptor de arriba encendido, cada recordatorio se manda a una sola persona desde Clientes → Recordatorios, con el botón “Enviar”.'}
            </div>
          </div>
          <button
            onClick={() => cambiarAutomatico(!config.automatico)}
            disabled={guardando}
            style={{
              background: 'transparent', color: config.automatico ? COLORS.red : COLORS.text, border: `1px solid ${config.automatico ? COLORS.red : COLORS.border}`,
              borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: guardando ? 'wait' : 'pointer',
            }}
          >
            {config.automatico ? 'Apagar automático' : 'Encender automático'}
          </button>
        </div>
        <Fila label="Recordatorio configurado"><Si ok={config.envioDisponible} /></Fila>
        <Fila label="Liga de pago en el botón"><Si ok={Boolean(config.ligaDisponible)} si="Configurada" no="Falta LIGA_PAGO_SECRET (no se envían recordatorios)" /></Fila>
        <Fila label="Mensaje de pago recibido"><Si ok={Boolean(pagoRecibido.disponible)} si={`Configurado (${pagoRecibido.plantilla})`} no="Sin conexión con el mensajero" /></Fila>
        {mensajero.estado === 'activa' && mensajero.sandbox && (
          <Fila label="Modo del mensajero"><span style={{ color: '#F5A623' }}>Sandbox: solo envía a teléfonos de prueba</span></Fila>
        )}
        <Fila label="Webhook de estados"><Si ok={config.webhookDisponible} si="Configurado" no="Sin secreto (no se verán entregados/leídos)" /></Fila>
        <Fila label="Hora de envío diario">{config.hora} (hora de México)</Fila>
        <Fila label="Etapas">{config.etapas.map((e) => etapaLabel(etapaDeOffset(e))).join(' · ')}</Fila>
        {ultimaCorrida && (
          <Fila label="Última corrida (desde el último reinicio)">
            {new Date(ultimaCorrida.at).toLocaleString('es-MX')}: {ultimaCorrida.enviados ?? 0} enviados, {ultimaCorrida.fallidos ?? 0} con falla
            {ultimaCorrida.detenida ? ` · detenida (${ultimaCorrida.detenida})` : ''}
          </Fila>
        )}
        {config.avisos?.length > 0 && (
          <ul style={{ color: '#F5A623', fontSize: 12, margin: '12px 0 0', paddingLeft: 18 }}>
            {config.avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
      </Card>

      <Card title="Pago en línea (Mercado Pago)">
        <Fila label="Checkout de Mercado Pago"><Si ok={Boolean(mp.checkoutDisponible)} si={mp.modoPrueba ? 'Configurado (credenciales de PRUEBA)' : 'Configurado'} no="Sin configurar: no aparece el botón de pagar" /></Fila>
        <Fila label="Avisos (webhook) de pagos"><Si ok={Boolean(mp.webhookDisponible)} si="Configurado" no="Sin configurar: no se confirma ningún pago en línea" /></Fila>
        {mp.avisos?.length > 0 && (
          <ul style={{ color: '#F5A623', fontSize: 12, margin: '12px 0 0', paddingLeft: 18 }}>
            {mp.avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
      </Card>

      <Card title={`Hoy (${fmtDia(data.hoy)}): ${resumen.tocanHoy} cliente(s) en etapa de recordatorio${config.automatico ? '' : ' (no se envían solos)'}`}>
        <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>
          Además, {resumen.etapaHoySinTelefono} cliente(s) en etapa hoy no tienen teléfono y {resumen.etapaHoyPagados} ya tienen un pago registrado: a ellos no se les envía.
        </div>
        {tocanHoy.length === 0
          ? <div style={{ color: COLORS.muted, fontSize: 13 }}>Nadie más recibe mensaje hoy.</div>
          : (
            <ul style={{ margin: 0, paddingLeft: 18, color: COLORS.text, fontSize: 13, lineHeight: 1.8 }}>
              {tocanHoy.map((i) => (
                <li key={i.clienteId}>
                  {i.nombre} · {etapaLabel(i.etapaHoy).toLowerCase()} (vence {fmtDia(i.vencimiento)}) · {i.telefono}
                </li>
              ))}
            </ul>
          )}
      </Card>
    </>
  );
}
