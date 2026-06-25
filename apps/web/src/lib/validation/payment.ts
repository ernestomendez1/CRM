import { z } from 'zod';

export const paymentMethods = ['cash', 'transfer', 'check', 'card', 'other'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const paymentSchema = z.object({
  invoice_id: z.string().uuid(),
  payment_date: dateString,
  amount: z.coerce.number().positive('Must be > 0').max(999_999_999),
  method: z.enum(paymentMethods),
  reference: z.string().trim().max(200).optional().or(z.literal('').transform(() => undefined)),
  notes: z.string().trim().max(1000).optional().or(z.literal('').transform(() => undefined)),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export type Payment = {
  id: string;
  business_id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
};
