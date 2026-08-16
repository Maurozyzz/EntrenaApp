import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';

export function Login() {
  const { session, loading, signIn, signUp } = useAuth();
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
      }}
    >
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
          Origen Coaching
        </span>
        <h1 style={{ fontSize: 24, color: 'var(--oc-gold)', marginTop: 'var(--oc-space-2)' }}>
          {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </h1>

        {signupDone ? (
          <p style={{ color: 'var(--oc-success)' }}>
            Cuenta creada. Si tu proyecto de Supabase pide confirmación por email, revisá tu casilla y después
            iniciá sesión.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-4)', marginTop: 'var(--oc-space-4)' }}
          >
            {mode === 'signup' && (
              <Field label="Nombre">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Contraseña">
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
              {submitting ? 'Enviando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
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
          {mode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Ingresá'}
        </button>
      </Card>
    </div>
  );
}
