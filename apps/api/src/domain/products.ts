import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { products, type NewProduct } from '@crm/db/schema';
import type { ProductInput } from '@crm/contracts/product';
import type { Ctx } from '../middleware/auth';
import { getDb } from '../lib/db';

export type ProductSearchResult = {
  id: string;
  name: string;
  sku: string | null;
  type: string;
  unit_price: string;
  is_taxable: boolean;
  is_active: boolean;
};

function toRow(input: ProductInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    unitPrice: String(input.unit_price),
    isTaxable: input.is_taxable,
    taxRateOverride:
      input.tax_rate_override != null ? String(input.tax_rate_override) : null,
    type: input.type,
    sku: input.sku ?? null,
    isActive: input.is_active,
  };
}

export async function createProductRecord(
  ctx: Ctx,
  input: ProductInput,
): Promise<{ id: string; name: string }> {
  const db = getDb();
  const insert: NewProduct = {
    ...toRow(input),
    businessId: ctx.businessId,
    createdBy: ctx.userId,
  };
  const [created] = await db
    .insert(products)
    .values(insert)
    .returning({ id: products.id, name: products.name });
  if (!created) throw new Error('Insert returned no row');
  return created;
}

export async function searchProducts(
  ctx: Ctx,
  params: { query: string; limit?: number; includeInactive?: boolean },
): Promise<ProductSearchResult[]> {
  const db = getDb();
  const term = `%${params.query.trim()}%`;
  const conditions = [
    eq(products.businessId, ctx.businessId),
    isNull(products.deletedAt),
    or(ilike(products.name, term), ilike(products.sku, term)),
  ];
  if (!params.includeInactive) {
    conditions.push(eq(products.isActive, true));
  }
  const rows = await db
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
    .where(and(...conditions))
    .orderBy(products.name)
    .limit(params.limit ?? 5);
  return rows;
}

export { products as productsTable, toRow as productInputToRow };
