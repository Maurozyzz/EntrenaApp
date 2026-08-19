import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { COACH_NAV } from './nav';
import type { Profile } from '../../lib/types';

const INACTIVE_DAYS_THRESHOLD = 7;

interface StudentAlerts {
  hasRoutine: boolean;
  lastWorkoutAt: string | null;
  paymentOverdue: boolean;
}

function daysSince(dateStr: string): number {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function CoachStudents() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [students, setStudents] = useState<Profile[]>([]);
  const [alerts, setAlerts] = useState<Record<string, StudentAlerts>>({});
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const { data: studentRows } = await supabase
      .from('profiles')
      .select('*')
      .eq('trainer_id', profile.id)
      .order('created_at', { ascending: false });
    const rows = studentRows ?? [];
    setStudents(rows);

    if (rows.length === 0) {
      setLoading(false);
      return;
    }

    const ids = rows.map((s) => s.id);
    const [{ data: routines }, { data: logs }, { data: payments }] = await Promise.all([
      supabase.from('routines').select('student_id').eq('active', true).in('student_id', ids),
      supabase
        .from('workout_logs')
        .select('student_id, performed_at')
        .in('student_id', ids)
        .order('performed_at', { ascending: false }),
      supabase.from('payments').select('student_id, status, period_end').in('student_id', ids),
    ]);

    const hasRoutine = new Set((routines ?? []).map((r) => r.student_id));
    const lastWorkout = new Map<string, string>();
    for (const log of logs ?? []) {
      if (!lastWorkout.has(log.student_id)) lastWorkout.set(log.student_id, log.performed_at);
    }
    const today = new Date().toISOString().slice(0, 10);
    const overdue = new Set(
      (payments ?? []).filter((p) => p.status === 'pending' && p.period_end < today).map((p) => p.student_id),
    );

    const nextAlerts: Record<string, StudentAlerts> = {};
    for (const id of ids) {
      nextAlerts[id] = {
        hasRoutine: hasRoutine.has(id),
        lastWorkoutAt: lastWorkout.get(id) ?? null,
        paymentOverdue: overdue.has(id),
      };
    }
    setAlerts(nextAlerts);
    setLoading(false);
  }

  async function removeStudent(student: Profile) {
    const confirmed = window.confirm(
      t('coachStudents.confirmRemove', { name: student.full_name || student.email || '' }),
    );
    if (!confirmed) return;

    setRemoving(student.id);
    const { error } = await supabase.rpc('delete_student', { target_student_id: student.id });
    setRemoving(null);
    if (error) {
      window.alert(t('coachStudents.removeFailed', { message: error.message }));
      return;
    }
    setStudents((prev) => prev.filter((s) => s.id !== student.id));
  }

  return (
    <AppShell links={COACH_NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>{t('coachStudents.title')}</h1>
      <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>{t('coachStudents.howToAdd')}</p>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      ) : students.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('coachStudents.noStudents')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)', marginTop: 'var(--oc-space-4)' }}>
          {students.map((student) => {
            const a = alerts[student.id];
            const inactiveDays = a?.lastWorkoutAt ? daysSince(a.lastWorkoutAt) : null;
            const isInactive = a?.hasRoutine && (inactiveDays === null || inactiveDays >= INACTIVE_DAYS_THRESHOLD);

            return (
              <Card key={student.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--oc-space-3)', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{student.full_name || t('coachStudents.noName')}</strong>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--oc-text-muted)' }}>{student.email}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--oc-space-3)' }}>
                    <Link to={`/coach/alumnos/${student.id}`} style={{ color: 'var(--oc-gold)', fontSize: 14, whiteSpace: 'nowrap' }}>
                      {t('coachStudents.view')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeStudent(student)}
                      disabled={removing === student.id}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--oc-danger)',
                        cursor: removing === student.id ? 'default' : 'pointer',
                        fontSize: 13,
                        opacity: removing === student.id ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {removing === student.id ? t('coachStudents.removing') : t('coachStudents.remove')}
                    </button>
                  </div>
                </div>

                {a && (a.paymentOverdue || !a.hasRoutine || isInactive) && (
                  <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', marginTop: 'var(--oc-space-3)' }}>
                    {a.paymentOverdue && <AlertBadge tone="danger">{t('coachStudents.overdueBadge')}</AlertBadge>}
                    {!a.hasRoutine && <AlertBadge tone="muted">{t('coachStudents.noRoutineBadge')}</AlertBadge>}
                    {isInactive && (
                      <AlertBadge tone="warning">
                        {inactiveDays === null
                          ? t('coachStudents.neverLogged')
                          : t('coachStudents.inactiveDays', { days: inactiveDays })}
                      </AlertBadge>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function AlertBadge({ tone, children }: { tone: 'danger' | 'warning' | 'muted'; children: ReactNode }) {
  const colors: Record<typeof tone, string> = {
    danger: 'var(--oc-danger)',
    warning: 'var(--oc-gold)',
    muted: 'var(--oc-text-muted)',
  };
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: colors[tone],
        border: `1px solid ${colors[tone]}`,
        borderRadius: 999,
        padding: '3px 10px',
      }}
    >
      {children}
    </span>
  );
}
