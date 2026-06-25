import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import {
  customers,
  invoices,
  payments,
  quotations,
  type NewCustomer,
} from '@crm/db/schema';
import type { CustomerInput, TaxIdType } from '@crm/contracts/customer';
import type { Ctx } from '../middleware/auth';
import { getDb } from '../lib/db';

export type CustomerSearchResult = {
  id: string;
  name: string;
  company_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  tax_id_type: TaxIdType | null;
};

function toRow(input: CustomerInput) {
  return {
    name: input.name,
    companyName: input.company_name ?? null,
    taxId: input.tax_id ?? null,
    taxIdType: input.tax_id_type ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    country: input.country ?? 'DO',
    notes: input.notes ?? null,
    isActive: input.is_active,
  };
}

export async function createCustomerRecord(
  ctx: Ctx,
  input: CustomerInput,
): Promise<{ id: string; name: string }> {
  const db = getDb();
  const insert: NewCustomer = {
    ...toRow(input),
    businessId: ctx.businessId,
    createdBy: ctx.userId,
  };
  const [created] = await db
    .insert(customers)
    .values(insert)
    .returning({ id: customers.id, name: customers.name });
  if (!created) throw new Error('Insert returned no row');
  return created;
}

export async function searchCustomers(
  ctx: Ctx,
  params: { query: string; limit?: number; includeInactive?: boolean },
): Promise<CustomerSearchResult[]> {
  const db = getDb();
  const term = `%${params.query.trim()}%`;
  const conditions = [
    eq(customers.businessId, ctx.businessId),
    isNull(customers.deletedAt),
    or(
      ilike(customers.name, term),
      ilike(customers.companyName, term),
      ilike(customers.taxId, term),
    ),
  ];
  if (!params.includeInactive) conditions.push(eq(customers.isActive, true));
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      company_name: customers.companyName,
      tax_id: customers.taxId,
      email: customers.email,
      phone: customers.phone,
      is_active: customers.isActive,
      tax_id_type: customers.taxIdType,
    })
    .from(customers)
    .where(and(...conditions))
    .orderBy(customers.name)
    .limit(params.limit ?? 5);
  return rows as CustomerSearchResult[];
}

export async function customerOverview(ctx: Ctx, customerId: string) {
  const db = getDb();
  const [customerRows, quotationRows, invoiceRows, paymentRows] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(
        and(eq(customers.id, customerId), eq(customers.businessId, ctx.businessId)),
      )
      .limit(1),
    db
      .select({
        id: quotations.id,
        quotation_number: quotations.quotationNumber,
        issue_date: quotations.issueDate,
        status: quotations.status,
        total: quotations.total,
        currency: quotations.currency,
      })
      .from(quotations)
      .where(
        and(
          eq(quotations.businessId, ctx.businessId),
          eq(quotations.customerId, customerId),
          isNull(quotations.deletedAt),
        ),
      )
      .orderBy(desc(quotations.issueDate)),
    db
      .select({
        id: invoices.id,
        invoice_number: invoices.invoiceNumber,
        issue_date: invoices.issueDate,
        due_date: invoices.dueDate,
        status: invoices.status,
        total: invoices.total,
        balance_due: invoices.balanceDue,
        currency: invoices.currency,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.businessId, ctx.businessId),
          eq(invoices.customerId, customerId),
          isNull(invoices.deletedAt),
        ),
      )
      .orderBy(desc(invoices.issueDate)),
    db
      .select({
        id: payments.id,
        payment_date: payments.paymentDate,
        amount: payments.amount,
        method: payments.method,
        reference: payments.reference,
        invoice: {
          id: invoices.id,
          invoice_number: invoices.invoiceNumber,
        },
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(
        and(
          eq(payments.businessId, ctx.businessId),
          eq(invoices.customerId, customerId),
          isNull(payments.deletedAt),
        ),
      )
      .orderBy(desc(payments.paymentDate)),
  ]);

  const customer = customerRows[0];
  if (!customer) return null;
  return {
    customer,
    quotations: quotationRows,
    invoices: invoiceRows,
    payments: paymentRows,
  };
}

export { customers as customersTable, toRow as customerInputToRow };
