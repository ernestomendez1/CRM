import { requireBusiness } from '@/lib/auth/session';
import { createClient } from '@crm/db/server';

export const dynamic = 'force-dynamic';

/**
 * Thin proxy to @crm/api's POST /v1/expenses/extract. We do not use
 * api-client.apiPostForm here because the api returns its own non-ApiResult
 * shape ({ ok, extracted, warnings } or { ok: false, errorCode }) and we
 * want to forward it untouched to the expense-form widget.
 */
export async function POST(request: Request) {
  await requireBusiness();
  const supabase = await createClient();
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !sessionData.session) {
    return Response.json({ ok: false, errorCode: 'unauthorized' }, { status: 401 });
  }
  const jwt = sessionData.session.access_token;
  const form = await request.formData();
  const apiUrl = process.env.API_URL ?? 'http://localhost:8080';
  const response = await fetch(`${apiUrl}/v1/expenses/extract`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  const text = await response.text();
  try {
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return Response.json({ ok: false, errorCode: 'provider_error' }, { status: 502 });
  }
}
