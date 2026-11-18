import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    if (!profile) return;
    setLoading(true);
    setLoadError(null);
    const { data: studentRows, error: studentsErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('trainer_id', profile.id)
      .order('created_at', { ascending: false });
    if (studentsErr) {
      setLoadError(studentsErr.message);
      setLoading(false);
      return;
    }
    const rows = studentRows ?? [];
    setStudents(rows);

    if (rows.length === 0) {
      setLoading(false);
      return;
    }

    const ids = rows.map((s) => s.id);
    // last_workout_by_student devuelve una fila por alumno (su último
    // entrenamiento) en vez de bajar todo el historial de workout_logs.
    const [routinesRes, logsRes, paymentsRes] = await Promise.all([
      supabase.from('routines').select('student_id').eq('active', true).in('student_id', ids),
      supabase.rpc('last_workout_by_student', { student_ids: ids }),
      supabase.from('payments').select('student_id, status, period_end').in('student_id', ids),
    ]);
    const firstError = routinesRes.error ?? logsRes.error ?? paymentsRes.error;
    if (firstError) setLoadError(firstError.message);
    const routines = routinesRes.data;
    const payments = paymentsRes.data;

    const hasRoutine = new Set((routines ?? []).map((r) => r.student_id));
    const lastWorkout = new Map<string, string>();
    for (const row of (logsRes.data ?? []) as { student_id: string; last_performed_at: string }[]) {
      lastWorkout.set(row.student_id, row.last_performed_at);
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

  async function createInvite() {
    if (!profile) return;
    setInviting(true);
    setInviteError(null);
    setCopied(false);
    const { data, error } = await supabase
      .from('trainer_invites')
      .insert({ trainer_id: profile.id })
      .select('code')
      .single();
    setInviting(false);
    if (error || !data) {
      setInviteError(t('common.saveFailed', { message: error?.message ?? '' }));
      return;
    }
    setInviteLink(`${window.location.origin}/login?invitacion=${data.code}`);
  }

  async function copyInvite() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
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

      <Card style={{ marginTop: 'var(--oc-space-3)' }}>
        <Button onClick={createInvite} disabled={inviting}>
          {inviting ? t('coachStudents.inviting') : t('coachStudents.invite')}
        </Button>
        {inviteError && <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{inviteError}</p>}
        {inviteLink && (
          <div style={{ marginTop: 'var(--oc-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--oc-text-muted)' }}>{t('coachStudents.inviteReady')}</p>
            <code style={{ fontSize: 13, wordBreak: 'break-all', color: 'var(--oc-gold)' }}>{inviteLink}</code>
            <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={copyInvite}>
                {copied ? t('coachStudents.copied') : t('coachStudents.copy')}
              </Button>
              <a
                className="oc-button oc-button--ghost"
                href={`https://wa.me/?text=${encodeURIComponent(t('coachStudents.inviteMessage', { link: inviteLink }))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('coachStudents.shareWhatsapp')}
              </a>
            </div>
          </div>
        )}
      </Card>

      {loadError && (
        <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{t('common.loadFailed', { message: loadError })}</p>
      )}

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
