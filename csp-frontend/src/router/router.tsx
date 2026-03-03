import { Navigate, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { OtpPage } from '../pages/OtpPage';
import { UserDashboardPage } from '../pages/UserDashboardPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { ProtectedRoute } from './guards';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/verify-otp', element: <OtpPage /> },
  {
    path: '/dashboard/user',
    element: (
      <ProtectedRoute role="user">
        <UserDashboardPage />
      </ProtectedRoute>
    )
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
