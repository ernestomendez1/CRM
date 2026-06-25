import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';
import { AppError, zodToFieldErrors } from '../lib/errors';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { ok: false, error: err.message, fieldErrors: err.fieldErrors },
      err.status,
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        ok: false,
        error: 'Validation failed',
        fieldErrors: zodToFieldErrors(err),
      },
      422,
    );
  }

  console.error('[api error]', err);
  return c.json({ ok: false, error: 'Internal server error' }, 500);
};
