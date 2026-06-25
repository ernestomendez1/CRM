import { describe, expect, it } from 'vitest';
import {
  applyPayments,
  calculateLine,
  calculateTotals,
  roundMoney,
} from '../src/money/calc';
import { formatMoney, formatPercent } from '../src/money/format';

describe('roundMoney (banker\'s)', () => {
  it('rounds halfway to even', () => {
    expect(roundMoney(2.5, 0)).toBe(2);
    expect(roundMoney(3.5, 0)).toBe(4);
    expect(roundMoney(0.125, 2)).toBe(0.12);
    expect(roundMoney(0.135, 2)).toBe(0.14);
  });

  it('rounds non-halfway normally', () => {
    expect(roundMoney(2.51, 0)).toBe(3);
    expect(roundMoney(2.49, 0)).toBe(2);
    expect(roundMoney(1.005, 2)).toBe(1.0);
  });

  it('handles whole numbers', () => {
    expect(roundMoney(100, 2)).toBe(100);
    expect(roundMoney(0, 2)).toBe(0);
  });

  it('rejects non-finite', () => {
    expect(() => roundMoney(Infinity)).toThrow();
    expect(() => roundMoney(Number.NaN)).toThrow();
  });
});

describe('calculateLine', () => {
  it('computes a simple taxed line', () => {
    const r = calculateLine({ quantity: 2, unitPrice: 100, taxRate: 0.18 });
    expect(r.lineSubtotal).toBe(200);
    expect(r.lineTax).toBe(36);
    expect(r.lineDiscount).toBe(0);
    expect(r.lineTotal).toBe(236);
  });

  it('applies per-line discount before tax (acceptance example)', () => {
    // qty=2, unit_price=100, discount=10%, tax=18%
    // gross=200, discount=20, subtotal=180, tax=32.40, total=212.40
    const r = calculateLine({
      quantity: 2,
      unitPrice: 100,
      discountPct: 0.1,
      taxRate: 0.18,
    });
    expect(r.lineDiscount).toBe(20);
    expect(r.lineSubtotal).toBe(180);
    expect(r.lineTax).toBe(32.4);
    expect(r.lineTotal).toBe(212.4);
  });

  it('handles tax-exempt lines', () => {
    const r = calculateLine({ quantity: 1, unitPrice: 50, taxRate: 0 });
    expect(r.lineTax).toBe(0);
    expect(r.lineTotal).toBe(50);
  });

  it('handles fractional quantities', () => {
    const r = calculateLine({ quantity: 1.5, unitPrice: 10, taxRate: 0.18 });
    expect(r.lineSubtotal).toBe(15);
    expect(r.lineTax).toBe(2.7);
    expect(r.lineTotal).toBe(17.7);
  });

  it('returns zeros for zero quantity', () => {
    const r = calculateLine({ quantity: 0, unitPrice: 100, taxRate: 0.18 });
    expect(r.lineSubtotal).toBe(0);
    expect(r.lineTax).toBe(0);
    expect(r.lineTotal).toBe(0);
  });

  it('rejects negative quantity, unit price, and out-of-range fractions', () => {
    expect(() => calculateLine({ quantity: -1, unitPrice: 10 })).toThrow();
    expect(() => calculateLine({ quantity: 1, unitPrice: -10 })).toThrow();
    expect(() => calculateLine({ quantity: 1, unitPrice: 10, discountPct: 1.5 })).toThrow();
    expect(() => calculateLine({ quantity: 1, unitPrice: 10, taxRate: 1.5 })).toThrow();
    expect(() => calculateLine({ quantity: 1, unitPrice: 10, discountPct: -0.1 })).toThrow();
  });

  it('rounds tax per-line (not on the document total)', () => {
    // 33.333 * 0.18 = 6.0  exactly per line, but the document subtotal might
    // not be a tidy multiple. Two lines at 33.33 each * 0.18:
    // per-line: 33.33 → tax 6.00 (rounded from 5.9994)
    // sum: 12.00
    // vs document-level: 66.66 * 0.18 = 11.9988 → 12.00
    // For this case both agree; the point is the per-line rule is what we enforce.
    const r = calculateLine({ quantity: 1, unitPrice: 33.33, taxRate: 0.18 });
    expect(r.lineTax).toBe(6); // 33.33 * 0.18 = 5.9994 → 6.00
  });
});

describe('calculateTotals', () => {
  it('sums multiple lines correctly', () => {
    const totals = calculateTotals([
      { quantity: 2, unitPrice: 100, taxRate: 0.18 }, // sub 200 tax 36
      { quantity: 1, unitPrice: 50, taxRate: 0.18 },  // sub 50  tax 9
    ]);
    expect(totals.subtotal).toBe(250);
    expect(totals.taxTotal).toBe(45);
    expect(totals.total).toBe(295);
    expect(totals.discountTotal).toBe(0);
    expect(totals.lines).toHaveLength(2);
  });

  it('handles mixed tax + exempt lines', () => {
    const totals = calculateTotals([
      { quantity: 1, unitPrice: 100, taxRate: 0.18 }, // sub 100 tax 18
      { quantity: 1, unitPrice: 50, taxRate: 0 },     // sub 50  tax 0
    ]);
    expect(totals.subtotal).toBe(150);
    expect(totals.taxTotal).toBe(18);
    expect(totals.total).toBe(168);
  });

  it('sums discounts across lines', () => {
    const totals = calculateTotals([
      { quantity: 2, unitPrice: 100, discountPct: 0.1, taxRate: 0.18 },
      { quantity: 1, unitPrice: 50, discountPct: 0.2, taxRate: 0 },
    ]);
    // line 1: discount 20, sub 180, tax 32.40
    // line 2: discount 10, sub 40,  tax 0
    expect(totals.discountTotal).toBe(30);
    expect(totals.subtotal).toBe(220);
    expect(totals.taxTotal).toBe(32.4);
    expect(totals.total).toBe(252.4);
  });

  it('empty document is zero', () => {
    const totals = calculateTotals([]);
    expect(totals.subtotal).toBe(0);
    expect(totals.taxTotal).toBe(0);
    expect(totals.total).toBe(0);
  });

  it('avoids float drift across many lines', () => {
    const lines = Array.from({ length: 100 }, () => ({
      quantity: 1,
      unitPrice: 0.1,
      taxRate: 0,
    }));
    const totals = calculateTotals(lines);
    expect(totals.subtotal).toBe(10); // exactly 100 × 0.10
    expect(totals.total).toBe(10);
  });
});

describe('applyPayments', () => {
  const total = 10000;

  it('issues by default with no payments', () => {
    expect(applyPayments(total, []).status).toBe('issued');
    expect(applyPayments(total, []).amountPaid).toBe(0);
    expect(applyPayments(total, []).balanceDue).toBe(total);
  });

  it('marks partially_paid after a partial payment', () => {
    const r = applyPayments(total, [{ amount: 4000 }]);
    expect(r.amountPaid).toBe(4000);
    expect(r.balanceDue).toBe(6000);
    expect(r.status).toBe('partially_paid');
  });

  it('marks paid when fully covered', () => {
    const r = applyPayments(total, [{ amount: 4000 }, { amount: 6000 }]);
    expect(r.amountPaid).toBe(10000);
    expect(r.balanceDue).toBe(0);
    expect(r.status).toBe('paid');
  });

  it('clamps balanceDue at zero for overpayments', () => {
    const r = applyPayments(total, [{ amount: 11000 }]);
    expect(r.balanceDue).toBe(0);
    expect(r.status).toBe('paid');
  });

  it('marks overdue when past due and unpaid', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const r = applyPayments(total, [], { dueDate: yesterday });
    expect(r.status).toBe('overdue');
  });

  it('does not mark overdue if fully paid', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const r = applyPayments(total, [{ amount: total }], { dueDate: yesterday });
    expect(r.status).toBe('paid');
  });

  it('respects draft/cancelled invoice statuses', () => {
    expect(applyPayments(total, [], { currentStatus: 'draft' }).status).toBe('draft');
    expect(applyPayments(total, [], { currentStatus: 'cancelled' }).status).toBe('cancelled');
  });

  it('reverts to issued when payment is deleted', () => {
    const r = applyPayments(total, []);
    expect(r.status).toBe('issued');
  });
});

describe('formatters', () => {
  it('formats DOP currency', () => {
    const out = formatMoney(1234.5, { currency: 'DOP', locale: 'en-US' });
    expect(out).toContain('1,234.50');
  });

  it('formats percent', () => {
    expect(formatPercent(0.18)).toBe('18%');
    expect(formatPercent(0.185)).toMatch(/18\.5/);
  });
});
