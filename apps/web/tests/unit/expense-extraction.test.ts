import { describe, expect, it } from 'vitest';
import { normalizeExpenseExtraction } from '@/lib/ai/expense-extraction';

describe('normalizeExpenseExtraction', () => {
  it('uses the business default currency when the model does not return one', () => {
    const result = normalizeExpenseExtraction(
      {
        vendor_name: 'Office Depot',
        vendor_tax_id: null,
        expense_date: '2026-05-21',
        category: null,
        description: null,
        subtotal: 100,
        tax_amount: 18,
        currency: null,
        has_fiscal_receipt: false,
        fiscal_receipt_number: null,
      },
      { defaultCurrency: 'DOP' },
    );

    expect(result.extracted.currency).toBe('DOP');
    expect(result.warnings).toContain('currency_defaulted');
  });

  it('sets tax to zero when subtotal exists but tax is missing', () => {
    const result = normalizeExpenseExtraction(
      {
        vendor_name: 'Adobe',
        vendor_tax_id: null,
        expense_date: '2026-05-21',
        category: 'Software',
        description: 'Creative Cloud subscription',
        subtotal: 42.55,
        tax_amount: null,
        currency: 'usd',
        has_fiscal_receipt: false,
        fiscal_receipt_number: null,
      },
      { defaultCurrency: 'DOP' },
    );

    expect(result.extracted.subtotal).toBe(42.55);
    expect(result.extracted.tax_amount).toBe(0);
    expect(result.extracted.category).toBe('Software');
    expect(result.extracted.description).toBe('Creative Cloud subscription');
    expect(result.warnings).toContain('tax_missing_set_zero');
  });

  it('infers fiscal receipt from the receipt number even when the boolean is false', () => {
    const result = normalizeExpenseExtraction(
      {
        vendor_name: 'Proveedor',
        vendor_tax_id: '101010101',
        expense_date: '2026-05-21',
        category: 'Professional Services',
        description: 'Certificado digital',
        subtotal: 2500,
        tax_amount: 0,
        currency: 'dop',
        has_fiscal_receipt: false,
        fiscal_receipt_number: 'B0100000005',
      },
      { defaultCurrency: 'USD' },
    );

    expect(result.extracted.has_fiscal_receipt).toBe(true);
    expect(result.extracted.fiscal_receipt_number).toBe('B0100000005');
    expect(result.warnings).toContain('fiscal_receipt_inferred_from_number');
  });

  it('preserves nulls for fields that cannot be confidently extracted', () => {
    const result = normalizeExpenseExtraction(
      {
        vendor_name: null,
        vendor_tax_id: null,
        expense_date: '05/21/2026',
        category: null,
        description: null,
        subtotal: null,
        tax_amount: null,
        currency: '',
        has_fiscal_receipt: null,
        fiscal_receipt_number: null,
      },
      { defaultCurrency: 'EUR' },
    );

    expect(result.extracted.vendor_name).toBeNull();
    expect(result.extracted.expense_date).toBeNull();
    expect(result.extracted.category).toBeNull();
    expect(result.extracted.description).toBeNull();
    expect(result.extracted.subtotal).toBeNull();
    expect(result.extracted.tax_amount).toBeNull();
    expect(result.extracted.currency).toBe('EUR');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'vendor_name_missing',
        'expense_date_missing',
        'subtotal_missing',
        'currency_defaulted',
      ]),
    );
  });
});
