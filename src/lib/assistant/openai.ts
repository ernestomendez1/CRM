import 'server-only';

import type { Locale } from '@/i18n/config';
import type { BusinessDefaults } from '@/lib/domain/business';
import type { AssistantHistoryMessage } from '@/lib/assistant/types';
import { getAssistantCopy } from '@/lib/assistant/copy';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_ASSISTANT_MODEL = 'gpt-5';

export type AssistantOpenAiErrorCode =
  | 'missing_api_key'
  | 'provider_quota'
  | 'provider_error'
  | 'invalid_response';

export type AssistantToolName =
  | 'prepare_create_product'
  | 'prepare_create_customer'
  | 'prepare_create_expense'
  | 'search_products'
  | 'search_customers'
  | 'search_expenses';

export type AssistantToolCall = {
  name: AssistantToolName;
  arguments: Record<string, unknown>;
};

type AssistantToolPlanResult =
  | { ok: true; toolCall: AssistantToolCall | null; message: string | null }
  | { ok: false; errorCode: AssistantOpenAiErrorCode };

type OpenAiResponsePayload = {
  output_text?: string;
  error?: { message?: string };
  output?: Array<{
    type?: string;
    name?: string;
    arguments?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function getAssistantModel() {
  return process.env.OPENAI_ASSISTANT_MODEL?.trim() || DEFAULT_OPENAI_ASSISTANT_MODEL;
}

function buildTools() {
  return [
    {
      type: 'function',
      name: 'prepare_create_product',
      description: 'Prepare a product or service creation request.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          unit_price: { type: ['number', 'string', 'null'] },
          is_taxable: { type: 'boolean' },
          tax_rate_override: { type: ['number', 'string', 'null'] },
          type: { type: 'string', enum: ['product', 'service'] },
          sku: { type: ['string', 'null'] },
          is_active: { type: 'boolean' },
        },
        required: [],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'prepare_create_customer',
      description:
        'Prepare a customer creation request. If the user provides a tax ID and a business or person name in the same phrase, separate them into tax_id and name.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: ['string', 'null'] },
          company_name: { type: ['string', 'null'] },
          tax_id_type: { type: 'string', enum: ['rnc', 'cedula', 'passport', 'other'] },
          tax_id: { type: ['string', 'null'] },
          email: { type: ['string', 'null'] },
          phone: { type: ['string', 'null'] },
          address: { type: ['string', 'null'] },
          city: { type: ['string', 'null'] },
          country: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'] },
          is_active: { type: 'boolean' },
        },
        required: [],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'prepare_create_expense',
      description: 'Prepare an expense creation request.',
      parameters: {
        type: 'object',
        properties: {
          vendor_name: { type: ['string', 'null'] },
          vendor_tax_id: { type: ['string', 'null'] },
          expense_date: { type: ['string', 'null'] },
          category: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
          subtotal: { type: ['number', 'string', 'null'] },
          tax_amount: { type: ['number', 'string', 'null'] },
          currency: { type: ['string', 'null'] },
          has_fiscal_receipt: { type: 'boolean' },
          fiscal_receipt_number: { type: ['string', 'null'] },
          payment_method: { type: 'string', enum: ['cash', 'transfer', 'card', 'credit', 'other'] },
        },
        required: [],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'search_products',
      description: 'Search existing active products or services by name or SKU.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'search_customers',
      description: 'Search existing active customers by name, company, or tax ID.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'search_expenses',
      description: 'Search existing expenses by vendor name or fiscal receipt number.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          from: { type: ['string', 'null'] },
          to: { type: ['string', 'null'] },
          has_fiscal_receipt: { type: 'boolean' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  ];
}

function getOutputText(payload: OpenAiResponsePayload) {
  if (payload.output_text) return payload.output_text;

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  return null;
}

function getToolCall(payload: OpenAiResponsePayload): AssistantToolCall | null {
  const item = (payload.output ?? []).find(
    (entry) => entry.type === 'function_call' && typeof entry.name === 'string',
  );

  if (!item || !item.name) return null;

  let parsedArguments: Record<string, unknown> = {};
  try {
    parsedArguments = item.arguments ? (JSON.parse(item.arguments) as Record<string, unknown>) : {};
  } catch {
    throw new Error('invalid_tool_arguments');
  }

  return {
    name: item.name as AssistantToolName,
    arguments: parsedArguments,
  };
}

export async function planAssistantTool(args: {
  locale: Locale;
  businessDefaults: BusinessDefaults;
  message: string;
  history: AssistantHistoryMessage[];
}): Promise<AssistantToolPlanResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, errorCode: 'missing_api_key' };
  }

  const copy = getAssistantCopy(args.locale);
  const input = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: copy.systemPrompt(args.businessDefaults) }],
    },
    ...args.history.map((entry) => ({
      role: entry.role,
      content: [{ type: entry.role === 'assistant' ? 'output_text' : 'input_text', text: entry.content }],
    })),
    {
      role: 'user',
      content: [{ type: 'input_text', text: args.message }],
    },
  ];

  const body = JSON.stringify({
    model: getAssistantModel(),
    input,
    tools: buildTools(),
    parallel_tool_calls: false,
    tool_choice: 'auto',
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      let payload: OpenAiResponsePayload;
      try {
        payload = (await response.json()) as OpenAiResponsePayload;
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return { ok: false, errorCode: 'provider_error' };
      }

      if (!response.ok) {
        const message = payload.error?.message?.toLowerCase() ?? '';
        console.error('[assistant] OpenAI error', response.status, JSON.stringify(payload));
        if (message.includes('exceeded your current quota')) {
          return { ok: false, errorCode: 'provider_quota' };
        }
        if (response.status >= 500 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return { ok: false, errorCode: 'provider_error' };
      }

      let toolCall: AssistantToolCall | null = null;
      try {
        toolCall = getToolCall(payload);
      } catch {
        return { ok: false, errorCode: 'invalid_response' };
      }

      const message = getOutputText(payload);
      if (!toolCall && !message) {
        return { ok: false, errorCode: 'invalid_response' };
      }

      return { ok: true, toolCall, message };
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return { ok: false, errorCode: 'provider_error' };
    }
  }

  return { ok: false, errorCode: 'provider_error' };
}
