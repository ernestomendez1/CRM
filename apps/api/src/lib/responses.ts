import type { Context } from 'hono';

export type FieldErrors = Record<string, string[]>;

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export const ok = <T>(c: Context, data: T) =>
  c.json<ApiResult<T>>({ ok: true, data }, 200);

export const created = <T>(c: Context, data: T) =>
  c.json<ApiResult<T>>({ ok: true, data }, 201);

export const noContent = (c: Context) =>
  c.body(null, 204);

export const badRequest = (
  c: Context,
  error: string,
  fieldErrors?: FieldErrors,
) => c.json<ApiResult<never>>({ ok: false, error, fieldErrors }, 400);

export const unauthorized = (c: Context, error = 'Unauthorized') =>
  c.json<ApiResult<never>>({ ok: false, error }, 401);

export const forbidden = (c: Context, error = 'Forbidden') =>
  c.json<ApiResult<never>>({ ok: false, error }, 403);

export const notFound = (c: Context, error = 'Not found') =>
  c.json<ApiResult<never>>({ ok: false, error }, 404);

export const conflict = (c: Context, error: string) =>
  c.json<ApiResult<never>>({ ok: false, error }, 409);

export const unprocessable = (
  c: Context,
  error: string,
  fieldErrors?: FieldErrors,
) => c.json<ApiResult<never>>({ ok: false, error, fieldErrors }, 422);

export const serverError = (c: Context, error = 'Internal server error') =>
  c.json<ApiResult<never>>({ ok: false, error }, 500);
