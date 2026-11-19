import type { Lang } from './i18n';

function locale(lang: Lang): string {
  return lang === 'en' ? 'en-US' : 'es-AR';
}

// Las fechas tipo "2026-11-18" (columna date) se leen como fecha local, no
// UTC: new Date('2026-11-18') en Argentina daría el 17 a las 21 h.
function parseDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

/** "18 nov. 2026" / "Nov 18, 2026" */
export function formatDate(value: string | null | undefined, lang: Lang): string {
  if (!value) return '—';
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "$45.000" para ARS; otras monedas con su código. */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined, lang: Lang): string {
  if (amount == null) return '—';
  const code = (currency || 'ARS').toUpperCase();
  try {
    return new Intl.NumberFormat(locale(lang), {
      style: 'currency',
      currency: code,
      currencyDisplay: code === 'ARS' ? 'narrowSymbol' : 'code',
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}
