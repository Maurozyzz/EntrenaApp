import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../lib/i18n';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Field, Input, Select, Textarea } from './ui/Input';
import type { Exercise } from '../lib/types';

type Sex = 'male' | 'female' | 'other';
type Activity = 'sedentary' | 'light' | 'moderate' | 'high';
type Goal = 'lose' | 'maintain' | 'gain';
type TrainingFocus = 'hypertrophy' | 'endurance' | 'strength' | 'general';
type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';

interface HealthProfile {
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  age_years: number | null;
  sex: Sex | null;
  activity_level: Activity;
  goal: Goal;
  training_focus: TrainingFocus;
  training_level: TrainingLevel;
  equipment: string | null;
  session_minutes: number | null;
  preferred_exercises: string | null;
  excluded_exercises: string | null;
  training_days: number;
  injuries: string | null;
  meals_per_day: number;
  meal_schedule: string | null;
  preferred_foods: string | null;
  avoided_foods: string | null;
  allergies: string | null;
  food_budget: string | null;
  daily_steps: number | null;
  sleep_hours: number | null;
  stress_level: 'low' | 'moderate' | 'high';
  work_type: 'sedentary' | 'active' | 'physical';
  medical_conditions: string | null;
  medical_clearance: boolean;
}

interface GeneratedPlan {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  exercises: Array<{ id: number; name: string; muscleGroup: string | null; day: number; reason: string; sets: number; reps: string; rest: number; tempo: string; focus: string }>;
  meals: Array<{ foodId: number; meal: string; food: string; quantity: number; unit: 'g' | 'ml'; calories: number; protein: number; carbs: number; fat: number }>;
}

interface FoodOption {
  id: number;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

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

const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

const GOAL_ADJUSTMENTS: Record<Goal, number> = { lose: -300, maintain: 0, gain: 250 };

const INJURY_RULES: Array<{ terms: string[]; groups: string[]; names: string[] }> = [
  { terms: ['hombro', 'shoulder'], groups: ['Hombros', 'Pecho'], names: ['Press militar', 'Press de hombros', 'Fondos', 'Elevaciones'] },
  { terms: ['rodilla', 'knee'], groups: ['Piernas'], names: ['Sentadilla', 'Zancadas', 'Prensa', 'Extensión de cuádriceps', 'Salto', 'Correr', 'Escaladora'] },
  { terms: ['espalda', 'lumbar', 'columna', 'back'], groups: ['Espalda'], names: ['Peso muerto', 'Remo con barra', 'Hiperextensiones'] },
  { terms: ['codo', 'elbow'], groups: ['Bíceps', 'Tríceps'], names: ['Curl', 'Press francés', 'Extensión de tríceps', 'Fondos'] },
  { terms: ['tobillo', 'ankle'], groups: ['Piernas', 'Cardio'], names: ['Correr', 'Salto', 'Escaladora', 'Zancadas'] },
];

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isExerciseAllowed(exercise: Exercise, injuries: string, excludedExercises: string, equipment: string | null): boolean {
  const normalized = normalizeText(injuries);
  const excluded = normalizeText(excludedExercises);
  const exerciseName = normalizeText(exercise.name);
  const equipmentText = normalizeText(equipment ?? '');
  if (excluded && excluded.split(',').some((term) => term.trim() && exerciseName.includes(term.trim()))) return false;
  if (equipmentText && /(casa|home|sin maquina|sin maquinas)/.test(equipmentText) && /(polea|maquina|smith|stairmaster)/.test(exerciseName)) return false;
  return !INJURY_RULES.some((rule) => {
    if (!rule.terms.some((term) => normalized.includes(normalizeText(term)))) return false;
    return rule.names.some((name) => exerciseName.includes(normalizeText(name)));
  });
}

const FOCUS_KEYWORDS: Record<TrainingFocus, string[]> = {
  hypertrophy: ['press', 'curl', 'extensión', 'aperturas', 'elevaciones', 'hip thrust', 'prensa'],
  endurance: ['máquina', 'polea', 'plancha', 'puente', 'bicicleta', 'correr', 'remo (', 'escaladora'],
  strength: ['barra', 'press', 'sentadilla', 'peso muerto', 'dominadas', 'remo con barra'],
  general: [],
};

function exerciseReason(injuries: string, focus: TrainingFocus): string {
  const normalized = normalizeText(injuries);
  const matchingRule = INJURY_RULES.find((rule) => rule.terms.some((term) => normalized.includes(normalizeText(term))));
  const focusReason = focus === 'endurance'
    ? 'Se prioriza por permitir volumen alto con pausas cortas y técnica estable.'
    : focus === 'strength'
      ? 'Se prioriza por permitir trabajar fuerza con cargas progresivas y técnica controlada.'
      : focus === 'hypertrophy'
        ? 'Se prioriza por facilitar tensión mecánica y volumen efectivo para hipertrofia.'
        : 'Se selecciona por equilibrio entre fuerza, volumen y acondicionamiento.';
  if (!matchingRule) return focusReason;
  const injury = matchingRule.terms.find((term) => normalized.includes(normalizeText(term))) ?? 'la lesión declarada';
  return `${focusReason} Es una alternativa seleccionada para proteger la zona asociada a ${injury}; revisar tolerancia y técnica.`;
}

function buildMeals(foods: FoodOption[], targetCalories: number, profile: HealthProfile): GeneratedPlan['meals'] {
  const templates = [
    ['Desayuno', 'Avena (copos secos)', 70], ['Desayuno', 'Huevo entero', 150],
    ['Almuerzo', 'Pechuga de pollo', 180], ['Almuerzo', 'Arroz blanco cocido', 220],
    ['Merienda', 'Yogur griego natural', 200], ['Merienda', 'Banana', 120],
    ['Cena', 'Carne vacuna magra', 160], ['Cena', 'Papa cocida', 250],
  ] as const;
  const restrictions = normalizeText(`${profile.allergies ?? ''},${profile.avoided_foods ?? ''}`);
  const preferredFoods = normalizeText(profile.preferred_foods ?? '').split(',').map((term) => term.trim()).filter(Boolean);
  const availableFoods = foods.filter((food) => !restrictions.split(',').some((term) => term.trim() && normalizeText(food.name).includes(term.trim())));
  const chooseFood = (foodName: string, meal: string): FoodOption | undefined => {
    const exact = availableFoods.find((food) => normalizeText(food.name) === normalizeText(foodName));
    if (exact) return exact;
    const preferred = availableFoods.find((food) => preferredFoods.some((term) => normalizeText(food.name).includes(term)));
    return preferred ?? availableFoods.find((food) => food.name && meal.length > 0);
  };
  const baseMeals = templates.flatMap(([meal, foodName, quantity]) => {
    if (restrictions.split(',').some((term) => term.trim() && normalizeText(foodName).includes(term.trim()))) return [];
    if (profile.meals_per_day === 3 && meal === 'Merienda') return [];
    const food = chooseFood(foodName, meal);
    if (!food) return [];
    const factor = quantity / 100;
    return [{ foodId: food.id, meal, food: food.name, quantity, unit: 'g' as const, calories: food.calories_per_100g * factor, protein: food.protein_per_100g * factor, carbs: food.carbs_per_100g * factor, fat: food.fat_per_100g * factor }];
  });
  const baseCalories = baseMeals.reduce((total, meal) => total + meal.calories, 0);
  const scale = Math.min(1.35, Math.max(0.75, targetCalories / Math.max(baseCalories, 1)));
  return baseMeals.map((meal) => ({
    ...meal,
    quantity: Math.round((meal.quantity * scale) / 5) * 5,
    calories: Math.round(meal.calories * scale),
    protein: Math.round(meal.protein * scale),
    carbs: Math.round(meal.carbs * scale),
    fat: Math.round(meal.fat * scale),
  }));
}

const SPLITS: Record<number, string[][]> = {
  3: [['Pecho', 'Tríceps'], ['Espalda', 'Bíceps'], ['Piernas', 'Core']],
  4: [['Pecho', 'Tríceps'], ['Espalda', 'Bíceps'], ['Piernas'], ['Hombros', 'Core']],
  5: [['Pecho', 'Tríceps'], ['Espalda', 'Bíceps'], ['Piernas'], ['Hombros'], ['Core', 'Cardio']],
  6: [['Pecho', 'Tríceps'], ['Espalda', 'Bíceps'], ['Piernas', 'Core'], ['Pecho', 'Hombros'], ['Espalda', 'Bíceps'], ['Piernas', 'Cardio']],
};

function calculatePlan(profile: HealthProfile, exercises: Exercise[]): GeneratedPlan {
  const weight = profile.weight_kg ?? 0;
  const height = profile.height_cm ?? 0;
  const age = profile.age_years ?? 0;
  const sexOffset = profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  const stepAdjustment = profile.daily_steps && profile.daily_steps >= 10000 ? 0.1 : profile.daily_steps && profile.daily_steps < 5000 ? -0.05 : 0;
  const workAdjustment = profile.work_type === 'physical' ? 0.1 : profile.work_type === 'active' ? 0.05 : 0;
  const calories = Math.round(Math.max(1200, bmr * (ACTIVITY_FACTORS[profile.activity_level] + stepAdjustment + workAdjustment) + GOAL_ADJUSTMENTS[profile.goal]) / 50) * 50;
  const protein = Math.round(weight * (profile.goal === 'lose' || profile.training_focus === 'hypertrophy' ? 1.8 : 1.6));
  const fat = Math.round(weight * 0.8);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const injuries = profile.injuries ?? '';
  const allowed = exercises.filter((exercise) => isExerciseAllowed(exercise, injuries, profile.excluded_exercises ?? '', profile.equipment));
  const split = SPLITS[profile.training_days] ?? SPLITS[3];
  const cursors: Record<string, number> = {};
  const focusKeywords = FOCUS_KEYWORDS[profile.training_focus];
  const recoveryLimited = (profile.sleep_hours !== null && profile.sleep_hours < 6) || profile.stress_level === 'high';
  const exercisesPerGroup = profile.training_focus === 'strength'
    ? 2
    : profile.training_focus === 'endurance'
      ? 4
        : profile.training_level === 'advanced'
        ? 4
        : profile.training_level === 'intermediate'
          ? 3
            : 2;
  const adjustedExercisesPerGroup = recoveryLimited ? Math.max(1, exercisesPerGroup - 1) : exercisesPerGroup;
  const preferredKeywords = (profile.preferred_exercises ?? '').toLowerCase().split(',').map((term) => term.trim()).filter(Boolean);
  const picked = split.flatMap((dayGroups, dayIndex) => dayGroups.flatMap((group) => {
    const matches = allowed
      .filter((exercise) => exercise.muscle_group === group)
      .map((exercise, index) => ({
        exercise,
        score: focusKeywords.reduce((score, keyword) => score + (exercise.name.toLowerCase().includes(keyword) ? 2 : 0), 0)
          + preferredKeywords.reduce((score, keyword) => score + (exercise.name.toLowerCase().includes(keyword) ? 3 : 0), 0),
        index,
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ exercise }) => exercise);
    const cursor = cursors[group] ?? 0;
    const selected = matches.slice(cursor, cursor + adjustedExercisesPerGroup);
    cursors[group] = matches.length ? (cursor + selected.length) % matches.length : 0;
    return selected.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscle_group,
      day: dayIndex + 1,
      reason: exerciseReason(injuries, profile.training_focus),
      sets: profile.training_focus === 'strength' ? 4 : profile.training_focus === 'endurance' ? 2 : profile.training_level === 'beginner' ? 2 : 3,
      reps: exercise.muscle_group === 'Cardio' ? '10-15 min' : profile.training_focus === 'strength' ? '4-6' : profile.training_focus === 'endurance' ? '15-25' : '8-12',
      rest: exercise.muscle_group === 'Core' || profile.training_focus === 'endurance' ? 45 : profile.training_focus === 'strength' ? 150 : 90,
      tempo: profile.training_focus === 'endurance' ? '2-0-2' : '2-1-2',
      focus: profile.training_focus === 'hypertrophy'
        ? 'Buscar tensión mecánica, recorrido controlado y terminar con 1-3 repeticiones en reserva.'
        : profile.training_focus === 'endurance'
          ? 'Mantener técnica y ritmo constantes, con pausas cortas y sin llegar al fallo técnico.'
          : profile.training_focus === 'strength'
            ? 'Priorizar técnica, estabilidad y velocidad; detener la serie si se degrada la ejecución.'
            : 'Controlar la técnica y mantener 1-3 repeticiones en reserva.',
    }));
  }));

  return { calories, protein, carbs, fat, exercises: picked, meals: [] };
}

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