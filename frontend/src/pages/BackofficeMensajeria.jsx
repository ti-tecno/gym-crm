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

  const cambiar = async (activo) => {
    if (activo) {
      const texto = [
        '¿Encender el envío de recordatorios de pago por WhatsApp?',
        '',
        `Hoy les toca a ${resumen.tocanHoy} cliente(s).`,
        `Si ya pasó la hora configurada (${config.hora}), se les enviará en el siguiente minuto; si no, a esa hora.`,
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

  return (
    <>
      {msg && <div style={{ color: COLORS.green, marginBottom: 10 }}>{msg}</div>}
      {error && <div style={{ color: COLORS.red, marginBottom: 10 }}>{error}</div>}

      <Card
        title="Recordatorio de pago por WhatsApp"
        right={(
          <button
            onClick={() => cambiar(!config.activo)}
            disabled={guardando || (!config.activo && !config.envioDisponible)}
            title={!config.activo && !config.envioDisponible ? 'Primero hay que configurar la conexión con el mensajero en el servidor' : ''}
            style={{
              background: config.activo ? COLORS.red : COLORS.green, color: '#000', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontWeight: 700, cursor: guardando ? 'wait' : 'pointer',
              opacity: (!config.activo && !config.envioDisponible) ? 0.4 : 1,
            }}
          >
            {config.activo ? 'Apagar envío' : 'Encender envío'}
          </button>
        )}
      >
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Barlow Condensed',sans-serif", color: config.activo ? COLORS.green : '#F5A623', marginBottom: 6 }}>
          {config.activo ? 'ENCENDIDO' : 'APAGADO'}
        </div>
        <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 12 }}>
          {config.actualizadoAt
            ? `Último cambio: ${new Date(config.actualizadoAt).toLocaleString('es-MX')}${config.actualizadoPor ? ` por ${config.actualizadoPor}` : ''}.`
            : 'Nunca se ha encendido.'}
          {' '}Apagado, ni la tarea diaria ni el botón “Enviar” de Recordatorios mandan mensajes; la lista se sigue calculando.
        </div>
        <Fila label="Mensajero configurado"><Si ok={config.envioDisponible} /></Fila>
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

      <Card title={`Hoy (${fmtDia(data.hoy)}): ${resumen.tocanHoy} recordatorio(s) por enviar`}>
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
