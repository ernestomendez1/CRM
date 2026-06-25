import { eq } from 'drizzle-orm';
import { businesses } from '@crm/db/schema';
import type { Ctx } from '../middleware/auth';
import { getDb } from '../lib/db';

export type BusinessDefaults = {
  businessName: string;
  defaultCurrency: string;
  defaultTaxRate: number;
  defaultPaymentTermsDays: number;
};

export async function loadBusinessDefaults(ctx: Ctx): Promise<BusinessDefaults> {
  const db = getDb();
  const rows = await db
    .select({
      name: businesses.name,
      defaultCurrency: businesses.defaultCurrency,
      defaultTaxRate: businesses.defaultTaxRate,
      defaultPaymentTermsDays: businesses.defaultPaymentTermsDays,
    })
    .from(businesses)
    .where(eq(businesses.id, ctx.businessId))
    .limit(1);

  const row = rows[0];
  return {
    businessName: row?.name?.trim() || 'CRM business',
    defaultCurrency: row?.defaultCurrency?.trim().toUpperCase() || 'DOP',
    defaultTaxRate: Number(row?.defaultTaxRate ?? '0.18'),
    defaultPaymentTermsDays: Number(row?.defaultPaymentTermsDays ?? 30),
  };
}
