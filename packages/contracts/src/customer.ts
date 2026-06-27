import { z } from 'zod';

export const taxIdTypes = ['rnc', 'cedula', 'passport', 'other'] as const;
export type TaxIdType = (typeof taxIdTypes)[number];

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const optionalText = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(255).optional(),
);

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(200),
  company_name: optionalText,
  tax_id_type: z.preprocess(emptyToUndefined, z.enum(taxIdTypes).optional()),
  tax_id: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email('Invalid email').optional()),
  phone: optionalText,
  address: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  city: optionalText,
  country: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(255).optional().transform((v) => v ?? 'DO'),
  ),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  is_active: z.boolean().default(true),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export type Customer = CustomerInput & {
  id: string;
  business_id: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
