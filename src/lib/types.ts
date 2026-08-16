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
  exercises: { name: string } | null;
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
  created_at: string;
}
