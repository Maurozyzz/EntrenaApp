import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { STUDENT_NAV } from './nav';
import type { Payment, Routine } from '../../lib/types';

export function StudentHome() {
  const { profile } = useAuth();
  const { t } = useLanguage();
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
      <h1 style={{ color: 'var(--oc-gold)' }}>
        {t('studentHome.greeting', { name: profile?.full_name ? `, ${profile.full_name}` : '' })}
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)', marginTop: 'var(--oc-space-4)' }}>
        <Card>
          <strong>{t('studentHome.activeRoutine')}</strong>
          <p style={{ color: 'var(--oc-text-muted)', marginTop: 'var(--oc-space-2)' }}>
            {routine ? routine.name : t('studentHome.noRoutine')}
          </p>
          <Link to="/mi/rutina" style={{ color: 'var(--oc-gold)', fontSize: 14 }}>
            {t('studentHome.viewRoutine')}
          </Link>
        </Card>

        <Card>
          <strong>{t('studentHome.nextPayment')}</strong>
          <p style={{ color: 'var(--oc-text-muted)', marginTop: 'var(--oc-space-2)' }}>
            {nextPayment
              ? t('studentHome.dueLabel', {
                  amount: nextPayment.amount,
                  currency: nextPayment.currency,
                  date: nextPayment.period_end,
                })
              : t('studentHome.noPending')}
          </p>
          <Link to="/mi/pagos" style={{ color: 'var(--oc-gold)', fontSize: 14 }}>
            {t('studentHome.viewPayments')}
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
