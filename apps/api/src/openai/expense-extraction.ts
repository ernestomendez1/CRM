import { env } from '../lib/env';
import {
  canExtractExpenseReceipt,
  normalizeExpenseExtraction,
  rawExpenseExtractionSchema,
  type ExpenseExtractionDraft,
  type ExpenseExtractionWarningCode,
} from './expense-extraction-schema';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_FILES_URL = 'https://api.openai.com/v1/files';

export type ExpenseExtractionErrorCode =
  | 'invalid_file'
  | 'unsupported_type'
  | 'missing_api_key'
  | 'provider_quota'
  | 'provider_error'
  | 'invalid_response';

export type ExpenseExtractionResult =
  | {
      ok: true;
      extracted: ExpenseExtractionDraft;
      warnings: ExpenseExtractionWarningCode[];
    }
  | { ok: false; errorCode: ExpenseExtractionErrorCode };

type OpenAiResponsesResult = {
  output_text?: string;
  error?: { message?: string };
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

type OpenAiFileUploadResult = { id: string };

function buildJsonSchema() {
  const nullable = (type: 'string' | 'number' | 'boolean') => ({
    anyOf: [{ type }, { type: 'null' }],
  });
  return {
    type: 'object',
    properties: {
      vendor_name: nullable('string'),
      vendor_tax_id: nullable('string'),
      expense_date: nullable('string'),
      category: nullable('string'),
      description: nullable('string'),
      subtotal: nullable('number'),
      tax_amount: nullable('number'),
      currency: nullable('string'),
      has_fiscal_receipt: nullable('boolean'),
      fiscal_receipt_number: nullable('string'),
    },
    required: [
      'vendor_name',
      'vendor_tax_id',
      'expense_date',
      'category',
      'description',
      'subtotal',
      'tax_amount',
      'currency',
      'has_fiscal_receipt',
      'fiscal_receipt_number',
    ],
    additionalProperties: false,
  };
}

function buildPrompt() {
  return [
    'Extract objective accounting fields from a single expense receipt or PDF.',
    'Return null for any field that is not clearly visible.',
    'Return a short expense category when it can be reasonably inferred from the merchant or charge concept, such as Software, Travel, Office, Utilities, Banking, Taxes, or Professional Services.',
    'Return a short description that captures the concept of the charge when the receipt clearly states it.',
    'Never guess payment method.',
    'Output expense_date as YYYY-MM-DD when visible.',
    'Output currency as a 3-letter ISO code when visible.',
    'If an NCF or fiscal receipt number is visible, include it and set has_fiscal_receipt true.',
    'If the document only shows a total and no separate tax amount, set subtotal to that visible total and tax_amount to 0.',
    'If tax is not visible but subtotal is visible, set tax_amount to 0.',
  ].join(' ');
}

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString('base64');
}

async function uploadOpenAiFile(file: File, apiKey: string) {
  const formData = new FormData();
  formData.append('purpose', 'user_data');
  formData.append('file', file, file.name || 'expense-receipt.pdf');
  const response = await fetch(OPENAI_FILES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  let payload: OpenAiFileUploadResult | { error?: { message?: string } };
  try {
    payload = (await response.json()) as OpenAiFileUploadResult | { error?: { message?: string } };
  } catch {
    console.error('Expense extraction file upload error: non-JSON response');
    return null;
  }
  if (!response.ok || !('id' in payload) || !payload.id) {
    console.error('Expense extraction file upload error:', payload);
    return null;
  }
  return payload.id;
}

async function deleteOpenAiFile(fileId: string, apiKey: string) {
  try {
    await fetch(`${OPENAI_FILES_URL}/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    console.error('Expense extraction file cleanup failed for', fileId);
  }
}

async function buildUserContent(file: File, apiKey: string) {
  if (file.type === 'application/pdf') {
    const fileId = await uploadOpenAiFile(file, apiKey);
    if (!fileId) return { ok: false as const };
    return {
      ok: true as const,
      content: [
        { type: 'input_file', file_id: fileId },
        { type: 'input_text', text: 'Extract expense receipt fields from this PDF.' },
      ],
      cleanupFileId: fileId as string | null,
    };
  }
  const base64Data = await fileToBase64(file);
  return {
    ok: true as const,
    content: [
      { type: 'input_image', image_url: `data:${file.type};base64,${base64Data}` },
      { type: 'input_text', text: 'Extract expense receipt fields from this image.' },
    ],
    cleanupFileId: null as string | null,
  };
}

function getOutputText(payload: OpenAiResponsesResult) {
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

export async function extractExpenseFromReceipt(
  file: File,
  options: { defaultCurrency: string },
): Promise<ExpenseExtractionResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errorCode: 'invalid_file' };
  }
  if (!canExtractExpenseReceipt(file.type)) {
    return { ok: false, errorCode: 'unsupported_type' };
  }
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, errorCode: 'missing_api_key' };

  const contentResult = await buildUserContent(file, apiKey);
  if (!contentResult.ok) return { ok: false, errorCode: 'provider_error' };

  const body = {
    model: env.OPENAI_EXPENSE_MODEL ?? 'gpt-4o',
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: buildPrompt() }],
      },
      { role: 'user', content: contentResult.content },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'expense_receipt_extraction',
        schema: buildJsonSchema(),
        strict: true,
      },
    },
  };

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    let payload: OpenAiResponsesResult;
    try {
      payload = (await response.json()) as OpenAiResponsesResult;
    } catch {
      console.error('Expense extraction provider error: non-JSON response');
      return { ok: false, errorCode: 'provider_error' };
    }
    if (!response.ok) {
      const message = payload.error?.message ?? '';
      console.error('Expense extraction provider error:', message || payload);
      if (message.toLowerCase().includes('exceeded your current quota')) {
        return { ok: false, errorCode: 'provider_quota' };
      }
      return { ok: false, errorCode: 'provider_error' };
    }
    const outputText = getOutputText(payload);
    if (!outputText) return { ok: false, errorCode: 'invalid_response' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return { ok: false, errorCode: 'invalid_response' };
    }
    const normalized = rawExpenseExtractionSchema.safeParse(parsed);
    if (!normalized.success) return { ok: false, errorCode: 'invalid_response' };
    const result = normalizeExpenseExtraction(normalized.data, options);
    return { ok: true, extracted: result.extracted, warnings: result.warnings };
  } finally {
    if (contentResult.cleanupFileId) {
      await deleteOpenAiFile(contentResult.cleanupFileId, apiKey);
    }
  }
}
