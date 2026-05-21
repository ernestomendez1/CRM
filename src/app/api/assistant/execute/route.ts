import { assistantExecuteRequestSchema } from '@/lib/assistant/schemas';
import { executePendingAction } from '@/lib/assistant/service';
import { getCurrentContextResult } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

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

  const parsed = assistantExecuteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, errorCode: 'invalid_request', message: 'Invalid assistant execution request' },
      { status: 400 },
    );
  }

  const response = await executePendingAction({
    ctx: ctxResult.context,
    locale: parsed.data.locale,
    pendingAction: parsed.data.pendingAction,
  });

  if (!response.ok) {
    return Response.json(response, { status: 400 });
  }

  return Response.json(response);
}
