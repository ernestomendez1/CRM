import 'server-only';
import type {
  LeadInput,
  LeadStatus,
  LeadStatusUpdate,
} from '@crm/contracts/lead';
import {
  apiGet,
  apiPatch,
  type ApiResult,
} from '../api-client';

/**
 * Public lead submission. No auth (the api endpoint is unauthenticated
 * and rate-limited). We POST directly without going through the
 * Bearer-JWT api-client.
 */
export async function submitLead(
  input: LeadInput,
  turnstileToken?: string,
): Promise<ApiResult<{ id: string }>> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:8080';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (turnstileToken) {
    headers['x-turnstile-token'] = turnstileToken;
  }
  const res = await fetch(`${apiUrl}/v1/public/leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (res.status === 204) return { ok: true, data: { id: '' } };
  try {
    return (await res.json()) as ApiResult<{ id: string }>;
  } catch {
    return {
      ok: false,
      error: `Bad response from api (status ${res.status})`,
    };
  }
}

// -------- admin --------

export type LeadListRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  rnc: string | null;
  status: LeadStatus;
  created_at: string;
};

export type LeadList = {
  rows: LeadListRow[];
  count: number;
  page: number;
  size: number;
};

export const listLeadsAdmin = (params: {
  status?: LeadStatus;
  q?: string;
  page?: number;
  size?: number;
}) => {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.q) sp.set('q', params.q);
  if (params.page) sp.set('page', String(params.page));
  if (params.size) sp.set('size', String(params.size));
  const qs = sp.toString();
  return apiGet<LeadList>(`/v1/admin/leads${qs ? `?${qs}` : ''}`);
};

export type LeadDetail = {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  rnc: string | null;
  employeesBand: string | null;
  currentTool: string | null;
  interestNote: string | null;
  status: LeadStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  convertedBusinessId: string | null;
  turnstileOk: boolean;
  sourceIp: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export const getLeadAdmin = (id: string) =>
  apiGet<LeadDetail>(`/v1/admin/leads/${id}`);

export const updateLeadStatusAdmin = (id: string, input: LeadStatusUpdate) =>
  apiPatch<undefined>(`/v1/admin/leads/${id}`, input);
