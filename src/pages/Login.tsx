import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useLanguage } from '../lib/i18n';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';

export function Login() {
  const { session, loading, signIn, signUp } = useAuth();
  const { t, lang, toggleLang } = useLanguage();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password, fullName);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else if (mode === 'signup') {
      setSignupDone(true);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--oc-space-5)',
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={toggleLang}
        aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        style={{
          position: 'absolute',
          top: 'var(--oc-space-4)',
          right: 'var(--oc-space-4)',
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

      <Card style={{ width: '100%', maxWidth: 380, boxSizing: 'border-box' }}>
        <span
          style={{
            fontFamily: 'var(--oc-font-body)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 2,
            color: 'var(--oc-energy)',
            textTransform: 'uppercase',
          }}
        >
          {t('login.brand')}
        </span>
        <h1 style={{ fontSize: 24, color: 'var(--oc-gold)', marginTop: 'var(--oc-space-2)' }}>
          {mode === 'login' ? t('login.signIn') : t('login.signUp')}
        </h1>

        {signupDone ? (
          <p style={{ color: 'var(--oc-success)' }}>{t('login.signupDone')}</p>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-4)', marginTop: 'var(--oc-space-4)' }}
          >
            {mode === 'signup' && (
              <Field label={t('login.name')}>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>
            )}
            <Field label={t('login.email')}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label={t('login.password')}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </Field>

            {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{error}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.sending') : mode === 'login' ? t('login.signIn') : t('login.signUp')}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
            setSignupDone(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--oc-text-muted)',
            fontSize: 13,
            marginTop: 'var(--oc-space-4)',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          {mode === 'login' ? t('login.toSignup') : t('login.toSignin')}
        </button>
      </Card>
    </div>
  );
}
