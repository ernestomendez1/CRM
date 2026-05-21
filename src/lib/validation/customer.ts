import { z } from 'zod';

export const taxIdTypes = ['rnc', 'cedula', 'passport', 'other'] as const;
export type TaxIdType = (typeof taxIdTypes)[number];

const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(200),
  company_name: optionalText,
  tax_id_type: z.enum(taxIdTypes).optional(),
  tax_id: z.string().trim().max(40).optional().or(z.literal('').transform(() => undefined)),
  email: z
    .string()
    .trim()
    .email('Invalid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: optionalText,
  address: z.string().trim().max(500).optional().or(z.literal('').transform(() => undefined)),
  city: optionalText,
  country: optionalText.transform((v) => v ?? 'DO'),
  notes: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
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
