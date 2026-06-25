import { z } from 'zod';

export const productTypes = ['product', 'service'] as const;
export type ProductType = (typeof productTypes)[number];

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalRate = z
  .preprocess((v) => {
    if (v === '' || v == null) return undefined;
    if (typeof v === 'string') {
      const n = Number.parseFloat(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return v;
  }, z.number().min(0).max(1).optional());

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  unit_price: z.preprocess((v) => {
    if (typeof v === 'string') return Number.parseFloat(v);
    return v;
  }, z.number().min(0).max(99_999_999)),
  is_taxable: z.boolean().default(true),
  tax_rate_override: optionalRate,
  type: z.enum(productTypes).default('service'),
  sku: optionalText,
  is_active: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  unit_price: number;
  is_taxable: boolean;
  tax_rate_override: number | null;
  type: ProductType;
  sku: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
