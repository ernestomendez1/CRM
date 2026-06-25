import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { expenses, type NewExpense } from '@crm/db/schema';
import type { ExpenseInput } from '@crm/contracts/expense';
import type { Ctx } from '../middleware/auth';
import { getDb } from '../lib/db';
import { conflictError, notFoundError, validationError } from '../lib/errors';
import { getSupabaseStorage } from '../lib/supabase-storage';

export const RECEIPT_BUCKET = 'expense-receipts';
const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'application/pdf',
]);
const MAX_BYTES = 10 * 1024 * 1024;

function toRow(input: ExpenseInput) {
  const total = input.subtotal + input.tax_amount;
  return {
    vendorName: input.vendor_name,
    vendorTaxId: input.vendor_tax_id ?? null,
    expenseDate: input.expense_date,
    category: input.category ?? null,
    description: input.description ?? null,
    subtotal: String(input.subtotal),
    taxAmount: String(input.tax_amount),
    total: String(total),
    currency: input.currency,
    hasFiscalReceipt: input.has_fiscal_receipt,
    fiscalReceiptNumber: input.fiscal_receipt_number ?? null,
    paymentMethod: input.payment_method ?? null,
  };
}

export async function uploadReceiptFile(
  businessId: string,
  file: File,
): Promise<string> {
  if (!ALLOWED_MIMES.has(file.type)) {
    throw validationError(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_BYTES) {
    throw validationError('File exceeds 10 MB');
  }
  const ext = file.name.includes('.')
    ? (file.name.split('.').pop() ?? 'bin').toLowerCase()
    : 'bin';
  const path = `${businessId}/${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = getSupabaseStorage();
  const { error } = await storage.storage
    .from(RECEIPT_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) throw validationError(`Upload failed: ${error.message}`);
  return path;
}

export async function deleteReceiptFile(path: string): Promise<void> {
  const storage = getSupabaseStorage();
  await storage.storage.from(RECEIPT_BUCKET).remove([path]);
}

export async function createExpenseRecord(
  ctx: Ctx,
  input: ExpenseInput,
  receiptFileUrl: string | null = null,
): Promise<{ id: string; vendor_name: string }> {
  const db = getDb();
  const insert: NewExpense = {
    ...toRow(input),
    receiptFileUrl,
    businessId: ctx.businessId,
    createdBy: ctx.userId,
  };
  const [created] = await db
    .insert(expenses)
    .values(insert)
    .returning({ id: expenses.id, vendor_name: expenses.vendorName });
  if (!created) throw new Error('Insert returned no row');
  return created;
}

export async function updateExpenseRecord(
  ctx: Ctx,
  id: string,
  input: ExpenseInput,
  newReceiptFileUrl?: string | null,
): Promise<{ id: string }> {
  const db = getDb();
  const update: Partial<NewExpense> = toRow(input);
  if (newReceiptFileUrl !== undefined) {
    update.receiptFileUrl = newReceiptFileUrl;
  }
  const updated = await db
    .update(expenses)
    .set(update)
    .where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)))
    .returning({ id: expenses.id });
  if (updated.length === 0) throw notFoundError('Expense not found');
  return { id };
}

export async function getExpenseReceiptPath(
  ctx: Ctx,
  id: string,
): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ receiptFileUrl: expenses.receiptFileUrl })
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)))
    .limit(1);
  if (rows.length === 0) throw notFoundError('Expense not found');
  return rows[0]?.receiptFileUrl ?? null;
}

export async function clearExpenseReceiptUrl(ctx: Ctx, id: string): Promise<void> {
  const db = getDb();
  await db
    .update(expenses)
    .set({ receiptFileUrl: null })
    .where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)));
}

export async function softDeleteExpense(ctx: Ctx, id: string): Promise<void> {
  const db = getDb();
  const updated = await db
    .update(expenses)
    .set({ deletedAt: new Date() })
    .where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)))
    .returning({ id: expenses.id });
  if (updated.length === 0) throw notFoundError('Expense not found');
}

export type ExpenseSearchResult = {
  id: string;
  vendor_name: string;
  vendor_tax_id: string | null;
  expense_date: string;
  category: string | null;
  total: string;
  currency: string;
  has_fiscal_receipt: boolean;
  fiscal_receipt_number: string | null;
};

export async function searchExpenses(
  ctx: Ctx,
  params: {
    query: string;
    from?: string;
    to?: string;
    hasFiscalReceipt?: boolean;
    limit?: number;
  },
): Promise<ExpenseSearchResult[]> {
  const db = getDb();
  const term = `%${params.query.trim()}%`;
  const conditions = [
    eq(expenses.businessId, ctx.businessId),
    isNull(expenses.deletedAt),
    or(
      ilike(expenses.vendorName, term),
      ilike(expenses.fiscalReceiptNumber, term),
    ),
  ];
  if (params.from) conditions.push(gte(expenses.expenseDate, params.from));
  if (params.to) conditions.push(lte(expenses.expenseDate, params.to));
  if (typeof params.hasFiscalReceipt === 'boolean') {
    conditions.push(eq(expenses.hasFiscalReceipt, params.hasFiscalReceipt));
  }
  return await db
    .select({
      id: expenses.id,
      vendor_name: expenses.vendorName,
      vendor_tax_id: expenses.vendorTaxId,
      expense_date: expenses.expenseDate,
      category: expenses.category,
      total: expenses.total,
      currency: expenses.currency,
      has_fiscal_receipt: expenses.hasFiscalReceipt,
      fiscal_receipt_number: expenses.fiscalReceiptNumber,
    })
    .from(expenses)
    .where(and(...conditions))
    .orderBy(desc(expenses.expenseDate))
    .limit(params.limit ?? 5);
}

export type ExpenseListRow = ExpenseSearchResult;

export async function listExpenses(
  ctx: Ctx,
  params: {
    q?: string;
    from?: string;
    to?: string;
    hasFiscalReceipt?: boolean;
    page: number;
    size: number;
  },
): Promise<{ rows: ExpenseListRow[]; count: number }> {
  const db = getDb();
  const conditions = [
    eq(expenses.businessId, ctx.businessId),
    isNull(expenses.deletedAt),
  ];
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(expenses.vendorName, term),
        ilike(expenses.fiscalReceiptNumber, term),
      )!,
    );
  }
  if (params.from) conditions.push(gte(expenses.expenseDate, params.from));
  if (params.to) conditions.push(lte(expenses.expenseDate, params.to));
  if (typeof params.hasFiscalReceipt === 'boolean') {
    conditions.push(eq(expenses.hasFiscalReceipt, params.hasFiscalReceipt));
  }
  const whereClause = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: expenses.id,
        vendor_name: expenses.vendorName,
        vendor_tax_id: expenses.vendorTaxId,
        expense_date: expenses.expenseDate,
        category: expenses.category,
        total: expenses.total,
        currency: expenses.currency,
        has_fiscal_receipt: expenses.hasFiscalReceipt,
        fiscal_receipt_number: expenses.fiscalReceiptNumber,
      })
      .from(expenses)
      .where(whereClause)
      .orderBy(desc(expenses.expenseDate))
      .limit(params.size)
      .offset((params.page - 1) * params.size),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(expenses)
      .where(whereClause),
  ]);

  return { rows, count: countRows[0]?.count ?? 0 };
}

export async function getExpenseById(ctx: Ctx, id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row;
}
