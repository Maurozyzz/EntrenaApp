import { supabase } from './supabaseClient';
import type { AdaptationScope } from './types';

export type { AdaptationScope };

export interface PlanFeedbackInput {
  studentId: string;
  trainerId?: string | null;
  trainingPlanVersionId?: string | null;
  nutritionPlanVersionId?: string | null;
  difficulty?: number | null;
  energy?: number | null;
  painLevel?: number | null;
  adherencePct?: number | null;
  liked?: string | null;
  disliked?: string | null;
  notes?: string | null;
}

export interface AdaptationRequestInput {
  studentId: string;
  trainerId?: string | null;
  requestText: string;
  scope: AdaptationScope;
}

function inRange(value: number | null | undefined, min: number, max: number): boolean {
  return value == null || (Number.isInteger(value) && value >= min && value <= max);
}

export function validatePlanFeedback(input: PlanFeedbackInput): string | null {
  if (!input.studentId) return 'Falta el alumno.';
  if (!inRange(input.difficulty, 1, 5)) return 'La dificultad debe estar entre 1 y 5.';
  if (!inRange(input.energy, 1, 5)) return 'La energía debe estar entre 1 y 5.';
  if (!inRange(input.painLevel, 0, 10)) return 'El dolor debe estar entre 0 y 10.';
  if (!inRange(input.adherencePct, 0, 100)) return 'La adherencia debe estar entre 0 y 100.';
  return null;
}

export async function submitPlanFeedback(input: PlanFeedbackInput) {
  const validationError = validatePlanFeedback(input);
  if (validationError) return { data: null, error: new Error(validationError) };

  return supabase
    .from('plan_feedback')
    .insert({
      student_id: input.studentId,
      trainer_id: input.trainerId ?? null,
      training_plan_version_id: input.trainingPlanVersionId ?? null,
      nutrition_plan_version_id: input.nutritionPlanVersionId ?? null,
      difficulty: input.difficulty ?? null,
      energy: input.energy ?? null,
      pain_level: input.painLevel ?? null,
      adherence_pct: input.adherencePct ?? null,
      liked: input.liked ?? null,
      disliked: input.disliked ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
}

export async function submitAdaptationRequest(input: AdaptationRequestInput) {
  if (!input.studentId) return { data: null, error: new Error('Falta el alumno.') };
  if (!input.requestText.trim()) return { data: null, error: new Error('Escribí qué querés cambiar.') };

  return supabase
    .from('adaptation_requests')
    .insert({
      student_id: input.studentId,
      trainer_id: input.trainerId ?? null,
      request_text: input.requestText.trim(),
      scope: input.scope,
    })
    .select()
    .single();
}

export async function rememberStudentPreference(studentId: string, key: string, value: string, source: 'manual' | 'feedback' | 'request' | 'ai' = 'manual') {
  if (!studentId || !key.trim() || !value.trim()) return { data: null, error: new Error('La preferencia está incompleta.') };

  return supabase
    .from('student_memory')
    .upsert(
      {
        student_id: studentId,
        memory_key: key.trim(),
        memory_value: value.trim(),
        source,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,memory_key,memory_value' },
    )
    .select()
    .single();
}
