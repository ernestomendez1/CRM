import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono();

app.use('*', logger());

app.get('/healthz', (c) =>
  c.json({ ok: true, service: 'api', ts: new Date().toISOString() }),
);

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
