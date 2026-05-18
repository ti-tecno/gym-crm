import { Outlet } from 'react-router-dom';
import ClienteSidebar from './ClienteSidebar.jsx';
import { COLORS } from '../../constants/theme.js';

export default function ClienteLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', background: COLORS.bg, color: COLORS.text, overflow: 'hidden' }}>
      <ClienteSidebar />
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}><Outlet /></div>
    </div>
  );
}
