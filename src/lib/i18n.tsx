import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'oc-lang';

type Dict = Record<string, string>;

// Namespaced con un punto (ej: "login.title") para que sea fácil ubicar a qué
// pantalla pertenece cada texto. Los valores con {{variable}} se interpolan
// con el segundo argumento de t().
const es: Dict = {
  'app.name': 'Origen Coaching',

  'common.loading': 'Cargando…',
  'common.saving': 'Guardando…',
  'common.sending': 'Enviando…',
  'common.uploading': 'Subiendo…',
  'common.cancel': 'Cancelar',
  'common.add': 'Agregar',
  'common.none': '—',

  'nav.students': 'Alumnos',
  'nav.exercises': 'Ejercicios',
  'nav.home': 'Inicio',
  'nav.routine': 'Rutina',
  'nav.progress': 'Progreso',
  'nav.diet': 'Dieta',
  'nav.payments': 'Pagos',
  'nav.signOut': 'Salir',
  'nav.langToggle': 'EN',

  'day.mon': 'Lunes',
  'day.tue': 'Martes',
  'day.wed': 'Miércoles',
  'day.thu': 'Jueves',
  'day.fri': 'Viernes',
  'day.sat': 'Sábado',
  'day.sun': 'Domingo',
  'day.none': 'Sin día asignado',
  'day.noneOption': 'Sin día',

  'login.brand': 'Origen Coaching',
  'login.signIn': 'Ingresar',
  'login.signUp': 'Crear cuenta',
  'login.name': 'Nombre',
  'login.email': 'Email',
  'login.password': 'Contraseña',
  'login.signupDone':
    'Cuenta creada. Si tu proyecto de Supabase pide confirmación por email, revisá tu casilla y después iniciá sesión.',
  'login.toSignup': '¿No tenés cuenta? Registrate',
  'login.toSignin': '¿Ya tenés cuenta? Ingresá',

  'studentHome.greeting': 'Hola{{name}}',
  'studentHome.activeRoutine': 'Rutina activa',
  'studentHome.noRoutine': 'Todavía no tenés una rutina asignada.',
  'studentHome.viewRoutine': 'Ver rutina →',
  'studentHome.nextPayment': 'Próximo pago',
  'studentHome.noPending': 'No tenés pagos pendientes.',
  'studentHome.dueLabel': '{{amount}} {{currency}} · vence {{date}}',
  'studentHome.viewPayments': 'Ver pagos →',

  'routine.title': 'Mi rutina',
  'routine.noRoutine': 'Todavía no tenés una rutina asignada.',
  'routine.noExercises': 'Tu rutina todavía no tiene ejercicios cargados.',
  'routine.setsReps': '{{sets}} series x {{reps}} reps',
  'routine.targetSuffix': ' · objetivo {{weight}}kg',
  'routine.restSuffix': ' · descanso {{sec}}s',
  'routine.setsDone': 'Series hechas',
  'routine.weightUsed': 'Peso usado',
  'routine.save': 'Guardar',
  'routine.logSet': 'Registrar serie',
  'routine.howTo': '▶ Ver cómo hacerlo',
  'routine.history': 'Historial',

  'progress.title': 'Mi progreso',
  'progress.weight': 'Peso',
  'progress.waist': 'Cintura',
  'progress.weightKg': 'Peso (kg)',
  'progress.waistCm': 'Cintura (cm)',
  'progress.logMeasurement': 'Cargar medición',
  'progress.noMeasurements': 'Todavía no cargaste mediciones.',
  'progress.waistSuffix': ' · cintura {{cm}}cm',
  'progress.photosTitle': 'Fotos de progreso',
  'progress.dragToCompare': 'Arrastrá para comparar',
  'progress.uploadPhoto': '+ Subir una foto',
  'progress.noPhotos': 'Todavía no subiste fotos.',
  'progress.needTwo': 'Necesitás al menos dos mediciones de {{metric}} para ver el gráfico.',
  'progress.evolutionOf': 'Evolución de {{label}}',
  'progress.compareAria': 'Comparar antes y después',
  'progress.before': 'Antes',
  'progress.after': 'Después',

  'nutrition.title': 'Mi dieta',
  'nutrition.noPlan': 'Todavía no tenés un plan nutricional asignado.',
  'nutrition.dailyCalories': 'Calorías diarias',
  'nutrition.protein': 'Proteína',
  'nutrition.carbs': 'Carbohidratos',
  'nutrition.fat': 'Grasas',
  'nutrition.trainerNotes': 'Notas del entrenador',
  'nutrition.detailedTitle': 'Mi dieta detallada',
  'nutrition.detailedHint':
    'Cargá acá lo que te mandó tu entrenador (ej: 200g de pollo, 200g de arroz) y calculamos los macros al instante.',
  'nutrition.mealsTitle': 'Mis comidas',
  'nutrition.mealsHint': 'Subí una foto de lo que vas comiendo para que tu entrenador pueda verlo.',
  'nutrition.uploadMealPhoto': '+ Subir foto de una comida',
  'nutrition.noMealPhotos': 'Todavía no subiste fotos de comidas.',

  'payments.title': 'Mis pagos',
  'payments.noPayments': 'Todavía no hay pagos registrados.',
  'payments.viewReceipt': 'Ver comprobante subido',
  'payments.uploadReceipt': '+ Subir comprobante',
  'payments.noReceipt': 'Sin comprobante',
  'payments.rangeLine': '{{start}} → {{end}} · {{amount}} {{currency}}',

  'status.pending': 'Pendiente',
  'status.paid': 'Pagado',
  'status.overdue': 'Vencido',

  'dietBuilder.total': 'Total cargado',
  'dietBuilder.calories': 'Calorías',
  'dietBuilder.protein': 'Proteína',
  'dietBuilder.carbs': 'Carbohidratos',
  'dietBuilder.fat': 'Grasas',
  'dietBuilder.notInList': '¿No está en la lista? Escaneá el código de barras del producto.',
  'dietBuilder.scanButton': '📷 Escanear código de barras',
  'dietBuilder.searching': 'Buscando…',
  'dietBuilder.notFound': 'No encontramos ese producto (código {{barcode}}). Cargalo con los datos de la etiqueta y lo vamos a reconocer solo la próxima vez que se escanee este mismo código.',
  'dietBuilder.productName': 'Nombre del producto',
  'dietBuilder.kcalPer100': 'Kcal /100g',
  'dietBuilder.proteinPer100': 'Proteína /100g',
  'dietBuilder.carbsPer100': 'Carbos /100g',
  'dietBuilder.fatPer100': 'Grasas /100g',
  'dietBuilder.saveProduct': 'Guardar producto',
  'dietBuilder.food': 'Alimento',
  'dietBuilder.choose': 'Elegir…',
  'dietBuilder.quantity': 'Cantidad',
  'dietBuilder.unit': 'Unidad',
  'dietBuilder.meal': 'Comida',
  'dietBuilder.mealPlaceholder': 'Desayuno, Comida 1…',
  'dietBuilder.mealHint':
    'Usá el mismo nombre de "Comida" para juntar varios alimentos en un mismo renglón (ej: "Comida 1" para pollo + arroz + palta).',
  'dietBuilder.noDiet': 'Todavía no cargaste tu dieta.',
  'dietBuilder.noMealAssigned': 'Sin comida asignada',
  'dietBuilder.remove': 'Quitar',
  'dietBuilder.entryLine': '· {{qty}}{{unit}} · {{kcal}} kcal',
  'dietBuilder.foodFallback': 'Alimento',
  'dietBuilder.scanSaveFailed': 'No se pudo guardar el producto escaneado.',
  'dietBuilder.manualSaveFailed': 'No se pudo guardar el producto.',
  'dietBuilder.loadingCamera': 'Cargando cámara…',
  'dietBuilder.previewLine': '{{kcal}} kcal · {{protein}}g prot · {{carbs}}g carb · {{fat}}g grasa',

  'workoutHistory.noLogs': 'Todavía no hay series registradas.',
  'workoutHistory.bestMark': 'mejor marca',
  'workoutHistory.exerciseFallback': 'Ejercicio',
  'workoutHistory.setsLine': '· {{sets}} series',
  'workoutHistory.weightSuffix': '· {{weight}}kg',

  'scanner.aim': 'Apuntá al código de barras del producto',
  'scanner.genericError': 'No se pudo acceder a la cámara.',

  'coachStudents.title': 'Alumnos',
  'coachStudents.howToAdd':
    'Para sumar un alumno nuevo, pedile que se registre desde la pantalla de login con su propio email — queda vinculado a vos automáticamente.',
  'coachStudents.noStudents': 'Todavía no tenés alumnos registrados.',
  'coachStudents.noName': 'Sin nombre',
  'coachStudents.view': 'Ver →',
  'coachStudents.remove': 'Sacar alumno',
  'coachStudents.removing': 'Sacando…',
  'coachStudents.confirmRemove':
    '¿Seguro que querés sacar a {{name}} de tus alumnos? Se borra toda su rutina, historial, medidas, fotos, dieta y pagos. Esto no se puede deshacer.',
  'coachStudents.removeFailed': 'No se pudo sacar al alumno: {{message}}',
  'coachStudents.overdueBadge': 'Pago vencido',
  'coachStudents.noRoutineBadge': 'Sin rutina',
  'coachStudents.neverLogged': 'Nunca registró una serie',
  'coachStudents.inactiveDays': 'Inactivo hace {{days}} días',

  'coachExercises.title': 'Ejercicios',
  'coachExercises.intro': 'Ya viene precargado con un catálogo amplio de ejercicios comunes — sumá acá los que te falten.',
  'coachExercises.duplicateName': 'Ya existe un ejercicio con ese nombre.',
  'coachExercises.muscleGroupPlaceholder': 'Pecho, espalda…',
  'coachExercises.search': 'Buscar',
  'coachExercises.searchPlaceholder': 'Nombre o grupo muscular…',
  'coachExercises.name': 'Nombre',
  'coachExercises.muscleGroup': 'Grupo muscular',
  'coachExercises.noExercises': 'Todavía no cargaste ejercicios.',
  'coachExercises.noMatch': 'Ningún ejercicio coincide con "{{search}}".',
  'coachExercises.viewVideo': '▶ Ver video',

  'coachStudentDetail.fallbackName': 'Alumno',
  'coachStudentDetail.workoutHistoryTitle': 'Historial de entrenamientos',
  'coachStudentDetail.routineTitle': 'Rutina',
  'coachStudentDetail.noActiveRoutine': 'Este alumno todavía no tiene una rutina activa.',
  'coachStudentDetail.createRoutine': 'Crear rutina',
  'coachStudentDetail.noExercisesYet': 'Todavía no agregaste ejercicios.',
  'coachStudentDetail.day': 'Día',
  'coachStudentDetail.exercise': 'Ejercicio',
  'coachStudentDetail.choose': 'Elegir…',
  'coachStudentDetail.sets': 'Series',
  'coachStudentDetail.reps': 'Reps',
  'coachStudentDetail.weightKg': 'Peso (kg)',
  'coachStudentDetail.remove': 'Quitar',
  'coachStudentDetail.dietTitle': 'Dieta',
  'coachStudentDetail.caloriesLabel': 'Calorías',
  'coachStudentDetail.proteinG': 'Proteína (g)',
  'coachStudentDetail.carbsG': 'Carbs (g)',
  'coachStudentDetail.fatG': 'Grasas (g)',
  'coachStudentDetail.update': 'Actualizar',
  'coachStudentDetail.createPlan': 'Crear plan',
  'coachStudentDetail.detailedDietTitle': 'Dieta detallada',
  'coachStudentDetail.detailedDietHint':
    'Podés cargarla vos mismo, o la carga el alumno desde su cuenta — comparten la misma lista.',
  'coachStudentDetail.paymentsTitle': 'Pagos',
  'coachStudentDetail.noPayments': 'Todavía no hay pagos cargados.',
  'coachStudentDetail.viewReceipt': 'Ver comprobante',
  'coachStudentDetail.markPaid': 'Marcar pagado',
  'coachStudentDetail.amount': 'Monto',
  'coachStudentDetail.from': 'Desde',
  'coachStudentDetail.to': 'Hasta',
  'coachStudentDetail.registerPayment': 'Registrar pago',
  'coachStudentDetail.rangeLine': '{{start}} → {{end}} · {{amount}} {{currency}}',
  'coachStudentDetail.setsRepsLine': '· {{sets}}x{{reps}}',
  'coachStudentDetail.weightSuffix': '· {{weight}}kg',

  'auth.profileLoadFailed': 'No pudimos cargar tu perfil{{detail}}',
  'auth.signOut': 'Cerrar sesión',
};

const en: Dict = {
  'app.name': 'Origen Coaching',

  'common.loading': 'Loading…',
  'common.saving': 'Saving…',
  'common.sending': 'Sending…',
  'common.uploading': 'Uploading…',
  'common.cancel': 'Cancel',
  'common.add': 'Add',
  'common.none': '—',

  'nav.students': 'Students',
  'nav.exercises': 'Exercises',
  'nav.home': 'Home',
  'nav.routine': 'Routine',
  'nav.progress': 'Progress',
  'nav.diet': 'Diet',
  'nav.payments': 'Payments',
  'nav.signOut': 'Sign out',
  'nav.langToggle': 'ES',

  'day.mon': 'Monday',
  'day.tue': 'Tuesday',
  'day.wed': 'Wednesday',
  'day.thu': 'Thursday',
  'day.fri': 'Friday',
  'day.sat': 'Saturday',
  'day.sun': 'Sunday',
  'day.none': 'No day assigned',
  'day.noneOption': 'No day',

  'login.brand': 'Origen Coaching',
  'login.signIn': 'Sign in',
  'login.signUp': 'Create account',
  'login.name': 'Name',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.signupDone':
    'Account created. If your Supabase project requires email confirmation, check your inbox and then sign in.',
  'login.toSignup': "Don't have an account? Sign up",
  'login.toSignin': 'Already have an account? Sign in',

  'studentHome.greeting': 'Hi{{name}}',
  'studentHome.activeRoutine': 'Active routine',
  'studentHome.noRoutine': "You don't have a routine assigned yet.",
  'studentHome.viewRoutine': 'View routine →',
  'studentHome.nextPayment': 'Next payment',
  'studentHome.noPending': "You don't have any pending payments.",
  'studentHome.dueLabel': '{{amount}} {{currency}} · due {{date}}',
  'studentHome.viewPayments': 'View payments →',

  'routine.title': 'My routine',
  'routine.noRoutine': "You don't have a routine assigned yet.",
  'routine.noExercises': "Your routine doesn't have any exercises loaded yet.",
  'routine.setsReps': '{{sets}} sets x {{reps}} reps',
  'routine.targetSuffix': ' · target {{weight}}kg',
  'routine.restSuffix': ' · rest {{sec}}s',
  'routine.setsDone': 'Sets done',
  'routine.weightUsed': 'Weight used',
  'routine.save': 'Save',
  'routine.logSet': 'Log set',
  'routine.howTo': '▶ How to do it',
  'routine.history': 'History',

  'progress.title': 'My progress',
  'progress.weight': 'Weight',
  'progress.waist': 'Waist',
  'progress.weightKg': 'Weight (kg)',
  'progress.waistCm': 'Waist (cm)',
  'progress.logMeasurement': 'Log measurement',
  'progress.noMeasurements': "You haven't logged any measurements yet.",
  'progress.waistSuffix': ' · waist {{cm}}cm',
  'progress.photosTitle': 'Progress photos',
  'progress.dragToCompare': 'Drag to compare',
  'progress.uploadPhoto': '+ Upload a photo',
  'progress.noPhotos': "You haven't uploaded any photos yet.",
  'progress.needTwo': 'You need at least two {{metric}} measurements to see the chart.',
  'progress.evolutionOf': '{{label}} over time',
  'progress.compareAria': 'Compare before and after',
  'progress.before': 'Before',
  'progress.after': 'After',

  'nutrition.title': 'My diet',
  'nutrition.noPlan': "You don't have a nutrition plan assigned yet.",
  'nutrition.dailyCalories': 'Daily calories',
  'nutrition.protein': 'Protein',
  'nutrition.carbs': 'Carbs',
  'nutrition.fat': 'Fat',
  'nutrition.trainerNotes': "Trainer's notes",
  'nutrition.detailedTitle': 'My detailed diet',
  'nutrition.detailedHint':
    'Log what your trainer sent you here (e.g. 200g chicken, 200g rice) and we calculate the macros instantly.',
  'nutrition.mealsTitle': 'My meals',
  'nutrition.mealsHint': "Upload a photo of what you're eating so your trainer can see it.",
  'nutrition.uploadMealPhoto': '+ Upload a meal photo',
  'nutrition.noMealPhotos': "You haven't uploaded any meal photos yet.",

  'payments.title': 'My payments',
  'payments.noPayments': 'No payments registered yet.',
  'payments.viewReceipt': 'View uploaded receipt',
  'payments.uploadReceipt': '+ Upload receipt',
  'payments.noReceipt': 'No receipt',
  'payments.rangeLine': '{{start}} → {{end}} · {{amount}} {{currency}}',

  'status.pending': 'Pending',
  'status.paid': 'Paid',
  'status.overdue': 'Overdue',

  'dietBuilder.total': 'Total logged',
  'dietBuilder.calories': 'Calories',
  'dietBuilder.protein': 'Protein',
  'dietBuilder.carbs': 'Carbs',
  'dietBuilder.fat': 'Fat',
  'dietBuilder.notInList': "Not on the list? Scan the product's barcode.",
  'dietBuilder.scanButton': '📷 Scan barcode',
  'dietBuilder.searching': 'Searching…',
  'dietBuilder.notFound':
    "We couldn't find that product (barcode {{barcode}}). Load it with the label's info and we'll recognize it instantly the next time this barcode gets scanned.",
  'dietBuilder.productName': 'Product name',
  'dietBuilder.kcalPer100': 'Kcal /100g',
  'dietBuilder.proteinPer100': 'Protein /100g',
  'dietBuilder.carbsPer100': 'Carbs /100g',
  'dietBuilder.fatPer100': 'Fat /100g',
  'dietBuilder.saveProduct': 'Save product',
  'dietBuilder.food': 'Food',
  'dietBuilder.choose': 'Choose…',
  'dietBuilder.quantity': 'Quantity',
  'dietBuilder.unit': 'Unit',
  'dietBuilder.meal': 'Meal',
  'dietBuilder.mealPlaceholder': 'Breakfast, Meal 1…',
  'dietBuilder.mealHint':
    'Use the same "Meal" name to group several foods into one row (e.g. "Meal 1" for chicken + rice + avocado).',
  'dietBuilder.noDiet': "You haven't logged your diet yet.",
  'dietBuilder.noMealAssigned': 'No meal assigned',
  'dietBuilder.remove': 'Remove',
  'dietBuilder.entryLine': '· {{qty}}{{unit}} · {{kcal}} kcal',
  'dietBuilder.foodFallback': 'Food',
  'dietBuilder.scanSaveFailed': "Couldn't save the scanned product.",
  'dietBuilder.manualSaveFailed': "Couldn't save the product.",
  'dietBuilder.loadingCamera': 'Loading camera…',
  'dietBuilder.previewLine': '{{kcal}} kcal · {{protein}}g protein · {{carbs}}g carbs · {{fat}}g fat',

  'workoutHistory.noLogs': 'No sets logged yet.',
  'workoutHistory.bestMark': 'best mark',
  'workoutHistory.exerciseFallback': 'Exercise',
  'workoutHistory.setsLine': '· {{sets}} sets',
  'workoutHistory.weightSuffix': '· {{weight}}kg',

  'scanner.aim': "Point at the product's barcode",
  'scanner.genericError': "Couldn't access the camera.",

  'coachStudents.title': 'Students',
  'coachStudents.howToAdd':
    'To add a new student, have them sign up from the login screen with their own email — they get linked to you automatically.',
  'coachStudents.noStudents': "You don't have any students registered yet.",
  'coachStudents.noName': 'No name',
  'coachStudents.view': 'View →',
  'coachStudents.remove': 'Remove student',
  'coachStudents.removing': 'Removing…',
  'coachStudents.confirmRemove':
    'Are you sure you want to remove {{name}} from your students? Their routine, workout history, measurements, photos, diet, and payments will all be deleted. This cannot be undone.',
  'coachStudents.removeFailed': "Couldn't remove the student: {{message}}",
  'coachStudents.overdueBadge': 'Payment overdue',
  'coachStudents.noRoutineBadge': 'No routine',
  'coachStudents.neverLogged': 'Never logged a set',
  'coachStudents.inactiveDays': 'Inactive for {{days}} days',

  'coachExercises.title': 'Exercises',
  'coachExercises.intro': "It comes preloaded with a wide catalog of common exercises — add here the ones you're missing.",
  'coachExercises.duplicateName': 'An exercise with that name already exists.',
  'coachExercises.muscleGroupPlaceholder': 'Chest, back…',
  'coachExercises.search': 'Search',
  'coachExercises.searchPlaceholder': 'Name or muscle group…',
  'coachExercises.name': 'Name',
  'coachExercises.muscleGroup': 'Muscle group',
  'coachExercises.noExercises': "You haven't added any exercises yet.",
  'coachExercises.noMatch': 'No exercise matches "{{search}}".',
  'coachExercises.viewVideo': '▶ View video',

  'coachStudentDetail.fallbackName': 'Student',
  'coachStudentDetail.workoutHistoryTitle': 'Workout history',
  'coachStudentDetail.routineTitle': 'Routine',
  'coachStudentDetail.noActiveRoutine': "This student doesn't have an active routine yet.",
  'coachStudentDetail.createRoutine': 'Create routine',
  'coachStudentDetail.noExercisesYet': "You haven't added any exercises yet.",
  'coachStudentDetail.day': 'Day',
  'coachStudentDetail.exercise': 'Exercise',
  'coachStudentDetail.choose': 'Choose…',
  'coachStudentDetail.sets': 'Sets',
  'coachStudentDetail.reps': 'Reps',
  'coachStudentDetail.weightKg': 'Weight (kg)',
  'coachStudentDetail.remove': 'Remove',
  'coachStudentDetail.dietTitle': 'Diet',
  'coachStudentDetail.caloriesLabel': 'Calories',
  'coachStudentDetail.proteinG': 'Protein (g)',
  'coachStudentDetail.carbsG': 'Carbs (g)',
  'coachStudentDetail.fatG': 'Fat (g)',
  'coachStudentDetail.update': 'Update',
  'coachStudentDetail.createPlan': 'Create plan',
  'coachStudentDetail.detailedDietTitle': 'Detailed diet',
  'coachStudentDetail.detailedDietHint':
    'You can load it yourself, or the student loads it from their account — they share the same list.',
  'coachStudentDetail.paymentsTitle': 'Payments',
  'coachStudentDetail.noPayments': 'No payments logged yet.',
  'coachStudentDetail.viewReceipt': 'View receipt',
  'coachStudentDetail.markPaid': 'Mark as paid',
  'coachStudentDetail.amount': 'Amount',
  'coachStudentDetail.from': 'From',
  'coachStudentDetail.to': 'To',
  'coachStudentDetail.registerPayment': 'Register payment',
  'coachStudentDetail.rangeLine': '{{start}} → {{end}} · {{amount}} {{currency}}',
  'coachStudentDetail.setsRepsLine': '· {{sets}}x{{reps}}',
  'coachStudentDetail.weightSuffix': '· {{weight}}kg',

  'auth.profileLoadFailed': "We couldn't load your profile{{detail}}",
  'auth.signOut': 'Sign out',
};

const dictionaries: Record<Lang, Dict> = { es, en };

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: TranslateFn;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'es';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'en' ? 'en' : 'es';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readInitialLang);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'es' ? 'en' : 'es'));
  }, []);

  const t = useCallback<TranslateFn>(
    (key, vars) => {
      const template = dictionaries[lang][key] ?? key;
      if (!vars) return template;
      return Object.entries(vars).reduce(
        (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
        template,
      );
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, toggleLang, t }), [lang, toggleLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage debe usarse dentro de <LanguageProvider>');
  return ctx;
}
