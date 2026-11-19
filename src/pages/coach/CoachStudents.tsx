import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatMoney } from '../../lib/format';
import { COACH_NAV } from './nav';
import type { Profile } from '../../lib/types';
import './CoachStudents.css';

const INACTIVE_DAYS_THRESHOLD = 7;
const PAIN_LOOKBACK_DAYS = 7;

interface StudentAlerts {
  hasRoutine: boolean;
  lastWorkoutAt: string | null;
  paymentOverdue: boolean;
  overdueSince: string | null;
  reportedPain: boolean;
}

function daysSince(dateStr: string): number {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '·';
}

export function CoachStudents() {
  const { profile } = useAuth();
  const { t, lang } = useLanguage();
  const [students, setStudents] = useState<Profile[]>([]);
  const [alerts, setAlerts] = useState<Record<string, StudentAlerts>>({});
  const [collected, setCollected] = useState<{ amount: number; currency: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

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
      .order('full_name', { ascending: true });
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
    const painSince = new Date(Date.now() - PAIN_LOOKBACK_DAYS * 864e5).toISOString();
    // last_workout_by_student devuelve una fila por alumno (su último
    // entrenamiento) en vez de bajar todo el historial de workout_logs.
    const [routinesRes, logsRes, paymentsRes, feedbackRes] = await Promise.all([
      supabase.from('routines').select('student_id').eq('active', true).in('student_id', ids),
      supabase.rpc('last_workout_by_student', { student_ids: ids }),
      supabase.from('payments').select('student_id, status, period_end, amount, currency, paid_at').in('student_id', ids),
      supabase
        .from('plan_feedback')
        .select('student_id, pain_level')
        .in('student_id', ids)
        .gt('pain_level', 0)
        .gte('created_at', painSince),
    ]);
    // plan_feedback puede no existir si no se corrió la migración de planes:
    // en ese caso simplemente no hay alertas de dolor.
    const firstError = routinesRes.error ?? logsRes.error ?? paymentsRes.error;
    if (firstError) setLoadError(firstError.message);
    const payments = paymentsRes.data ?? [];

    const hasRoutine = new Set((routinesRes.data ?? []).map((r) => r.student_id));
    const lastWorkout = new Map<string, string>();
    for (const row of (logsRes.data ?? []) as { student_id: string; last_performed_at: string }[]) {
      lastWorkout.set(row.student_id, row.last_performed_at);
    }
    const today = new Date().toISOString().slice(0, 10);
    const overdueSince = new Map<string, string>();
    for (const p of payments) {
      if (p.status !== 'pending' || p.period_end >= today) continue;
      const prev = overdueSince.get(p.student_id);
      if (!prev || p.period_end < prev) overdueSince.set(p.student_id, p.period_end);
    }
    const pain = new Set((feedbackRes.error ? [] : (feedbackRes.data ?? [])).map((f) => f.student_id));

    const month = today.slice(0, 7);
    const paidThisMonth = payments.filter((p) => p.status === 'paid' && p.paid_at?.slice(0, 7) === month);
    setCollected({
      amount: paidThisMonth.reduce((sum, p) => sum + Number(p.amount), 0),
      currency: paidThisMonth[0]?.currency ?? payments[0]?.currency ?? 'ARS',
    });

    const nextAlerts: Record<string, StudentAlerts> = {};
    for (const id of ids) {
      nextAlerts[id] = {
        hasRoutine: hasRoutine.has(id),
        lastWorkoutAt: lastWorkout.get(id) ?? null,
        paymentOverdue: overdueSince.has(id),
        overdueSince: overdueSince.get(id) ?? null,
        reportedPain: pain.has(id),
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
    setRemoving(student.id);
    setActionError(null);
    const { error } = await supabase.rpc('delete_student', { target_student_id: student.id });
    setRemoving(null);
    setConfirmRemove(null);
    if (error) {
      setActionError(t('coachStudents.removeFailed', { message: error.message }));
      return;
    }
    setStudents((prev) => prev.filter((s) => s.id !== student.id));
  }

  const inactiveDaysOf = (a: StudentAlerts | undefined) => (a?.lastWorkoutAt ? daysSince(a.lastWorkoutAt) : null);
  const isInactive = (a: StudentAlerts | undefined) => {
    const days = inactiveDaysOf(a);
    return Boolean(a?.hasRoutine) && (days === null || days >= INACTIVE_DAYS_THRESHOLD);
  };

  // Lo urgente primero: pago vencido, dolor, sin entrenar, sin rutina.
  const attention = useMemo(() => {
    const score = (a: StudentAlerts) =>
      (a.paymentOverdue ? 8 : 0) + (a.reportedPain ? 4 : 0) + (isInactive(a) ? 2 : 0) + (!a.hasRoutine ? 1 : 0);
    return students
      .map((s) => ({ student: s, a: alerts[s.id] }))
      .filter((x): x is { student: Profile; a: StudentAlerts } => Boolean(x.a) && score(x.a) > 0)
      .sort((x, y) => score(y.a) - score(x.a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, alerts]);

  const withRoutine = students.filter((s) => alerts[s.id]?.hasRoutine);
  const activeThisWeek = withRoutine.filter((s) => {
    const days = inactiveDaysOf(alerts[s.id]);
    return days !== null && days < INACTIVE_DAYS_THRESHOLD;
  });
  const adherence = withRoutine.length ? Math.round((activeThisWeek.length / withRoutine.length) * 100) : null;

  const query = search.trim().toLowerCase();
  const filtered = query
    ? students.filter((s) => `${s.full_name ?? ''} ${s.email ?? ''}`.toLowerCase().includes(query))
    : students;

  function reasonFor(a: StudentAlerts): { text: string; tone: 'danger' | 'warning' | 'muted' } {
    if (a.paymentOverdue && a.overdueSince) {
      return { text: t('coachDash.overdueFor', { days: Math.max(1, daysSince(a.overdueSince)) }), tone: 'danger' };
    }
    if (a.reportedPain) return { text: t('coachDash.pain'), tone: 'danger' };
    if (isInactive(a)) {
      const days = inactiveDaysOf(a);
      return {
        text: days === null ? t('coachStudents.neverLogged') : t('coachStudents.inactiveDays', { days }),
        tone: 'warning',
      };
    }
    return { text: t('coachStudents.noRoutineBadge'), tone: 'muted' };
  }

  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <AppShell links={COACH_NAV}>
      <div className="oc-dash">
        <div>
          <p className="oc-dash__date">
            {new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 style={{ color: 'var(--oc-gold)', margin: 0 }}>
            {firstName ? t('coachDash.hello', { name: firstName }) : t('coachStudents.title')}
          </h1>
        </div>

        {loadError && <p className="oc-dash__error">{t('common.loadFailed', { message: loadError })}</p>}
        {actionError && <p className="oc-dash__error">{actionError}</p>}

        {!loading && students.length > 0 && (
          <div className="oc-kpis">
            <div className="oc-kpi">
              <strong style={{ color: 'var(--oc-energy)' }}>{students.length}</strong>
              <span>{t('coachDash.students')}</span>
            </div>
            <div className="oc-kpi">
              <strong style={{ color: 'var(--oc-gold)' }}>{adherence == null ? '—' : `${adherence}%`}</strong>
              <span>{t('coachDash.adherence')}</span>
            </div>
            <div className="oc-kpi">
              <strong>{collected ? formatMoney(collected.amount, collected.currency, lang) : '—'}</strong>
              <span>{t('coachDash.collected')}</span>
            </div>
          </div>
        )}

        {!loading && attention.length > 0 && (
          <section className="oc-dash__section">
            <div className="oc-dash__head">
              <h2>{t('coachDash.attention')}</h2>
              <span className="oc-dash__count">{attention.length}</span>
            </div>
            <div className="oc-dash__list">
              {attention.slice(0, 6).map(({ student, a }) => {
                const reason = reasonFor(a);
                const name = student.full_name || student.email || t('coachStudents.noName');
                return (
                  <Link key={student.id} to={`/coach/alumnos/${student.id}`} className="oc-att">
                    <span className="oc-avatar">{initials(name)}</span>
                    <span className="oc-att__body">
                      <strong>{name}</strong>
                      <span className={`oc-att__reason oc-att__reason--${reason.tone}`}>{reason.text}</span>
                    </span>
                    <span className="oc-att__go" aria-hidden="true">›</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <Card>
          <div className="oc-dash__invite">
            <p style={{ margin: 0, color: 'var(--oc-text-muted)', fontSize: 13, flex: '1 1 220px' }}>{t('coachStudents.howToAdd')}</p>
            <Button onClick={createInvite} disabled={inviting}>
              {inviting ? t('coachStudents.inviting') : t('coachStudents.invite')}
            </Button>
          </div>
          {inviteError && <p className="oc-dash__error">{inviteError}</p>}
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

        <section className="oc-dash__section">
          <div className="oc-dash__head">
            <h2>{t('coachDash.allStudents')}</h2>
          </div>
          {students.length > 3 && (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('coachDash.searchPlaceholder')}
              aria-label={t('coachDash.searchPlaceholder')}
            />
          )}

          {loading ? (
            <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
          ) : students.length === 0 ? (
            <p style={{ color: 'var(--oc-text-muted)' }}>{t('coachStudents.noStudents')}</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: 'var(--oc-text-muted)' }}>{t('coachDash.noMatch', { search })}</p>
          ) : (
            <div className="oc-dash__list">
              {filtered.map((student) => {
                const a = alerts[student.id];
                const inactiveDays = inactiveDaysOf(a);
                const name = student.full_name || t('coachStudents.noName');
                return (
                  <Card key={student.id} className="oc-row">
                    <div className="oc-row__main">
                      <span className="oc-avatar">{initials(name)}</span>
                      <div style={{ minWidth: 0 }}>
                        <Link to={`/coach/alumnos/${student.id}`} className="oc-row__name">
                          {name}
                        </Link>
                        <p className="oc-row__email">{student.email}</p>
                      </div>
                      <div className="oc-row__actions">
                        {confirmRemove === student.id ? (
                          <>
                            <span className="oc-row__confirm">{t('coachDash.confirmRemoveShort')}</span>
                            <button type="button" className="oc-link oc-link--danger" disabled={removing === student.id} onClick={() => removeStudent(student)}>
                              {removing === student.id ? t('coachStudents.removing') : t('coachDash.yesRemove')}
                            </button>
                            <button type="button" className="oc-link" onClick={() => setConfirmRemove(null)}>
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <Link to={`/coach/alumnos/${student.id}`} className="oc-link oc-link--gold">
                              {t('coachStudents.view')}
                            </Link>
                            <button type="button" className="oc-link oc-link--danger" onClick={() => setConfirmRemove(student.id)}>
                              {t('coachStudents.remove')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {confirmRemove === student.id && (
                      <p className="oc-row__warn">{t('coachStudents.confirmRemove', { name })}</p>
                    )}
                    {a && (a.paymentOverdue || !a.hasRoutine || isInactive(a) || a.reportedPain) && (
                      <div className="oc-row__badges">
                        {a.paymentOverdue && <AlertBadge tone="danger">{t('coachStudents.overdueBadge')}</AlertBadge>}
                        {a.reportedPain && <AlertBadge tone="danger">{t('coachDash.painBadge')}</AlertBadge>}
                        {!a.hasRoutine && <AlertBadge tone="muted">{t('coachStudents.noRoutineBadge')}</AlertBadge>}
                        {isInactive(a) && (
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
        </section>
      </div>
    </AppShell>
  );
}

function AlertBadge({ tone, children }: { tone: 'danger' | 'warning' | 'muted'; children: ReactNode }) {
  return <span className={`oc-badge oc-badge--${tone}`}>{children}</span>;
}
