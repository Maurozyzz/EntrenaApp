/**
 * Enlace a resultados de búsqueda de YouTube (sin necesidad de guardar un video
 * puntual por ejercicio, que podría borrarse o quedar desactualizado). YouTube
 * discontinuó el embed de listas de búsqueda (listType=search), así que se abre
 * en una pestaña nueva en lugar de incrustarse en un iframe.
 */
export function youtubeSearchUrl(query: string): string {
  const search = `${query} técnica ejercicio gimnasio`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(search)}`;
}
