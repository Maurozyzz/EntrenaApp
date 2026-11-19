import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../lib/i18n';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Input';
import { StatusPill } from '../../components/ui/StatusPill';
import { DietBuilder } from '../../components/DietBuilder';
import { AutoPlanBuilder } from '../../components/AutoPlanBuilder';
import { WorkoutHistory } from '../../components/WorkoutHistory';
import { COACH_NAV } from './nav';
import { DAYS, dayLabel, groupByDay, muscleGroupSummary } from '../../lib/days';
import { translateExerciseName } from '../../lib/catalogTranslations';
import { formatDate, formatMoney } from '../../lib/format';
import { StudentSummary } from '../../components/StudentSummary';
import '../coach/CoachStudents.css';

type Tab = 'summary' | 'routine' | 'history' | 'diet' | 'payments' | 'auto';
const TABS: { id: Tab; key: string }[] = [
  { id: 'summary', key: 'coachDetail.tabSummary' },
  { id: 'routine', key: 'coachDetail.tabRoutine' },
  { id: 'history', key: 'coachDetail.tabHistory' },
  { id: 'diet', key: 'coachDetail.tabDiet' },
  { id: 'payments', key: 'coachDetail.tabPayments' },
  { id: 'auto', key: 'coachDetail.tabAuto' },
];
import type {
  Exercise,
  NutritionPlan,
  Payment,
  Profile,
  Routine,
  RoutineExerciseWithName,
} from '../../lib/types';

const RECEIPTS_BUCKET = 'payment-receipts';

export function CoachStudentDetail() {
  const { id: studentId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [student, setStudent] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>('summary');

  useEffect(() => {
    if (!studentId) return;
    supabase.from('profiles').select('*').eq('id', studentId).single().then(({ data }) => setStudent(data));
  }, [studentId]);

  if (!studentId || !profile) return null;

  return (
    <AppShell links={COACH_NAV}>
      <h1 style={{ color: 'var(--oc-gold)', marginBottom: 0 }}>
        {student?.full_name || student?.email || t('coachStudentDetail.fallbackName')}
      </h1>
      {student?.email && student.full_name && (
        <p style={{ margin: '4px 0 0', color: 'var(--oc-text-muted)', fontSize: 13 }}>{student.email}</p>
      )}

      <div className="oc-tabs" role="tablist" aria-label={t('coachDetail.sections')}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`oc-tab${tab === item.id ? ' oc-tab--on' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {t(item.key)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-5)' }}>
        {tab === 'summary' && <StudentSummary studentId={studentId} onGoTo={(next) => setTab(next as Tab)} />}
        {tab === 'routine' && <RoutineSection studentId={studentId} trainerId={profile.id} />}
        {tab === 'history' && (
          <Card>
            <h2 style={{ marginTop: 0 }}>{t('coachStudentDetail.workoutHistoryTitle')}</h2>
            <WorkoutHistory studentId={studentId} />
          </Card>
        )}
        {tab === 'diet' && <NutritionSection studentId={studentId} trainerId={profile.id} />}
        {tab === 'payments' && <PaymentsSection studentId={studentId} />}
        {tab === 'auto' && <AutoPlanBuilder studentId={studentId} trainerId={profile.id} />}
      </div>
    </AppShell>
  );
}

function RoutineSection({ studentId, trainerId }: { studentId: string; trainerId: string }) {
  const { t, lang } = useLanguage();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [items, setItems] = useState<RoutineExerciseWithName[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [exerciseId, setExerciseId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weightTarget, setWeightTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ sets: '', reps: '', weight: '', rest: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: routineData }, { data: exerciseData }] = await Promise.all([
      supabase.from('routines').select('*').eq('student_id', studentId).eq('active', true).limit(1).maybeSingle(),
      supabase.from('exercises').select('*').order('name', { ascending: true }),
    ]);
    setExercises(exerciseData ?? []);
    setRoutine(routineData ?? null);

    if (routineData) {
      const { data: itemsData } = await supabase
        .from('routine_exercises')
        .select('*, exercises(name, muscle_group)')
        .eq('routine_id', routineData.id)
        .order('order_index', { ascending: true });
      setItems((itemsData as RoutineExerciseWithName[]) ?? []);
    } else {
      setItems([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Otros alumnos con rutina activa, para "copiar rutina de…".
    (async () => {
      const { data: rs } = await supabase
        .from('routines')
        .select('student_id')
        .eq('trainer_id', trainerId)
        .eq('active', true)
        .neq('student_id', studentId);
      const ids = [...new Set((rs ?? []).map((r) => r.student_id as string))];
      if (ids.length === 0) return setSources([]);
      const { data: ps } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      setSources(
        (ps ?? [])
          .map((p) => ({ id: p.id as string, name: (p.full_name || p.email || p.id) as string }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  function startEdit(item: RoutineExerciseWithName) {
    setEditingId(item.id);
    setEdit({
      sets: item.sets?.toString() ?? '',
      reps: item.reps ?? '',
      weight: item.weight_target?.toString() ?? '',
      rest: item.rest_seconds?.toString() ?? '',
      notes: item.notes ?? '',
    });
  }

  async function saveEdit(id: number) {
    setBusy(true);
    setError(null);
    const { error: updateErr } = await supabase
      .from('routine_exercises')
      .update({
        sets: edit.sets ? Number(edit.sets) : null,
        reps: edit.reps || null,
        weight_target: edit.weight ? Number(edit.weight.replace(',', '.')) : null,
        rest_seconds: edit.rest ? Number(edit.rest) : null,
        notes: edit.notes.trim() || null,
      })
      .eq('id', id);
    setBusy(false);
    if (updateErr) {
      setError(t('common.saveFailed', { message: updateErr.message }));
      return;
    }
    setEditingId(null);
    load();
  }

  // Sube o baja un ejercicio dentro de su día y renumera order_index para que
  // quede un orden limpio (antes podía haber índices repetidos).
  async function move(item: RoutineExerciseWithName, direction: -1 | 1) {
    const sameDay = items.filter((i) => i.day_of_week === item.day_of_week);
    const pos = sameDay.findIndex((i) => i.id === item.id);
    const target = sameDay[pos + direction];
    if (!target) return;
    const ordered = [...items];
    const a = ordered.findIndex((i) => i.id === item.id);
    const b = ordered.findIndex((i) => i.id === target.id);
    [ordered[a], ordered[b]] = [ordered[b], ordered[a]];
    const changes = ordered
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => row.order_index !== index);
    setBusy(true);
    setError(null);
    setItems(ordered.map((row, index) => ({ ...row, order_index: index })));
    const results = await Promise.all(
      changes.map(({ row, index }) => supabase.from('routine_exercises').update({ order_index: index }).eq('id', row.id)),
    );
    setBusy(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setError(t('common.saveFailed', { message: failed.error.message }));
      load();
    }
  }

  async function copyRoutine() {
    if (!copyFrom) return;
    setBusy(true);
    setError(null);
    setCopyMsg(null);
    const { data: source } = await supabase
      .from('routines')
      .select('id')
      .eq('student_id', copyFrom)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    const { data: sourceItems, error: srcErr } = source
      ? await supabase.from('routine_exercises').select('*').eq('routine_id', source.id).order('order_index')
      : { data: [], error: null };
    if (srcErr || !sourceItems || sourceItems.length === 0) {
      setBusy(false);
      setError(srcErr ? t('common.saveFailed', { message: srcErr.message }) : t('coachDetail.copyEmpty'));
      return;
    }

    let routineId = routine?.id;
    if (!routineId) {
      const { data: created, error: createErr } = await supabase
        .from('routines')
        .insert({ student_id: studentId, trainer_id: trainerId, name: 'Rutina activa' })
        .select('id')
        .single();
      if (createErr || !created) {
        setBusy(false);
        setError(t('common.saveFailed', { message: createErr?.message ?? '' }));
        return;
      }
      routineId = created.id;
    }

    const start = items.length;
    const { error: insertErr } = await supabase.from('routine_exercises').insert(
      sourceItems.map((row, i) => ({
        routine_id: routineId,
        exercise_id: row.exercise_id,
        day_of_week: row.day_of_week,
        order_index: start + i,
        sets: row.sets,
        reps: row.reps,
        weight_target: row.weight_target,
        rest_seconds: row.rest_seconds,
        notes: row.notes,
      })),
    );
    setBusy(false);
    if (insertErr) {
      setError(t('common.saveFailed', { message: insertErr.message }));
      return;
    }
    setCopyMsg(t('coachDetail.copied', { n: sourceItems.length }));
    setCopyFrom('');
    load();
  }

  async function createRoutine() {
    setError(null);
    const { error: insertErr } = await supabase.from('routines').insert({
      student_id: studentId,
      trainer_id: trainerId,
      name: 'Rutina activa',
    });
    if (insertErr) {
      setError(t('common.saveFailed', { message: insertErr.message }));
      return;
    }
    load();
  }

  async function addExercise(e: FormEvent) {
    e.preventDefault();
    if (!routine || !exerciseId) return;
    setError(null);
    const { error: insertErr } = await supabase.from('routine_exercises').insert({
      routine_id: routine.id,
      exercise_id: Number(exerciseId),
      day_of_week: dayOfWeek ? Number(dayOfWeek) : null,
      order_index: items.length,
      sets: sets ? Number(sets) : null,
      reps: reps || null,
      weight_target: weightTarget ? Number(weightTarget) : null,
    });
    if (insertErr) {
      setError(insertErr.message);
      return;
    }
    setExerciseId('');
    setSets('');
    setReps('');
    setWeightTarget('');
    load();
  }

  async function removeExercise(id: number) {
    setError(null);
    const { error: deleteErr } = await supabase.from('routine_exercises').delete().eq('id', id);
    if (deleteErr) {
      setError(deleteErr.message);
      return;
    }
    load();
  }

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{t('coachStudentDetail.routineTitle')}</h2>
      {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{error}</p>}
      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      ) : !routine ? (
        <div>
          <p style={{ color: 'var(--oc-text-muted)' }}>{t('coachStudentDetail.noActiveRoutine')}</p>
          <Button onClick={createRoutine}>{t('coachStudentDetail.createRoutine')}</Button>
        </div>
      ) : (
        <>
          {items.length === 0 ? (
            <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>{t('coachStudentDetail.noExercisesYet')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-4)', marginBottom: 'var(--oc-space-4)' }}>
              {groupByDay(items).map(({ day, items: dayItems }) => (
                <div key={day ?? 'none'}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--oc-gold)', marginBottom: 'var(--oc-space-2)' }}>
                    {dayLabel(day, t)}
                    {muscleGroupSummary(dayItems, lang) && (
                      <span style={{ color: 'var(--oc-text-muted)', fontWeight: 400 }}> · {muscleGroupSummary(dayItems, lang)}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)' }}>
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 'var(--oc-space-2) var(--oc-space-3)',
                          background: 'var(--oc-surface-gradient)',
                          boxShadow: 'var(--oc-shadow-raised-sm)',
                          borderRadius: 'var(--oc-radius-sm)',
                          gap: 'var(--oc-space-3)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ minWidth: 0 }}>
                          <strong>{item.exercises?.name ? translateExerciseName(item.exercises.name, lang) : ''}</strong>
                          <span style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>
                            {' '}
                            {t('coachStudentDetail.setsRepsLine', { sets: item.sets ?? '—', reps: item.reps ?? '—' })}
                            {item.weight_target ? ` ${t('coachStudentDetail.weightSuffix', { weight: item.weight_target })}` : ''}
                            {item.rest_seconds ? ` · ${item.rest_seconds}s` : ''}
                          </span>
                          {item.notes && <span style={{ display: 'block', color: 'var(--oc-gold)', fontSize: 12 }}>{item.notes}</span>}
                        </span>
                        <span className="oc-item-actions">
                          <button type="button" className="oc-icon-btn" aria-label={t('coachDetail.moveUp')} disabled={busy || dayItems[0]?.id === item.id} onClick={() => move(item, -1)}>↑</button>
                          <button type="button" className="oc-icon-btn" aria-label={t('coachDetail.moveDown')} disabled={busy || dayItems[dayItems.length - 1]?.id === item.id} onClick={() => move(item, 1)}>↓</button>
                          <button type="button" className="oc-link oc-link--gold" onClick={() => (editingId === item.id ? setEditingId(null) : startEdit(item))}>
                            {editingId === item.id ? t('common.cancel') : t('coachDetail.edit')}
                          </button>
                          <button type="button" className="oc-link oc-link--danger" onClick={() => removeExercise(item.id)}>
                            {t('coachStudentDetail.remove')}
                          </button>
                        </span>
                        {editingId === item.id && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveEdit(item.id);
                            }}
                            style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end', width: '100%' }}
                          >
                            <div style={{ width: 70 }}>
                              <Field label={t('coachStudentDetail.sets')}>
                                <Input value={edit.sets} onChange={(e) => setEdit({ ...edit, sets: e.target.value })} inputMode="numeric" />
                              </Field>
                            </div>
                            <div style={{ width: 80 }}>
                              <Field label={t('coachStudentDetail.reps')}>
                                <Input value={edit.reps} onChange={(e) => setEdit({ ...edit, reps: e.target.value })} />
                              </Field>
                            </div>
                            <div style={{ width: 80 }}>
                              <Field label={t('coachStudentDetail.weightKg')}>
                                <Input value={edit.weight} onChange={(e) => setEdit({ ...edit, weight: e.target.value })} inputMode="decimal" />
                              </Field>
                            </div>
                            <div style={{ width: 90 }}>
                              <Field label={t('coachDetail.restSec')}>
                                <Input value={edit.rest} onChange={(e) => setEdit({ ...edit, rest: e.target.value })} inputMode="numeric" />
                              </Field>
                            </div>
                            <div style={{ flex: '1 1 160px' }}>
                              <Field label={t('coachDetail.note')}>
                                <Input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder={t('coachDetail.notePlaceholder')} />
                              </Field>
                            </div>
                            <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('routine.save')}</Button>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addExercise} style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ width: 130 }}>
              <Field label={t('coachStudentDetail.day')}>
                <Select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
                  <option value="">{t('day.noneOption')}</option>
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {t(d.key)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <Field label={t('coachStudentDetail.exercise')}>
                <Select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} required>
                  <option value="">{t('coachStudentDetail.choose')}</option>
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {translateExerciseName(ex.name, lang)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div style={{ width: 70 }}>
              <Field label={t('coachStudentDetail.sets')}>
                <Input value={sets} onChange={(e) => setSets(e.target.value)} inputMode="numeric" />
              </Field>
            </div>
            <div style={{ width: 90 }}>
              <Field label={t('coachStudentDetail.reps')}>
                <Input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="8-12" />
              </Field>
            </div>
            <div style={{ width: 90 }}>
              <Field label={t('coachStudentDetail.weightKg')}>
                <Input value={weightTarget} onChange={(e) => setWeightTarget(e.target.value)} inputMode="decimal" />
              </Field>
            </div>
            <Button type="submit">{t('common.add')}</Button>
          </form>
        </>
      )}

      {!loading && sources.length > 0 && (
        <div style={{ marginTop: 'var(--oc-space-5)', borderTop: '1px solid var(--oc-border)', paddingTop: 'var(--oc-space-4)' }}>
          <p style={{ margin: '0 0 var(--oc-space-2)', fontSize: 13, color: 'var(--oc-text-muted)' }}>{t('coachDetail.copyHint')}</p>
          <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <Field label={t('coachDetail.copyFrom')}>
                <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                  <option value="">{t('coachStudentDetail.choose')}</option>
                  {sources.map((src) => (
                    <option key={src.id} value={src.id}>{src.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button variant="secondary" disabled={!copyFrom || busy} onClick={copyRoutine}>
              {t('coachDetail.copyButton')}
            </Button>
          </div>
          {copyMsg && <p style={{ color: 'var(--oc-energy)', fontSize: 13 }}>{copyMsg}</p>}
        </div>
      )}
    </Card>
  );
}

function NutritionSection({ studentId, trainerId }: { studentId: string; trainerId: string }) {
  const { t } = useLanguage();
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('nutrition_plans')
      .select('*')
      .eq('student_id', studentId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    setPlan(data ?? null);
    setCalories(data?.calories_target?.toString() ?? '');
    setProtein(data?.protein_g?.toString() ?? '');
    setCarbs(data?.carbs_g?.toString() ?? '');
    setFat(data?.fat_g?.toString() ?? '');
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      calories_target: calories ? Number(calories) : null,
      protein_g: protein ? Number(protein) : null,
      carbs_g: carbs ? Number(carbs) : null,
      fat_g: fat ? Number(fat) : null,
    };
    const { error: saveErr } = plan
      ? await supabase.from('nutrition_plans').update(payload).eq('id', plan.id)
      : await supabase.from('nutrition_plans').insert({
          student_id: studentId,
          trainer_id: trainerId,
          name: 'Plan nutricional',
          ...payload,
        });
    setSaving(false);
    if (saveErr) {
      setError(t('common.saveFailed', { message: saveErr.message }));
      return;
    }
    load();
  }

  if (loading) {
    return (
      <Card>
        <h2 style={{ marginTop: 0 }}>{t('coachStudentDetail.dietTitle')}</h2>
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{t('coachStudentDetail.dietTitle')}</h2>
      {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ width: 100 }}>
          <Field label={t('coachStudentDetail.caloriesLabel')}>
            <Input value={calories} onChange={(e) => setCalories(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <div style={{ width: 90 }}>
          <Field label={t('coachStudentDetail.proteinG')}>
            <Input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <div style={{ width: 90 }}>
          <Field label={t('coachStudentDetail.carbsG')}>
            <Input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <div style={{ width: 90 }}>
          <Field label={t('coachStudentDetail.fatG')}>
            <Input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? t('common.saving') : plan ? t('coachStudentDetail.update') : t('coachStudentDetail.createPlan')}
        </Button>
      </form>

      <h3 style={{ marginTop: 'var(--oc-space-5)', marginBottom: 'var(--oc-space-3)', fontSize: 15 }}>
        {t('coachStudentDetail.detailedDietTitle')}
      </h3>
      <p style={{ color: 'var(--oc-text-muted)', fontSize: 13, marginTop: -8 }}>
        {t('coachStudentDetail.detailedDietHint')}
      </p>
      <DietBuilder studentId={studentId} />
    </Card>
  );
}

function PaymentsSection({ studentId }: { studentId: string }) {
  const { t, lang } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receiptUrls, setReceiptUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('period_start', { ascending: false });
    const rows = data ?? [];
    setPayments(rows);

    const urls: Record<number, string> = {};
    await Promise.all(
      rows
        .filter((p) => p.receipt_path)
        .map(async (p) => {
          const { data: signed } = await supabase.storage
            .from(RECEIPTS_BUCKET)
            .createSignedUrl(p.receipt_path as string, 60 * 60);
          if (signed?.signedUrl) urls[p.id] = signed.signedUrl;
        }),
    );
    setReceiptUrls(urls);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: insertErr } = await supabase.from('payments').insert({
      student_id: studentId,
      amount: Number(amount),
      period_start: periodStart,
      period_end: periodEnd,
    });
    if (insertErr) {
      setSaving(false);
      setError(t('common.saveFailed', { message: insertErr.message }));
      return;
    }
    setAmount('');
    setPeriodStart('');
    setPeriodEnd('');
    setSaving(false);
    load();
  }

  // Cuota siguiente: misma plata y mismo largo de período, corrido un mes.
  async function createNextFee() {
    const last = payments[0];
    if (!last) return;
    const shift = (value: string) => {
      const d = new Date(`${value}T00:00:00`);
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, lastDay));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    setSaving(true);
    setError(null);
    const { error: insertErr } = await supabase.from('payments').insert({
      student_id: studentId,
      amount: last.amount,
      currency: last.currency,
      period_start: shift(last.period_start),
      period_end: shift(last.period_end),
    });
    setSaving(false);
    if (insertErr) {
      setError(t('common.saveFailed', { message: insertErr.message }));
      return;
    }
    load();
  }

  async function markPaid(id: number) {
    setError(null);
    const { error: updateErr } = await supabase
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id);
    if (updateErr) {
      setError(t('common.saveFailed', { message: updateErr.message }));
      return;
    }
    load();
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--oc-space-3)', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t('coachStudentDetail.paymentsTitle')}</h2>
        {payments.length > 0 && (
          <Button variant="secondary" onClick={createNextFee} disabled={saving}>
            {t('coachDetail.nextFee', {
              amount: formatMoney(payments[0].amount, payments[0].currency, lang),
            })}
          </Button>
        )}
      </div>
      <p style={{ color: 'var(--oc-text-muted)', fontSize: 12, margin: 'var(--oc-space-2) 0 var(--oc-space-4)' }}>
        {t('coachDetail.nextFeeHint')}
      </p>
      {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p>
      ) : payments.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>{t('coachStudentDetail.noPayments')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)', marginBottom: 'var(--oc-space-4)' }}>
          {payments.map((payment) => (
            <div
              key={payment.id}
              style={{
                padding: 'var(--oc-space-2) var(--oc-space-3)',
                background: 'var(--oc-surface-gradient)',
                boxShadow: 'var(--oc-shadow-raised-sm)',
                borderRadius: 'var(--oc-radius-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--oc-space-3)', flexWrap: 'wrap' }}>
                <span>
                  {t('coachStudentDetail.rangeLine', {
                    start: formatDate(payment.period_start, lang),
                    end: formatDate(payment.period_end, lang),
                    amount: formatMoney(payment.amount, payment.currency, lang),
                  })}
                </span>
                {receiptUrls[payment.id] && (
                  <a href={receiptUrls[payment.id]} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                    {t('coachStudentDetail.viewReceipt')}
                  </a>
                )}
              </div>
              <div style={{ marginTop: 'var(--oc-space-2)' }}>
                {payment.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={() => markPaid(payment.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--oc-energy)', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}
                  >
                    {t('coachStudentDetail.markPaid')}
                  </button>
                ) : (
                  <StatusPill status={payment.status} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ width: 100 }}>
          <Field label={t('coachStudentDetail.amount')}>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required />
          </Field>
        </div>
        <div>
          <Field label={t('coachStudentDetail.from')}>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
          </Field>
        </div>
        <div>
          <Field label={t('coachStudentDetail.to')}>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
          </Field>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? t('common.saving') : t('coachStudentDetail.registerPayment')}
        </Button>
      </form>
    </Card>
  );
}
