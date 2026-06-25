import { describe, expect, it } from 'vitest';
import {
  prepareCreateCustomerAction,
  prepareCreateExpenseAction,
  prepareCreateProductAction,
} from '@/lib/assistant/service';

describe('assistant preparation logic', () => {
  it('prepares a validated product action from structured args', () => {
    const response = prepareCreateProductAction({
      locale: 'en',
      raw: {
        name: 'Adobe Creative Cloud',
        unit_price: '42.55',
        is_taxable: true,
        type: 'service',
      },
    });

    expect(response.ok).toBe(true);
    if (!response.ok || response.type !== 'pending_action') {
      throw new Error('Expected a pending action');
    }
    if (response.pendingAction.type !== 'create_product') {
      throw new Error('Expected a product action');
    }
    expect(response.pendingAction.type).toBe('create_product');
    expect(response.pendingAction.payload.unit_price).toBe(42.55);
    expect(response.pendingAction.payload.type).toBe('service');
  });

  it('asks for missing required expense fields instead of guessing', () => {
    const response = prepareCreateExpenseAction({
      locale: 'en',
      defaults: {
        businessName: 'CRM',
        defaultCurrency: 'DOP',
        defaultTaxRate: 0.18,
        defaultPaymentTermsDays: 30,
      },
      raw: {
        vendor_name: 'JetBrains',
        subtotal: '120',
      },
    });

    expect(response.ok).toBe(true);
    if (!response.ok || response.type !== 'clarification') {
      throw new Error('Expected a clarification response');
    }
    expect(response.missingFields).toContain('expense_date');
  });

  it('applies the business default expense currency when the user omits it', () => {
    const response = prepareCreateExpenseAction({
      locale: 'en',
      defaults: {
        businessName: 'CRM',
        defaultCurrency: 'DOP',
        defaultTaxRate: 0.18,
        defaultPaymentTermsDays: 30,
      },
      raw: {
        vendor_name: 'JetBrains',
        expense_date: '2026-05-21',
        subtotal: '120',
      },
    });

    expect(response.ok).toBe(true);
    if (!response.ok || response.type !== 'pending_action') {
      throw new Error('Expected a pending action');
    }
    if (response.pendingAction.type !== 'create_expense') {
      throw new Error('Expected an expense action');
    }
    expect(response.pendingAction.payload.currency).toBe('DOP');
    expect(response.pendingAction.warnings[0]).toContain('DOP');
  });

  it('recovers customer name and tax id from the raw message when the model misses the split', () => {
    const response = prepareCreateCustomerAction({
      locale: 'en',
      raw: {
        tax_id: '101-60539-1',
      },
      message: 'Create this customer 101-60539-1 HISPIZZA SA',
    });

    expect(response.ok).toBe(true);
    if (!response.ok || response.type !== 'pending_action') {
      throw new Error('Expected a pending action');
    }
    if (response.pendingAction.type !== 'create_customer') {
      throw new Error('Expected a customer action');
    }

    expect(response.pendingAction.payload.tax_id).toBe('101-60539-1');
    expect(response.pendingAction.payload.name).toBe('HISPIZZA SA');
  });
});
