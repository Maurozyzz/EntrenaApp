import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import type { Role } from '../lib/types';

interface RequireAuthProps {
  children: ReactNode;
  role?: Role;
}

export function RequireAuth({ children, role }: RequireAuthProps) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <p style={{ padding: 'var(--oc-space-5)', color: 'var(--oc-text-muted)' }}>Cargando…</p>;
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'trainer' ? '/coach' : '/mi'} replace />;
  }

  return <>{children}</>;
}
