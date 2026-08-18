export const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
] as const;

export function dayLabel(value: number | null): string {
  return DAYS.find((d) => d.value === value)?.label ?? 'Sin día asignado';
}

export function groupByDay<T extends { day_of_week: number | null }>(items: T[]): { day: number | null; items: T[] }[] {
  const map = new Map<number | null, T[]>();
  for (const item of items) {
    const key = item.day_of_week;
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(item);
  }
  const order: (number | null)[] = [1, 2, 3, 4, 5, 6, 7, null];
  return order.filter((d) => map.has(d)).map((d) => ({ day: d, items: map.get(d) as T[] }));
}

export function muscleGroupSummary(items: { exercises: { muscle_group: string | null } | null }[]): string {
  const groups: string[] = [];
  for (const item of items) {
    const mg = item.exercises?.muscle_group;
    if (mg && !groups.includes(mg)) groups.push(mg);
  }
  return groups.join(', ');
}
