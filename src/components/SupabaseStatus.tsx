import { useEffect, useState } from 'react';
import { checkSupabaseConnection, type SupabaseConnectionStatus } from '../lib/checkSupabaseConnection';

export function SupabaseStatus() {
  const [status, setStatus] = useState<SupabaseConnectionStatus | null>(null);

  useEffect(() => {
    checkSupabaseConnection().then(setStatus);
  }, []);

  if (!status) {
    return <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>Comprobando conexión a Supabase…</p>;
  }

  return (
    <p style={{ color: status.ok ? 'var(--oc-success)' : 'var(--oc-danger)', fontSize: 13 }}>
      {status.ok ? '✓' : '✕'} {status.message}
    </p>
  );
}
