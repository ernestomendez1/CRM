import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { leads, type NewLead } from '@crm/db/schema';
import type {
  LeadInput,
  LeadStatus,
  LeadStatusUpdate,
} from '@crm/contracts/lead';
import { getDb } from '../lib/db';
import { notFoundError } from '../lib/errors';

export async function createLead(params: {
  input: LeadInput;
  sourceIp: string;
  userAgent: string | null;
  turnstileOk: boolean;
}): Promise<{ id: string }> {
  const db = getDb();
  const row: NewLead = {
    businessName: params.input.business_name,
    contactName: params.input.contact_name,
    email: params.input.email.toLowerCase(),
    phone: params.input.phone ?? null,
    rnc: params.input.rnc ?? null,
    employeesBand: params.input.employees_band ?? null,
    currentTool: params.input.current_tool ?? null,
    interestNote: params.input.interest_note ?? null,
    sourceIp: params.sourceIp,
    userAgent: params.userAgent,
    turnstileOk: params.turnstileOk,
    // Auto-mark as spam if Turnstile failed AND we're enforcing it; otherwise
    // the admin will see it as pending and can decide.
    status: 'pending',
  };
  const [created] = await db
    .insert(leads)
    .values(row)
    .returning({ id: leads.id });
  if (!created) throw new Error('Insert returned no row');

  // TODO Step 3: send lead-notification email to EMAIL_ADMIN_ALERTS via Resend.
  return created;
}

export type LeadListRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  rnc: string | null;
  status: LeadStatus;
  created_at: string;
};

export async function listLeads(params: {
  status?: LeadStatus;
  q?: string;
  page: number;
  size: number;
}): Promise<{ rows: LeadListRow[]; count: number }> {
  const db = getDb();
  const conditions = [];
  if (params.status) conditions.push(eq(leads.status, params.status));
  if (params.q?.trim()) {
    const term = `%${params.q.trim()}%`;
    conditions.push(
      or(
        ilike(leads.businessName, term),
        ilike(leads.contactName, term),
        ilike(leads.email, term),
        ilike(leads.rnc, term),
      )!,
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: leads.id,
        business_name: leads.businessName,
        contact_name: leads.contactName,
        email: leads.email,
        rnc: leads.rnc,
        status: leads.status,
        created_at: leads.createdAt,
      })
      .from(leads)
      .where(whereClause)
      .orderBy(desc(leads.createdAt))
      .limit(params.size)
      .offset((params.page - 1) * params.size),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(whereClause),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      business_name: r.business_name,
      contact_name: r.contact_name,
      email: r.email,
      rnc: r.rnc,
      status: r.status as LeadStatus,
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
    })),
    count: countRows[0]?.count ?? 0,
  };
}

export async function getLead(id: string) {
  const db = getDb();
  const rows = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw notFoundError('Lead not found');
  return row;
}

export async function updateLeadStatus(
  id: string,
  update: LeadStatusUpdate,
  reviewerUserId: string,
): Promise<void> {
  const db = getDb();
  const result = await db
    .update(leads)
    .set({
      status: update.status,
      reviewNotes: update.notes ?? null,
      reviewedBy: reviewerUserId,
      reviewedAt: new Date(),
    })
    .where(eq(leads.id, id))
    .returning({ id: leads.id });
  if (result.length === 0) throw notFoundError('Lead not found');
}
