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

// Íconos simples (trazo) para la barra de abajo del celular.
const ICONS: Record<string, string> = {
  'nav.home': 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  'nav.routine': 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  'nav.progress': 'M4 19V5M4 19h16M8 15l4-4 3 3 5-6',
  'nav.diet': 'M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4M17 3c-2 2-2 6 0 8v10',
  'nav.payments': 'M3 6h18v12H3zM3 10h18M7 15h4',
  'nav.students': 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  'nav.exercises': 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
};

function NavIcon({ labelKey }: { labelKey: string }) {
  const d = ICONS[labelKey];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

interface AppShellProps {
  links: NavItem[];
  children: ReactNode;
}

export function AppShell({ links, children }: AppShellProps) {
  const { signOut, profile } = useAuth();
  const { t, lang, toggleLang } = useLanguage();

  return (
    <div className="oc-shell">
      <button
        type="button"
        onClick={toggleLang}
        aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        style={{
          position: 'fixed',
          top: 'var(--oc-space-4)',
          right: 'var(--oc-space-4)',
          zIndex: 20,
          background: 'var(--oc-ink)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--oc-space-3)', paddingRight: 48 }}>
          <span className="oc-header__user" style={{ fontSize: 13, color: 'var(--oc-text-muted)' }}>
            {profile?.full_name || profile?.email}
          </span>
          <Button variant="ghost" onClick={() => signOut()}>
            {t('nav.signOut')}
          </Button>
        </div>
      </header>
      <main className="oc-main">
        <div className="oc-main__inner">{children}</div>
      </main>
      <nav className="oc-tabbar" aria-label={t('app.name')}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/coach' || link.to === '/mi'}
            className={({ isActive }) => `oc-tabbar__link${isActive ? ' oc-tabbar__link--active' : ''}`}
          >
            <NavIcon labelKey={link.labelKey} />
            <span>{t(link.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
