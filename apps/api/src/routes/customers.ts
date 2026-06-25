import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { customers } from '@crm/db/schema';
import { customerSchema } from '@crm/contracts/customer';
import {
  createCustomerRecord,
  customerInputToRow,
  customerOverview,
  searchCustomers,
} from '../domain/customers';
import { getDb } from '../lib/db';
import { notFoundError, validationError } from '../lib/errors';
import { created, noContent, ok } from '../lib/responses';
import { type AuthEnv, getCtx } from '../middleware/auth';

const route = new Hono<AuthEnv>();

route.get('/', async (c) => {
  const ctx = getCtx(c);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '25')));
  const includeInactive = url.searchParams.get('inactive') === '1';

  const db = getDb();
  const conditions = [
    eq(customers.businessId, ctx.businessId),
    isNull(customers.deletedAt),
  ];
  if (!includeInactive) conditions.push(eq(customers.isActive, true));
  if (q) {
    const term = `%${q}%`;
    conditions.push(
      or(
        ilike(customers.name, term),
        ilike(customers.companyName, term),
        ilike(customers.taxId, term),
      )!,
    );
  }
  const whereClause = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        company_name: customers.companyName,
        tax_id: customers.taxId,
        email: customers.email,
        phone: customers.phone,
        is_active: customers.isActive,
      })
      .from(customers)
      .where(whereClause)
      .orderBy(customers.name)
      .limit(size)
      .offset((page - 1) * size),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(whereClause),
  ]);

  return ok(c, { rows, count: countRows[0]?.count ?? 0, page, size });
});

route.get('/search', async (c) => {
  const ctx = getCtx(c);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') ?? '';
  if (!q.trim()) return ok(c, []);
  const limit = Number(url.searchParams.get('limit') ?? '5');
  const includeInactive = url.searchParams.get('inactive') === '1';
  const results = await searchCustomers(ctx, { query: q, limit, includeInactive });
  return ok(c, results);
});

route.get('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const db = getDb();
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.businessId, ctx.businessId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFoundError('Customer not found');
  return ok(c, row);
});

route.get('/:id/overview', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const overview = await customerOverview(ctx, id);
  if (!overview) throw notFoundError('Customer not found');
  return ok(c, overview);
});

route.post('/', async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError('Validation failed', parsed.error.flatten().fieldErrors);
  }
  const result = await createCustomerRecord(ctx, parsed.data);
  return created(c, result);
});

route.put('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError('Validation failed', parsed.error.flatten().fieldErrors);
  }
  const db = getDb();
  const updated = await db
    .update(customers)
    .set(customerInputToRow(parsed.data))
    .where(and(eq(customers.id, id), eq(customers.businessId, ctx.businessId)))
    .returning({ id: customers.id });
  if (updated.length === 0) throw notFoundError('Customer not found');
  return ok(c, { id });
});

route.patch('/:id/deactivate', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const db = getDb();
  const updated = await db
    .update(customers)
    .set({ isActive: false, deletedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.businessId, ctx.businessId)))
    .returning({ id: customers.id });
  if (updated.length === 0) throw notFoundError('Customer not found');
  return noContent(c);
});

route.patch('/:id/reactivate', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const db = getDb();
  const updated = await db
    .update(customers)
    .set({ isActive: true, deletedAt: null })
    .where(and(eq(customers.id, id), eq(customers.businessId, ctx.businessId)))
    .returning({ id: customers.id });
  if (updated.length === 0) throw notFoundError('Customer not found');
  return noContent(c);
});

export { route as customersRoute };
