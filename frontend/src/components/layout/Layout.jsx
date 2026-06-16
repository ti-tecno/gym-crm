import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { COLORS } from '../../constants/theme.js';

export default function Layout() {
  return (
    <div style={{ display: 'flex', height: '100vh', background: COLORS.bg, color: COLORS.text, overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <Outlet />
      </div>
    </div>
  );
}
