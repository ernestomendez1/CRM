/**
 * Locale-aware money + percent formatting.
 * Defaults match the business profile (DOP, Dominican Republic).
 */

export type FormatMoneyOptions = {
  currency?: string; // ISO 4217, e.g. 'DOP', 'USD'
  locale?: string;   // e.g. 'en-US', 'es-DO'
  /** Show currency symbol/code. Default true. */
  showSymbol?: boolean;
};

export function formatMoney(amount: number, options: FormatMoneyOptions = {}): string {
  const { currency = 'DOP', locale = 'en-US', showSymbol = true } = options;

  return new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(fraction: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(fraction);
}

export function parseMoneyInput(value: string): number {
  // Strip whitespace + common separators (assumes the form input shows raw 12.34 style).
  const cleaned = value.replace(/[^\d.-]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
