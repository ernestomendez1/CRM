import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { products } from '@crm/db/schema';
import { productSchema } from '@crm/contracts/product';
import {
  createProductRecord,
  productInputToRow,
  searchProducts,
} from '../domain/products';
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
    eq(products.businessId, ctx.businessId),
    isNull(products.deletedAt),
  ];
  if (!includeInactive) conditions.push(eq(products.isActive, true));
  if (q) {
    const term = `%${q}%`;
    conditions.push(or(ilike(products.name, term), ilike(products.sku, term))!);
  }

  const whereClause = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        type: products.type,
        unit_price: products.unitPrice,
        is_taxable: products.isTaxable,
        is_active: products.isActive,
      })
      .from(products)
      .where(whereClause)
      .orderBy(products.name)
      .limit(size)
      .offset((page - 1) * size),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
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
  const results = await searchProducts(ctx, {
    query: q,
    limit,
    includeInactive,
  });
  return ok(c, results);
});

route.get('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const db = getDb();
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.businessId, ctx.businessId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFoundError('Product not found');
  return ok(c, row);
});

route.post('/', async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError('Validation failed', parsed.error.flatten().fieldErrors);
  }
  const result = await createProductRecord(ctx, parsed.data);
  return created(c, result);
});

route.put('/:id', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError('Validation failed', parsed.error.flatten().fieldErrors);
  }
  const db = getDb();
  const updated = await db
    .update(products)
    .set(productInputToRow(parsed.data))
    .where(and(eq(products.id, id), eq(products.businessId, ctx.businessId)))
    .returning({ id: products.id });
  if (updated.length === 0) throw notFoundError('Product not found');
  return ok(c, { id });
});

route.patch('/:id/deactivate', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const db = getDb();
  const updated = await db
    .update(products)
    .set({ isActive: false, deletedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.businessId, ctx.businessId)))
    .returning({ id: products.id });
  if (updated.length === 0) throw notFoundError('Product not found');
  return noContent(c);
});

route.patch('/:id/reactivate', async (c) => {
  const ctx = getCtx(c);
  const id = c.req.param('id');
  const db = getDb();
  const updated = await db
    .update(products)
    .set({ isActive: true, deletedAt: null })
    .where(and(eq(products.id, id), eq(products.businessId, ctx.businessId)))
    .returning({ id: products.id });
  if (updated.length === 0) throw notFoundError('Product not found');
  return noContent(c);
});

export { route as productsRoute };
