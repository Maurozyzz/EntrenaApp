import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { STUDENT_NAV } from './nav';
import { youtubeSearchUrl } from '../../lib/youtube';
import { WorkoutHistory } from '../../components/WorkoutHistory';
import { dayLabel, groupByDay, muscleGroupSummary } from '../../lib/days';
import { translateExerciseName } from '../../lib/catalogTranslations';
import { formatDate } from '../../lib/format';
import {
  buildHistory,
  isNewRecord,
  localDateKey,
  routineDayOf,
  suggestedSet,
  toNumber,
  type SetLog,
} from '../../lib/workoutSession';
import type { Routine, RoutineExercise } from '../../lib/types';
import './StudentRoutine.css';

type Item = RoutineExercise & {
  exercises: { name: string; muscle_group: string | null; video_url: string | null } | null;
};

type LogRow = Omit<SetLog, 'exercise_id'> & { routine_exercises: { exercise_id: number } | null };

const DEFAULT_REST_SECONDS = 90;
const HISTORY_DAYS = 120;

function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function StudentRoutine() {
  const { profile } = useAuth();
  const { t, lang } = useLanguage();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null | undefined>(undefined);
  const [drafts, setDrafts] = useState<Record<string, { reps: string; weight: string }>>({});
  const [extraSets, setExtraSets] = useState<Record<number, number>>({});
  const [busySet, setBusySet] = useState<string | null>(null);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [record, setRecord] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const todayKey = localDateKey(new Date());

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    const { data: routineData, error: routineErr } = await supabase
      .from('routines')
      .select('*')
      .eq('student_id', profile.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (routineErr) setError(t('common.loadFailed', { message: routineErr.message }));
    setRoutine(routineData ?? null);

    if (routineData) {
      const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const [itemsRes, logsRes] = await Promise.all([
        supabase
          .from('routine_exercises')
          .select('*, exercises(name, muscle_group, video_url)')
          .eq('routine_id', routineData.id)
          .order('order_index', { ascending: true }),
        supabase
          .from('workout_logs')
          .select('id, routine_exercise_id, performed_at, reps_completed, weight_used, routine_exercises(exercise_id)')
          .eq('student_id', profile.id)
          .gte('performed_at', since)
          .order('performed_at', { ascending: true })
          .limit(2000),
      ]);
      const firstErr = itemsRes.error ?? logsRes.error;
      if (firstErr) setError(t('common.loadFailed', { message: firstErr.message }));
      setItems((itemsRes.data as Item[]) ?? []);
      setLogs(
        ((logsRes.data as unknown as LogRow[]) ?? []).map((row) => ({
          id: row.id,
          routine_exercise_id: row.routine_exercise_id,
          performed_at: row.performed_at,
          reps_completed: row.reps_completed,
          weight_used: row.weight_used,
          exercise_id: row.routine_exercises?.exercise_id ?? null,
        })),
      );
    }
    setLoading(false);
  }

  // Cronómetro de descanso: un tick por segundo solo mientras corre.
  useEffect(() => {
    if (restEndsAt == null) return;
    const id = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= restEndsAt) {
        setRestEndsAt(null);
        try {
          navigator.vibrate?.([200, 100, 200]);
        } catch {
          /* algunos navegadores no vibran */
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [restEndsAt]);

  const days = useMemo(() => groupByDay(items), [items]);
  const history = useMemo(() => buildHistory(logs, todayKey), [logs, todayKey]);
  const todayLogs = useMemo(() => {
    const map = new Map<number, SetLog[]>();
    for (const log of logs) {
      if (log.routine_exercise_id == null || localDateKey(log.performed_at) !== todayKey) continue;
      const list = map.get(log.routine_exercise_id) ?? [];
      list.push(log);
      map.set(log.routine_exercise_id, list);
    }
    return map;
  }, [logs, todayKey]);

  // Día por defecto: el de hoy si tiene ejercicios; si no, el primero de la rutina.
  const todayDow = routineDayOf(new Date());
  const activeDay =
    selectedDay !== undefined && days.some((d) => d.day === selectedDay)
      ? selectedDay
      : (days.find((d) => d.day === todayDow)?.day ?? days[0]?.day ?? null);
  const dayItems = days.find((d) => d.day === activeDay)?.items ?? [];

  const plannedSets = (item: Item) => Math.max(1, item.sets ?? 3) + (extraSets[item.id] ?? 0);
  const totalSets = dayItems.reduce((sum, item) => sum + plannedSets(item), 0);
  const doneSets = dayItems.reduce((sum, item) => sum + Math.min(todayLogs.get(item.id)?.length ?? 0, plannedSets(item)), 0);
  const doneExercises = dayItems.filter((item) => (todayLogs.get(item.id)?.length ?? 0) >= plannedSets(item)).length;

  function draftFor(item: Item, index: number) {
    const key = `${item.id}-${index}`;
    return (
      drafts[key] ??
      suggestedSet(index, item.exercise_id != null ? history.get(item.exercise_id) : undefined, {
        reps: item.reps,
        weight: item.weight_target,
      })
    );
  }

  function setDraft(item: Item, index: number, field: 'reps' | 'weight', value: string) {
    const key = `${item.id}-${index}`;
    setDrafts((prev) => ({ ...prev, [key]: { ...draftFor(item, index), [field]: value } }));
  }

  async function completeSet(item: Item, index: number) {
    if (!profile) return;
    const key = `${item.id}-${index}`;
    const draft = draftFor(item, index);
    const weight = toNumber(draft.weight);
    setBusySet(key);
    setError(null);
    const { data, error: insertErr } = await supabase
      .from('workout_logs')
      .insert({
        student_id: profile.id,
        routine_exercise_id: item.id,
        sets_completed: 1,
        reps_completed: draft.reps || null,
        weight_used: weight,
      })
      .select('id, performed_at')
      .single();
    setBusySet(null);
    if (insertErr || !data) {
      setError(t('common.saveFailed', { message: insertErr?.message ?? '' }));
      return;
    }

    const exHistory = item.exercise_id != null ? history.get(item.exercise_id) : undefined;
    const todayBest = Math.max(0, ...(todayLogs.get(item.id) ?? []).map((l) => l.weight_used ?? 0));
    if (isNewRecord(weight, exHistory) && (weight ?? 0) > todayBest && item.exercises) {
      setRecord(t('workout.newRecord', { exercise: translateExerciseName(item.exercises.name, lang), weight: draft.weight }));
    }

    setLogs((prev) => [
      ...prev,
      {
        id: data.id,
        routine_exercise_id: item.id,
        performed_at: data.performed_at,
        reps_completed: draft.reps || null,
        weight_used: weight,
        exercise_id: item.exercise_id,
      },
    ]);
    setHistoryKey((k) => k + 1);
    // La serie siguiente arranca con lo que acaba de hacer (si no la tocó).
    const nextKey = `${item.id}-${index + 1}`;
    setDrafts((prev) => (prev[nextKey] ? prev : { ...prev, [nextKey]: { reps: draft.reps, weight: draft.weight } }));

    const isLastOfDay = doneSets + 1 >= totalSets;
    if (!isLastOfDay) {
      const start = Date.now();
      setNow(start);
      setRestEndsAt(start + (item.rest_seconds ?? DEFAULT_REST_SECONDS) * 1000);
    } else {
      setRestEndsAt(null);
    }
  }

  async function undoSet(item: Item) {
    const last = todayLogs.get(item.id)?.at(-1);
    if (!last) return;
    setBusySet(`${item.id}-undo`);
    setError(null);
    const { error: deleteErr } = await supabase.from('workout_logs').delete().eq('id', last.id);
    setBusySet(null);
    if (deleteErr) {
      setError(t('common.saveFailed', { message: deleteErr.message }));
      return;
    }
    setLogs((prev) => prev.filter((l) => l.id !== last.id));
    setRestEndsAt(null);
    setHistoryKey((k) => k + 1);
  }

  const restLeft = restEndsAt != null ? Math.ceil((restEndsAt - now) / 1000) : 0;

  return (
    <AppShell links={STUDENT_NAV}>
      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      ) : !routine ? (
        <>
          <h1 style={{ color: 'var(--oc-gold)' }}>{t('routine.title')}</h1>
          <p style={{ color: 'var(--oc-text-muted)' }}>{t('routine.noRoutine')}</p>
        </>
      ) : items.length === 0 ? (
        <>
          <h1 style={{ color: 'var(--oc-gold)' }}>{t('routine.title')}</h1>
          <p style={{ color: 'var(--oc-text-muted)' }}>{t('routine.noExercises')}</p>
        </>
      ) : (
        <div className="oc-workout">
          <div>
            <div className="oc-workout__eyebrow">
              {activeDay === todayDow ? t('workout.today') : dayLabel(activeDay, t)}
            </div>
            <h1 className="oc-workout__title">
              {muscleGroupSummary(dayItems, lang) || dayLabel(activeDay, t)}
            </h1>
          </div>

          {days.length > 1 && (
            <div className="oc-workout__days" role="tablist" aria-label={t('workout.chooseDay')}>
              {days.map(({ day }) => (
                <button
                  key={day ?? 'none'}
                  type="button"
                  role="tab"
                  aria-selected={day === activeDay}
                  className={`oc-workout__day${day === activeDay ? ' oc-workout__day--on' : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  {dayLabel(day, t)}
                  {day === todayDow ? ' •' : ''}
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="oc-workout__progress" aria-hidden="true">
              <div style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
            </div>
            <p className="oc-workout__count">
              {t('workout.progress', { done: doneSets, total: totalSets, exDone: doneExercises, exTotal: dayItems.length })}
            </p>
          </div>

          {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13, margin: 0 }}>{error}</p>}

          {record && (
            <div className="oc-workout__record" role="status">
              <span>{record}</span>
              <button type="button" onClick={() => setRecord(null)} aria-label={t('common.cancel')}>
                ×
              </button>
            </div>
          )}

          {dayItems.map((item) => {
            const name = item.exercises?.name ? translateExerciseName(item.exercises.name, lang) : '';
            const done = todayLogs.get(item.id) ?? [];
            const total = plannedSets(item);
            const exHistory = item.exercise_id != null ? history.get(item.exercise_id) : undefined;
            const finished = done.length >= total;
            const videoUrl = item.exercises?.video_url || (name ? youtubeSearchUrl(name, lang) : null);

            return (
              <Card key={item.id} className={finished ? 'oc-workout__ex oc-workout__ex--done' : 'oc-workout__ex'}>
                <div className="oc-workout__ex-head">
                  <div style={{ minWidth: 0 }}>
                    <strong>{name}</strong>
                    <p className="oc-workout__meta">
                      {t('routine.setsReps', { sets: item.sets ?? '—', reps: item.reps ?? '—' })}
                      {item.weight_target ? t('routine.targetSuffix', { weight: item.weight_target }) : ''}
                      {t('routine.restSuffix', { sec: item.rest_seconds ?? DEFAULT_REST_SECONDS })}
                    </p>
                  </div>
                  {videoUrl && (
                    <a className="oc-workout__video" href={videoUrl} target="_blank" rel="noopener noreferrer">
                      {t('workout.technique')}
                    </a>
                  )}
                </div>
                {item.notes && <p className="oc-workout__note">{item.notes}</p>}

                <div className="oc-sets" role="table">
                  <span className="oc-sets__h">{t('workout.set')}</span>
                  <span className="oc-sets__h">kg</span>
                  <span className="oc-sets__h">{t('workout.reps')}</span>
                  <span />
                  {Array.from({ length: Math.max(total, done.length) }, (_, index) => {
                    const log = done[index];
                    const isNext = index === done.length;
                    const isLastDone = index === done.length - 1;
                    const draft = draftFor(item, index);
                    const key = `${item.id}-${index}`;
                    return (
                      <div className={`oc-sets__row${log ? ' oc-sets__row--done' : ''}`} key={key} role="row">
                        <span className="oc-sets__n">{index + 1}</span>
                        {log ? (
                          <>
                            <span className="oc-sets__val">{log.weight_used ?? '—'}</span>
                            <span className="oc-sets__val">{log.reps_completed ?? '—'}</span>
                          </>
                        ) : (
                          <>
                            <input
                              className="oc-sets__input"
                              inputMode="decimal"
                              aria-label={t('workout.kgFor', { n: index + 1 })}
                              value={draft.weight}
                              onChange={(e) => setDraft(item, index, 'weight', e.target.value)}
                            />
                            <input
                              className="oc-sets__input"
                              inputMode="numeric"
                              aria-label={t('workout.repsFor', { n: index + 1 })}
                              value={draft.reps}
                              onChange={(e) => setDraft(item, index, 'reps', e.target.value)}
                            />
                          </>
                        )}
                        <button
                          type="button"
                          className={`oc-sets__check${log ? ' oc-sets__check--on' : ''}`}
                          aria-label={log ? t('workout.undoSet', { n: index + 1 }) : t('workout.doneSet', { n: index + 1 })}
                          disabled={busySet != null || (!isNext && !isLastDone)}
                          onClick={() => (log ? undoSet(item) : completeSet(item, index))}
                        >
                          {busySet === key ? '…' : log ? '✓' : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="oc-workout__ex-foot">
                  <span className="oc-workout__prev">
                    {exHistory?.lastSession.length
                      ? t('workout.lastTime', {
                          date: formatDate(exHistory.lastSessionDate, lang),
                          sets: exHistory.lastSession
                            .map((s) => `${s.weight ?? '—'}×${s.reps ?? '—'}`)
                            .join(', '),
                        })
                      : t('workout.firstTime')}
                  </span>
                  <button
                    type="button"
                    className="oc-workout__add"
                    onClick={() => setExtraSets((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))}
                  >
                    {t('workout.addSet')}
                  </button>
                </div>
              </Card>
            );
          })}

          {doneSets > 0 && profile && (
            <WorkoutFeedback studentId={profile.id} trainerId={profile.trainer_id} todayKey={todayKey} />
          )}

          <h2 style={{ color: 'var(--oc-gold)', marginTop: 'var(--oc-space-4)', marginBottom: 0 }}>{t('routine.history')}</h2>
          {profile && <WorkoutHistory key={historyKey} studentId={profile.id} />}
        </div>
      )}

      {restEndsAt != null && (
        <div className="oc-rest" role="timer" aria-live="polite">
          <span>{t('workout.rest')}</span>
          <strong>{fmtClock(restLeft)}</strong>
          <button type="button" onClick={() => setRestEndsAt((end) => (end ?? Date.now()) + 15000)}>
            +15 s
          </button>
          <button type="button" onClick={() => setRestEndsAt(null)}>
            {t('workout.skip')}
          </button>
        </div>
      )}
    </AppShell>
  );
}

const FEEDBACK_KEY = 'oc-feedback-sent';

function WorkoutFeedback({ studentId, trainerId, todayKey }: { studentId: string; trainerId: string | null; todayKey: string }) {
  const { t } = useLanguage();
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [pain, setPain] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(() => {
    try {
      return localStorage.getItem(FEEDBACK_KEY) === `${studentId}:${todayKey}`;
    } catch {
      return false;
    }
  });

  async function submit() {
    setSaving(true);
    setError(null);
    const { error: insertErr } = await supabase.from('plan_feedback').insert({
      student_id: studentId,
      trainer_id: trainerId,
      difficulty,
      energy,
      pain_level: pain ? 5 : 0,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (insertErr) {
      setError(t('common.saveFailed', { message: insertErr.message }));
      return;
    }
    try {
      localStorage.setItem(FEEDBACK_KEY, `${studentId}:${todayKey}`);
    } catch {
      /* sin almacenamiento local: igual queda guardado en Supabase */
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <strong style={{ color: 'var(--oc-energy)' }}>{t('feedback.thanks')}</strong>
      </Card>
    );
  }

  const options = (
    value: number | null,
    onChange: (v: number) => void,
    labels: [number, string][],
    label: string,
  ) => (
    <div className="oc-feedback__group" role="radiogroup" aria-label={label}>
      <span className="oc-feedback__label">{label}</span>
      <div className="oc-feedback__chips">
        {labels.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={`oc-chip${value === v ? ' oc-chip--on' : ''}`}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="oc-feedback">
      <strong>{t('feedback.title')}</strong>
      <p className="oc-workout__meta" style={{ marginTop: 2 }}>{t('feedback.hint')}</p>
      {options(difficulty, setDifficulty, [[2, t('feedback.easy')], [3, t('feedback.right')], [5, t('feedback.hard')]], t('feedback.effort'))}
      {options(energy, setEnergy, [[2, t('feedback.low')], [3, t('feedback.normal')], [5, t('feedback.high')]], t('feedback.energy'))}
      <label className="oc-feedback__pain">
        <input type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)} />
        {t('feedback.pain')}
      </label>
      <textarea
        className="oc-input"
        rows={2}
        placeholder={t('feedback.notesPlaceholder')}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
      <div>
        <Button onClick={submit} disabled={saving || (difficulty == null && energy == null && !pain && !notes.trim())}>
          {saving ? t('common.sending') : t('feedback.send')}
        </Button>
      </div>
    </Card>
  );
}
