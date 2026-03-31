import { NavLink, useNavigate } from 'react-router-dom';
import { clearToken } from '../utils/auth';

const navItems = [
  { to: '/dashboard/user', label: 'Dashboard', end: true },
  { to: '/dashboard/user/queries', label: 'Queries' },
  { to: '/dashboard/user/feedback', label: 'Feedback' },
  { to: '/dashboard/user/account', label: 'Account Details' }
] as const;

export function Sidebar() {
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="sidebar-shell">
      <div>
        <p className="sidebar-brand">CSP Cloud</p>
        <p className="sidebar-subtitle">User Workspace</p>
      </div>

      <nav className="sidebar-nav" aria-label="Dashboard navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            className={({ isActive }) =>
              isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button type="button" className="sidebar-logout" onClick={handleLogout}>
        Logout
      </button>
    </aside>
  );
}
