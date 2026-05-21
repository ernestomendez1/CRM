import { describe, expect, it, vi } from 'vitest';
import { createCustomerRecord, searchCustomers } from '@/lib/domain/customers';
import { createExpenseRecord } from '@/lib/domain/expenses';
import { createProductRecord } from '@/lib/domain/products';

const ctx = {
  userId: 'user-1',
  email: 'owner@example.com',
  businessId: 'business-1',
  role: 'owner',
};

function makeInsertClient<T extends Record<string, unknown>>(table: string, data: T) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn((name: string) => {
    expect(name).toBe(table);
    return { insert };
  });

  return { client: { from }, from, insert, select, single };
}

function makeCustomerSearchClient(data: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    or: vi.fn().mockResolvedValue({ data, error: null }),
  };
  const from = vi.fn(() => chain);
  return { client: { from }, chain };
}

describe('domain services', () => {
  it('creates products through the shared service with business scoping', async () => {
    const mock = makeInsertClient('products', { id: 'product-1', name: 'Adobe CC' });

    const created = await createProductRecord(
      ctx,
      {
        name: 'Adobe CC',
        description: 'Subscription',
        unit_price: 42.55,
        is_taxable: true,
        type: 'service',
        is_active: true,
      },
      mock.client as never,
    );

    expect(created).toEqual({ id: 'product-1', name: 'Adobe CC' });
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: 'business-1',
        created_by: 'user-1',
        unit_price: 42.55,
      }),
    );
  });

  it('creates customers through the shared service with business scoping', async () => {
    const mock = makeInsertClient('customers', { id: 'customer-1', name: 'Acme' });

    const created = await createCustomerRecord(
      ctx,
      {
        name: 'Acme',
        company_name: 'Acme Inc',
        country: 'DO',
        is_active: true,
      },
      mock.client as never,
    );

    expect(created).toEqual({ id: 'customer-1', name: 'Acme' });
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: 'business-1',
        created_by: 'user-1',
      }),
    );
  });

  it('computes expense totals in the shared creation service', async () => {
    const mock = makeInsertClient('expenses', { id: 'expense-1', vendor_name: 'JetBrains' });

    const created = await createExpenseRecord(
      ctx,
      {
        vendor_name: 'JetBrains',
        expense_date: '2026-05-20',
        subtotal: 100,
        tax_amount: 18,
        currency: 'DOP',
        has_fiscal_receipt: false,
      },
      { client: mock.client as never },
    );

    expect(created).toEqual({ id: 'expense-1', vendor_name: 'JetBrains' });
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 118,
        business_id: 'business-1',
      }),
    );
  });

  it('searches customers inside the current business', async () => {
    const mock = makeCustomerSearchClient([
      {
        id: 'customer-1',
        name: 'Acme',
        company_name: 'Acme Inc',
        tax_id: '101010101',
        email: 'billing@acme.test',
        phone: null,
        is_active: true,
      },
    ]);

    const results = await searchCustomers(
      ctx,
      { query: 'acme' },
      mock.client as never,
    );

    expect(results).toHaveLength(1);
    expect(mock.chain.eq).toHaveBeenCalledWith('business_id', 'business-1');
    expect(mock.chain.eq).toHaveBeenCalledWith('is_active', true);
    expect(mock.chain.or).toHaveBeenCalledWith(
      expect.stringContaining('name.ilike.%acme%'),
    );
  });
});
