import type { Locale } from '@/i18n/config';
import type { CustomerInput } from '@/lib/validation/customer';
import type { ExpenseInput } from '@/lib/validation/expense';
import type { ProductInput } from '@/lib/validation/product';
import type { CustomerSearchResult } from '@/lib/domain/customers';
import type { ExpenseSearchResult } from '@/lib/domain/expenses';
import type { ProductSearchResult } from '@/lib/domain/products';

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
