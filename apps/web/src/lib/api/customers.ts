import 'server-only';
import type {
  Customer,
  CustomerInput,
  TaxIdType,
} from '@crm/contracts/customer';
import type { InvoiceStatus } from '@crm/contracts/invoice';
import type { QuotationStatus } from '@crm/contracts/quotation';
import {
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  type ApiResult,
} from '../api-client';

type DrizzleCustomerRow = {
  id: string;
  businessId: string;
  name: string;
  companyName: string | null;
  taxId: string | null;
  taxIdType: TaxIdType | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function camelToSnake(row: DrizzleCustomerRow): Customer {
  return {
    id: row.id,
    business_id: row.businessId,
    name: row.name,
    company_name: row.companyName ?? undefined,
    tax_id: row.taxId ?? undefined,
    tax_id_type: row.taxIdType ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    country: row.country ?? 'DO',
    notes: row.notes ?? undefined,
    is_active: row.isActive,
    deleted_at: row.deletedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export type CustomerListRow = {
  id: string;
  name: string;
  company_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

export type CustomerList = {
  rows: CustomerListRow[];
  count: number;
  page: number;
  size: number;
};

export async function listCustomers(params: {
  q?: string;
  page?: number;
  size?: number;
  includeInactive?: boolean;
}): Promise<ApiResult<CustomerList>> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.page) sp.set('page', String(params.page));
  if (params.size) sp.set('size', String(params.size));
  if (params.includeInactive) sp.set('inactive', '1');
  const qs = sp.toString();
  return apiGet<CustomerList>(`/v1/customers${qs ? `?${qs}` : ''}`);
}

export async function getCustomer(id: string): Promise<ApiResult<Customer>> {
  const res = await apiGet<DrizzleCustomerRow>(`/v1/customers/${id}`);
  if (!res.ok) return res;
  return { ok: true, data: camelToSnake(res.data) };
}

export type CustomerOverviewQuotation = {
  id: string;
  quotation_number: string;
  issue_date: string;
  status: QuotationStatus;
  total: string;
  currency: string;
};

export type CustomerOverviewInvoice = {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  total: string;
  balance_due: string;
  currency: string;
};

export type CustomerOverviewPayment = {
  id: string;
  payment_date: string;
  amount: string;
  method: string;
  reference: string | null;
  invoice: { id: string; invoice_number: string } | null;
};

export type CustomerOverview = {
  customer: Customer;
  quotations: CustomerOverviewQuotation[];
  invoices: CustomerOverviewInvoice[];
  payments: CustomerOverviewPayment[];
};

type RawOverview = {
  customer: DrizzleCustomerRow;
  quotations: CustomerOverviewQuotation[];
  invoices: CustomerOverviewInvoice[];
  payments: CustomerOverviewPayment[];
};

export async function getCustomerOverview(
  id: string,
): Promise<ApiResult<CustomerOverview>> {
  const res = await apiGet<RawOverview>(`/v1/customers/${id}/overview`);
  if (!res.ok) return res;
  return {
    ok: true,
    data: {
      customer: camelToSnake(res.data.customer),
      quotations: res.data.quotations,
      invoices: res.data.invoices,
      payments: res.data.payments,
    },
  };
}

export const createCustomer = (input: CustomerInput) =>
  apiPost<{ id: string; name: string }>('/v1/customers', input);

export const updateCustomer = (id: string, input: CustomerInput) =>
  apiPut<{ id: string }>(`/v1/customers/${id}`, input);

export const deactivateCustomer = (id: string) =>
  apiPatch<undefined>(`/v1/customers/${id}/deactivate`);

export const reactivateCustomer = (id: string) =>
  apiPatch<undefined>(`/v1/customers/${id}/reactivate`);
