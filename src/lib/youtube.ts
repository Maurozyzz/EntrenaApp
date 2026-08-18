/**
 * Embed de resultados de búsqueda de YouTube (sin necesidad de guardar un video
 * puntual por ejercicio, que podría borrarse o quedar desactualizado).
 */
export function youtubeSearchEmbedUrl(query: string): string {
  const search = `${query} técnica ejercicio gimnasio`;
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(search)}`;
}
