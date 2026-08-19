import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import { STUDENT_NAV } from './nav';
import { youtubeSearchUrl } from '../../lib/youtube';
import { WorkoutHistory } from '../../components/WorkoutHistory';
import { dayLabel, groupByDay, muscleGroupSummary } from '../../lib/days';
import type { Routine, RoutineExerciseWithName } from '../../lib/types';
import './StudentRoutine.css';

export function StudentRoutine() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [items, setItems] = useState<RoutineExerciseWithName[]>([]);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [setsCompleted, setSetsCompleted] = useState('');
  const [weightUsed, setWeightUsed] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    if (!profile) return;
    setLoading(true);
    const { data: routineData } = await supabase
      .from('routines')
      .select('*')
      .eq('student_id', profile.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    setRoutine(routineData ?? null);

    if (routineData) {
      const { data: itemsData } = await supabase
        .from('routine_exercises')
        .select('*, exercises(name, muscle_group)')
        .eq('routine_id', routineData.id)
        .order('order_index', { ascending: true });
      setItems((itemsData as RoutineExerciseWithName[]) ?? []);
    }
    setLoading(false);
  }

  async function logWorkout(e: FormEvent, routineExerciseId: number) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    await supabase.from('workout_logs').insert({
      student_id: profile.id,
      routine_exercise_id: routineExerciseId,
      sets_completed: setsCompleted ? Number(setsCompleted) : null,
      weight_used: weightUsed ? Number(weightUsed) : null,
    });
    setSaving(false);
    setLogging(null);
    setSetsCompleted('');
    setWeightUsed('');
    setHistoryKey((k) => k + 1);
  }

  return (
    <AppShell links={STUDENT_NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>{t('routine.title')}</h1>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      ) : !routine ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('routine.noRoutine')}</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('routine.noExercises')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-5)', marginTop: 'var(--oc-space-4)' }}>
          {groupByDay(items).map(({ day, items: dayItems }) => (
            <div key={day ?? 'none'}>
              <h2 style={{ color: 'var(--oc-gold)', fontSize: 18 }}>
                {dayLabel(day, t)}
                {muscleGroupSummary(dayItems) && (
                  <span style={{ color: 'var(--oc-text-muted)', fontWeight: 400, fontSize: 14 }}>
                    {' '}
                    · {muscleGroupSummary(dayItems)}
                  </span>
                )}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
                {dayItems.map((item) => (
                  <Card key={item.id}>
                    <strong
                      onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {item.exercises?.name}
                    </strong>
                    <p style={{ color: 'var(--oc-text-muted)', fontSize: 13, marginTop: 'var(--oc-space-1)' }}>
                      {t('routine.setsReps', { sets: item.sets ?? '—', reps: item.reps ?? '—' })}
                      {item.weight_target ? t('routine.targetSuffix', { weight: item.weight_target }) : ''}
                      {item.rest_seconds ? t('routine.restSuffix', { sec: item.rest_seconds }) : ''}
                    </p>

                    {logging === item.id ? (
                      <form
                        onSubmit={(e) => logWorkout(e, item.id)}
                        style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 'var(--oc-space-3)' }}
                      >
                        <div style={{ width: 90 }}>
                          <Field label={t('routine.setsDone')}>
                            <Input value={setsCompleted} onChange={(e) => setSetsCompleted(e.target.value)} inputMode="numeric" />
                          </Field>
                        </div>
                        <div style={{ width: 90 }}>
                          <Field label={t('routine.weightUsed')}>
                            <Input value={weightUsed} onChange={(e) => setWeightUsed(e.target.value)} inputMode="decimal" />
                          </Field>
                        </div>
                        <Button type="submit" disabled={saving}>
                          {saving ? t('common.saving') : t('routine.save')}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setLogging(null)}>
                          {t('common.cancel')}
                        </Button>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', marginTop: 'var(--oc-space-3)' }}>
                        <Button variant="secondary" onClick={() => setLogging(item.id)}>
                          {t('routine.logSet')}
                        </Button>
                        {selectedId === item.id && item.exercises?.name && (
                          <a
                            className="oc-button oc-button--ghost"
                            href={youtubeSearchUrl(item.exercises.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t('routine.howTo')}
                          </a>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {profile && (
        <>
          <h2 style={{ color: 'var(--oc-gold)', marginTop: 'var(--oc-space-6)' }}>{t('routine.history')}</h2>
          <WorkoutHistory key={historyKey} studentId={profile.id} />
        </>
      )}
    </AppShell>
  );
}
