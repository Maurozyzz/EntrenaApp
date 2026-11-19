// Cálculos puros del modo entrenamiento (sin Supabase) para poder probarlos
// por separado: qué día toca, valores sugeridos por serie y récords.

export interface SetLog {
  id: number;
  exercise_id: number | null;
  routine_exercise_id: number | null;
  performed_at: string;
  reps_completed: string | null;
  weight_used: number | null;
}

export interface ExerciseHistory {
  /** Series de la última sesión anterior a hoy, en orden. */
  lastSession: { reps: number | null; weight: number | null }[];
  lastSessionDate: string | null;
  /** Mayor peso levantado alguna vez antes de hoy. */
  bestWeight: number | null;
}

/** Día de la semana como lo guarda la rutina: 1 = lunes … 7 = domingo. */
export function routineDayOf(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

export function localDateKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Primer número de un objetivo de reps como "8-12" o "10". */
export function firstNumber(text: string | null | undefined): number | null {
  const match = text?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function toNumber(text: string | null | undefined): number | null {
  if (text == null || text.trim() === '') return null;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Historial por ejercicio (exercise_id) a partir de logs de cualquier fecha. */
export function buildHistory(logs: SetLog[], todayKey: string): Map<number, ExerciseHistory> {
  const byExercise = new Map<number, SetLog[]>();
  for (const log of logs) {
    if (log.exercise_id == null) continue;
    if (localDateKey(log.performed_at) >= todayKey) continue;
    const list = byExercise.get(log.exercise_id) ?? [];
    list.push(log);
    byExercise.set(log.exercise_id, list);
  }

  const result = new Map<number, ExerciseHistory>();
  for (const [exerciseId, list] of byExercise) {
    const sorted = [...list].sort((a, b) => a.performed_at.localeCompare(b.performed_at));
    const lastKey = localDateKey(sorted[sorted.length - 1].performed_at);
    const lastSession = sorted
      .filter((l) => localDateKey(l.performed_at) === lastKey)
      .map((l) => ({ reps: firstNumber(l.reps_completed), weight: l.weight_used }));
    const weights = sorted.map((l) => l.weight_used).filter((w): w is number => w != null);
    result.set(exerciseId, {
      lastSession,
      lastSessionDate: lastKey,
      bestWeight: weights.length ? Math.max(...weights) : null,
    });
  }
  return result;
}

/** Valores sugeridos para la serie N (0-based): lo de la última vez, o el objetivo. */
export function suggestedSet(
  index: number,
  history: ExerciseHistory | undefined,
  target: { reps: string | null; weight: number | null },
): { reps: string; weight: string } {
  const prev = history?.lastSession[index] ?? history?.lastSession[history.lastSession.length - 1];
  const reps = prev?.reps ?? firstNumber(target.reps);
  const weight = prev?.weight ?? target.weight;
  return { reps: reps != null ? String(reps) : '', weight: weight != null ? String(weight) : '' };
}

export function isNewRecord(weight: number | null, history: ExerciseHistory | undefined): boolean {
  if (weight == null || weight <= 0) return false;
  return history?.bestWeight != null ? weight > history.bestWeight : false;
}
