/**
 * Money math — pure functions, no I/O.
 *
 * Strategy:
 *   - Money values in this codebase are stored as decimals with 2 fractional digits.
 *   - Inside this module we convert to integer cents for sums and rounding so we
 *     never compound float drift across line items.
 *   - Tax and discount are computed per-line, then summed for the document total.
 *     We never compute "total tax" as a percentage of the document subtotal.
 *   - Rounding is half-to-even (banker's) to match accounting conventions.
 *
 * Inputs are validated; the caller is expected to feed sanitized values from
 * the validation layer (e.g. zod-parsed form data).
 */

export type LineInput = {
  /** Quantity. Supports fractional quantities up to 4 decimals. */
  quantity: number;
  /** Unit price as a decimal (e.g. 100.00). */
  unitPrice: number;
  /** Discount fraction, 0–1 (e.g. 0.10 for 10%). */
  discountPct?: number;
  /** Tax fraction, 0–1 (e.g. 0.18 for 18% ITBIS). 0 for tax-exempt lines. */
  taxRate?: number;
};

export type LineComputed = {
  /** Quantity × unit price, after discount, before tax. */
  lineSubtotal: number;
  /** Tax amount on the line. */
  lineTax: number;
  /** Discount amount applied to this line. */
  lineDiscount: number;
  /** lineSubtotal + lineTax. */
  lineTotal: number;
};

export type DocumentTotals = {
  /** Sum of line subtotals (after discount, before tax). */
  subtotal: number;
  /** Sum of line discounts (informational; subtotal already net of discount). */
  discountTotal: number;
  /** Sum of line taxes. */
  taxTotal: number;
  /** subtotal + taxTotal. */
  total: number;
};

/**
 * Half-to-even (banker's) rounding to N decimals.
 * 2.5 → 2, 3.5 → 4, 2.51 → 3, 2.45 → 2, 2.55 → 2.6
 */
export function roundMoney(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) {
    throw new Error(`roundMoney: non-finite value ${value}`);
  }
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;

  // Tolerance for float imprecision around halfway points.
  const EPSILON = 1e-9;

  let rounded: number;
  if (Math.abs(diff - 0.5) < EPSILON) {
    // Halfway → round to even
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else if (diff > 0.5) {
    rounded = floor + 1;
  } else {
    rounded = floor;
  }
  // Handle negatives: floor() goes more negative; the above logic still works
  // because halfway adjustment is symmetric.
  return rounded / factor;
}

function assertNonNegative(name: string, n: number) {
  if (!Number.isFinite(n)) throw new Error(`${name} must be finite`);
  if (n < 0) throw new Error(`${name} must be >= 0`);
}

function assertFraction(name: string, n: number) {
  if (!Number.isFinite(n)) throw new Error(`${name} must be finite`);
  if (n < 0 || n > 1) throw new Error(`${name} must be between 0 and 1 (got ${n})`);
}

export function calculateLine(input: LineInput): LineComputed {
  const quantity = input.quantity;
  const unitPrice = input.unitPrice;
  const discountPct = input.discountPct ?? 0;
  const taxRate = input.taxRate ?? 0;

  assertNonNegative('quantity', quantity);
  assertNonNegative('unitPrice', unitPrice);
  assertFraction('discountPct', discountPct);
  assertFraction('taxRate', taxRate);

  const gross = quantity * unitPrice;
  const lineDiscount = roundMoney(gross * discountPct);
  const lineSubtotal = roundMoney(gross - lineDiscount);
  const lineTax = roundMoney(lineSubtotal * taxRate);
  const lineTotal = roundMoney(lineSubtotal + lineTax);

  return { lineSubtotal, lineTax, lineDiscount, lineTotal };
}

export function calculateTotals(lines: LineInput[]): DocumentTotals & {
  lines: LineComputed[];
} {
  if (!Array.isArray(lines)) {
    throw new Error('calculateTotals: lines must be an array');
  }

  const computed = lines.map(calculateLine);

  // Sum in integer cents to avoid float drift.
  let subtotalCents = 0;
  let discountCents = 0;
  let taxCents = 0;

  for (const l of computed) {
    subtotalCents += Math.round(l.lineSubtotal * 100);
    discountCents += Math.round(l.lineDiscount * 100);
    taxCents += Math.round(l.lineTax * 100);
  }

  const subtotal = subtotalCents / 100;
  const discountTotal = discountCents / 100;
  const taxTotal = taxCents / 100;
  const total = roundMoney(subtotal + taxTotal);

  return { subtotal, discountTotal, taxTotal, total, lines: computed };
}

/**
 * Recompute invoice balance after a list of payments.
 * Returns { amountPaid, balanceDue, status } given the invoice total.
 */
export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export function applyPayments(
  invoiceTotal: number,
  payments: { amount: number }[],
  options: { dueDate?: Date | string | null; today?: Date; currentStatus?: InvoiceStatus } = {},
): { amountPaid: number; balanceDue: number; status: InvoiceStatus } {
  assertNonNegative('invoiceTotal', invoiceTotal);

  const cents = payments.reduce((acc, p) => {
    assertNonNegative('payment.amount', p.amount);
    return acc + Math.round(p.amount * 100);
  }, 0);
  const amountPaid = cents / 100;
  const balanceDue = Math.max(0, roundMoney(invoiceTotal - amountPaid));

  if (options.currentStatus === 'cancelled' || options.currentStatus === 'draft') {
    return { amountPaid, balanceDue, status: options.currentStatus };
  }

  let status: InvoiceStatus;
  const EPS = 0.005; // half a cent
  if (amountPaid + EPS >= invoiceTotal && invoiceTotal > 0) {
    status = 'paid';
  } else if (amountPaid > 0) {
    status = 'partially_paid';
  } else {
    status = 'issued';
  }

  // Overdue check only applies if not fully paid.
  if (status !== 'paid' && options.dueDate) {
    const due = new Date(options.dueDate);
    const today = options.today ?? new Date();
    if (due.getTime() < startOfDay(today).getTime()) {
      status = 'overdue';
    }
  }

  return { amountPaid, balanceDue, status };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
