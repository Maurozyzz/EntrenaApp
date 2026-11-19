// Edge Function: el alumno escribe qué le pasa o qué quiere cambiar de su
// rutina ("me duele el hombro con el press militar", "no tengo barra en casa").
// Claude lee la rutina activa real (routines / routine_exercises) y el catálogo
// de ejercicios, y PROPONE cambios puntuales. Nada se aplica acá: el pedido
// queda en adaptation_requests con estado 'pending' y el entrenador lo aprueba
// o lo rechaza desde la ficha del alumno.
//
// Es autocontenida (no importa nada de src/) para poder publicarla también
// pegándola en el editor de Edge Functions del panel de Supabase.
//
// Secretos necesarios: ANTHROPIC_API_KEY (SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase).
import Anthropic from 'npm:@anthropic-ai/sdk@0.125.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.125.0/helpers/zod';
import { z } from 'npm:zod@4.6.5';
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const AI_MODEL = 'claude-opus-5-5';
const MAX_REQUESTS_PER_DAY = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ReplaceExercise = z.object({
  type: z.literal('replace_exercise'),
  routine_exercise_id: z.number().int(),
  new_exercise_id: z.number().int(),
  reason: z.string(),
});
const Adjust = z.object({
  type: z.literal('adjust'),
  routine_exercise_id: z.number().int(),
  sets: z.number().int().optional(),
  reps: z.string().optional(),
  weight_target: z.number().optional(),
  rest_seconds: z.number().int().optional(),
  reason: z.string(),
});
const AddNote = z.object({
  type: z.literal('add_note'),
  routine_exercise_id: z.number().int(),
  note: z.string(),
  reason: z.string(),
});
const Proposal = z.object({
  reply: z.string(),
  summary_for_trainer: z.string(),
  changes: z.array(z.discriminatedUnion('type', [ReplaceExercise, Adjust, AddNote])),
});
type Change = z.infer<typeof Proposal>['changes'][number];

const SYSTEM_PROMPT = `Sos el asistente de rutinas de Origen Coaching, una app donde un entrenador personal arma rutinas de gimnasio para sus alumnos.

Un alumno te escribe algo sobre su rutina actual: una molestia, falta de equipamiento, que algo le resulta muy fácil o muy difícil, que se aburre de un ejercicio, etc. Tu trabajo es proponer cambios puntuales sobre su rutina actual para que su entrenador los revise. El entrenador decide: vos nunca aplicás nada.

Cómo proponer:
- Usá solo los "routine_exercise_id" que aparecen en "routine" y solo los "id" de ejercicio que aparecen en "catalog". Si no hay un reemplazo adecuado en el catálogo, no lo inventes: proponé un ajuste o una nota, o ningún cambio.
- replace_exercise: cambiar un ejercicio por otro del catálogo que trabaje el mismo grupo muscular y evite el problema.
- adjust: cambiar series, repeticiones (texto, ej. "8-10"), kilos objetivo o descanso en segundos. Incluí solo los campos que cambian.
- add_note: una indicación técnica para ese ejercicio (máximo 200 caracteres).
- Proponé pocos cambios (normalmente 1 a 3), solo los que responden a lo que dijo el alumno.
- Si menciona dolor fuerte, lesión, mareos o algo médico, no propongas ejercicios para "trabajar" la zona: sugerí sacar o reemplazar lo que la carga y en "reply" recomendale consultar a un profesional de la salud.
- Si el mensaje no pide ningún cambio o es ambiguo, dejá "changes" vacío y en "reply" pedile que aclare.

"reply": respuesta breve para el alumno, en español rioplatense, cálida y concreta, aclarando que su entrenador va a revisar la propuesta antes de que cambie la rutina. No asumas el género del entrenador: decile "tu entrenador".
"summary_for_trainer": una o dos oraciones para el entrenador explicando qué pidió el alumno y qué proponés.`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

interface RoutineRow {
  id: number;
  exercise_id: number;
  day_of_week: number | null;
  sets: number | null;
  reps: string | null;
  weight_target: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercises: { name: string; muscle_group: string | null } | null;
}

/** Descarta lo que no apunte a la rutina o al catálogo reales, y acota valores. */
function validChanges(changes: Change[], rows: RoutineRow[], catalogIds: Set<number>): (Change & { exercise_name: string | null })[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: Change[] = [];
  for (const c of changes) {
    const row = byId.get(c.routine_exercise_id);
    if (!row) continue;
    if (c.type === 'replace_exercise') {
      if (!catalogIds.has(c.new_exercise_id) || c.new_exercise_id === row.exercise_id) continue;
      out.push(c);
    } else if (c.type === 'adjust') {
      const adj: z.infer<typeof Adjust> = { type: 'adjust', routine_exercise_id: c.routine_exercise_id, reason: c.reason };
      if (c.sets != null && c.sets >= 1 && c.sets <= 10) adj.sets = c.sets;
      if (c.reps != null && c.reps.trim() && c.reps.length <= 20) adj.reps = c.reps.trim();
      if (c.weight_target != null && c.weight_target >= 0 && c.weight_target <= 500) adj.weight_target = c.weight_target;
      if (c.rest_seconds != null && c.rest_seconds >= 0 && c.rest_seconds <= 600) adj.rest_seconds = c.rest_seconds;
      if (Object.keys(adj).length > 3) out.push(adj);
    } else if (c.type === 'add_note') {
      const note = c.note.trim().slice(0, 200);
      if (note) out.push({ ...c, note });
    }
  }
  // Se guarda el nombre actual del ejercicio para que la propuesta se siga
  // leyendo bien después de aplicada (cuando el ejercicio ya cambió).
  return out.slice(0, 6).map((c) => ({ ...c, exercise_name: byId.get(c.routine_exercise_id)?.exercises?.name ?? null }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);

    // Service role: el alumno no puede escribir parsed_action por RLS (para que
    // no pueda inventar una "propuesta"). La identidad se valida con su JWT.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
    const studentId = userData.user.id;

    const { data: me } = await supabase.from('profiles').select('role, trainer_id, full_name').eq('id', studentId).single();
    if (!me || me.role !== 'student' || !me.trainer_id) return json({ error: 'students_only' }, 403);

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 1000) : '';
    if (!text) return json({ error: 'empty' }, 400);

    const since = new Date(Date.now() - 864e5).toISOString();
    const { count } = await supabase
      .from('adaptation_requests')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('created_at', since);
    if ((count ?? 0) >= MAX_REQUESTS_PER_DAY) return json({ error: 'too_many' }, 429);

    const { data: routine } = await supabase
      .from('routines')
      .select('id, name')
      .eq('student_id', studentId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let rows: RoutineRow[] = [];
    if (routine) {
      const { data } = await supabase
        .from('routine_exercises')
        .select('id, exercise_id, day_of_week, sets, reps, weight_target, rest_seconds, notes, exercises(name, muscle_group)')
        .eq('routine_id', routine.id)
        .order('order_index');
      rows = (data ?? []) as unknown as RoutineRow[];
    }

    let reply = 'Le pasé tu mensaje a tu entrenador. Te va a responder por acá.';
    let summary = '';
    let changes: (Change & { exercise_name: string | null })[] = [];

    if (rows.length > 0) {
      const [{ data: catalog }, { data: feedback }] = await Promise.all([
        supabase.from('exercises').select('id, name, muscle_group').order('name'),
        supabase
          .from('plan_feedback')
          .select('created_at, difficulty, energy, pain_level, notes')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);
      const catalogIds = new Set((catalog ?? []).map((e: { id: number }) => e.id));
      const context = {
        routine: rows.map((r) => ({
          routine_exercise_id: r.id,
          exercise_id: r.exercise_id,
          name: r.exercises?.name,
          muscle_group: r.exercises?.muscle_group,
          day_of_week: r.day_of_week,
          sets: r.sets,
          reps: r.reps,
          weight_target: r.weight_target,
          rest_seconds: r.rest_seconds,
          notes: r.notes,
        })),
        recent_feedback: feedback ?? [],
        catalog: catalog ?? [],
        student_message: text,
      };

      try {
        const anthropic = new Anthropic();
        const response = await anthropic.messages.parse({
          model: AI_MODEL,
          max_tokens: 16000,
          output_config: { effort: 'medium', format: zodOutputFormat(Proposal) },
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: JSON.stringify(context) }],
        });
        if (response.stop_reason !== 'refusal' && response.parsed_output) {
          reply = response.parsed_output.reply;
          summary = response.parsed_output.summary_for_trainer;
          changes = validChanges(response.parsed_output.changes, rows, catalogIds);
        }
      } catch (aiError) {
        // Sin IA el pedido igual le llega al entrenador, solo que sin propuesta.
        console.error('routine-assistant: AI error', aiError);
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('adaptation_requests')
      .insert({
        student_id: studentId,
        trainer_id: me.trainer_id,
        request_text: text,
        scope: 'training',
        status: 'pending',
        parsed_action: changes.length > 0 || summary ? { kind: 'routine', summary, changes, routine_id: routine?.id ?? null } : null,
      })
      .select('id')
      .single();
    if (insertError) {
      console.error('routine-assistant: insert error', insertError);
      return json({ error: 'save_failed' }, 500);
    }

    return json({ requestId: inserted.id, reply, proposed: changes.length });
  } catch (error) {
    console.error('routine-assistant error', error);
    return json({ error: 'internal' }, 500);
  }
});
