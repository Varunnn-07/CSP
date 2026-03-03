import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { getToken, getTokenRole } from '../utils/auth';

type Props = {
  children: ReactNode;
  role?: 'admin' | 'user';
};

export function ProtectedRoute({ children, role }: Props) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    return <>{children}</>;
  }

  const tokenRole = getTokenRole(token);
  if (tokenRole !== role) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
