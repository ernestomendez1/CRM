import { assistantChatRequestSchema } from '@/lib/assistant/schemas';
import { handleAssistantChat } from '@/lib/assistant/service';
import { getCurrentContextResult } from '@/lib/auth/session';
import { loadBusinessDefaults } from '@/lib/domain/business';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  const ctxResult = await getCurrentContextResult();
  if (ctxResult.status === 'unauthenticated') {
    return Response.json(
      { ok: false, errorCode: 'unauthorized', message: 'Unauthorized' },
      { status: 401 },
    );
  }
  if (ctxResult.status === 'no_business') {
    return Response.json(
      { ok: false, errorCode: 'no_business', message: 'No business selected' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, errorCode: 'invalid_json', message: 'Invalid request body' },
      { status: 400 },
    );
  }

  const parsed = assistantChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, errorCode: 'invalid_request', message: 'Invalid assistant request' },
      { status: 400 },
    );
  }

  const defaults = await loadBusinessDefaults(ctxResult.context);
  const response = await handleAssistantChat(parsed.data, ctxResult.context, defaults);
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
