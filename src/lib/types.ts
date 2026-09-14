export type Role = 'trainer' | 'student';

export interface Profile {
  id: string;
  role: Role;
  trainer_id: string | null;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string | null;
  video_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Routine {
  id: number;
  student_id: string;
  trainer_id: string;
  name: string;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface RoutineExercise {
  id: number;
  routine_id: number;
  exercise_id: number;
  day_of_week: number | null;
  order_index: number;
  sets: number | null;
  reps: string | null;
  weight_target: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

export interface RoutineExerciseWithName extends RoutineExercise {
  exercises: { name: string; muscle_group: string | null } | null;
}

export interface WorkoutLog {
  id: number;
  student_id: string;
  routine_exercise_id: number | null;
  performed_at: string;
  sets_completed: number | null;
  reps_completed: string | null;
  weight_used: number | null;
  notes: string | null;
}

export interface WorkoutLogWithExercise extends WorkoutLog {
  routine_exercises: { exercises: { name: string } | null } | null;
}

export interface PhotoLog {
  id: number;
  student_id: string;
  taken_at: string;
  storage_path: string;
  notes: string | null;
}

export type ProgressPhoto = PhotoLog;
export type MealPhoto = PhotoLog;

export interface BodyMeasurement {
  id: number;
  student_id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  notes: string | null;
}

export interface StudentHealthProfile {
  student_id: string;
  trainer_id: string;
  height_cm: number | null;
  weight_kg: number | null;
  age_years: number | null;
  sex: 'male' | 'female' | 'other' | null;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'high';
  goal: 'lose' | 'maintain' | 'gain';
  training_days: number;
  injuries: string | null;
  created_at: string;
  updated_at: string;
}

export interface Food {
  id: number;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  barcode: string | null;
  created_by: string | null;
  created_at: string;
}

export type QuantityUnit = 'g' | 'ml';

export interface DietEntry {
  id: number;
  student_id: string;
  food_id: number;
  quantity_g: number;
  quantity_unit: QuantityUnit;
  meal_label: string | null;
  created_at: string;
}

export interface DietEntryWithFood extends DietEntry {
  foods: Food | null;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionPlan {
  id: number;
  student_id: string;
  trainer_id: string;
  name: string;
  calories_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

export interface Payment {
  id: number;
  student_id: string;
  amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  status: PaymentStatus;
  paid_at: string | null;
  receipt_path: string | null;
  created_at: string;
}

export type PlanVersionStatus = 'draft' | 'active' | 'archived';
export type PlanSource = 'trainer' | 'rules' | 'ai' | 'student_request';

export interface TrainingPlanVersion {
  id: string;
  student_id: string;
  trainer_id: string;
  version_number: number;
  status: PlanVersionStatus;
  source: PlanSource;
  change_reason: string | null;
  profile_snapshot: Record<string, unknown>;
  created_at: string;
  activated_at: string | null;
}

export interface TrainingPlanDay {
  id: string;
  plan_version_id: string;
  day_number: number;
  label: string;
  is_rest_day: boolean;
  session_minutes: number | null;
}

export interface TrainingPlanExercise {
  id: string;
  plan_day_id: string;
  exercise_id: number;
  order_index: number;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  rir_target: number | null;
  tempo: string | null;
  load_target: number | null;
  notes: string | null;
  selection_reason: string | null;
}

export interface NutritionPlanVersion {
  id: string;
  student_id: string;
  trainer_id: string;
  version_number: number;
  status: PlanVersionStatus;
  source: PlanSource;
  change_reason: string | null;
  calories_target: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  profile_snapshot: Record<string, unknown>;
  created_at: string;
  activated_at: string | null;
}

export interface NutritionPlanMeal {
  id: string;
  plan_version_id: string;
  order_index: number;
  label: string;
  scheduled_time: string | null;
  notes: string | null;
}

export interface NutritionPlanItem {
  id: string;
  meal_id: string;
  food_id: number;
  quantity: number;
  unit: 'g' | 'ml' | 'unit';
  alternative_group: string | null;
  notes: string | null;
}

export interface PlanFeedback {
  id: string;
  student_id: string;
  trainer_id: string | null;
  training_plan_version_id: string | null;
  nutrition_plan_version_id: string | null;
  feedback_date: string;
  difficulty: number | null;
  energy: number | null;
  pain_level: number | null;
  adherence_pct: number | null;
  liked: string | null;
  disliked: string | null;
  notes: string | null;
  created_at: string;
}

export type AdaptationScope = 'training' | 'nutrition' | 'both';
export type AdaptationStatus = 'pending' | 'reviewed' | 'applied' | 'rejected';

export interface AdaptationRequest {
  id: string;
  student_id: string;
  trainer_id: string | null;
  request_text: string;
  scope: AdaptationScope;
  status: AdaptationStatus;
  parsed_action: Record<string, unknown> | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type MemorySource = 'manual' | 'feedback' | 'request' | 'ai';

export interface StudentMemory {
  id: string;
  student_id: string;
  memory_key: string;
  memory_value: string;
  source: MemorySource;
  confidence: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}
