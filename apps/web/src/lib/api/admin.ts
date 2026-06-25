import 'server-only';
import { apiGet, type ApiResult } from '../api-client';

export type AdminStats = {
  leadsPending: number;
  businessesTrial: number;
  businessesActive: number;
  businessesPastDue: number;
};

export const getAdminStats = () => apiGet<AdminStats>('/v1/admin/stats');

export const getAdminMe = () =>
  apiGet<{ userId: string; email: string; staffRole: 'admin' | 'support' }>(
    '/v1/admin/me',
  );
