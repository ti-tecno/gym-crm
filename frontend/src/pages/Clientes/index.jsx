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
  { id: 'pagos',         icon: '💳', label: 'Pago en Línea' },
  { id: 'recordatorios', icon: '🔔', label: 'Recordatorios' },
];

export default function Clientes() {
  const [tab, setTab] = useState('lista');
  return (
    <div>
      <SectionHeader title="Clientes & Pagos" sub="Registro, membresías, pagos en línea y recordatorios automáticos" />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'lista'         && <Lista onNuevo={() => setTab('registro')} onPagar={() => setTab('pagos')} onRecordar={() => setTab('recordatorios')} />}
      {tab === 'registro'      && <RegistroAutonomo />}
      {tab === 'pagos'         && <PagoEnLinea />}
      {tab === 'recordatorios' && <Recordatorios />}
    </div>
  );
}
