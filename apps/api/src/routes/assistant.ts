import { Hono } from 'hono';
import {
  assistantChatRequestSchema,
  assistantExecuteRequestSchema,
} from '../openai/assistant-schemas';
import {
  executePendingAction,
  handleAssistantChat,
} from '../openai/assistant-service';
import { loadBusinessDefaults } from '../domain/business';
import { validationError } from '../lib/errors';
import { type AuthEnv, getCtx } from '../middleware/auth';

const route = new Hono<AuthEnv>();

route.post('/chat', async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = assistantChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError('Invalid assistant request');
  }
  const defaults = await loadBusinessDefaults(ctx);
  const response = await handleAssistantChat(parsed.data, ctx, defaults);
  if (!response.ok) {
    const status =
      response.errorCode === 'missing_api_key'
        ? 503
        : response.errorCode === 'provider_quota'
          ? 429
          : response.errorCode === 'provider_error' || response.errorCode === 'invalid_response'
            ? 502
            : 400;
    return c.json(response, status);
  }
  return c.json(response);
});

route.post('/execute', async (c) => {
  const ctx = getCtx(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = assistantExecuteRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError('Invalid assistant execution request');
  }
  const response = await executePendingAction({
    ctx,
    locale: parsed.data.locale,
    pendingAction: parsed.data.pendingAction,
  });
  if (!response.ok) {
    return c.json(response, 400);
  }
  return c.json(response);
});

export { route as assistantRoute };
