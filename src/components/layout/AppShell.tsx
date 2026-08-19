import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { Button } from '../ui/Button';
import './AppShell.css';

interface NavItem {
  to: string;
  labelKey: string;
}

interface AppShellProps {
  links: NavItem[];
  children: ReactNode;
}

export function AppShell({ links, children }: AppShellProps) {
  const { signOut, profile } = useAuth();
  const { t, lang, toggleLang } = useLanguage();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="oc-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--oc-space-5)', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--oc-font-display)', color: 'var(--oc-gold)', fontWeight: 700 }}>
            {t('app.name')}
          </span>
          <nav className="oc-nav">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/coach' || link.to === '/mi'}
                className={({ isActive }) => `oc-nav__link${isActive ? ' oc-nav__link--active' : ''}`}
              >
                {t(link.labelKey)}
              </NavLink>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--oc-space-3)' }}>
          <span style={{ fontSize: 13, color: 'var(--oc-text-muted)' }}>
            {profile?.full_name || profile?.email}
          </span>
          <button
            type="button"
            onClick={toggleLang}
            aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            style={{
              background: 'none',
              border: '1px solid var(--oc-border)',
              borderRadius: 'var(--oc-radius-sm)',
              color: 'var(--oc-text-muted)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 10px',
            }}
          >
            {t('nav.langToggle')}
          </button>
          <Button variant="ghost" onClick={() => signOut()}>
            {t('nav.signOut')}
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
