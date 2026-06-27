import type { MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors';
import { env } from '../lib/env';

/**
 * In-memory rate limiter for public endpoints. Tracks request counts
 * per IP in a sliding window. Acceptable for our scale (≤ 50 clients);
 * swap for Redis when we cross that.
 */
type Hit = { count: number; resetAt: number };
const WINDOW_MS = 60 * 60 * 1000; // 1h
const LIMIT_PER_WINDOW = 10;
const ipHits = new Map<string, Hit>();

function getClientIp(c: Parameters<MiddlewareHandler>[0]): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = c.req.header('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const hit = ipHits.get(ip);
  if (!hit || hit.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (hit.count >= LIMIT_PER_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }
  hit.count += 1;
  return { ok: true };
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  // If Turnstile secret is not configured, accept (dev-friendly mode).
  // Set TURNSTILE_SECRET in production to enforce.
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new URLSearchParams();
  form.set('secret', env.TURNSTILE_SECRET);
  form.set('response', token);
  if (ip !== 'unknown') form.set('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}

/**
 * Public endpoint middleware: rate limit by IP + Turnstile verification
 * (when configured). Stores the IP and verification result on context
 * so handlers can persist them.
 */
export const publicMiddleware: MiddlewareHandler<{
  Variables: { clientIp: string; turnstileOk: boolean };
}> = async (c, next) => {
  const ip = getClientIp(c);
  c.set('clientIp', ip);

  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    c.header('Retry-After', String(rate.retryAfter));
    throw new AppError(429, 'Too many requests');
  }

  const token = c.req.header('x-turnstile-token') ?? '';
  const turnstileOk = await verifyTurnstile(token, ip);
  c.set('turnstileOk', turnstileOk);

  await next();
};
