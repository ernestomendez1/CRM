import { z } from 'zod';
import { customerSchema, taxIdTypes } from '@crm/contracts/customer';
import { expensePaymentMethods, expenseSchema } from '@crm/contracts/expense';
import { productSchema, productTypes } from '@crm/contracts/product';
import { defaultLocale, locales } from './locale';

const nullableText = z.string().trim().nullable().optional();
const localeSchema = z.enum(locales);
const flexibleNumber = z.union([z.number(), z.string()]);

export const assistantChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(24)
    .optional()
    .default([]),
  locale: localeSchema.optional().default(defaultLocale),
});

export const assistantPendingActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_product'),
    summary: z.string().trim().min(1),
    warnings: z.array(z.string()).default([]),
    payload: productSchema,
  }),
  z.object({
    type: z.literal('create_customer'),
    summary: z.string().trim().min(1),
    warnings: z.array(z.string()).default([]),
    payload: customerSchema,
  }),
  z.object({
    type: z.literal('create_expense'),
    summary: z.string().trim().min(1),
    warnings: z.array(z.string()).default([]),
    payload: expenseSchema,
  }),
]);

export const assistantExecuteRequestSchema = z.object({
  pendingAction: assistantPendingActionSchema,
  locale: localeSchema.optional().default(defaultLocale),
});

export const prepareCreateProductArgsSchema = z.object({
  name: nullableText,
  description: nullableText,
  unit_price: flexibleNumber.optional(),
  is_taxable: z.boolean().optional(),
  tax_rate_override: z.union([flexibleNumber, z.null()]).optional(),
  type: z.enum(productTypes).optional(),
  sku: nullableText,
  is_active: z.boolean().optional(),
});

export const prepareCreateCustomerArgsSchema = z.object({
  name: nullableText,
  company_name: nullableText,
  tax_id_type: z.enum(taxIdTypes).optional(),
  tax_id: nullableText,
  email: nullableText,
  phone: nullableText,
  address: nullableText,
  city: nullableText,
  country: nullableText,
  notes: nullableText,
  is_active: z.boolean().optional(),
});

export const prepareCreateExpenseArgsSchema = z.object({
  vendor_name: nullableText,
  vendor_tax_id: nullableText,
  expense_date: nullableText,
  category: nullableText,
  description: nullableText,
  subtotal: flexibleNumber.optional(),
  tax_amount: flexibleNumber.optional(),
  currency: nullableText,
  has_fiscal_receipt: z.boolean().optional(),
  fiscal_receipt_number: nullableText,
  payment_method: z.enum(expensePaymentMethods).optional(),
});

export const searchProductsArgsSchema = z.object({
  query: z.string().trim().min(1).max(200),
});

export const searchCustomersArgsSchema = z.object({
  query: z.string().trim().min(1).max(200),
});

export const searchExpensesArgsSchema = z.object({
  query: z.string().trim().min(1).max(200),
  from: nullableText,
  to: nullableText,
  has_fiscal_receipt: z.boolean().optional(),
});
