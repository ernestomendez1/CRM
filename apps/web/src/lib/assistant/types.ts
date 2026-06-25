import type { Locale } from '@/i18n/config';
import type { CustomerInput, TaxIdType } from '@crm/contracts/customer';
import type { ExpenseInput } from '@crm/contracts/expense';
import type { ProductInput, ProductType } from '@crm/contracts/product';

// Search result row shapes returned by the api's assistant search tools.
// Kept inline so this types file has no dependency on the old @/lib/domain
// modules (removed during Phase 2 cleanup).
export type ProductSearchResult = {
  id: string;
  name: string;
  sku: string | null;
  type: ProductType;
  unit_price: number | string;
  is_taxable: boolean;
  is_active: boolean;
};

export type CustomerSearchResult = {
  id: string;
  name: string;
  company_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  tax_id_type: TaxIdType | null;
};

export type ExpenseSearchResult = {
  id: string;
  vendor_name: string;
  vendor_tax_id: string | null;
  expense_date: string;
  category: string | null;
  total: number | string;
  currency: string;
  has_fiscal_receipt: boolean;
  fiscal_receipt_number: string | null;
};

export type AssistantActionType = 'create_product' | 'create_customer' | 'create_expense';

export type AssistantHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantPendingAction =
  | {
      type: 'create_product';
      summary: string;
      warnings: string[];
      payload: ProductInput;
    }
  | {
      type: 'create_customer';
      summary: string;
      warnings: string[];
      payload: CustomerInput;
    }
  | {
      type: 'create_expense';
      summary: string;
      warnings: string[];
      payload: ExpenseInput;
    };

export type AssistantSearchResults =
  | { entity: 'products'; items: ProductSearchResult[] }
  | { entity: 'customers'; items: CustomerSearchResult[] }
  | { entity: 'expenses'; items: ExpenseSearchResult[] };

export type AssistantChatRequest = {
  message: string;
  history?: AssistantHistoryMessage[];
  locale?: Locale;
};

export type AssistantChatResponse =
  | { ok: true; type: 'message'; message: string }
  | { ok: true; type: 'clarification'; message: string; missingFields: string[] }
  | { ok: true; type: 'pending_action'; message: string; pendingAction: AssistantPendingAction }
  | { ok: true; type: 'search_results'; message: string; results: AssistantSearchResults }
  | { ok: false; errorCode: string; message: string };

export type AssistantExecuteRequest = {
  pendingAction: AssistantPendingAction;
  locale?: Locale;
};

export type AssistantExecuteResponse =
  | {
      ok: true;
      message: string;
      record: {
        entity: 'products' | 'customers' | 'expenses';
        id: string;
        label: string;
        path: string;
      };
    }
  | { ok: false; errorCode: string; message: string };
