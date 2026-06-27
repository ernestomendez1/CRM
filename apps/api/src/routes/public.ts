import { Hono } from 'hono';
import { leadInputSchema } from '@crm/contracts/lead';
import { createLead } from '../domain/leads';
import { validationError } from '../lib/errors';
import { created } from '../lib/responses';
import { publicMiddleware } from '../middleware/public';

const route = new Hono<{
  Variables: { clientIp: string; turnstileOk: boolean };
}>();

route.use('*', publicMiddleware);

route.post('/leads', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(
      'Validation failed',
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  const result = await createLead({
    input: parsed.data,
    sourceIp: c.get('clientIp'),
    userAgent: c.req.header('user-agent') ?? null,
    turnstileOk: c.get('turnstileOk'),
  });
  return created(c, result);
});

export { route as publicRoute };
