import { requireBusiness } from '@/lib/auth/session';
import { assistantChat } from '@/lib/api/assistant';

export const dynamic = 'force-dynamic';

/**
 * Thin proxy to @crm/api's POST /v1/assistant/chat. Keeps the widget
 * pointed at /api/assistant/chat (no change needed in browser code).
 */
export async function POST(request: Request) {
  await requireBusiness();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, errorCode: 'invalid_json', message: 'Invalid request body' },
      { status: 400 },
    );
  }
  const response = await assistantChat(body as Parameters<typeof assistantChat>[0]);
  if (!response.ok) {
    const status =
      response.errorCode === 'missing_api_key'
        ? 503
        : response.errorCode === 'provider_quota'
          ? 429
          : response.errorCode === 'provider_error' || response.errorCode === 'invalid_response'
            ? 502
            : 400;
    return Response.json(response, { status });
  }
  return Response.json(response);
}
