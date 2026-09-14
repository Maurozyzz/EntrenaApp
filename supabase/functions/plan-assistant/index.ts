// Edge Function: interpreta el pedido en lenguaje natural del alumno, lo
// clasifica con Claude en un JSON estructurado y valido, y ejecuta SOLO los
// cambios que pasan la validación a través del motor de reglas (rulesEngine
// + planEngine). La IA nunca toca Supabase directamente: propone, el motor decide.
//
// Flujo: alumno -> Edge Function -> contexto autorizado -> IA (JSON) ->
// validación -> motor de reglas / motor de cambios -> Supabase.
import Anthropic from 'npm:@anthropic-ai/sdk@0.125.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.125.0/helpers/zod';
import { z } from 'npm:zod@4.6.5';
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

import { buildStudentContext } from '../../../src/lib/studentContext.ts';
import { validateAiProposal } from '../../../src/lib/intents.ts';
import { applyExerciseReplacement, applyFoodReplacement, regeneratePlan } from '../../../src/lib/planEngine.ts';
import type { Exercise, StudentHealthProfile } from '../../../src/lib/types.ts';
import type { FoodOption } from '../../../src/lib/rulesEngine.ts';
import { corsHeaders } from '../_shared/cors.ts';

const AI_MODEL = 'claude-opus-5';

const ExerciseReplacementSchema = z.object({
  type: z.literal('exercise_replacement'),
  plan_day_id: z.string(),
  original_exercise_id: z.number().int().positive(),
  replacement_exercise_id: z.number().int().positive(),
  reason: z.string().optional(),
});

const FoodReplacementSchema = z.object({
  type: z.literal('food_replacement'),
  meal_id: z.string(),
  original_food_id: z.number().int().positive(),
  replacement_food_id: z.number().int().positive(),
  quantity: z.number().positive().optional(),
  reason: z.string().optional(),
});

const TrainingDaysChangeSchema = z.object({
  type: z.literal('training_days_change'),
  new_training_days: z.number().int().min(3).max(6),
});

const GoalChangeSchema = z.object({
  type: z.literal('goal_change'),
  new_goal: z.enum(['lose', 'maintain', 'gain']),
});

const RegenerateTrainingSchema = z.object({
  type: z.literal('regenerate_training_plan'),
  reason: z.string().optional(),
});

const RegenerateNutritionSchema = z.object({
  type: z.literal('regenerate_nutrition_plan'),
  reason: z.string().optional(),
});

const ChangeSchema = z.discriminatedUnion('type', [
  ExerciseReplacementSchema,
  FoodReplacementSchema,
  TrainingDaysChangeSchema,
  GoalChangeSchema,
  RegenerateTrainingSchema,
  RegenerateNutritionSchema,
]);

const AiProposalSchema = z.object({
  intent: z.enum([
    'GENERATE_PLAN', 'ADAPT_PLAN', 'MODIFY_WORKOUT', 'MODIFY_NUTRITION',
    'REPLACE_EXERCISE', 'REPLACE_FOOD', 'CHANGE_GOAL', 'CHANGE_AVAILABILITY',
    'GENERATE_VARIATION', 'ANALYZE_PROGRESS', 'REQUEST_FEEDBACK',
  ]),
  confidence: z.number().min(0).max(1),
  changes: z.array(ChangeSchema),
  studentMessage: z.string().min(1),
  clarification_needed: z.string().optional(),
});

const SYSTEM_PROMPT = `Sos el intérprete del motor de planificación de Origen Coaching, una app de coaching fitness.

Tu único trabajo es leer el pedido en lenguaje natural de un alumno y devolver un JSON estructurado: qué intención tiene y qué cambios puntuales propone. NO generás vos los ejercicios ni los alimentos de un plan nuevo — eso lo hace un motor de reglas determinístico contra el catálogo real. Vos solo interpretás y proponés.

Reglas estrictas:
- Nunca inventes IDs de ejercicios ni de alimentos: usá únicamente los que aparecen en "catalog".
- Para "exercise_replacement" y "food_replacement", el ID original y el plan_day_id / meal_id deben existir en "studentContext" (el plan activo del alumno).
- Si el pedido es ambiguo, incompleto, o no tenés información suficiente para decidir con confianza, no inventes: completá "clarification_needed" explicando qué falta, y bajá "confidence".
- "confidence" debe reflejar qué tan seguro estás de haber entendido bien el pedido (0 a 1), no una constante.
- "studentMessage" es una respuesta breve, cercana y en español que se le muestra directamente al alumno explicando qué vas a hacer (o qué necesitás aclarar).
- Un pedido puede no requerir ningún cambio (por ejemplo, preguntas sobre su progreso): en ese caso "changes" va vacío.

Intents disponibles: GENERATE_PLAN, ADAPT_PLAN, MODIFY_WORKOUT, MODIFY_NUTRITION, REPLACE_EXERCISE, REPLACE_FOOD, CHANGE_GOAL, CHANGE_AVAILABILITY, GENERATE_VARIATION, ANALYZE_PROGRESS, REQUEST_FEEDBACK.

Tipos de "changes" y cuándo usarlos:
- exercise_replacement: el alumno quiere cambiar un ejercicio puntual (intent REPLACE_EXERCISE).
- food_replacement: el alumno quiere cambiar un alimento puntual (intent REPLACE_FOOD).
- training_days_change: cambia cuántos días por semana entrena (intent CHANGE_AVAILABILITY).
- goal_change: cambia el objetivo general, ej. bajar de grasa / ganar masa (intent CHANGE_GOAL).
- regenerate_training_plan / regenerate_nutrition_plan: el alumno pide "algo diferente" o una revisión más amplia (intent GENERATE_VARIATION o ADAPT_PLAN). No necesitás elegir los ejercicios/comidas nuevos, solo marcar que hace falta regenerar.

Nunca actives ni modifiques nada vos directamente: tu respuesta es solo la propuesta. El servidor valida todo antes de aplicar cualquier cambio.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Falta el header Authorization.' }, 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, '');

    // Cliente con service role: las políticas RLS actuales solo dejan escribir
    // planes/perfil al entrenador (trainer_id = auth.uid()), pero acá el que
    // pide el cambio es el alumno. La identidad ya se validó con su JWT arriba;
    // de acá en más, este código hace su propia autorización (dueño del plan,
    // referencias válidas) en vez de depender de RLS — nunca se expone esta
    // clave al frontend.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) return jsonResponse({ error: 'No autenticado.' }, 401);
    const studentId = userData.user.id;

    const { data: callerProfile } = await supabase.from('profiles').select('role, trainer_id').eq('id', studentId).single();
    if (!callerProfile || callerProfile.role !== 'student') {
      return jsonResponse({ error: 'Este endpoint es solo para alumnos.' }, 403);
    }

    const body = await req.json().catch(() => null);
    const requestText = typeof body?.requestText === 'string' ? body.requestText.trim() : '';
    if (!requestText) return jsonResponse({ error: 'Falta requestText.' }, 400);
    const scopeInput = body?.scope;
    const scope = scopeInput === 'training' || scopeInput === 'nutrition' ? scopeInput : 'both';

    // 1. Registrar el pedido crudo de inmediato (auditoría, pase lo que pase después).
    const { data: requestRow, error: insertError } = await supabase
      .from('adaptation_requests')
      .insert({ student_id: studentId, trainer_id: callerProfile.trainer_id, request_text: requestText, scope })
      .select('id')
      .single();
    if (insertError || !requestRow) return jsonResponse({ error: 'No se pudo registrar el pedido.' }, 500);

    async function resolve(status: 'reviewed' | 'applied' | 'rejected', notes: string, parsedAction?: unknown) {
      await supabase
        .from('adaptation_requests')
        .update({ status, resolution_notes: notes, parsed_action: parsedAction ?? null, resolved_at: new Date().toISOString() })
        .eq('id', requestRow.id);
    }

    const trainerId = callerProfile.trainer_id;
    if (!trainerId) {
      await resolve('rejected', 'El alumno no tiene un entrenador asignado.');
      return jsonResponse({ intent: null, studentMessage: 'No pudimos identificar a tu entrenador. Contactalo directamente.', applied: false });
    }

    // 2. Perfil completo + catálogos reales (el motor de reglas nunca improvisa).
    const [{ data: healthProfile }, { data: allExercises }, { data: allFoods }] = await Promise.all([
      supabase.from('student_health_profiles').select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('exercises').select('*').order('name'),
      supabase.from('foods').select('*').order('name'),
    ]);

    if (!healthProfile) {
      await resolve('rejected', 'El alumno todavía no completó su perfil físico.');
      return jsonResponse({ intent: null, studentMessage: 'Todavía no completaste tu perfil físico — pedile a tu entrenador que lo cargue antes de pedir cambios.', applied: false });
    }

    // 3. Contexto compacto para la IA (nunca el historial completo).
    const { data: context, error: contextError } = await buildStudentContext(supabase, studentId);
    if (contextError || !context) {
      await resolve('rejected', `No se pudo construir el contexto: ${contextError?.message ?? 'desconocido'}`);
      return jsonResponse({ intent: null, studentMessage: 'Tuvimos un problema técnico armando tu contexto. Probá de nuevo en un rato.', applied: false });
    }

    // 4. La IA interpreta y propone (JSON estructurado y validado por schema).
    const anthropic = new Anthropic();
    const catalog = {
      exercises: (allExercises ?? []).map((e: { id: number; name: string; muscle_group: string | null }) => ({ id: e.id, name: e.name, muscle_group: e.muscle_group })),
      foods: (allFoods ?? []).map((f: { id: number; name: string }) => ({ id: f.id, name: f.name })),
    };

    let parsed: z.infer<typeof AiProposalSchema> | null;
    try {
      const response = await anthropic.messages.parse({
        model: AI_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify({ studentContext: context, catalog, studentRequest: requestText }) }],
        output_config: { format: zodOutputFormat(AiProposalSchema) },
      });
      parsed = response.parsed_output;
    } catch (aiError) {
      await resolve('rejected', `Error llamando a la IA: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
      return jsonResponse({ intent: null, studentMessage: 'No pudimos procesar tu pedido en este momento. Probá de nuevo en unos minutos.', applied: false });
    }

    if (!parsed) {
      await resolve('rejected', 'La IA no devolvió un JSON válido.');
      return jsonResponse({ intent: null, studentMessage: 'No entendimos bien tu pedido. ¿Podés reformularlo?', applied: false });
    }

    // 5. Validación de negocio (capa aparte del schema: IDs reales, rangos, forma).
    const validation = validateAiProposal(parsed);
    if (!validation.ok) {
      await resolve('rejected', `Validación falló: ${validation.error}`, parsed);
      return jsonResponse({ intent: null, studentMessage: 'No pudimos aplicar ese cambio de forma segura. ¿Podés explicarlo de otra manera?', applied: false });
    }
    const proposal = validation.data;

    if (proposal.clarification_needed || proposal.confidence < 0.6) {
      await resolve('reviewed', proposal.clarification_needed ?? `Confianza baja (${proposal.confidence}).`, proposal);
      return jsonResponse({ intent: proposal.intent, studentMessage: proposal.clarification_needed ?? proposal.studentMessage, applied: false });
    }

    // 6. La IA propone, el motor decide: solo cambios validados llegan a Supabase.
    let applied = false;
    let trainingVersionId: string | null = null;
    let nutritionVersionId: string | null = null;
    const changeErrors: string[] = [];

    for (const change of proposal.changes) {
      if (change.type === 'exercise_replacement') {
        const result = await applyExerciseReplacement(supabase, change, trainerId);
        if (result.error) changeErrors.push(result.error.message); else applied = true;
      } else if (change.type === 'food_replacement') {
        const result = await applyFoodReplacement(supabase, change, trainerId);
        if (result.error) changeErrors.push(result.error.message); else applied = true;
      }
    }

    const needsRegeneration = proposal.changes.some(
      (c) => c.type === 'regenerate_training_plan' || c.type === 'regenerate_nutrition_plan' || c.type === 'training_days_change' || c.type === 'goal_change',
    );

    if (needsRegeneration) {
      const profileUpdates: Record<string, unknown> = {};
      for (const change of proposal.changes) {
        if (change.type === 'training_days_change') profileUpdates.training_days = change.new_training_days;
        if (change.type === 'goal_change') profileUpdates.goal = change.new_goal;
      }
      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from('student_health_profiles').update(profileUpdates).eq('student_id', studentId);
      }
      const updatedProfile = { ...(healthProfile as StudentHealthProfile), ...profileUpdates };

      const wantsTraining = proposal.changes.some((c) => c.type === 'regenerate_training_plan' || c.type === 'training_days_change' || c.type === 'goal_change')
        || proposal.intent === 'GENERATE_PLAN' || proposal.intent === 'GENERATE_VARIATION';
      const wantsNutrition = proposal.changes.some((c) => c.type === 'regenerate_nutrition_plan' || c.type === 'goal_change')
        || proposal.intent === 'GENERATE_PLAN' || proposal.intent === 'GENERATE_VARIATION';
      const scopeToUse: 'training' | 'nutrition' | 'both' = wantsTraining && wantsNutrition ? 'both' : wantsTraining ? 'training' : 'nutrition';

      const excludeExerciseIds = proposal.intent === 'GENERATE_VARIATION'
        ? (context.currentTrainingPlan?.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)) ?? [])
        : [];
      const excludeFoodIds = proposal.intent === 'GENERATE_VARIATION'
        ? (context.currentNutritionPlan?.meals.flatMap((m) => m.items.map((i) => i.foodId)) ?? [])
        : [];

      const regenerated = await regeneratePlan(supabase, {
        studentId,
        trainerId,
        source: 'ai',
        changeReason: requestText,
        scope: scopeToUse,
        profile: updatedProfile,
        exercises: (allExercises ?? []) as Exercise[],
        foods: (allFoods ?? []) as FoodOption[],
        excludeExerciseIds,
        excludeFoodIds,
      });
      if (regenerated.error) {
        changeErrors.push(regenerated.error.message);
      } else {
        applied = true;
        trainingVersionId = regenerated.data?.trainingVersionId ?? null;
        nutritionVersionId = regenerated.data?.nutritionVersionId ?? null;
      }
    }

    const finalStatus = applied ? 'applied' : changeErrors.length > 0 ? 'rejected' : 'reviewed';
    await resolve(finalStatus, changeErrors.length > 0 ? changeErrors.join(' | ') : 'Aplicado automáticamente.', proposal);

    return jsonResponse({
      intent: proposal.intent,
      studentMessage: proposal.studentMessage,
      applied,
      trainingVersionId,
      nutritionVersionId,
      warnings: changeErrors.length > 0 ? changeErrors : undefined,
    });
  } catch (error) {
    console.error('plan-assistant error', error);
    return jsonResponse({ error: 'Error interno.' }, 500);
  }
});
