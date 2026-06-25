import { z } from 'zod';

export const expensePaymentMethods = ['cash', 'transfer', 'card', 'credit', 'other'] as const;
export type ExpensePaymentMethod = (typeof expensePaymentMethods)[number];

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const optionalText = (max = 255) =>
  z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

export const expenseSchema = z.object({
  vendor_name: z.string().trim().min(1, 'Required').max(200),
  vendor_tax_id: optionalText(40),
  expense_date: dateString,
  category: optionalText(100),
  description: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  subtotal: z.coerce.number().min(0).max(99_999_999),
  tax_amount: z.coerce.number().min(0).max(99_999_999).default(0),
  currency: z.string().trim().length(3).default('DOP'),
  has_fiscal_receipt: z.boolean().default(false),
  fiscal_receipt_number: optionalText(60),
  payment_method: z.enum(expensePaymentMethods).optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export type Expense = {
  id: string;
  business_id: string;
  vendor_name: string;
  vendor_tax_id: string | null;
  expense_date: string;
  category: string | null;
  description: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  has_fiscal_receipt: boolean;
  fiscal_receipt_number: string | null;
  receipt_file_url: string | null;
  payment_method: ExpensePaymentMethod | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
