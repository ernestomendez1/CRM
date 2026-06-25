import 'server-only';

import { revalidatePath } from 'next/cache';
import type { Locale } from '@/i18n/config';
import { getAssistantCopy } from '@/lib/assistant/copy';
import { planAssistantTool } from '@/lib/assistant/openai';
import {
  prepareCreateCustomerArgsSchema,
  prepareCreateExpenseArgsSchema,
  prepareCreateProductArgsSchema,
  searchCustomersArgsSchema,
  searchExpensesArgsSchema,
  searchProductsArgsSchema,
} from '@/lib/assistant/schemas';
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantExecuteResponse,
  AssistantPendingAction,
} from '@/lib/assistant/types';
import type { CurrentContext } from '@/lib/auth/session';
import { loadBusinessDefaults, type BusinessDefaults } from '@/lib/domain/business';
import { createCustomerRecord, searchCustomers } from '@/lib/domain/customers';
import { createExpenseRecord, searchExpenses } from '@/lib/domain/expenses';
import { createProductRecord, searchProducts } from '@/lib/domain/products';
import { customerSchema } from '@crm/contracts/customer';
import { expenseSchema } from '@crm/contracts/expense';
import { productSchema } from '@crm/contracts/product';

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNumber(value: number | string | null | undefined) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function asFieldLabel(locale: Locale, field: string) {
  const labels = {
    en: {
      name: 'name',
      unit_price: 'unit price',
      vendor_name: 'vendor name',
      expense_date: 'expense date',
      subtotal: 'subtotal',
      email: 'email',
    },
    es: {
      name: 'nombre',
      unit_price: 'precio unitario',
      vendor_name: 'suplidor',
      expense_date: 'fecha del gasto',
      subtotal: 'subtotal',
      email: 'correo electrónico',
    },
  } as const;

  return labels[locale]?.[field as keyof (typeof labels)['en']] ?? field;
}

function buildMissingFieldsMessage(
  locale: Locale,
  action: AssistantPendingAction['type'],
  fields: string[],
): AssistantChatResponse {
  const copy = getAssistantCopy(locale);
  return {
    ok: true,
    type: 'clarification',
    message: copy.missingFields(
      action,
      fields.map((field) => asFieldLabel(locale, field)),
    ),
    missingFields: fields,
  };
}

function buildValidationErrorMessage(
  locale: Locale,
  fieldErrors: Record<string, string[] | undefined>,
): AssistantChatResponse {
  const copy = getAssistantCopy(locale);
  const invalidFields = Object.keys(fieldErrors);
  return {
    ok: true,
    type: 'clarification',
    message: copy.invalidFields(invalidFields.map((field) => asFieldLabel(locale, field))),
    missingFields: invalidFields,
  };
}

export function prepareCreateProductAction(args: {
  locale: Locale;
  raw: unknown;
}): AssistantChatResponse {
  const parsed = prepareCreateProductArgsSchema.safeParse(args.raw);
  if (!parsed.success) {
    return buildValidationErrorMessage(args.locale, parsed.error.flatten().fieldErrors);
  }

  const draft = {
    name: normalizeText(parsed.data.name),
    description: normalizeText(parsed.data.description),
    unit_price: normalizeNumber(parsed.data.unit_price),
    is_taxable: parsed.data.is_taxable ?? true,
    tax_rate_override:
      parsed.data.tax_rate_override == null ? undefined : normalizeNumber(parsed.data.tax_rate_override),
    type: parsed.data.type ?? 'service',
    sku: normalizeText(parsed.data.sku),
    is_active: parsed.data.is_active ?? true,
  };

  if (!draft.name) {
    return buildMissingFieldsMessage(args.locale, 'create_product', ['name']);
  }

  const validated = productSchema.safeParse(draft);
  if (!validated.success) {
    return buildValidationErrorMessage(args.locale, validated.error.flatten().fieldErrors);
  }

  const copy = getAssistantCopy(args.locale);
  return {
    ok: true,
    type: 'pending_action',
    message: copy.pendingMessage('create_product'),
    pendingAction: {
      type: 'create_product',
      payload: validated.data,
      summary: copy.summaries.product(validated.data),
      warnings: [],
    },
  };
}

export function prepareCreateCustomerAction(args: {
  locale: Locale;
  raw: unknown;
  message?: string;
}): AssistantChatResponse {
  const parsed = prepareCreateCustomerArgsSchema.safeParse(args.raw);
  if (!parsed.success) {
    return buildValidationErrorMessage(args.locale, parsed.error.flatten().fieldErrors);
  }

  const inferred = inferCustomerFieldsFromMessage(args.message);

  const draft = {
    name: normalizeText(parsed.data.name) ?? inferred.name,
    company_name: normalizeText(parsed.data.company_name),
    tax_id_type: parsed.data.tax_id_type,
    tax_id: normalizeText(parsed.data.tax_id) ?? inferred.taxId,
    email: normalizeText(parsed.data.email),
    phone: normalizeText(parsed.data.phone),
    address: normalizeText(parsed.data.address),
    city: normalizeText(parsed.data.city),
    country: normalizeText(parsed.data.country),
    notes: normalizeText(parsed.data.notes),
    is_active: parsed.data.is_active ?? true,
  };

  if (!draft.name) {
    return buildMissingFieldsMessage(args.locale, 'create_customer', ['name']);
  }

  const validated = customerSchema.safeParse(draft);
  if (!validated.success) {
    return buildValidationErrorMessage(args.locale, validated.error.flatten().fieldErrors);
  }

  const copy = getAssistantCopy(args.locale);
  return {
    ok: true,
    type: 'pending_action',
    message: copy.pendingMessage('create_customer'),
    pendingAction: {
      type: 'create_customer',
      payload: validated.data,
      summary: copy.summaries.customer(validated.data),
      warnings: [],
    },
  };
}

export function prepareCreateExpenseAction(args: {
  locale: Locale;
  defaults: BusinessDefaults;
  raw: unknown;
}): AssistantChatResponse {
  const parsed = prepareCreateExpenseArgsSchema.safeParse(args.raw);
  if (!parsed.success) {
    return buildValidationErrorMessage(args.locale, parsed.error.flatten().fieldErrors);
  }

  const warnings: string[] = [];
  const currency = normalizeText(parsed.data.currency)?.toUpperCase() ?? args.defaults.defaultCurrency;
  if (!normalizeText(parsed.data.currency)) {
    warnings.push(getAssistantCopy(args.locale).defaults.expenseCurrency(args.defaults.defaultCurrency));
  }

  const draft = {
    vendor_name: normalizeText(parsed.data.vendor_name),
    vendor_tax_id: normalizeText(parsed.data.vendor_tax_id),
    expense_date: normalizeText(parsed.data.expense_date),
    category: normalizeText(parsed.data.category),
    description: normalizeText(parsed.data.description),
    subtotal: normalizeNumber(parsed.data.subtotal),
    tax_amount: normalizeNumber(parsed.data.tax_amount) ?? 0,
    currency,
    has_fiscal_receipt: parsed.data.has_fiscal_receipt ?? false,
    fiscal_receipt_number: normalizeText(parsed.data.fiscal_receipt_number),
    payment_method: parsed.data.payment_method,
  };

  if (!draft.vendor_name) {
    return buildMissingFieldsMessage(args.locale, 'create_expense', ['vendor_name']);
  }

  const validated = expenseSchema.safeParse(draft);
  if (!validated.success) {
    return buildValidationErrorMessage(args.locale, validated.error.flatten().fieldErrors);
  }

  const copy = getAssistantCopy(args.locale);
  return {
    ok: true,
    type: 'pending_action',
    message: copy.pendingMessage('create_expense'),
    pendingAction: {
      type: 'create_expense',
      payload: validated.data,
      summary: copy.summaries.expense(validated.data),
      warnings,
    },
  };
}

export async function handleAssistantChat(
  request: AssistantChatRequest & { locale: Locale },
  ctx: CurrentContext,
  defaults?: BusinessDefaults,
): Promise<AssistantChatResponse> {
  const businessDefaults = defaults ?? (await loadBusinessDefaults(ctx));
  const copy = getAssistantCopy(request.locale);
  const plan = await planAssistantTool({
    locale: request.locale,
    businessDefaults,
    message: request.message,
    history: request.history ?? [],
  });

  if (!plan.ok) {
    const message =
      plan.errorCode === 'missing_api_key'
        ? copy.unavailable
        : plan.errorCode === 'provider_quota'
          ? copy.quota
          : plan.errorCode === 'invalid_response'
            ? copy.invalidResponse
            : copy.providerError;

    return {
      ok: false,
      errorCode: plan.errorCode,
      message,
    };
  }

  if (!plan.toolCall) {
    return {
      ok: true,
      type: 'message',
      message: plan.message ?? copy.unsupported,
    };
  }

  switch (plan.toolCall.name) {
    case 'prepare_create_product':
      return prepareCreateProductAction({ locale: request.locale, raw: plan.toolCall.arguments });
    case 'prepare_create_customer':
      return prepareCreateCustomerAction({
        locale: request.locale,
        raw: plan.toolCall.arguments,
        message: request.message,
      });
    case 'prepare_create_expense':
      return prepareCreateExpenseAction({
        locale: request.locale,
        defaults: businessDefaults,
        raw: plan.toolCall.arguments,
      });
    case 'search_products': {
      const parsed = searchProductsArgsSchema.safeParse(plan.toolCall.arguments);
      if (!parsed.success) {
        return buildValidationErrorMessage(request.locale, parsed.error.flatten().fieldErrors);
      }
      const items = await searchProducts(ctx, { query: parsed.data.query });
      const results = { entity: 'products' as const, items };
      return {
        ok: true,
        type: 'search_results',
        message: copy.searchMessage(results, parsed.data.query),
        results,
      };
    }
    case 'search_customers': {
      const parsed = searchCustomersArgsSchema.safeParse(plan.toolCall.arguments);
      if (!parsed.success) {
        return buildValidationErrorMessage(request.locale, parsed.error.flatten().fieldErrors);
      }
      const items = await searchCustomers(ctx, { query: parsed.data.query });
      const results = { entity: 'customers' as const, items };
      return {
        ok: true,
        type: 'search_results',
        message: copy.searchMessage(results, parsed.data.query),
        results,
      };
    }
    case 'search_expenses': {
      const parsed = searchExpensesArgsSchema.safeParse(plan.toolCall.arguments);
      if (!parsed.success) {
        return buildValidationErrorMessage(request.locale, parsed.error.flatten().fieldErrors);
      }
      const items = await searchExpenses(ctx, {
        query: parsed.data.query,
        from: normalizeText(parsed.data.from),
        to: normalizeText(parsed.data.to),
        hasFiscalReceipt: parsed.data.has_fiscal_receipt,
      });
      const results = { entity: 'expenses' as const, items };
      return {
        ok: true,
        type: 'search_results',
        message: copy.searchMessage(results, parsed.data.query),
        results,
      };
    }
    default:
      return {
        ok: true,
        type: 'message',
        message: copy.unsupported,
      };
  }
}

export async function executePendingAction(args: {
  locale: Locale;
  ctx: CurrentContext;
  pendingAction: AssistantPendingAction;
}): Promise<AssistantExecuteResponse> {
  const copy = getAssistantCopy(args.locale);

  try {
    switch (args.pendingAction.type) {
      case 'create_product': {
        const created = await createProductRecord(args.ctx, args.pendingAction.payload);
        revalidatePath('/products');
        return {
          ok: true,
          message: copy.created('products', created.name),
          record: {
            entity: 'products',
            id: created.id,
            label: created.name,
            path: `/products/${created.id}`,
          },
        };
      }
      case 'create_customer': {
        const created = await createCustomerRecord(args.ctx, args.pendingAction.payload);
        revalidatePath('/customers');
        return {
          ok: true,
          message: copy.created('customers', created.name),
          record: {
            entity: 'customers',
            id: created.id,
            label: created.name,
            path: `/customers/${created.id}`,
          },
        };
      }
      case 'create_expense': {
        const created = await createExpenseRecord(args.ctx, args.pendingAction.payload);
        revalidatePath('/expenses');
        return {
          ok: true,
          message: copy.created('expenses', created.vendor_name),
          record: {
            entity: 'expenses',
            id: created.id,
            label: created.vendor_name,
            path: `/expenses/${created.id}`,
          },
        };
      }
    }
  } catch (error) {
    return {
      ok: false,
      errorCode: 'mutation_failed',
      message: error instanceof Error ? error.message : copy.providerError,
    };
  }
}

function inferCustomerFieldsFromMessage(message: string | undefined) {
  const source = message?.trim();
  if (!source) {
    return { name: undefined, taxId: undefined };
  }

  const cleaned = source
    .replace(
      /^(create|add|new|make|register|crear|agregar|nuevo|nueva|registrar)\s+(this\s+)?(customer|cliente)\b[:\s-]*/i,
      '',
    )
    .replace(/^(customer|cliente)\b[:\s-]*/i, '')
    .trim();

  const taxIdMatch = cleaned.match(/\b\d[\d-]{5,}\d\b/);
  const taxId = taxIdMatch?.[0]?.trim();

  let remainder = cleaned;
  if (taxIdMatch && taxId) {
    remainder = `${cleaned.slice(0, taxIdMatch.index)} ${cleaned.slice((taxIdMatch.index ?? 0) + taxId.length)}`
      .replace(/\s+/g, ' ')
      .trim();
  }

  remainder = remainder.replace(/^(named|called|name|nombre)\s+/i, '').trim();

  return {
    name: remainder || undefined,
    taxId: taxId || undefined,
  };
}
