import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useLanguage } from '../lib/i18n';
import type { Role } from '../lib/types';

interface RequireAuthProps {
  children: ReactNode;
  role?: Role;
}

export function RequireAuth({ children, role }: RequireAuthProps) {
  const { session, profile, profileError, loading, signOut } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return <p style={{ padding: 'var(--oc-space-5)', color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Con sesión pero sin perfil: no redirigir a /login (ahí rebotaría de
  // vuelta acá y generaría un loop) — mostrar el error en su lugar.
  if (!profile) {
    return (
      <div style={{ padding: 'var(--oc-space-5)', color: 'var(--oc-danger)' }}>
        <p>{t('auth.profileLoadFailed', { detail: profileError ? `: ${profileError}` : '.' })}</p>
        <button
          type="button"
          onClick={() => signOut()}
          style={{ background: 'none', border: 'none', color: 'var(--oc-gold)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
        >
          {t('auth.signOut')}
        </button>
      </div>
    );
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'trainer' ? '/coach' : '/mi'} replace />;
  }

  return <>{children}</>;
}
