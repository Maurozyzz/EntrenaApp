import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { STUDENT_NAV } from './nav';
import type { Payment, Routine } from '../../lib/types';

export function StudentHome() {
  const { profile } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [nextPayment, setNextPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('routines')
      .select('*')
      .eq('student_id', profile.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setRoutine(data ?? null));

    supabase
      .from('payments')
      .select('*')
      .eq('student_id', profile.id)
      .eq('status', 'pending')
      .order('period_start', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setNextPayment(data ?? null));
  }, [profile]);

  return (
    <AppShell links={STUDENT_NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>Hola{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)', marginTop: 'var(--oc-space-4)' }}>
        <Card>
          <strong>Rutina activa</strong>
          <p style={{ color: 'var(--oc-text-muted)', marginTop: 'var(--oc-space-2)' }}>
            {routine ? routine.name : 'Todavía no tenés una rutina asignada.'}
          </p>
          <Link to="/mi/rutina" style={{ color: 'var(--oc-gold)', fontSize: 14 }}>
            Ver rutina →
          </Link>
        </Card>

        <Card>
          <strong>Próximo pago</strong>
          <p style={{ color: 'var(--oc-text-muted)', marginTop: 'var(--oc-space-2)' }}>
            {nextPayment
              ? `${nextPayment.amount} ${nextPayment.currency} · vence ${nextPayment.period_end}`
              : 'No tenés pagos pendientes.'}
          </p>
          <Link to="/mi/pagos" style={{ color: 'var(--oc-gold)', fontSize: 14 }}>
            Ver pagos →
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
