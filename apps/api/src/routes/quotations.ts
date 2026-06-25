import { Hono } from 'hono';
import { quotationSchema, quotationStatuses } from '@crm/contracts/quotation';
import {
  changeQuotationStatus,
  convertQuotationToInvoice,
  createQuotation,
  getQuotationDetail,
  listQuotations,
  softDeleteQuotation,
  updateQuotation,
} from '../domain/quotations';
import { notFoundError, validationError } from '../lib/errors';
import { created, noContent, ok } from '../lib/responses';
import { type AuthEnv, getCtx } from '../middleware/auth';

const route = new Hono<AuthEnv>();

route.get('/', async (c) => {
  const ctx = getCtx(c);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') ?? undefined;
  const statusParam = url.searchParams.get('status');
  const status =
    statusParam && (quotationStatuses as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof quotationStatuses)[number])
      : undefined;
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '25')));

  const result = await listQuotations(ctx, { q, status, page, size });
  return ok(c, { ...result, page, size });
});

route.get('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const detail = await getQuotationDetail(ctx, id);
  if (!detail) throw notFoundError('Quotation not found');
  return ok(c, detail);
});

route.post('/', async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = quotationSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  const result = await createQuotation(ctx, parsed.data);
  return created(c, result);
});

route.put('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = quotationSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  const result = await updateQuotation(ctx, id, parsed.data);
  return ok(c, result);
});

route.patch('/:id/status', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const status = String(body?.status ?? '');
  if (!(quotationStatuses as readonly string[]).includes(status)) {
    throw validationError('Invalid status');
  }
  await changeQuotationStatus(ctx, id, status as (typeof quotationStatuses)[number]);
  return noContent(c);
});

route.delete('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  await softDeleteQuotation(ctx, id);
  return noContent(c);
});

route.post('/:id/convert', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const result = await convertQuotationToInvoice(ctx, id);
  return created(c, result);
});

export { route as quotationsRoute };
