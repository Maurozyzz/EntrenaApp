import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Input';
import type { Exercise, NutritionPlan, Payment, Profile, Routine, RoutineExerciseWithName } from '../../lib/types';

const NAV = [
  { to: '/coach', label: 'Alumnos' },
  { to: '/coach/ejercicios', label: 'Ejercicios' },
];

export function CoachStudentDetail() {
  const { id: studentId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [student, setStudent] = useState<Profile | null>(null);

  useEffect(() => {
    if (!studentId) return;
    supabase.from('profiles').select('*').eq('id', studentId).single().then(({ data }) => setStudent(data));
  }, [studentId]);

  if (!studentId || !profile) return null;

  return (
    <AppShell links={NAV}>
      <h1 style={{ color: 'var(--oc-gold)' }}>{student?.full_name || student?.email || 'Alumno'}</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-5)', marginTop: 'var(--oc-space-4)' }}>
        <RoutineSection studentId={studentId} trainerId={profile.id} />
        <NutritionSection studentId={studentId} trainerId={profile.id} />
        <PaymentsSection studentId={studentId} />
      </div>
    </AppShell>
  );
}

function RoutineSection({ studentId, trainerId }: { studentId: string; trainerId: string }) {
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [items, setItems] = useState<RoutineExerciseWithName[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [exerciseId, setExerciseId] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weightTarget, setWeightTarget] = useState('');

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
        .select('*, exercises(name)')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function createRoutine() {
    await supabase.from('routines').insert({
      student_id: studentId,
      trainer_id: trainerId,
      name: 'Rutina activa',
    });
    load();
  }

  async function addExercise(e: FormEvent) {
    e.preventDefault();
    if (!routine || !exerciseId) return;
    await supabase.from('routine_exercises').insert({
      routine_id: routine.id,
      exercise_id: Number(exerciseId),
      order_index: items.length,
      sets: sets ? Number(sets) : null,
      reps: reps || null,
      weight_target: weightTarget ? Number(weightTarget) : null,
    });
    setExerciseId('');
    setSets('');
    setReps('');
    setWeightTarget('');
    load();
  }

  async function removeExercise(id: number) {
    await supabase.from('routine_exercises').delete().eq('id', id);
    load();
  }

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Rutina</h2>
      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : !routine ? (
        <div>
          <p style={{ color: 'var(--oc-text-muted)' }}>Este alumno todavía no tiene una rutina activa.</p>
          <Button onClick={createRoutine}>Crear rutina</Button>
        </div>
      ) : (
        <>
          {items.length === 0 ? (
            <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>Todavía no agregaste ejercicios.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)', marginBottom: 'var(--oc-space-4)' }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--oc-space-2) var(--oc-space-3)',
                    border: '1px solid var(--oc-border)',
                    borderRadius: 'var(--oc-radius-sm)',
                    gap: 'var(--oc-space-3)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    <strong>{item.exercises?.name}</strong>
                    <span style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>
                      {' '}
                      · {item.sets ?? '—'}x{item.reps ?? '—'} {item.weight_target ? `· ${item.weight_target}kg` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExercise(item.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--oc-danger)', cursor: 'pointer', fontSize: 13 }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addExercise} style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px' }}>
              <Field label="Ejercicio">
                <Select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} required>
                  <option value="">Elegir…</option>
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div style={{ width: 70 }}>
              <Field label="Series">
                <Input value={sets} onChange={(e) => setSets(e.target.value)} inputMode="numeric" />
              </Field>
            </div>
            <div style={{ width: 90 }}>
              <Field label="Reps">
                <Input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="8-12" />
              </Field>
            </div>
            <div style={{ width: 90 }}>
              <Field label="Peso (kg)">
                <Input value={weightTarget} onChange={(e) => setWeightTarget(e.target.value)} inputMode="decimal" />
              </Field>
            </div>
            <Button type="submit">Agregar</Button>
          </form>
        </>
      )}
    </Card>
  );
}

function NutritionSection({ studentId, trainerId }: { studentId: string; trainerId: string }) {
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);

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
    const payload = {
      calories_target: calories ? Number(calories) : null,
      protein_g: protein ? Number(protein) : null,
      carbs_g: carbs ? Number(carbs) : null,
      fat_g: fat ? Number(fat) : null,
    };
    if (plan) {
      await supabase.from('nutrition_plans').update(payload).eq('id', plan.id);
    } else {
      await supabase.from('nutrition_plans').insert({
        student_id: studentId,
        trainer_id: trainerId,
        name: 'Plan nutricional',
        ...payload,
      });
    }
    setSaving(false);
    load();
  }

  if (loading) {
    return (
      <Card>
        <h2 style={{ marginTop: 0 }}>Nutrición</h2>
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Nutrición</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ width: 100 }}>
          <Field label="Calorías">
            <Input value={calories} onChange={(e) => setCalories(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <div style={{ width: 90 }}>
          <Field label="Proteína (g)">
            <Input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <div style={{ width: 90 }}>
          <Field label="Carbs (g)">
            <Input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <div style={{ width: 90 }}>
          <Field label="Grasas (g)">
            <Input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : plan ? 'Actualizar' : 'Crear plan'}
        </Button>
      </form>
    </Card>
  );
}

function PaymentsSection({ studentId }: { studentId: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('period_start', { ascending: false });
    setPayments(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('payments').insert({
      student_id: studentId,
      amount: Number(amount),
      period_start: periodStart,
      period_end: periodEnd,
    });
    setAmount('');
    setPeriodStart('');
    setPeriodEnd('');
    setSaving(false);
    load();
  }

  async function markPaid(id: number) {
    await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    load();
  }

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Pagos</h2>

      {loading ? (
        <p style={{ color: 'var(--oc-text-muted)' }}>Cargando…</p>
      ) : payments.length === 0 ? (
        <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>Todavía no hay pagos cargados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)', marginBottom: 'var(--oc-space-4)' }}>
          {payments.map((payment) => (
            <div
              key={payment.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--oc-space-2) var(--oc-space-3)',
                border: '1px solid var(--oc-border)',
                borderRadius: 'var(--oc-radius-sm)',
                gap: 'var(--oc-space-3)',
                flexWrap: 'wrap',
              }}
            >
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
                }}
              >
                {payment.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={() => markPaid(payment.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--oc-energy)', cursor: 'pointer', fontSize: 13 }}
                  >
                    Marcar pagado
                  </button>
                ) : (
                  payment.status
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ width: 100 }}>
          <Field label="Monto">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required />
          </Field>
        </div>
        <div>
          <Field label="Desde">
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
          </Field>
        </div>
        <div>
          <Field label="Hasta">
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
          </Field>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Registrar pago'}
        </Button>
      </form>
    </Card>
  );
}
