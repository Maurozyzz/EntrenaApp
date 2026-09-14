import { supabase } from './supabaseClient';
import type {
  AdaptationRequest,
  Profile,
  StudentMemory,
} from './types';

export interface StudentContextExercise {
  planDayId: string;
  exerciseId: number;
  name: string;
  muscleGroup: string | null;
  order: number;
  sets: number | null;
  reps: string | null;
  restSeconds: number | null;
  rirTarget: number | null;
}

export interface StudentContextDay {
  dayNumber: number;
  label: string;
  isRestDay: boolean;
  sessionMinutes: number | null;
  exercises: StudentContextExercise[];
}

export interface StudentContextMealItem {
  mealId: string;
  foodId: number;
  name: string;
  quantity: number;
  unit: string;
}

export interface StudentContextMeal {
  label: string;
  scheduledTime: string | null;
  items: StudentContextMealItem[];
}

export interface StudentContext {
  studentId: string;
  trainerId: string | null;
  profile: {
    fullName: string | null;
    heightCm: number | null;
    weightKg: number | null;
    ageYears: number | null;
    sex: string | null;
    activityLevel: string | null;
    goal: string | null;
    trainingFocus: string | null;
    trainingLevel: string | null;
    trainingDays: number | null;
    equipment: string | null;
    injuries: string | null;
    excludedExercises: string | null;
    allergies: string | null;
    avoidedFoods: string | null;
    mealsPerDay: number | null;
  } | null;
  currentTrainingPlan: {
    versionId: string;
    versionNumber: number;
    days: StudentContextDay[];
  } | null;
  currentNutritionPlan: {
    versionId: string;
    versionNumber: number;
    caloriesTarget: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    meals: StudentContextMeal[];
  } | null;
  recentFeedback: Array<{
    date: string;
    difficulty: number | null;
    energy: number | null;
    painLevel: number | null;
    adherencePct: number | null;
    liked: string | null;
    disliked: string | null;
  }>;
  activeMemory: Array<{ key: string; value: string; source: string; confidence: number }>;
  pendingRequests: Array<{ id: string; text: string; scope: string; createdAt: string }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// Arma un contexto compacto y relevante del alumno para pasarle a la IA (Fase 4).
// A propósito NO trae historial completo: solo el plan activo, feedback reciente
// (últimos 5) y memoria activa. Si algo falla, se devuelve el error sin inventar datos.
export async function buildStudentContext(
  studentId: string,
): Promise<{ data: StudentContext | null; error: Error | null }> {
  const [
    profileResult,
    healthResult,
    trainingResult,
    nutritionResult,
    feedbackResult,
    memoryResult,
    requestsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', studentId).single(),
    supabase.from('student_health_profiles').select('*').eq('student_id', studentId).maybeSingle(),
    supabase
      .from('training_plan_versions')
      .select('*, training_plan_days(*, training_plan_exercises(*, exercises(name, muscle_group)))')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('nutrition_plan_versions')
      .select('*, nutrition_plan_meals(*, nutrition_plan_items(*, foods(name)))')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('plan_feedback')
      .select('*')
      .eq('student_id', studentId)
      .order('feedback_date', { ascending: false })
      .limit(5),
    supabase.from('student_memory').select('*').eq('student_id', studentId).eq('active', true),
    supabase.from('adaptation_requests').select('*').eq('student_id', studentId).eq('status', 'pending'),
  ]);

  const firstError =
    profileResult.error ??
    trainingResult.error ??
    nutritionResult.error ??
    feedbackResult.error ??
    memoryResult.error ??
    requestsResult.error;
  if (firstError) return { data: null, error: new Error(firstError.message) };

  const profile = profileResult.data as Profile;
  const health = healthResult.data as Row | null;
  const training = trainingResult.data as Row | null;
  const nutrition = nutritionResult.data as Row | null;

  const context: StudentContext = {
    studentId,
    trainerId: profile?.trainer_id ?? null,
    profile: health
      ? {
          fullName: profile?.full_name ?? null,
          heightCm: health.height_cm,
          weightKg: health.weight_kg,
          ageYears: health.age_years,
          sex: health.sex,
          activityLevel: health.activity_level,
          goal: health.goal,
          trainingFocus: health.training_focus,
          trainingLevel: health.training_level,
          trainingDays: health.training_days,
          equipment: health.equipment,
          injuries: health.injuries,
          excludedExercises: health.excluded_exercises,
          allergies: health.allergies,
          avoidedFoods: health.avoided_foods,
          mealsPerDay: health.meals_per_day,
        }
      : null,
    currentTrainingPlan: training
      ? {
          versionId: training.id,
          versionNumber: training.version_number,
          days: ((training.training_plan_days ?? []) as Row[])
            .sort((a, b) => a.day_number - b.day_number)
            .map((day) => ({
              dayNumber: day.day_number,
              label: day.label,
              isRestDay: day.is_rest_day,
              sessionMinutes: day.session_minutes,
              exercises: ((day.training_plan_exercises ?? []) as Row[])
                .sort((a, b) => a.order_index - b.order_index)
                .map((ex) => ({
                  planDayId: day.id,
                  exerciseId: ex.exercise_id,
                  name: ex.exercises?.name ?? '',
                  muscleGroup: ex.exercises?.muscle_group ?? null,
                  order: ex.order_index,
                  sets: ex.sets,
                  reps: ex.reps,
                  restSeconds: ex.rest_seconds,
                  rirTarget: ex.rir_target,
                })),
            })),
        }
      : null,
    currentNutritionPlan: nutrition
      ? {
          versionId: nutrition.id,
          versionNumber: nutrition.version_number,
          caloriesTarget: nutrition.calories_target,
          proteinG: nutrition.protein_g,
          carbsG: nutrition.carbs_g,
          fatG: nutrition.fat_g,
          meals: ((nutrition.nutrition_plan_meals ?? []) as Row[])
            .sort((a, b) => a.order_index - b.order_index)
            .map((meal) => ({
              label: meal.label,
              scheduledTime: meal.scheduled_time,
              items: ((meal.nutrition_plan_items ?? []) as Row[]).map((item) => ({
                mealId: meal.id,
                foodId: item.food_id,
                name: item.foods?.name ?? '',
                quantity: item.quantity,
                unit: item.unit,
              })),
            })),
        }
      : null,
    recentFeedback: ((feedbackResult.data ?? []) as Row[]).map((f) => ({
      date: f.feedback_date,
      difficulty: f.difficulty,
      energy: f.energy,
      painLevel: f.pain_level,
      adherencePct: f.adherence_pct,
      liked: f.liked,
      disliked: f.disliked,
    })),
    activeMemory: ((memoryResult.data ?? []) as StudentMemory[]).map((m) => ({
      key: m.memory_key,
      value: m.memory_value,
      source: m.source,
      confidence: m.confidence,
    })),
    pendingRequests: ((requestsResult.data ?? []) as AdaptationRequest[]).map((r) => ({
      id: r.id,
      text: r.request_text,
      scope: r.scope,
      createdAt: r.created_at,
    })),
  };

  return { data: context, error: null };
}
