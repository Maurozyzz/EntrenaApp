import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../lib/i18n';
import { formatDate, formatMoney } from '../lib/format';
import { localDateKey } from '../lib/workoutSession';
import { Card } from './ui/Card';
import type { Payment } from '../lib/types';

const WEEKS = 8;

interface FeedbackRow {
  id: string;
  created_at: string;
  difficulty: number | null;
  energy: number | null;
  pain_level: number | null;
  notes: string | null;
}

interface SummaryData {
  weightChange: number | null;
  weightSince: string | null;
  sessionsPerWeek: number[];
  weekStarts: string[];
  nextPayment: Payment | null;
  feedback: FeedbackRow[] | null;
}

/** Lunes (local) de la semana de una fecha, como "AAAA-MM-DD". */
function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d;
}

export function StudentSummary({ studentId, onGoTo }: { studentId: string; onGoTo: (tab: string) => void }) {
  const { t, lang } = useLanguage();
  const [data, setData] = useState<SummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const firstMonday = mondayOf(new Date());
      firstMonday.setDate(firstMonday.getDate() - (WEEKS - 1) * 7);
      const [measRes, logsRes, payRes, fbRes] = await Promise.all([
        supabase
          .from('body_measurements')
          .select('measured_at, weight_kg')
          .eq('student_id', studentId)
          .not('weight_kg', 'is', null)
          .order('measured_at', { ascending: true }),
        supabase
          .from('workout_logs')
          .select('performed_at')
          .eq('student_id', studentId)
          .gte('performed_at', firstMonday.toISOString())
          .limit(3000),
        supabase
          .from('payments')
          .select('*')
          .eq('student_id', studentId)
          .eq('status', 'pending')
          .order('period_end', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('plan_feedback')
          .select('id, created_at, difficulty, energy, pain_level, notes')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(4),
      ]);
      if (!active) return;
      const err = measRes.error ?? logsRes.error ?? payRes.error;
      if (err) setError(t('common.loadFailed', { message: err.message }));

      const meas = measRes.data ?? [];
      const weightChange =
        meas.length >= 2 ? Number(meas[meas.length - 1].weight_kg) - Number(meas[0].weight_kg) : null;

      // Sesiones = días distintos con al menos una serie, agrupados por semana.
      const weekStarts: string[] = [];
      for (let i = 0; i < WEEKS; i++) {
        const d = new Date(firstMonday);
        d.setDate(d.getDate() + i * 7);
        weekStarts.push(localDateKey(d));
      }
      const days = new Set((logsRes.data ?? []).map((l) => localDateKey(l.performed_at)));
      const sessionsPerWeek = weekStarts.map(() => 0);
      for (const day of days) {
        const monday = localDateKey(mondayOf(new Date(`${day}T12:00:00`)));
        const idx = weekStarts.indexOf(monday);
        if (idx >= 0) sessionsPerWeek[idx] += 1;
      }

      setData({
        weightChange,
        weightSince: meas[0]?.measured_at ?? null,
        sessionsPerWeek,
        weekStarts,
        nextPayment: payRes.data ?? null,
        feedback: fbRes.error ? null : ((fbRes.data as FeedbackRow[]) ?? []),
      });
    }
    load();
    return () => {
      active = false;
    };
  }, [studentId, t]);

  if (!data) {
    return error ? <p style={{ color: 'var(--oc-danger)' }}>{error}</p> : <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>;
  }

  const maxSessions = Math.max(3, ...data.sessionsPerWeek);
  const totalSessions = data.sessionsPerWeek.reduce((a, b) => a + b, 0);
  const effortLabel = (v: number | null) =>
    v == null ? null : v <= 2 ? t('feedback.easy') : v >= 5 ? t('feedback.hard') : t('feedback.right');
  const overdue = data.nextPayment && data.nextPayment.period_end < new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-4)' }}>
      {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
      <div className="oc-kpis">
        <div className="oc-kpi">
          <strong style={{ color: 'var(--oc-energy)' }}>
            {data.weightChange == null ? '—' : `${data.weightChange > 0 ? '+' : ''}${data.weightChange.toFixed(1).replace('.', ',')}`}
          </strong>
          <span>
            {data.weightSince
              ? t('coachDetail.kgSince', { date: formatDate(data.weightSince, lang) })
              : t('coachDetail.noWeights')}
          </span>
        </div>
        <div className="oc-kpi">
          <strong style={{ color: 'var(--oc-gold)' }}>{(totalSessions / WEEKS).toFixed(1).replace('.', ',')}</strong>
          <span>{t('coachDetail.sessionsWeek')}</span>
        </div>
        <button type="button" className="oc-kpi" style={{ border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => onGoTo('payments')}>
          <strong style={{ color: overdue ? 'var(--oc-danger)' : 'var(--oc-text)' }}>
            {data.nextPayment ? formatMoney(data.nextPayment.amount, data.nextPayment.currency, lang) : '✓'}
          </strong>
          <span>
            {data.nextPayment
              ? t(overdue ? 'coachDetail.overdueSince' : 'coachDetail.dueOn', { date: formatDate(data.nextPayment.period_end, lang) })
              : t('coachDetail.upToDate')}
          </span>
        </button>
      </div>

      <Card>
        <div className="oc-dash__head">
          <h2 style={{ margin: 0, fontSize: 18 }}>{t('coachDetail.trainings')}</h2>
          <span className="oc-dash__count">{t('coachDetail.lastWeeks', { n: WEEKS })}</span>
        </div>
        <div className="oc-weeks" role="img" aria-label={t('coachDetail.weeksAria', { total: totalSessions, n: WEEKS })}>
          {data.sessionsPerWeek.map((n, i) => (
            <div className="oc-weeks__bar" key={data.weekStarts[i]}>
              <span className="oc-weeks__label">{n}</span>
              <div
                className={`oc-weeks__fill${n > 0 ? ' oc-weeks__fill--hit' : ''}`}
                style={{ height: `${(n / maxSessions) * 100}%` }}
              />
            </div>
          ))}
        </div>
      </Card>

      {data.feedback && (
        <Card>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{t('coachDetail.feedbackTitle')}</h2>
          {data.feedback.length === 0 ? (
            <p style={{ color: 'var(--oc-text-muted)', fontSize: 13, margin: 0 }}>{t('coachDetail.noFeedback')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
              {data.feedback.map((f) => (
                <div key={f.id} style={{ fontSize: 14 }}>
                  <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>{formatDate(f.created_at, lang)}</strong>
                    {effortLabel(f.difficulty) && <span className="oc-badge oc-badge--muted">{effortLabel(f.difficulty)}</span>}
                    {(f.pain_level ?? 0) > 0 && <span className="oc-badge oc-badge--danger">{t('coachDash.painBadge')}</span>}
                  </div>
                  {f.notes && <p style={{ margin: '4px 0 0', color: 'var(--oc-text-muted)' }}>“{f.notes}”</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
