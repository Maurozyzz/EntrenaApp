import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { Button } from '../ui/Button';

interface NavLink {
  to: string;
  label: string;
}

interface AppShellProps {
  links: NavLink[];
  children: ReactNode;
}

export function AppShell({ links, children }: AppShellProps) {
  const { signOut, profile } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--oc-space-3)',
          padding: 'var(--oc-space-4) var(--oc-space-5)',
          borderBottom: '1px solid var(--oc-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--oc-space-5)', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--oc-font-display)', color: 'var(--oc-gold)', fontWeight: 700 }}>
            Origen Coaching
          </span>
          <nav style={{ display: 'flex', gap: 'var(--oc-space-4)', flexWrap: 'wrap' }}>
            {links.map((link) => (
              <Link key={link.to} to={link.to} style={{ color: 'var(--oc-text-muted)', fontSize: 14 }}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--oc-space-3)' }}>
          <span style={{ fontSize: 13, color: 'var(--oc-text-muted)' }}>
            {profile?.full_name || profile?.email}
          </span>
          <Button variant="ghost" onClick={() => signOut()}>
            Salir
          </Button>
        </div>
      </header>
      <main
        style={{
          flex: 1,
          padding: 'var(--oc-space-5)',
          width: '100%',
          maxWidth: 960,
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </main>
    </div>
  );
}
