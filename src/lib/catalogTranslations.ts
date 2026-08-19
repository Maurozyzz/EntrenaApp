import type { Lang } from './i18n';

// Traducciones de los datos precargados (catálogo base de ejercicios y
// alimentos del schema.sql). Un ejercicio o alimento que el entrenador haya
// cargado a mano no está acá, así que se muestra tal cual lo escribió —
// no hay forma de traducir texto libre sin un servicio externo.

const MUSCLE_GROUP_EN: Record<string, string> = {
  Pecho: 'Chest',
  Espalda: 'Back',
  Piernas: 'Legs',
  Glúteos: 'Glutes',
  Hombros: 'Shoulders',
  Bíceps: 'Biceps',
  Tríceps: 'Triceps',
  Core: 'Core',
  Cardio: 'Cardio',
};

const EXERCISE_NAME_EN: Record<string, string> = {
  'Press de banca con barra': 'Barbell bench press',
  'Press inclinado con barra': 'Incline barbell press',
  'Press declinado con barra': 'Decline barbell press',
  'Press de banca con mancuernas': 'Dumbbell bench press',
  'Press inclinado con mancuernas': 'Incline dumbbell press',
  'Aperturas con mancuernas': 'Dumbbell flyes',
  'Cruce de poleas (crossover)': 'Cable crossover',
  'Fondos en paralelas': 'Parallel bar dips',
  'Pullover con mancuerna': 'Dumbbell pullover',
  'Press en máquina Smith': 'Smith machine press',
  Dominadas: 'Pull-ups',
  'Jalón al pecho en polea': 'Lat pulldown',
  'Remo con barra': 'Barbell row',
  'Remo con mancuerna a una mano': 'One-arm dumbbell row',
  'Remo en polea baja': 'Seated cable row',
  'Remo en máquina': 'Machine row',
  'Peso muerto': 'Deadlift',
  Hiperextensiones: 'Hyperextensions',
  'Face pull': 'Face pull',
  'Pull-over en polea': 'Cable pullover',
  'Sentadilla con barra': 'Barbell squat',
  'Sentadilla frontal': 'Front squat',
  'Prensa de piernas': 'Leg press',
  'Zancadas (lunges)': 'Lunges',
  'Sentadilla búlgara': 'Bulgarian split squat',
  'Peso muerto rumano': 'Romanian deadlift',
  'Extensión de cuádriceps en máquina': 'Leg extension',
  'Curl femoral en máquina': 'Leg curl',
  'Elevación de talones de pie (gemelos)': 'Standing calf raise',
  'Elevación de talones sentado (gemelos)': 'Seated calf raise',
  'Hip thrust con barra': 'Barbell hip thrust',
  'Puente de glúteo': 'Glute bridge',
  'Patada de glúteo en polea': 'Cable glute kickback',
  'Abducción de cadera en máquina': 'Hip abduction machine',
  'Press militar con barra': 'Barbell overhead press',
  'Press de hombros con mancuernas': 'Dumbbell shoulder press',
  'Press Arnold': 'Arnold press',
  'Elevaciones laterales con mancuernas': 'Dumbbell lateral raises',
  'Elevaciones frontales con mancuernas': 'Dumbbell front raises',
  'Pájaro (elevaciones posteriores)': 'Rear delt fly',
  'Remo al mentón (upright row)': 'Upright row',
  'Curl con barra': 'Barbell curl',
  'Curl con mancuernas alternado': 'Alternating dumbbell curl',
  'Curl martillo': 'Hammer curl',
  'Curl concentrado': 'Concentration curl',
  'Curl en polea baja': 'Cable curl',
  'Curl predicador (banco Scott)': 'Preacher curl',
  'Press francés': 'Skull crusher',
  'Extensión de tríceps en polea alta': 'Triceps pushdown',
  'Fondos entre bancos': 'Bench dips',
  'Patada de tríceps con mancuerna': 'Dumbbell triceps kickback',
  'Press cerrado en banca': 'Close-grip bench press',
  'Plancha (plank)': 'Plank',
  'Abdominales crunch': 'Crunches',
  'Elevación de piernas colgado': 'Hanging leg raise',
  'Rueda abdominal (ab wheel)': 'Ab wheel rollout',
  'Giro ruso (russian twist)': 'Russian twist',
  'Abdominales en polea alta': 'Cable crunch',
  'Correr en cinta': 'Treadmill running',
  'Bicicleta fija': 'Stationary bike',
  'Remo (máquina de cardio)': 'Rowing machine',
  'Escaladora (stairmaster)': 'Stair climber',
  'Salto a la comba': 'Jump rope',
};

const FOOD_NAME_EN: Record<string, string> = {
  'Pechuga de pollo': 'Chicken breast',
  'Carne vacuna magra': 'Lean beef',
  'Pavo (pechuga)': 'Turkey (breast)',
  'Huevo entero': 'Whole egg',
  'Clara de huevo': 'Egg white',
  'Atún al natural': 'Canned tuna (in water)',
  Salmón: 'Salmon',
  Merluza: 'Hake',
  'Whey protein (polvo)': 'Whey protein (powder)',
  'Queso fresco / cottage': 'Fresh cheese / cottage cheese',
  'Yogur griego natural': 'Plain Greek yogurt',
  'Lentejas cocidas': 'Cooked lentils',
  'Garbanzos cocidos': 'Cooked chickpeas',
  Tofu: 'Tofu',
  'Arroz blanco cocido': 'Cooked white rice',
  'Arroz integral cocido': 'Cooked brown rice',
  'Papa cocida': 'Boiled potato',
  'Batata cocida': 'Boiled sweet potato',
  'Avena (copos secos)': 'Oats (dry)',
  'Pan integral': 'Whole wheat bread',
  'Pan blanco': 'White bread',
  'Pasta cocida': 'Cooked pasta',
  'Quinoa cocida': 'Cooked quinoa',
  'Tortilla de trigo': 'Wheat tortilla',
  Choclo: 'Corn',
  Banana: 'Banana',
  Manzana: 'Apple',
  Naranja: 'Orange',
  'Aceite de oliva': 'Olive oil',
  Palta: 'Avocado',
  'Manteca de maní': 'Peanut butter',
  Almendras: 'Almonds',
  Nueces: 'Walnuts',
  'Semillas de chía': 'Chia seeds',
  'Leche entera': 'Whole milk',
  'Leche descremada': 'Skim milk',
  'Queso cremoso': 'Cream cheese',
  Brócoli: 'Broccoli',
  Espinaca: 'Spinach',
  Zanahoria: 'Carrot',
  Tomate: 'Tomato',
  Lechuga: 'Lettuce',
};

export function translateExerciseName(name: string, lang: Lang): string {
  if (lang !== 'en') return name;
  return EXERCISE_NAME_EN[name] ?? name;
}

export function translateFoodName(name: string, lang: Lang): string {
  if (lang !== 'en') return name;
  return FOOD_NAME_EN[name] ?? name;
}

export function translateMuscleGroup(group: string, lang: Lang): string {
  if (lang !== 'en') return group;
  return MUSCLE_GROUP_EN[group] ?? group;
}
