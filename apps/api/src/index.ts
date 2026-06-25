import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { env } from './lib/env';
import { errorHandler } from './middleware/error';
import { authMiddleware, type AuthEnv, getCtx } from './middleware/auth';
import { ok } from './lib/responses';
import { customersRoute } from './routes/customers';
import { expensesRoute } from './routes/expenses';
import { invoicesRoute } from './routes/invoices';
import { productsRoute } from './routes/products';
import { quotationsRoute } from './routes/quotations';
import { settings } from './routes/settings';

const app = new Hono<AuthEnv>();

app.use('*', logger());
app.onError(errorHandler);

app.get('/healthz', (c) =>
  c.json({ ok: true, service: 'api', ts: new Date().toISOString() }),
);

// Authenticated routes mounted under /v1
const v1 = new Hono<AuthEnv>();
v1.use('*', authMiddleware);

v1.get('/me', (c) => {
  const ctx = getCtx(c);
  return ok(c, {
    userId: ctx.userId,
    email: ctx.email,
    businessId: ctx.businessId,
    role: ctx.role,
  });
});

v1.route('/settings', settings);
v1.route('/products', productsRoute);
v1.route('/customers', customersRoute);
v1.route('/quotations', quotationsRoute);
v1.route('/invoices', invoicesRoute);
v1.route('/expenses', expensesRoute);

app.route('/v1', v1);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
