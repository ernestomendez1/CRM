import { revalidatePath } from 'next/cache';
import { requireBusiness } from '@/lib/auth/session';
import { assistantExecute } from '@/lib/api/assistant';

export const dynamic = 'force-dynamic';

/**
 * Thin proxy to @crm/api's POST /v1/assistant/execute. After a successful
 * mutation we revalidatePath() locally so cached list pages re-render.
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
  const response = await assistantExecute(body as Parameters<typeof assistantExecute>[0]);
  if (response.ok) {
    revalidatePath(`/${response.record.entity}`);
  }
  if (!response.ok) {
    return Response.json(response, { status: 400 });
  }
  return Response.json(response);
}
