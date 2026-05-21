import { z } from 'zod';

const optionalText = (max = 255) =>
  z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(200),
  legal_name: optionalText(200),
  tax_id: optionalText(40),
  email: z
    .string()
    .trim()
    .email('Invalid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: optionalText(40),
  address: optionalText(500),
  city: optionalText(100),
  country: optionalText(2).transform((v) => v ?? 'DO'),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const taxSettingsSchema = z.object({
  default_currency: z.string().trim().length(3).toUpperCase(),
  default_tax_rate: z.coerce.number().min(0).max(1),
  default_payment_terms_days: z.coerce.number().int().min(0).max(365),
});
export type TaxSettingsInput = z.infer<typeof taxSettingsSchema>;

export const numberingSchema = z.object({
  invoice_prefix: z.string().trim().max(10).default('INV-'),
  invoice_next_number: z.coerce.number().int().min(1),
  quotation_prefix: z.string().trim().max(10).default('QUO-'),
  quotation_next_number: z.coerce.number().int().min(1),
});
export type NumberingInput = z.infer<typeof numberingSchema>;

export const pdfSettingsSchema = z.object({
  primary_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use #rrggbb')
    .default('#1a1a1a'),
  footer_text: z.string().trim().max(500).optional().or(z.literal('').transform(() => undefined)),
  show_logo: z.boolean().default(true),
});
export type PdfSettingsInput = z.infer<typeof pdfSettingsSchema>;
