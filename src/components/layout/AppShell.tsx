import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { Button } from '../ui/Button';
import './AppShell.css';

interface NavItem {
  to: string;
  label: string;
}

interface AppShellProps {
  links: NavItem[];
  children: ReactNode;
}

export function AppShell({ links, children }: AppShellProps) {
  const { signOut, profile } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="oc-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--oc-space-5)', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--oc-font-display)', color: 'var(--oc-gold)', fontWeight: 700 }}>
            Origen Coaching
          </span>
          <nav className="oc-nav">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/coach' || link.to === '/mi'}
                className={({ isActive }) => `oc-nav__link${isActive ? ' oc-nav__link--active' : ''}`}
              >
                {link.label}
              </NavLink>
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
