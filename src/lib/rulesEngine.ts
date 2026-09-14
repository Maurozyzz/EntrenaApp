import type { Exercise, StudentHealthProfile, TrainingFocus } from './types.ts';

// Subconjunto del perfil que necesita el motor de reglas: todo excepto las
// columnas de identidad/auditoría, que no influyen en el cálculo.
export type PlanProfile = Omit<StudentHealthProfile, 'student_id' | 'trainer_id' | 'created_at' | 'updated_at'>;

// Motor de reglas determinístico (BMR/TDEE, selección de ejercicios y comidas).
// Extraído de AutoPlanBuilder para que también lo use la Edge Function de IA
// (Fase 4): la IA interpreta el pedido y decide QUÉ cambió del perfil, pero
// nunca inventa ejercicios ni alimentos — eso siempre lo decide este motor
// contra el catálogo real, con las mismas reglas para entrenador y para IA.

export interface FoodOption {
  id: number;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

export interface GeneratedExercise {
  id: number;
  name: string;
  muscleGroup: string | null;
  day: number;
  reason: string;
  sets: number;
  reps: string;
  rest: number;
  tempo: string;
  focus: string;
}

export interface GeneratedMeal {
  foodId: number;
  meal: string;
  food: string;
  quantity: number;
  unit: 'g' | 'ml';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface GeneratedPlan {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  exercises: GeneratedExercise[];
  meals: GeneratedMeal[];
}

const ACTIVITY_FACTORS: Record<StudentHealthProfile['activity_level'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

const GOAL_ADJUSTMENTS: Record<StudentHealthProfile['goal'], number> = { lose: -300, maintain: 0, gain: 250 };

const INJURY_RULES: Array<{ terms: string[]; groups: string[]; names: string[] }> = [
  { terms: ['hombro', 'shoulder'], groups: ['Hombros', 'Pecho'], names: ['Press militar', 'Press de hombros', 'Fondos', 'Elevaciones'] },
  { terms: ['rodilla', 'knee'], groups: ['Piernas'], names: ['Sentadilla', 'Zancadas', 'Prensa', 'Extensión de cuádriceps', 'Salto', 'Correr', 'Escaladora'] },
  { terms: ['espalda', 'lumbar', 'columna', 'back'], groups: ['Espalda'], names: ['Peso muerto', 'Remo con barra', 'Hiperextensiones'] },
  { terms: ['codo', 'elbow'], groups: ['Bíceps', 'Tríceps'], names: ['Curl', 'Press francés', 'Extensión de tríceps', 'Fondos'] },
  { terms: ['tobillo', 'ankle'], groups: ['Piernas', 'Cardio'], names: ['Correr', 'Salto', 'Escaladora', 'Zancadas'] },
];

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function isExerciseAllowed(exercise: Exercise, injuries: string, excludedExercises: string, equipment: string | null): boolean {
  const normalized = normalizeText(injuries);
  const excluded = normalizeText(excludedExercises);
  const exerciseName = normalizeText(exercise.name);
  const equipmentText = normalizeText(equipment ?? '');
  if (excluded && excluded.split(',').some((term) => term.trim() && exerciseName.includes(term.trim()))) return false;
  if (equipmentText && /(casa|home|sin maquina|sin maquinas)/.test(equipmentText) && /(polea|maquina|smith|stairmaster)/.test(exerciseName)) return false;
  return !INJURY_RULES.some((rule) => {
    if (!rule.terms.some((term) => normalized.includes(normalizeText(term)))) return false;
    return rule.names.some((name) => exerciseName.includes(normalizeText(name)));
  });
}

const FOCUS_KEYWORDS: Record<TrainingFocus, string[]> = {
  hypertrophy: ['press', 'curl', 'extensión', 'aperturas', 'elevaciones', 'hip thrust', 'prensa'],
  endurance: ['máquina', 'polea', 'plancha', 'puente', 'bicicleta', 'correr', 'remo (', 'escaladora'],
  strength: ['barra', 'press', 'sentadilla', 'peso muerto', 'dominadas', 'remo con barra'],
  general: [],
};

function exerciseReason(injuries: string, focus: TrainingFocus): string {
  const normalized = normalizeText(injuries);
  const matchingRule = INJURY_RULES.find((rule) => rule.terms.some((term) => normalized.includes(normalizeText(term))));
  const focusReason = focus === 'endurance'
    ? 'Se prioriza por permitir volumen alto con pausas cortas y técnica estable.'
    : focus === 'strength'
      ? 'Se prioriza por permitir trabajar fuerza con cargas progresivas y técnica controlada.'
      : focus === 'hypertrophy'
        ? 'Se prioriza por facilitar tensión mecánica y volumen efectivo para hipertrofia.'
        : 'Se selecciona por equilibrio entre fuerza, volumen y acondicionamiento.';
  if (!matchingRule) return focusReason;
  const injury = matchingRule.terms.find((term) => normalized.includes(normalizeText(term))) ?? 'la lesión declarada';
  return `${focusReason} Es una alternativa seleccionada para proteger la zona asociada a ${injury}; revisar tolerancia y técnica.`;
}

export function buildMeals(
  foods: FoodOption[],
  targetCalories: number,
  profile: Pick<PlanProfile, 'allergies' | 'avoided_foods' | 'preferred_foods' | 'meals_per_day'>,
  excludeFoodIds: number[] = [],
): GeneratedMeal[] {
  const templates = [
    ['Desayuno', 'Avena (copos secos)', 70], ['Desayuno', 'Huevo entero', 150],
    ['Almuerzo', 'Pechuga de pollo', 180], ['Almuerzo', 'Arroz blanco cocido', 220],
    ['Merienda', 'Yogur griego natural', 200], ['Merienda', 'Banana', 120],
    ['Cena', 'Carne vacuna magra', 160], ['Cena', 'Papa cocida', 250],
  ] as const;
  const restrictions = normalizeText(`${profile.allergies ?? ''},${profile.avoided_foods ?? ''}`);
  const preferredFoods = normalizeText(profile.preferred_foods ?? '').split(',').map((term) => term.trim()).filter(Boolean);
  const availableFoods = foods
    .filter((food) => !excludeFoodIds.includes(food.id))
    .filter((food) => !restrictions.split(',').some((term) => term.trim() && normalizeText(food.name).includes(term.trim())));
  const chooseFood = (foodName: string, meal: string): FoodOption | undefined => {
    const exact = availableFoods.find((food) => normalizeText(food.name) === normalizeText(foodName));
    if (exact) return exact;
    const preferred = availableFoods.find((food) => preferredFoods.some((term) => normalizeText(food.name).includes(term)));
    return preferred ?? availableFoods.find((food) => food.name && meal.length > 0);
  };
  const baseMeals = templates.flatMap(([meal, foodName, quantity]) => {
    if (restrictions.split(',').some((term) => term.trim() && normalizeText(foodName).includes(term.trim()))) return [];
    if (profile.meals_per_day === 3 && meal === 'Merienda') return [];
    const food = chooseFood(foodName, meal);
    if (!food) return [];
    const factor = quantity / 100;
    return [{ foodId: food.id, meal, food: food.name, quantity, unit: 'g' as const, calories: food.calories_per_100g * factor, protein: food.protein_per_100g * factor, carbs: food.carbs_per_100g * factor, fat: food.fat_per_100g * factor }];
  });
  const baseCalories = baseMeals.reduce((total, meal) => total + meal.calories, 0);
  const scale = Math.min(1.35, Math.max(0.75, targetCalories / Math.max(baseCalories, 1)));
  return baseMeals.map((meal) => ({
    ...meal,
    quantity: Math.round((meal.quantity * scale) / 5) * 5,
    calories: Math.round(meal.calories * scale),
    protein: Math.round(meal.protein * scale),
    carbs: Math.round(meal.carbs * scale),
    fat: Math.round(meal.fat * scale),
  }));
}

const SPLITS: Record<number, string[][]> = {
  3: [['Pecho', 'Tríceps'], ['Espalda', 'Bíceps'], ['Piernas', 'Core']],
  4: [['Pecho', 'Tríceps'], ['Espalda', 'Bíceps'], ['Piernas'], ['Hombros', 'Core']],
  5: [['Pecho', 'Tríceps'], ['Espalda', 'Bíceps'], ['Piernas'], ['Hombros'], ['Core', 'Cardio']],
  6: [['Pecho', 'Tríceps'], ['Espalda', 'Bíceps'], ['Piernas', 'Core'], ['Pecho', 'Hombros'], ['Espalda', 'Bíceps'], ['Piernas', 'Cardio']],
};

export function calculatePlan(profile: PlanProfile, exercises: Exercise[], excludeExerciseIds: number[] = []): Omit<GeneratedPlan, 'meals'> {
  const weight = profile.weight_kg ?? 0;
  const height = profile.height_cm ?? 0;
  const age = profile.age_years ?? 0;
  const sexOffset = profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  const stepAdjustment = profile.daily_steps && profile.daily_steps >= 10000 ? 0.1 : profile.daily_steps && profile.daily_steps < 5000 ? -0.05 : 0;
  const workAdjustment = profile.work_type === 'physical' ? 0.1 : profile.work_type === 'active' ? 0.05 : 0;
  const calories = Math.round(Math.max(1200, bmr * (ACTIVITY_FACTORS[profile.activity_level] + stepAdjustment + workAdjustment) + GOAL_ADJUSTMENTS[profile.goal]) / 50) * 50;
  const protein = Math.round(weight * (profile.goal === 'lose' || profile.training_focus === 'hypertrophy' ? 1.8 : 1.6));
  const fat = Math.round(weight * 0.8);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const injuries = profile.injuries ?? '';
  const allowed = exercises
    .filter((exercise) => !excludeExerciseIds.includes(exercise.id))
    .filter((exercise) => isExerciseAllowed(exercise, injuries, profile.excluded_exercises ?? '', profile.equipment));
  const split = SPLITS[profile.training_days] ?? SPLITS[3];
  const cursors: Record<string, number> = {};
  const focusKeywords = FOCUS_KEYWORDS[profile.training_focus];
  const recoveryLimited = (profile.sleep_hours !== null && profile.sleep_hours < 6) || profile.stress_level === 'high';
  const exercisesPerGroup = profile.training_focus === 'strength'
    ? 2
    : profile.training_focus === 'endurance'
      ? 4
        : profile.training_level === 'advanced'
        ? 4
        : profile.training_level === 'intermediate'
          ? 3
            : 2;
  const adjustedExercisesPerGroup = recoveryLimited ? Math.max(1, exercisesPerGroup - 1) : exercisesPerGroup;
  const preferredKeywords = (profile.preferred_exercises ?? '').toLowerCase().split(',').map((term) => term.trim()).filter(Boolean);
  const picked = split.flatMap((dayGroups, dayIndex) => dayGroups.flatMap((group) => {
    const matches = allowed
      .filter((exercise) => exercise.muscle_group === group)
      .map((exercise, index) => ({
        exercise,
        score: focusKeywords.reduce((score, keyword) => score + (exercise.name.toLowerCase().includes(keyword) ? 2 : 0), 0)
          + preferredKeywords.reduce((score, keyword) => score + (exercise.name.toLowerCase().includes(keyword) ? 3 : 0), 0),
        index,
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ exercise }) => exercise);
    const cursor = cursors[group] ?? 0;
    const selected = matches.slice(cursor, cursor + adjustedExercisesPerGroup);
    cursors[group] = matches.length ? (cursor + selected.length) % matches.length : 0;
    return selected.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscle_group,
      day: dayIndex + 1,
      reason: exerciseReason(injuries, profile.training_focus),
      sets: profile.training_focus === 'strength' ? 4 : profile.training_focus === 'endurance' ? 2 : profile.training_level === 'beginner' ? 2 : 3,
      reps: exercise.muscle_group === 'Cardio' ? '10-15 min' : profile.training_focus === 'strength' ? '4-6' : profile.training_focus === 'endurance' ? '15-25' : '8-12',
      rest: exercise.muscle_group === 'Core' || profile.training_focus === 'endurance' ? 45 : profile.training_focus === 'strength' ? 150 : 90,
      tempo: profile.training_focus === 'endurance' ? '2-0-2' : '2-1-2',
      focus: profile.training_focus === 'hypertrophy'
        ? 'Buscar tensión mecánica, recorrido controlado y terminar con 1-3 repeticiones en reserva.'
        : profile.training_focus === 'endurance'
          ? 'Mantener técnica y ritmo constantes, con pausas cortas y sin llegar al fallo técnico.'
          : profile.training_focus === 'strength'
            ? 'Priorizar técnica, estabilidad y velocidad; detener la serie si se degrada la ejecución.'
            : 'Controlar la técnica y mantener 1-3 repeticiones en reserva.',
    }));
  }));

  return { calories, protein, carbs, fat, exercises: picked };
}
