import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { COLORS } from '../../constants/theme.js';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import ResultadoPago from '../../components/pago/ResultadoPago.jsx';
import { clientePortal } from '../../services/cliente.service.js';

const FOLIO = /^(TXN-[0-9A-F]{4,16}|MP-\d{1,20})$/;

/** /mi/pago/resultado?pago=<folio> — regreso de Mercado Pago al portal del cliente. */
export default function PagoResultado() {
  const [params] = useSearchParams();
  // `pago` lo pone nuestro backend en la URL de regreso; external_reference lo agrega MP (mismo folio).
  const folio = [params.get('pago'), params.get('external_reference')].find((v) => FOLIO.test(v || '')) || null;
  const consultar = useCallback(() => clientePortal.pago(folio), [folio]);
  const volver = <Link to="/mi/membresia" style={{ color: COLORS.accent, fontWeight: 700 }}>Volver a Mi Membresía</Link>;

  return (
    <div>
      <SectionHeader title="Pago en línea" sub="Resultado de tu pago" />
      {folio
        ? <ResultadoPago consultar={consultar} accion={volver} />
        : <div style={{ color: COLORS.muted }}>No encontramos el folio del pago. {volver}</div>}
    </div>
  );
}
