import { Hono } from 'hono';
import { count, eq } from 'drizzle-orm';
import { businesses, leads } from '@crm/db/schema';
import {
  leadStatuses,
  leadStatusUpdateSchema,
} from '@crm/contracts/lead';
import {
  getLead,
  listLeads,
  updateLeadStatus,
} from '../domain/leads';
import { getDb } from '../lib/db';
import { validationError } from '../lib/errors';
import { noContent, ok } from '../lib/responses';
import { getStaff, staffMiddleware, type StaffEnv } from '../middleware/staff';

const route = new Hono<StaffEnv>();

route.use('*', staffMiddleware);

route.get('/me', (c) => {
  const staff = getStaff(c);
  return ok(c, {
    userId: staff.userId,
    email: staff.email,
    staffRole: staff.staffRole,
  });
});

/**
 * Counts for the admin dashboard. Cheap aggregates over small tables.
 */
route.get('/stats', async (c) => {
  const db = getDb();
  const [leadsPending, businessesTrial, businessesActive, businessesPastDue] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(leads)
        .where(eq(leads.status, 'pending')),
      db
        .select({ value: count() })
        .from(businesses)
        .where(eq(businesses.subscriptionStatus, 'trial')),
      db
        .select({ value: count() })
        .from(businesses)
        .where(eq(businesses.subscriptionStatus, 'active')),
      db
        .select({ value: count() })
        .from(businesses)
        .where(eq(businesses.subscriptionStatus, 'past_due')),
    ]);
  return ok(c, {
    leadsPending: leadsPending[0]?.value ?? 0,
    businessesTrial: businessesTrial[0]?.value ?? 0,
    businessesActive: businessesActive[0]?.value ?? 0,
    businessesPastDue: businessesPastDue[0]?.value ?? 0,
  });
});

// ---- Leads ------------------------------------------------------------

route.get('/leads', async (c) => {
  const url = new URL(c.req.url);
  const statusParam = url.searchParams.get('status');
  const status = leadStatuses.includes(statusParam as never)
    ? (statusParam as (typeof leadStatuses)[number])
    : undefined;
  const q = url.searchParams.get('q') ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '25')));

  const result = await listLeads({ status, q, page, size });
  return ok(c, { ...result, page, size });
});

route.get('/leads/:id', async (c) => {
  const id = c.req.param('id');
  const row = await getLead(id);
  return ok(c, row);
});

route.patch('/leads/:id', async (c) => {
  const staff = getStaff(c);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = leadStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError(
      'Validation failed',
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  await updateLeadStatus(id, parsed.data, staff.userId);
  return noContent(c);
});

export { route as adminRoute };
