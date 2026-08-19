import type { Lang } from './i18n';

/**
 * Enlace a resultados de búsqueda de YouTube (sin necesidad de guardar un video
 * puntual por ejercicio, que podría borrarse o quedar desactualizado). YouTube
 * discontinuó el embed de listas de búsqueda (listType=search), así que se abre
 * en una pestaña nueva en lugar de incrustarse en un iframe.
 */
export function youtubeSearchUrl(query: string, lang: Lang = 'es'): string {
  const suffix = lang === 'en' ? 'exercise technique gym' : 'técnica ejercicio gimnasio';
  const search = `${query} ${suffix}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(search)}`;
}
