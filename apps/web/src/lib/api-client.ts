import 'server-only';
import { createClient } from '@crm/db/server';

/**
 * Mirrors @crm/api's ApiResult shape. The api returns this discriminated
 * union for every endpoint; we surface it as-is to callers.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type FetchInit = Omit<RequestInit, 'headers' | 'body'> & {
  headers?: Record<string, string>;
  /** JSON body, will be serialized + Content-Type set automatically. */
  json?: unknown;
  /** Multipart body (FormData), passed through untouched. */
  form?: FormData;
};

const API_URL = process.env.API_URL ?? 'http://localhost:8080';

async function getJwt(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
}

/**
 * Fetch from the api with the current user's Supabase JWT forwarded
 * in the Authorization header. Returns the api's `ApiResult<T>` so the
 * caller can branch on `ok`.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: FetchInit = {},
): Promise<ApiResult<T>> {
  const jwt = await getJwt();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    ...(init.headers ?? {}),
  };

  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  } else if (init.form !== undefined) {
    body = init.form;
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers,
    body,
  });

  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }

  try {
    return (await response.json()) as ApiResult<T>;
  } catch {
    return {
      ok: false,
      error: `Bad response from api (status ${response.status})`,
    };
  }
}

export const apiGet = <T>(path: string, init?: FetchInit) =>
  apiFetch<T>(path, { ...init, method: 'GET' });

export const apiPost = <T>(path: string, json?: unknown, init?: FetchInit) =>
  apiFetch<T>(path, { ...init, method: 'POST', json });

export const apiPatch = <T>(path: string, json?: unknown, init?: FetchInit) =>
  apiFetch<T>(path, { ...init, method: 'PATCH', json });

export const apiPut = <T>(path: string, json?: unknown, init?: FetchInit) =>
  apiFetch<T>(path, { ...init, method: 'PUT', json });

export const apiDelete = <T>(path: string, init?: FetchInit) =>
  apiFetch<T>(path, { ...init, method: 'DELETE' });

export const apiPostForm = <T>(path: string, form: FormData, init?: FetchInit) =>
  apiFetch<T>(path, { ...init, method: 'POST', form });
