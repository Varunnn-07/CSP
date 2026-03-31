import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export function UserLayout() {
  return (
    <div className="dashboard-app-shell">
      <Sidebar />
      <main className="dashboard-main-content">
        <Outlet />
      </main>
    </div>
  );
}
