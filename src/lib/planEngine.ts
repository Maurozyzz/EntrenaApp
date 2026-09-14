import { supabase } from './supabaseClient';
import type { ExerciseReplacementChange, FoodReplacementChange } from './intents';
import type { PlanSource } from './types';

interface Result<T> {
  data: T | null;
  error: Error | null;
}

function err<T>(message: string): Result<T> {
  return { data: null, error: new Error(message) };
}

async function nextVersionNumber(table: 'training_plan_versions' | 'nutrition_plan_versions', studentId: string): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select('version_number')
    .eq('student_id', studentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version_number ?? 0) + 1;
}

async function exerciseIdsExist(ids: number[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const unique = Array.from(new Set(ids));
  const { data, error } = await supabase.from('exercises').select('id').in('id', unique);
  if (error) return false;
  return (data ?? []).length === unique.length;
}

async function foodIdsExist(ids: number[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const unique = Array.from(new Set(ids));
  const { data, error } = await supabase.from('foods').select('id').in('id', unique);
  if (error) return false;
  return (data ?? []).length === unique.length;
}

export interface DraftTrainingDayInput {
  dayNumber: number;
  label: string;
  isRestDay?: boolean;
  sessionMinutes?: number | null;
  exercises: Array<{
    exerciseId: number;
    orderIndex: number;
    sets?: number | null;
    reps?: string | null;
    restSeconds?: number | null;
    rirTarget?: number | null;
    tempo?: string | null;
    loadTarget?: number | null;
    notes?: string | null;
    selectionReason?: string | null;
  }>;
}

export interface CreateDraftTrainingVersionInput {
  studentId: string;
  trainerId: string;
  source: PlanSource;
  changeReason?: string | null;
  profileSnapshot?: Record<string, unknown>;
  days: DraftTrainingDayInput[];
}

// Crea una nueva versión en estado 'draft'. Nunca toca la versión activa.
// Si falla a mitad de camino (días o ejercicios), borra la versión creada
// (el cascade se lleva puesto lo demás) en vez de dejar un draft a medio escribir.
export async function createDraftTrainingVersion(input: CreateDraftTrainingVersionInput): Promise<Result<string>> {
  const allExerciseIds = input.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
  if (!(await exerciseIdsExist(allExerciseIds))) {
    return err('Uno o más ejercicios no existen en el catálogo.');
  }

  const versionNumber = await nextVersionNumber('training_plan_versions', input.studentId);
  const { data: version, error: versionError } = await supabase
    .from('training_plan_versions')
    .insert({
      student_id: input.studentId,
      trainer_id: input.trainerId,
      version_number: versionNumber,
      status: 'draft',
      source: input.source,
      change_reason: input.changeReason ?? null,
      profile_snapshot: input.profileSnapshot ?? {},
    })
    .select('id')
    .single();
  if (versionError || !version) return err(versionError?.message ?? 'No se pudo crear la versión del plan.');

  for (const day of input.days) {
    const { data: dayRow, error: dayError } = await supabase
      .from('training_plan_days')
      .insert({
        plan_version_id: version.id,
        day_number: day.dayNumber,
        label: day.label,
        is_rest_day: day.isRestDay ?? false,
        session_minutes: day.sessionMinutes ?? null,
      })
      .select('id')
      .single();
    if (dayError || !dayRow) {
      await supabase.from('training_plan_versions').delete().eq('id', version.id);
      return err(dayError?.message ?? 'No se pudo crear un día del plan.');
    }

    if (day.exercises.length === 0) continue;
    const { error: exercisesError } = await supabase.from('training_plan_exercises').insert(
      day.exercises.map((ex) => ({
        plan_day_id: dayRow.id,
        exercise_id: ex.exerciseId,
        order_index: ex.orderIndex,
        sets: ex.sets ?? null,
        reps: ex.reps ?? null,
        rest_seconds: ex.restSeconds ?? null,
        rir_target: ex.rirTarget ?? null,
        tempo: ex.tempo ?? null,
        load_target: ex.loadTarget ?? null,
        notes: ex.notes ?? null,
        selection_reason: ex.selectionReason ?? null,
      })),
    );
    if (exercisesError) {
      await supabase.from('training_plan_versions').delete().eq('id', version.id);
      return err(exercisesError.message);
    }
  }

  return { data: version.id as string, error: null };
}

export interface DraftNutritionMealInput {
  orderIndex: number;
  label: string;
  scheduledTime?: string | null;
  notes?: string | null;
  items: Array<{
    foodId: number;
    quantity: number;
    unit?: 'g' | 'ml' | 'unit';
    alternativeGroup?: string | null;
    notes?: string | null;
  }>;
}

export interface CreateDraftNutritionVersionInput {
  studentId: string;
  trainerId: string;
  source: PlanSource;
  changeReason?: string | null;
  caloriesTarget?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  profileSnapshot?: Record<string, unknown>;
  meals: DraftNutritionMealInput[];
}

export async function createDraftNutritionVersion(input: CreateDraftNutritionVersionInput): Promise<Result<string>> {
  const allFoodIds = input.meals.flatMap((m) => m.items.map((i) => i.foodId));
  if (!(await foodIdsExist(allFoodIds))) {
    return err('Uno o más alimentos no existen en el catálogo.');
  }

  const versionNumber = await nextVersionNumber('nutrition_plan_versions', input.studentId);
  const { data: version, error: versionError } = await supabase
    .from('nutrition_plan_versions')
    .insert({
      student_id: input.studentId,
      trainer_id: input.trainerId,
      version_number: versionNumber,
      status: 'draft',
      source: input.source,
      change_reason: input.changeReason ?? null,
      calories_target: input.caloriesTarget ?? null,
      protein_g: input.proteinG ?? null,
      carbs_g: input.carbsG ?? null,
      fat_g: input.fatG ?? null,
      profile_snapshot: input.profileSnapshot ?? {},
    })
    .select('id')
    .single();
  if (versionError || !version) return err(versionError?.message ?? 'No se pudo crear la versión de nutrición.');

  for (const meal of input.meals) {
    const { data: mealRow, error: mealError } = await supabase
      .from('nutrition_plan_meals')
      .insert({
        plan_version_id: version.id,
        order_index: meal.orderIndex,
        label: meal.label,
        scheduled_time: meal.scheduledTime ?? null,
        notes: meal.notes ?? null,
      })
      .select('id')
      .single();
    if (mealError || !mealRow) {
      await supabase.from('nutrition_plan_versions').delete().eq('id', version.id);
      return err(mealError?.message ?? 'No se pudo crear una comida del plan.');
    }

    if (meal.items.length === 0) continue;
    const { error: itemsError } = await supabase.from('nutrition_plan_items').insert(
      meal.items.map((item) => ({
        meal_id: mealRow.id,
        food_id: item.foodId,
        quantity: item.quantity,
        unit: item.unit ?? 'g',
        alternative_group: item.alternativeGroup ?? null,
        notes: item.notes ?? null,
      })),
    );
    if (itemsError) {
      await supabase.from('nutrition_plan_versions').delete().eq('id', version.id);
      return err(itemsError.message);
    }
  }

  return { data: version.id as string, error: null };
}

// Activa una versión (archiva la anterior activa) en una sola operación
// transaccional del lado del servidor. Ver supabase/migrations/20260913_plan_engine_rpc.sql.
export async function activateTrainingVersion(versionId: string, trainerId: string): Promise<Result<true>> {
  const { data: version, error: lookupError } = await supabase
    .from('training_plan_versions')
    .select('trainer_id')
    .eq('id', versionId)
    .single();
  if (lookupError || !version) return err('La versión de entrenamiento no existe.');
  if (version.trainer_id !== trainerId) return err('No autorizado para activar esta versión.');

  const { error } = await supabase.rpc('activate_training_plan_version', { target_version_id: versionId });
  if (error) return err(error.message);
  return { data: true, error: null };
}

export async function activateNutritionVersion(versionId: string, trainerId: string): Promise<Result<true>> {
  const { data: version, error: lookupError } = await supabase
    .from('nutrition_plan_versions')
    .select('trainer_id')
    .eq('id', versionId)
    .single();
  if (lookupError || !version) return err('La versión de nutrición no existe.');
  if (version.trainer_id !== trainerId) return err('No autorizado para activar esta versión.');

  const { error } = await supabase.rpc('activate_nutrition_plan_version', { target_version_id: versionId });
  if (error) return err(error.message);
  return { data: true, error: null };
}

// Cambio pequeño: reemplaza un ejercicio puntual dentro del día de la versión
// activa, sin crear una versión nueva (regla de "cambios pequeños vs grandes").
export async function applyExerciseReplacement(change: ExerciseReplacementChange, trainerId: string): Promise<Result<true>> {
  if (!(await exerciseIdsExist([change.replacement_exercise_id]))) {
    return err('El ejercicio de reemplazo no existe en el catálogo.');
  }

  const { data: day, error: dayError } = await supabase
    .from('training_plan_days')
    .select('id, training_plan_versions!inner(trainer_id, status)')
    .eq('id', change.plan_day_id)
    .single();
  if (dayError || !day) return err('El día del plan no existe.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const version = (day as any).training_plan_versions;
  if (version?.trainer_id !== trainerId) return err('No autorizado para modificar este plan.');

  const { data: updated, error } = await supabase
    .from('training_plan_exercises')
    .update({ exercise_id: change.replacement_exercise_id, selection_reason: change.reason ?? null })
    .eq('plan_day_id', change.plan_day_id)
    .eq('exercise_id', change.original_exercise_id)
    .select('id');
  if (error) return err(error.message);
  if (!updated || updated.length === 0) return err('No se encontró el ejercicio a reemplazar en ese día.');
  return { data: true, error: null };
}

// Cambio pequeño equivalente para alimentos dentro de una comida.
export async function applyFoodReplacement(change: FoodReplacementChange, trainerId: string): Promise<Result<true>> {
  if (!(await foodIdsExist([change.replacement_food_id]))) {
    return err('El alimento de reemplazo no existe en el catálogo.');
  }

  const { data: meal, error: mealError } = await supabase
    .from('nutrition_plan_meals')
    .select('id, nutrition_plan_versions!inner(trainer_id, status)')
    .eq('id', change.meal_id)
    .single();
  if (mealError || !meal) return err('La comida del plan no existe.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const version = (meal as any).nutrition_plan_versions;
  if (version?.trainer_id !== trainerId) return err('No autorizado para modificar este plan.');

  const update: Record<string, unknown> = { food_id: change.replacement_food_id };
  if (change.quantity !== undefined) update.quantity = change.quantity;

  const { data: updated, error } = await supabase
    .from('nutrition_plan_items')
    .update(update)
    .eq('meal_id', change.meal_id)
    .eq('food_id', change.original_food_id)
    .select('id');
  if (error) return err(error.message);
  if (!updated || updated.length === 0) return err('No se encontró el alimento a reemplazar en esa comida.');
  return { data: true, error: null };
}
