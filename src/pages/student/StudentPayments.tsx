import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { STUDENT_NAV } from './nav';
import type { Payment } from '../../lib/types';

export function StudentPayments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('payments')
      .select('*')
      .eq('student_id', profile.id)
      .order('period_start', { ascending: false })
      .then(({ data }) => {
        setPayments(data ?? []);
        setLoading(false);
      });
  }, [profile]);

  return (
    <AppShell links={STUDENT_NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>Mis pagos</h1>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : payments.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Todavía no hay pagos registrados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)', marginTop: 'var(--oc-space-4)' }}>
          {payments.map((payment) => (
            <Card key={payment.id} style={{ padding: 'var(--oc-space-3) var(--oc-space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--oc-space-2)' }}>
                <span>
                  {payment.period_start} → {payment.period_end} · {payment.amount} {payment.currency}
                </span>
                <span
                  style={{
                    color:
                      payment.status === 'paid'
                        ? 'var(--oc-success)'
                        : payment.status === 'overdue'
                          ? 'var(--oc-danger)'
                          : 'var(--oc-text-muted)',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {payment.status}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
