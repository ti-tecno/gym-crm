import { useState } from 'react';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import TabBar from '../../components/ui/TabBar.jsx';
import Lista from './Lista.jsx';
import RegistroAutonomo from './RegistroAutonomo.jsx';
import PagoEnLinea from './PagoEnLinea.jsx';
import Recordatorios from './Recordatorios.jsx';

const TABS = [
  { id: 'lista',         icon: '◈',  label: 'Lista' },
  { id: 'registro',      icon: '✚',  label: 'Registro Autónomo' },
  { id: 'pagos',         icon: '💳', label: 'Registrar pago' },
  { id: 'recordatorios', icon: '🔔', label: 'Recordatorios' },
];

export default function Clientes() {
  const [tab, setTab] = useState('lista');
  // Cliente preseleccionado al llegar a "Registrar pago" desde la lista o desde una respuesta.
  const [clientePago, setClientePago] = useState(null);
  const irAPago = (clienteId = null) => { setClientePago(clienteId); setTab('pagos'); };
  return (
    <div>
      <SectionHeader title="Clientes & Pagos" sub="Registro, membresías, pagos en mostrador y recordatorios automáticos" />
      <TabBar tabs={TABS} active={tab} onChange={(t) => { if (t !== 'pagos') setClientePago(null); setTab(t); }} />
      {tab === 'lista'         && <Lista onNuevo={() => setTab('registro')} onPagar={(c) => irAPago(c?.clienteId)} onRecordar={() => setTab('recordatorios')} />}
      {tab === 'registro'      && <RegistroAutonomo />}
      {tab === 'pagos'         && <PagoEnLinea clienteInicial={clientePago} />}
      {tab === 'recordatorios' && <Recordatorios onRegistrarPago={irAPago} />}
    </div>
  );
}
