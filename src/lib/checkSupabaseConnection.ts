import { isSupabaseConfigured } from './supabaseClient';

export type SupabaseConnectionStatus =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Chequeo liviano de conectividad contra el endpoint REST raíz de Supabase.
 * No depende de que exista ninguna tabla todavía (útil antes de correr las migraciones).
 */
export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'Faltan las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local.' };
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anonKey },
    });
    if (res.status === 401) {
      return { ok: false, message: 'El proyecto respondió, pero la anon key parece incorrecta (401).' };
    }
    if (!res.ok && res.status !== 404) {
      return { ok: false, message: `El proyecto respondió con un error inesperado (${res.status}).` };
    }
    return { ok: true, message: 'Conectado a Supabase correctamente.' };
  } catch {
    return {
      ok: false,
      message: 'No se pudo alcanzar el proyecto de Supabase. Revisá la URL o si el proyecto está pausado.',
    };
  }
}
