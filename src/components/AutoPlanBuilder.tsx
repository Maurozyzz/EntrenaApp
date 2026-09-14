import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../lib/i18n';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Field, Input, Select, Textarea } from './ui/Input';
import type { Exercise } from '../lib/types';
import { buildMeals, calculatePlan, type FoodOption, type GeneratedPlan, type PlanProfile } from '../lib/rulesEngine';

type Sex = 'male' | 'female' | 'other';
type Activity = 'sedentary' | 'light' | 'moderate' | 'high';
type Goal = 'lose' | 'maintain' | 'gain';
type TrainingFocus = 'hypertrophy' | 'endurance' | 'strength' | 'general';
type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';
type HealthProfile = PlanProfile;

const DEFAULT_PROFILE: HealthProfile = {
  height_cm: null,
  weight_kg: null,
  body_fat_pct: null,
  age_years: null,
  sex: null,
  activity_level: 'moderate',
  goal: 'maintain',
  training_focus: 'hypertrophy',
  training_level: 'beginner',
  equipment: null,
  session_minutes: 60,
  preferred_exercises: null,
  excluded_exercises: null,
  training_days: 3,
  injuries: null,
  meals_per_day: 4,
  meal_schedule: null,
  preferred_foods: null,
  avoided_foods: null,
  allergies: null,
  food_budget: null,
  daily_steps: null,
  sleep_hours: null,
  stress_level: 'moderate',
  work_type: 'sedentary',
  medical_conditions: null,
  medical_clearance: false,
};

export function AutoPlanBuilder({ studentId, trainerId }: { studentId: string; trainerId: string }) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<HealthProfile>(DEFAULT_PROFILE);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [foods, setFoods] = useState<FoodOption[]>([]);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('student_health_profiles').select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('exercises').select('*').order('name', { ascending: true }),
      supabase.from('foods').select('*').order('name', { ascending: true }),
    ]).then(([profileResult, exercisesResult, foodsResult]) => {
      if (profileResult.data) setProfile({ ...DEFAULT_PROFILE, ...profileResult.data });
      setExercises((exercisesResult.data as Exercise[]) ?? []);
      setFoods((foodsResult.data as FoodOption[]) ?? []);
      const loadError = profileResult.error ?? exercisesResult.error ?? foodsResult.error;
      if (loadError) setError(`${t('autoPlan.loadFailed')}: ${loadError.message}`);
      setLoading(false);
    });
  }, [studentId, t]);

  function updateProfile<K extends keyof HealthProfile>(key: K, value: HealthProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setPlan(null);
    setMessage(null);
  }

  function generate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!profile.height_cm || !profile.weight_kg || !profile.age_years || !profile.sex) {
      setError(t('autoPlan.requiredFields'));
      return;
    }
    if (exercises.length === 0 || foods.length === 0) {
      setError(t('autoPlan.catalogUnavailable'));
      return;
    }
    const generated = calculatePlan(profile, exercises);
    setPlan({ ...generated, meals: buildMeals(foods, generated.calories, profile) });
  }

  function updateMeal(index: number, field: 'meal' | 'quantity', value: string) {
    setPlan((current) => current ? {
      ...current,
      meals: current.meals.map((meal, mealIndex) => {
        if (mealIndex !== index) return meal;
        if (field === 'meal') return { ...meal, meal: value };
        const quantity = Math.max(1, Number(value) || 1);
        const scale = quantity / Math.max(meal.quantity, 1);
        return { ...meal, quantity, calories: Math.round(meal.calories * scale), protein: Math.round(meal.protein * scale), carbs: Math.round(meal.carbs * scale), fat: Math.round(meal.fat * scale) };
      }),
    } : current);
  }

  async function applyPlan() {
    if (!plan || plan.exercises.length === 0 || plan.meals.length === 0) {
      setError(t('autoPlan.incompletePlan'));
      return;
    }
    if (profile.medical_conditions && !profile.medical_clearance) {
      setError(t('autoPlan.medicalWarning'));
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    const profilePayload = { student_id: studentId, trainer_id: trainerId, ...profile };
    const { error: profileError } = await supabase.from('student_health_profiles').upsert(profilePayload, { onConflict: 'student_id' });
    if (profileError) {
      setError(`${t('autoPlan.profileSaveFailed')}: ${profileError.message}`);
      setSaving(false);
      return;
    }

    const [{ data: oldRoutines }, { data: oldNutritionPlans }] = await Promise.all([
      supabase.from('routines').select('id').eq('student_id', studentId).eq('trainer_id', trainerId).eq('active', true),
      supabase.from('nutrition_plans').select('id').eq('student_id', studentId).eq('trainer_id', trainerId).eq('active', true),
    ]);
    const { data: routine, error: routineError } = await supabase
      .from('routines')
      .insert({
        student_id: studentId,
        trainer_id: trainerId,
        name: t('autoPlan.routineName', { focus: t(`autoPlan.${profile.training_focus}`) }),
        notes: `${t('autoPlan.routineNotes', { focus: t(`autoPlan.${profile.training_focus}`) })} ${t('autoPlan.warmupNotes')}`,
      })
      .select('*')
      .single();
    if (routineError || !routine) {
      setError(`${t('autoPlan.routineSaveFailed')}: ${routineError?.message ?? t('autoPlan.saveFailed')}`);
      setSaving(false);
      return;
    }

    const { error: exercisesError } = await supabase.from('routine_exercises').insert(
      plan.exercises.map((exercise, index) => ({
        routine_id: routine.id,
        exercise_id: exercise.id,
        day_of_week: exercise.day,
        order_index: index,
        sets: exercise.sets,
        reps: exercise.reps,
        rest_seconds: exercise.rest,
        notes: `${t('autoPlan.exerciseNotes')} ${exercise.focus} ${exercise.reason}`,
      })),
    );
    if (exercisesError) {
      setError(`${t('autoPlan.exercisesSaveFailed')}: ${exercisesError.message}`);
      setSaving(false);
      return;
    }

    const { error: nutritionError } = await supabase.from('nutrition_plans').insert({
      student_id: studentId,
      trainer_id: trainerId,
      name: t('autoPlan.nutritionName', { focus: t(`autoPlan.${profile.training_focus}`) }),
      calories_target: plan.calories,
      protein_g: plan.protein,
      carbs_g: plan.carbs,
      fat_g: plan.fat,
      notes: t('autoPlan.nutritionNotes', { focus: t(`autoPlan.${profile.training_focus}`) }),
    });
    if (nutritionError) {
      setError(`${t('autoPlan.nutritionSaveFailed')}: ${nutritionError.message}`);
      setSaving(false);
      return;
    }
    const { data: newDietEntries, error: dietError } = await supabase.from('diet_entries').insert(
      plan.meals.map((meal) => ({
        student_id: studentId,
        food_id: meal.foodId,
        quantity_g: meal.quantity,
        quantity_unit: meal.unit,
        meal_label: meal.meal,
      })),
    ).select('id');
    if (dietError) {
      setError(`${t('autoPlan.dietSaveFailed')}: ${dietError.message}`);
      setSaving(false);
      return;
    }
    const newDietIds = (newDietEntries ?? []).map((entry) => entry.id);
    if (newDietIds.length === 0) {
      setError(t('autoPlan.dietSaveFailed'));
      setSaving(false);
      return;
    }
    const { error: oldDietError } = await supabase
      .from('diet_entries')
      .delete()
      .eq('student_id', studentId)
      .not('id', 'in', `(${newDietIds.join(',')})`);
    if (oldDietError) {
      setError(`${t('autoPlan.dietCleanupFailed')}: ${oldDietError.message}`);
      setSaving(false);
      return;
    }
    const oldRoutineIds = (oldRoutines ?? []).map((row) => row.id);
    const oldNutritionIds = (oldNutritionPlans ?? []).map((row) => row.id);
    if (oldRoutineIds.length > 0) await supabase.from('routines').update({ active: false }).in('id', oldRoutineIds);
    if (oldNutritionIds.length > 0) await supabase.from('nutrition_plans').update({ active: false }).in('id', oldNutritionIds);
    setSaving(false);
    setMessage(t('autoPlan.saved'));
  }

  if (loading) return <Card><p style={{ color: 'var(--oc-text-muted)' }}>{t('common.loading')}</p></Card>;

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>{t('autoPlan.title')}</h2>
      <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>{t('autoPlan.intro')}</p>
      <p style={{ color: 'var(--oc-gold)', fontSize: 12 }}>{t('autoPlan.disclaimer')}</p>
      {error && !plan && <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{error}</p>}
      <form onSubmit={generate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 120px' }}><Field label={t('autoPlan.height')}><Input type="number" min="100" max="250" value={profile.height_cm ?? ''} onChange={(e) => updateProfile('height_cm', Number(e.target.value) || null)} required /></Field></div>
          <div style={{ flex: '1 1 120px' }}><Field label={t('autoPlan.weight')}><Input type="number" min="30" max="300" step="0.1" value={profile.weight_kg ?? ''} onChange={(e) => updateProfile('weight_kg', Number(e.target.value) || null)} required /></Field></div>
          <div style={{ flex: '1 1 130px' }}><Field label={t('autoPlan.bodyFat')}><Input type="number" min="3" max="70" step="0.1" value={profile.body_fat_pct ?? ''} onChange={(e) => updateProfile('body_fat_pct', Number(e.target.value) || null)} /></Field></div>
          <div style={{ flex: '1 1 100px' }}><Field label={t('autoPlan.age')}><Input type="number" min="13" max="100" value={profile.age_years ?? ''} onChange={(e) => updateProfile('age_years', Number(e.target.value) || null)} required /></Field></div>
          <div style={{ flex: '1 1 150px' }}><Field label={t('autoPlan.sex')}><Select value={profile.sex ?? ''} onChange={(e) => updateProfile('sex', (e.target.value || null) as Sex | null)} required><option value="">{t('autoPlan.choose')}</option><option value="female">{t('autoPlan.female')}</option><option value="male">{t('autoPlan.male')}</option><option value="other">{t('autoPlan.other')}</option></Select></Field></div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}><Field label={t('autoPlan.activity')}><Select value={profile.activity_level} onChange={(e) => updateProfile('activity_level', e.target.value as Activity)}><option value="sedentary">{t('autoPlan.sedentary')}</option><option value="light">{t('autoPlan.light')}</option><option value="moderate">{t('autoPlan.moderate')}</option><option value="high">{t('autoPlan.high')}</option></Select></Field></div>
          <div style={{ flex: '1 1 180px' }}><Field label={t('autoPlan.goal')}><Select value={profile.goal} onChange={(e) => updateProfile('goal', e.target.value as Goal)}><option value="lose">{t('autoPlan.lose')}</option><option value="maintain">{t('autoPlan.maintain')}</option><option value="gain">{t('autoPlan.gain')}</option></Select></Field></div>
          <div style={{ flex: '1 1 220px' }}><Field label={t('autoPlan.trainingFocus')}><Select value={profile.training_focus} onChange={(e) => updateProfile('training_focus', e.target.value as TrainingFocus)}><option value="hypertrophy">{t('autoPlan.hypertrophy')}</option><option value="endurance">{t('autoPlan.endurance')}</option><option value="strength">{t('autoPlan.strength')}</option><option value="general">{t('autoPlan.general')}</option></Select></Field></div>
          <div style={{ flex: '1 1 180px' }}><Field label={t('autoPlan.level')}><Select value={profile.training_level} onChange={(e) => updateProfile('training_level', e.target.value as TrainingLevel)}><option value="beginner">{t('autoPlan.beginner')}</option><option value="intermediate">{t('autoPlan.intermediate')}</option><option value="advanced">{t('autoPlan.advanced')}</option></Select></Field></div>
          <div style={{ flex: '1 1 120px' }}><Field label={t('autoPlan.days')}><Select value={profile.training_days} onChange={(e) => updateProfile('training_days', Number(e.target.value))}><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></Select></Field></div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}><Field label={t('autoPlan.equipment')}><Input value={profile.equipment ?? ''} onChange={(e) => updateProfile('equipment', e.target.value || null)} placeholder={t('autoPlan.equipmentPlaceholder')} /></Field></div>
          <div style={{ flex: '1 1 130px' }}><Field label={t('autoPlan.sessionMinutes')}><Input type="number" min="20" max="180" value={profile.session_minutes ?? ''} onChange={(e) => updateProfile('session_minutes', Number(e.target.value) || null)} /></Field></div>
          <div style={{ flex: '1 1 220px' }}><Field label={t('autoPlan.preferredExercises')}><Input value={profile.preferred_exercises ?? ''} onChange={(e) => updateProfile('preferred_exercises', e.target.value || null)} placeholder={t('autoPlan.listPlaceholder')} /></Field></div>
          <div style={{ flex: '1 1 220px' }}><Field label={t('autoPlan.excludedExercises')}><Input value={profile.excluded_exercises ?? ''} onChange={(e) => updateProfile('excluded_exercises', e.target.value || null)} placeholder={t('autoPlan.listPlaceholder')} /></Field></div>
        </div>
        <Field label={t('autoPlan.injuries')}><Textarea value={profile.injuries ?? ''} onChange={(e) => updateProfile('injuries', e.target.value || null)} placeholder={t('autoPlan.injuriesPlaceholder')} rows={3} /></Field>
        <h3 style={{ margin: 'var(--oc-space-2) 0 0' }}>{t('autoPlan.recoveryHealth')}</h3>
        <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 130px' }}><Field label={t('autoPlan.steps')}><Input type="number" min="0" max="100000" value={profile.daily_steps ?? ''} onChange={(e) => updateProfile('daily_steps', Number(e.target.value) || null)} /></Field></div>
          <div style={{ flex: '1 1 130px' }}><Field label={t('autoPlan.sleep')}><Input type="number" min="0" max="24" step="0.5" value={profile.sleep_hours ?? ''} onChange={(e) => updateProfile('sleep_hours', Number(e.target.value) || null)} /></Field></div>
          <div style={{ flex: '1 1 180px' }}><Field label={t('autoPlan.stress')}><Select value={profile.stress_level} onChange={(e) => updateProfile('stress_level', e.target.value as HealthProfile['stress_level'])}><option value="low">{t('autoPlan.low')}</option><option value="moderate">{t('autoPlan.moderate')}</option><option value="high">{t('autoPlan.high')}</option></Select></Field></div>
          <div style={{ flex: '1 1 180px' }}><Field label={t('autoPlan.workType')}><Select value={profile.work_type} onChange={(e) => updateProfile('work_type', e.target.value as HealthProfile['work_type'])}><option value="sedentary">{t('autoPlan.sedentary')}</option><option value="active">{t('autoPlan.active')}</option><option value="physical">{t('autoPlan.physical')}</option></Select></Field></div>
        </div>
        <Field label={t('autoPlan.medicalConditions')}><Textarea value={profile.medical_conditions ?? ''} onChange={(e) => updateProfile('medical_conditions', e.target.value || null)} placeholder={t('autoPlan.medicalPlaceholder')} rows={2} /></Field>
        <label style={{ display: 'flex', gap: 'var(--oc-space-2)', alignItems: 'center', color: 'var(--oc-text-muted)', fontSize: 13 }}><input type="checkbox" checked={profile.medical_clearance} onChange={(e) => updateProfile('medical_clearance', e.target.checked)} />{t('autoPlan.medicalClearance')}</label>
        {profile.medical_conditions && !profile.medical_clearance && <p style={{ color: 'var(--oc-gold)', fontSize: 12, margin: 0 }}>{t('autoPlan.medicalWarning')}</p>}
        <h3 style={{ margin: 'var(--oc-space-2) 0 0' }}>{t('autoPlan.dietPreferences')}</h3>
        <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 130px' }}><Field label={t('autoPlan.mealsPerDay')}><Select value={profile.meals_per_day} onChange={(e) => updateProfile('meals_per_day', Number(e.target.value))}><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></Select></Field></div>
          <div style={{ flex: '1 1 220px' }}><Field label={t('autoPlan.mealSchedule')}><Input value={profile.meal_schedule ?? ''} onChange={(e) => updateProfile('meal_schedule', e.target.value || null)} placeholder={t('autoPlan.schedulePlaceholder')} /></Field></div>
          <div style={{ flex: '1 1 220px' }}><Field label={t('autoPlan.preferredFoods')}><Input value={profile.preferred_foods ?? ''} onChange={(e) => updateProfile('preferred_foods', e.target.value || null)} placeholder={t('autoPlan.listPlaceholder')} /></Field></div>
          <div style={{ flex: '1 1 220px' }}><Field label={t('autoPlan.avoidedFoods')}><Input value={profile.avoided_foods ?? ''} onChange={(e) => updateProfile('avoided_foods', e.target.value || null)} placeholder={t('autoPlan.listPlaceholder')} /></Field></div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px' }}><Field label={t('autoPlan.allergies')}><Input value={profile.allergies ?? ''} onChange={(e) => updateProfile('allergies', e.target.value || null)} /></Field></div>
          <div style={{ flex: '1 1 220px' }}><Field label={t('autoPlan.foodBudget')}><Input value={profile.food_budget ?? ''} onChange={(e) => updateProfile('food_budget', e.target.value || null)} placeholder={t('autoPlan.budgetPlaceholder')} /></Field></div>
        </div>
        {error && <p style={{ color: 'var(--oc-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
        <Button type="submit">{plan ? t('autoPlan.regenerate') : t('autoPlan.generate')}</Button>
      </form>

      {plan && (
        <div style={{ marginTop: 'var(--oc-space-5)', borderTop: '1px solid var(--oc-border)', paddingTop: 'var(--oc-space-4)' }}>
          <h3 style={{ marginTop: 0 }}>{t('autoPlan.preview')}</h3>
          <div style={{ display: 'flex', gap: 'var(--oc-space-2)', flexWrap: 'wrap' }}>
            {[['autoPlan.calories', plan.calories], ['autoPlan.protein', `${plan.protein}g`], ['autoPlan.carbs', `${plan.carbs}g`], ['autoPlan.fat', `${plan.fat}g`]].map(([label, value]) => <span key={String(label)} style={{ background: 'var(--oc-surface-gradient)', borderRadius: 'var(--oc-radius-sm)', boxShadow: 'var(--oc-shadow-raised-sm)', padding: 'var(--oc-space-2) var(--oc-space-3)', fontSize: 13 }}>{t(String(label))}: <strong>{value}</strong></span>)}
          </div>
          <h3 style={{ marginTop: 'var(--oc-space-4)', marginBottom: 'var(--oc-space-2)' }}>{t('autoPlan.routinePreview')}</h3>
          <p style={{ color: 'var(--oc-text-muted)', fontSize: 13 }}>{t('autoPlan.warmupNotes')}</p>
          {plan.exercises.length === 0 ? <p style={{ color: 'var(--oc-danger)', fontSize: 13 }}>{t('autoPlan.noExercises')}</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-3)' }}>
              {Array.from({ length: profile.training_days }, (_, index) => index + 1).map((day) => (
                <div key={day} style={{ padding: 'var(--oc-space-3)', background: 'var(--oc-surface-gradient)', borderRadius: 'var(--oc-radius-sm)', boxShadow: 'var(--oc-shadow-raised-sm)' }}>
                  <strong style={{ color: 'var(--oc-gold)' }}>{t('autoPlan.dayLabel', { day })}</strong>
                  {plan.exercises.filter((exercise) => exercise.day === day).map((exercise) => (
                    <p key={`${day}-${exercise.id}`} style={{ fontSize: 13, margin: 'var(--oc-space-2) 0 0' }}>
                      <strong>{exercise.name}</strong>
                      <span style={{ color: 'var(--oc-text-muted)', display: 'block' }}>
                        {t('autoPlan.prescription', { sets: exercise.sets, reps: exercise.reps, rest: exercise.rest, tempo: exercise.tempo })}
                      </span>
                      <span style={{ color: 'var(--oc-text-muted)', display: 'block' }}>{exercise.focus}</span>
                      <span style={{ color: 'var(--oc-gold)', display: 'block' }}>{exercise.reason}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
          <p style={{ color: 'var(--oc-text-muted)', fontSize: 12 }}>{t('autoPlan.trainingMethod')}</p>
          <h3 style={{ marginTop: 'var(--oc-space-4)', marginBottom: 'var(--oc-space-2)' }}>{t('autoPlan.dietPreview')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oc-space-2)' }}>
            {plan.meals.map((meal, index) => (
              <div key={`${meal.foodId}-${index}`} style={{ display: 'flex', gap: 'var(--oc-space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 130px' }}><Field label={index === 0 || plan.meals[index - 1].meal !== meal.meal ? t('autoPlan.meal') : ''}><Input value={meal.meal} onChange={(e) => updateMeal(index, 'meal', e.target.value)} /></Field></div>
                <div style={{ flex: '1 1 180px' }}><Field label={index === 0 || plan.meals[index - 1].meal !== meal.meal ? t('autoPlan.food') : ''}><Input value={meal.food} readOnly /></Field></div>
                <div style={{ width: 100 }}><Field label={index === 0 || plan.meals[index - 1].meal !== meal.meal ? t('autoPlan.quantity') : ''}><Input type="number" min="1" value={meal.quantity} onChange={(e) => updateMeal(index, 'quantity', e.target.value)} /></Field></div>
                <span style={{ flex: '1 1 220px', color: 'var(--oc-text-muted)', fontSize: 12, paddingBottom: 8 }}>
                  {t('autoPlan.mealMacros', { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat })}
                </span>
              </div>
            ))}
          </div>
          <p style={{ color: 'var(--oc-text-muted)', fontSize: 12 }}>{t('autoPlan.dietMethod')}</p>
          <p style={{ color: 'var(--oc-text-muted)', fontSize: 12 }}>{t('autoPlan.review')}</p>
          <Button type="button" onClick={applyPlan} disabled={saving || plan.exercises.length === 0}>{saving ? t('common.saving') : t('autoPlan.apply')}</Button>
        </div>
      )}
      {message && <p style={{ color: 'var(--oc-success)', fontSize: 13 }}>{message}</p>}
    </Card>
  );
}