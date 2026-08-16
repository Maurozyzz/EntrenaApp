import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local y completalo con los datos de tu proyecto Supabase.',
  );
}

// Con las variables sin definir se crea igual un cliente "dummy" apuntando a localhost
// para que la app no explote al importar este módulo antes de tener credenciales reales;
// `isSupabaseConfigured` es lo que hay que chequear antes de usarlo de verdad.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'missing-anon-key',
);
