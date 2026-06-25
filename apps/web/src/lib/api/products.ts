import 'server-only';
import type { Product, ProductInput, ProductType } from '@crm/contracts/product';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  type ApiResult,
} from '../api-client';

// Drizzle row from /v1/products/:id (camelCase + decimal as string).
type DrizzleProductRow = {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  unitPrice: string;
  isTaxable: boolean;
  taxRateOverride: string | null;
  type: ProductType;
  sku: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function camelToSnake(row: DrizzleProductRow): Product {
  return {
    id: row.id,
    business_id: row.businessId,
    name: row.name,
    description: row.description,
    unit_price: Number(row.unitPrice),
    is_taxable: row.isTaxable,
    tax_rate_override: row.taxRateOverride != null ? Number(row.taxRateOverride) : null,
    type: row.type,
    sku: row.sku,
    is_active: row.isActive,
    deleted_at: row.deletedAt,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export type ProductListRow = {
  id: string;
  name: string;
  sku: string | null;
  type: ProductType;
  unit_price: string;
  is_taxable: boolean;
  is_active: boolean;
};

export type ProductList = {
  rows: ProductListRow[];
  count: number;
  page: number;
  size: number;
};

export async function listProducts(params: {
  q?: string;
  page?: number;
  size?: number;
  includeInactive?: boolean;
}): Promise<ApiResult<ProductList>> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.page) sp.set('page', String(params.page));
  if (params.size) sp.set('size', String(params.size));
  if (params.includeInactive) sp.set('inactive', '1');
  const qs = sp.toString();
  return apiGet<ProductList>(`/v1/products${qs ? `?${qs}` : ''}`);
}

export async function getProduct(id: string): Promise<ApiResult<Product>> {
  const res = await apiGet<DrizzleProductRow>(`/v1/products/${id}`);
  if (!res.ok) return res;
  return { ok: true, data: camelToSnake(res.data) };
}

export const createProduct = (input: ProductInput) =>
  apiPost<{ id: string; name: string }>('/v1/products', input);

export const updateProduct = (id: string, input: ProductInput) =>
  apiPut<{ id: string }>(`/v1/products/${id}`, input);

export const deactivateProduct = (id: string) =>
  apiPatch<undefined>(`/v1/products/${id}/deactivate`);

export const reactivateProduct = (id: string) =>
  apiPatch<undefined>(`/v1/products/${id}/reactivate`);
