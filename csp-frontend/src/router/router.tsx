import { Navigate, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { OtpPage } from '../pages/OtpPage';
import { EnableMfa } from '../pages/EnableMfa';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { ProtectedRoute } from './guards';
import { UserLayout } from '../pages/UserLayout';
import { Dashboard } from '../pages/Dashboard';
import { Queries } from '../pages/Queries';
import { Feedback } from '../pages/Feedback';
import { Account } from '../pages/Account';
import { getToken, getTokenRole } from '../utils/auth';

function DashboardEntry() {
  const token = getToken();
  const role = token ? getTokenRole(token) : null;

  if (role === 'admin') {
    return <Navigate to="/dashboard/admin" replace />;
  }

  if (role === 'user') {
    return <Navigate to="/dashboard/user" replace />;
  }

  return <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/verify-otp', element: <OtpPage /> },
  { path: '/mfa/enable', element: <EnableMfa /> },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardEntry />
      </ProtectedRoute>
    )
  },
  {
    path: '/dashboard/user',
    element: (
      <ProtectedRoute role="user">
        <UserLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'queries', element: <Queries /> },
      { path: 'feedback', element: <Feedback /> },
      { path: 'account', element: <Account /> }
    ]
  },
  {
    path: '/dashboard/admin',
    element: (
      <ProtectedRoute role="admin">
        <AdminDashboardPage />
      </ProtectedRoute>
    )
  }
]);
