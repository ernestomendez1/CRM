import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantChatResponse, AssistantExecuteResponse } from '@/lib/assistant/types';

vi.mock('@/lib/auth/session', () => ({
  getCurrentContextResult: vi.fn(),
}));

vi.mock('@/lib/domain/business', () => ({
  loadBusinessDefaults: vi.fn(),
}));

vi.mock('@/lib/assistant/service', () => ({
  handleAssistantChat: vi.fn(),
  executePendingAction: vi.fn(),
}));

import { POST as chatPost } from '@/app/api/assistant/chat/route';
import { POST as executePost } from '@/app/api/assistant/execute/route';
import { getCurrentContextResult } from '@/lib/auth/session';
import { loadBusinessDefaults } from '@/lib/domain/business';
import { executePendingAction, handleAssistantChat } from '@/lib/assistant/service';

describe('assistant api routes', () => {
  const readyContext = {
    status: 'ready' as const,
    context: {
      userId: 'user-1',
      email: 'owner@example.com',
      businessId: 'business-1',
      role: 'owner',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 from the chat route when unauthenticated', async () => {
    vi.mocked(getCurrentContextResult).mockResolvedValue({ status: 'unauthenticated' });

    const response = await chatPost(
      new Request('http://localhost/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Find Acme', locale: 'en' }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it('returns chat responses from the assistant handler', async () => {
    vi.mocked(getCurrentContextResult).mockResolvedValue(readyContext);
    vi.mocked(loadBusinessDefaults).mockResolvedValue({
      businessName: 'CRM',
      defaultCurrency: 'DOP',
      defaultTaxRate: 0.18,
      defaultPaymentTermsDays: 30,
    });
    vi.mocked(handleAssistantChat).mockResolvedValue({
      ok: true,
      type: 'message',
      message: 'I found Acme.',
    } satisfies AssistantChatResponse);

    const response = await chatPost(
      new Request('http://localhost/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 'Find Acme', locale: 'en' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      type: 'message',
      message: 'I found Acme.',
    });
  });

  it('returns 400 from the execute route for invalid payloads', async () => {
    vi.mocked(getCurrentContextResult).mockResolvedValue(readyContext);

    const response = await executePost(
      new Request('http://localhost/api/assistant/execute', {
        method: 'POST',
        body: JSON.stringify({ locale: 'en' }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it('executes pending actions through the execution route', async () => {
    vi.mocked(getCurrentContextResult).mockResolvedValue(readyContext);
    vi.mocked(executePendingAction).mockResolvedValue({
      ok: true,
      message: 'Product created: Adobe Creative Cloud.',
      record: {
        entity: 'products',
        id: 'product-1',
        label: 'Adobe Creative Cloud',
        path: '/products/product-1',
      },
    } satisfies AssistantExecuteResponse);

    const response = await executePost(
      new Request('http://localhost/api/assistant/execute', {
        method: 'POST',
        body: JSON.stringify({
          locale: 'en',
          pendingAction: {
            type: 'create_product',
            summary: 'Create product "Adobe Creative Cloud"',
            warnings: [],
            payload: {
              name: 'Adobe Creative Cloud',
              unit_price: 42.55,
              is_taxable: true,
              type: 'service',
              is_active: true,
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      message: 'Product created: Adobe Creative Cloud.',
      record: {
        entity: 'products',
        id: 'product-1',
        label: 'Adobe Creative Cloud',
        path: '/products/product-1',
      },
    });
  });
});
