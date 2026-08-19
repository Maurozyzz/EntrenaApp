export const DAYS = [
  { value: 1, key: 'day.mon' },
  { value: 2, key: 'day.tue' },
  { value: 3, key: 'day.wed' },
  { value: 4, key: 'day.thu' },
  { value: 5, key: 'day.fri' },
  { value: 6, key: 'day.sat' },
  { value: 7, key: 'day.sun' },
] as const;

type Translate = (key: string) => string;

export function dayLabel(value: number | null, t: Translate): string {
  const day = DAYS.find((d) => d.value === value);
  return day ? t(day.key) : t('day.none');
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
