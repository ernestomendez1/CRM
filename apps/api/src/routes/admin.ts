import { Hono } from 'hono';
import { and, count, eq, gt, isNotNull, lt } from 'drizzle-orm';
import { businesses, leads } from '@crm/db/schema';
import { getDb } from '../lib/db';
import { ok } from '../lib/responses';
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

export { route as adminRoute };
