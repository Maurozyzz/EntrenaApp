// Vocabulario cerrado (pero extensible) de intenciones que el motor entiende.
// La IA (Fase 4) debe clasificar cada pedido del alumno en uno de estos valores;
// cualquier otro string se trata como intent desconocido y se descarta.
export const INTENTS = [
  'GENERATE_PLAN',
  'ADAPT_PLAN',
  'MODIFY_WORKOUT',
  'MODIFY_NUTRITION',
  'REPLACE_EXERCISE',
  'REPLACE_FOOD',
  'CHANGE_GOAL',
  'CHANGE_AVAILABILITY',
  'GENERATE_VARIATION',
  'ANALYZE_PROGRESS',
  'REQUEST_FEEDBACK',
] as const;

export type Intent = (typeof INTENTS)[number];

export interface ExerciseReplacementChange {
  type: 'exercise_replacement';
  plan_day_id: string;
  original_exercise_id: number;
  replacement_exercise_id: number;
  reason?: string;
}

export interface FoodReplacementChange {
  type: 'food_replacement';
  meal_id: string;
  original_food_id: number;
  replacement_food_id: number;
  quantity?: number;
  reason?: string;
}

export interface TrainingDaysChange {
  type: 'training_days_change';
  new_training_days: number;
}

export interface GoalChange {
  type: 'goal_change';
  new_goal: 'lose' | 'maintain' | 'gain';
}

export interface RegenerateTrainingPlan {
  type: 'regenerate_training_plan';
  reason?: string;
}

export interface RegenerateNutritionPlan {
  type: 'regenerate_nutrition_plan';
  reason?: string;
}

export type ProposedChange =
  | ExerciseReplacementChange
  | FoodReplacementChange
  | TrainingDaysChange
  | GoalChange
  | RegenerateTrainingPlan
  | RegenerateNutritionPlan;

// Respuesta estructurada que se espera de la IA. Nunca se ejecuta texto libre:
// todo pasa por este esquema antes de tocar Supabase.
export interface AiProposal {
  intent: Intent;
  confidence: number;
  changes: ProposedChange[];
  studentMessage: string;
  clarification_needed?: string;
}

export interface ValidationOk {
  ok: true;
  data: AiProposal;
}

export interface ValidationError {
  ok: false;
  error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validateChange(raw: unknown, index: number): ProposedChange | string {
  if (!isRecord(raw)) return `changes[${index}] no es un objeto.`;
  const type = raw.type;

  if (type === 'exercise_replacement') {
    if (typeof raw.plan_day_id !== 'string' || !raw.plan_day_id) return `changes[${index}]: falta plan_day_id.`;
    if (!isPositiveInt(raw.original_exercise_id)) return `changes[${index}]: original_exercise_id inválido.`;
    if (!isPositiveInt(raw.replacement_exercise_id)) return `changes[${index}]: replacement_exercise_id inválido.`;
    return raw as unknown as ExerciseReplacementChange;
  }

  if (type === 'food_replacement') {
    if (typeof raw.meal_id !== 'string' || !raw.meal_id) return `changes[${index}]: falta meal_id.`;
    if (!isPositiveInt(raw.original_food_id)) return `changes[${index}]: original_food_id inválido.`;
    if (!isPositiveInt(raw.replacement_food_id)) return `changes[${index}]: replacement_food_id inválido.`;
    if (raw.quantity !== undefined && (typeof raw.quantity !== 'number' || raw.quantity <= 0)) {
      return `changes[${index}]: quantity inválida.`;
    }
    return raw as unknown as FoodReplacementChange;
  }

  if (type === 'training_days_change') {
    if (!isPositiveInt(raw.new_training_days) || raw.new_training_days < 3 || raw.new_training_days > 6) {
      return `changes[${index}]: new_training_days debe estar entre 3 y 6.`;
    }
    return raw as unknown as TrainingDaysChange;
  }

  if (type === 'goal_change') {
    if (raw.new_goal !== 'lose' && raw.new_goal !== 'maintain' && raw.new_goal !== 'gain') {
      return `changes[${index}]: new_goal inválido.`;
    }
    return raw as unknown as GoalChange;
  }

  if (type === 'regenerate_training_plan') {
    return raw as unknown as RegenerateTrainingPlan;
  }

  if (type === 'regenerate_nutrition_plan') {
    return raw as unknown as RegenerateNutritionPlan;
  }

  return `changes[${index}]: type "${String(type)}" no reconocido.`;
}

// Valida la respuesta cruda de la IA antes de que el motor de cambios la toque.
// Si algo no cierra, se descarta todo el proposal (no se aplican cambios parciales
// de un JSON inválido) y se devuelve el motivo para loguearlo (regla 21).
export function validateAiProposal(raw: unknown): ValidationOk | ValidationError {
  if (!isRecord(raw)) return { ok: false, error: 'La respuesta de la IA no es un objeto JSON.' };

  if (typeof raw.intent !== 'string' || !INTENTS.includes(raw.intent as Intent)) {
    return { ok: false, error: `Intent inválido o desconocido: ${String(raw.intent)}.` };
  }

  if (typeof raw.confidence !== 'number' || raw.confidence < 0 || raw.confidence > 1) {
    return { ok: false, error: 'confidence debe ser un número entre 0 y 1.' };
  }

  if (typeof raw.studentMessage !== 'string' || !raw.studentMessage.trim()) {
    return { ok: false, error: 'studentMessage es obligatorio (respuesta para mostrarle al alumno).' };
  }

  if (raw.clarification_needed !== undefined && typeof raw.clarification_needed !== 'string') {
    return { ok: false, error: 'clarification_needed debe ser texto.' };
  }

  if (!Array.isArray(raw.changes)) {
    return { ok: false, error: 'changes debe ser un array (puede estar vacío).' };
  }

  const changes: ProposedChange[] = [];
  for (let i = 0; i < raw.changes.length; i++) {
    const result = validateChange(raw.changes[i], i);
    if (typeof result === 'string') return { ok: false, error: result };
    changes.push(result);
  }

  return {
    ok: true,
    data: {
      intent: raw.intent as Intent,
      confidence: raw.confidence,
      changes,
      studentMessage: raw.studentMessage,
      clarification_needed: raw.clarification_needed as string | undefined,
    },
  };
}
