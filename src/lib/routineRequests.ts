// Pedidos de cambio de rutina: lo que propone el asistente (Edge Function
// routine-assistant) y cómo se aplica cuando el entrenador lo aprueba.
import type { SupabaseClient } from '@supabase/supabase-js';

/** Nombre del ejercicio al momento del pedido (lo guarda el asistente). */
type Named = { exercise_name?: string | null };

export type RoutineChange = Named &
  (
    | {
        type: 'replace_exercise';
        routine_exercise_id: number;
        new_exercise_id: number;
        reason?: string;
      }
    | {
        type: 'adjust';
        routine_exercise_id: number;
        sets?: number;
        reps?: string;
        weight_target?: number;
        rest_seconds?: number;
        reason?: string;
      }
    | {
        type: 'add_note';
        routine_exercise_id: number;
        note: string;
        reason?: string;
      }
  );

export interface RoutineProposal {
  kind: 'routine';
  summary: string;
  changes: RoutineChange[];
  routine_id: number | null;
}

export interface ChangeRequest {
  id: string;
  student_id: string;
  trainer_id: string | null;
  request_text: string;
  status: 'pending' | 'reviewed' | 'applied' | 'rejected';
  parsed_action: unknown;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** Lee parsed_action solo si tiene la forma que escribe routine-assistant. */
export function routineProposalOf(parsed: unknown): RoutineProposal | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Partial<RoutineProposal>;
  if (p.kind !== 'routine' || !Array.isArray(p.changes)) return null;
  const changes = p.changes.filter(
    (c): c is RoutineChange =>
      !!c &&
      typeof c === 'object' &&
      Number.isInteger((c as RoutineChange).routine_exercise_id) &&
      ['replace_exercise', 'adjust', 'add_note'].includes((c as RoutineChange).type),
  );
  return {
    kind: 'routine',
    summary: typeof p.summary === 'string' ? p.summary : '',
    changes,
    routine_id: p.routine_id ?? null,
  };
}

/** Qué columnas de routine_exercises cambia cada propuesta. */
export function changeToUpdate(change: RoutineChange): Record<string, unknown> {
  if (change.type === 'replace_exercise') return { exercise_id: change.new_exercise_id };
  if (change.type === 'add_note') return { notes: change.note };
  const update: Record<string, unknown> = {};
  if (change.sets != null) update.sets = change.sets;
  if (change.reps != null) update.reps = change.reps;
  if (change.weight_target != null) update.weight_target = change.weight_target;
  if (change.rest_seconds != null) update.rest_seconds = change.rest_seconds;
  return update;
}

/**
 * Aplica los cambios aprobados sobre la rutina ACTIVA del alumno. Un cambio que
 * apunta a un ejercicio que ya no está en esa rutina (el entrenador la editó o
 * la reemplazó) se saltea en vez de tocar otra cosa.
 */
export async function applyRoutineChanges(
  client: SupabaseClient,
  studentId: string,
  changes: RoutineChange[],
): Promise<{ applied: number; skipped: number; error: Error | null }> {
  const { data: routine, error: routineErr } = await client
    .from('routines')
    .select('id')
    .eq('student_id', studentId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (routineErr) return { applied: 0, skipped: 0, error: new Error(routineErr.message) };
  if (!routine) return { applied: 0, skipped: changes.length, error: null };

  let applied = 0;
  let skipped = 0;
  for (const change of changes) {
    const update = changeToUpdate(change);
    if (Object.keys(update).length === 0) {
      skipped += 1;
      continue;
    }
    const { data, error } = await client
      .from('routine_exercises')
      .update(update)
      .eq('id', change.routine_exercise_id)
      .eq('routine_id', routine.id)
      .select('id');
    if (error) return { applied, skipped, error: new Error(error.message) };
    if (data && data.length > 0) applied += 1;
    else skipped += 1;
  }
  return { applied, skipped, error: null };
}
