import { Hono } from 'hono';
import { expenseSchema } from '@crm/contracts/expense';
import {
  clearExpenseReceiptUrl,
  createExpenseRecord,
  deleteReceiptFile,
  getExpenseById,
  getExpenseReceiptPath,
  listExpenses,
  RECEIPT_BUCKET,
  softDeleteExpense,
  updateExpenseRecord,
  uploadReceiptFile,
} from '../domain/expenses';
import { notFoundError, validationError } from '../lib/errors';
import { created, noContent, ok } from '../lib/responses';
import { getSupabaseStorage } from '../lib/supabase-storage';
import { type AuthEnv, getCtx } from '../middleware/auth';

const route = new Hono<AuthEnv>();

route.get('/', async (c) => {
  const ctx = getCtx(c);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') ?? undefined;
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const fiscalParam = url.searchParams.get('fiscal');
  const hasFiscalReceipt =
    fiscalParam === 'yes' ? true : fiscalParam === 'no' ? false : undefined;
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '25')));

  const result = await listExpenses(ctx, { q, from, to, hasFiscalReceipt, page, size });
  return ok(c, { ...result, page, size });
});

route.get('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const row = await getExpenseById(ctx, id);
  if (!row) throw notFoundError('Expense not found');
  return ok(c, row);
});

/**
 * Parse a FormData containing both ExpenseInput JSON fields AND an
 * optional `receipt` file part. Returns the parsed expense input plus
 * the file (or null).
 */
async function parseExpenseFormData(c: import('hono').Context): Promise<{
  input: import('zod').z.infer<typeof expenseSchema>;
  receipt: File | null;
}> {
  const form = await c.req.formData();
  const rawObj: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key === 'receipt') continue;
    if (typeof value === 'string') rawObj[key] = value;
  }
  // Coerce booleans like the form does
  rawObj.has_fiscal_receipt =
    rawObj.has_fiscal_receipt === 'on' || rawObj.has_fiscal_receipt === 'true';
  if (!rawObj.currency) rawObj.currency = 'DOP';

  const parsed = expenseSchema.safeParse(rawObj);
  if (!parsed.success) {
    throw validationError(
      'Validation failed',
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  const file = form.get('receipt');
  const receipt =
    file instanceof File && file.size > 0 ? (file as File) : null;
  return { input: parsed.data, receipt };
}

route.post('/', async (c) => {
  const ctx = getCtx(c);
  const { input, receipt } = await parseExpenseFormData(c);
  let receiptPath: string | null = null;
  if (receipt) {
    receiptPath = await uploadReceiptFile(ctx.businessId, receipt);
  }
  try {
    const result = await createExpenseRecord(ctx, input, receiptPath);
    return created(c, result);
  } catch (err) {
    if (receiptPath) await deleteReceiptFile(receiptPath);
    throw err;
  }
});

route.put('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const { input, receipt } = await parseExpenseFormData(c);

  let newReceiptPath: string | null | undefined = undefined;
  let oldReceiptPath: string | null = null;
  if (receipt) {
    oldReceiptPath = await getExpenseReceiptPath(ctx, id);
    newReceiptPath = await uploadReceiptFile(ctx.businessId, receipt);
  }

  try {
    const result = await updateExpenseRecord(ctx, id, input, newReceiptPath);
    if (oldReceiptPath) await deleteReceiptFile(oldReceiptPath);
    return ok(c, result);
  } catch (err) {
    if (newReceiptPath) await deleteReceiptFile(newReceiptPath);
    throw err;
  }
});

route.delete('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  await softDeleteExpense(ctx, id);
  return noContent(c);
});

route.delete('/:id/receipt', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const path = await getExpenseReceiptPath(ctx, id);
  if (path) await deleteReceiptFile(path);
  await clearExpenseReceiptUrl(ctx, id);
  return noContent(c);
});

route.post('/:id/receipt-url', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const path = await getExpenseReceiptPath(ctx, id);
  if (!path) return ok(c, { signedUrl: null });
  const storage = getSupabaseStorage();
  const { data, error } = await storage.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, 60 * 5);
  if (error) return ok(c, { signedUrl: null });
  return ok(c, { signedUrl: data.signedUrl });
});

export { route as expensesRoute };
