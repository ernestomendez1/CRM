import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  canExtractExpenseReceipt,
  type ExpenseExtractionWarningCode,
} from '@/lib/ai/expense-extraction';
import { extractExpenseFromReceipt } from '@/lib/openai/expense-extraction';

export const dynamic = 'force-dynamic';

type ExtractExpenseResponse =
  | {
      ok: true;
      extracted: {
        vendor_name: string | null;
        vendor_tax_id: string | null;
        expense_date: string | null;
        category: string | null;
        description: string | null;
        subtotal: number | null;
        tax_amount: number | null;
        currency: string;
        has_fiscal_receipt: boolean;
        fiscal_receipt_number: string | null;
      };
      warnings: ExpenseExtractionWarningCode[];
    }
  | { ok: false; errorCode: string };

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) {
    return Response.json({ ok: false, errorCode: 'unauthorized' } satisfies ExtractExpenseResponse, {
      status: 401,
    });
  }

  const formData = await request.formData();
  const file = formData.get('receipt');
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, errorCode: 'invalid_file' } satisfies ExtractExpenseResponse, {
      status: 400,
    });
  }

  if (!canExtractExpenseReceipt(file.type)) {
    return Response.json({ ok: false, errorCode: 'unsupported_type' } satisfies ExtractExpenseResponse, {
      status: 400,
    });
  }

  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return Response.json(
      { ok: false, errorCode: 'membership_lookup_failed' } satisfies ExtractExpenseResponse,
      {
        status: 500,
      },
    );
  }

  if (!membership) {
    return Response.json({ ok: false, errorCode: 'no_business' } satisfies ExtractExpenseResponse, {
      status: 403,
    });
  }

  const businessId = (membership as { business_id: string }).business_id;
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('default_currency')
    .eq('id', businessId)
    .maybeSingle();

  if (businessError) {
    return Response.json(
      { ok: false, errorCode: 'business_lookup_failed' } satisfies ExtractExpenseResponse,
      {
        status: 500,
      },
    );
  }

  const defaultCurrency =
    (business as { default_currency: string } | null)?.default_currency ?? 'DOP';
  const result = await extractExpenseFromReceipt(file, { defaultCurrency });

  if (!result.ok) {
    const status =
      result.errorCode === 'missing_api_key'
        ? 503
        : result.errorCode === 'provider_quota'
          ? 429
        : result.errorCode === 'provider_error' || result.errorCode === 'invalid_response'
          ? 502
          : 400;

    return Response.json(
      { ok: false, errorCode: result.errorCode },
      { status },
    );
  }

  return Response.json({
    ok: true,
    extracted: result.extracted,
    warnings: result.warnings,
  } satisfies ExtractExpenseResponse);
}
