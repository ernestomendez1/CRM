// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantWidget } from '@/components/assistant/assistant-widget';

const messages = {
  assistant: {
    launcher: 'Assistant',
    title: 'Assistant',
    subtitle: 'Search records or prepare products, customers, and expenses from chat.',
    assistantLabel: 'Assistant',
    open: 'Open assistant',
    close: 'Close assistant',
    emptyTitle: 'Start with a direct command',
    emptyBody: 'Try a command.',
    placeholder: 'Ask the assistant…',
    send: 'Send',
    thinking: 'Thinking…',
    reviewTitle: 'Review before confirm',
    confirmAction: 'Confirm',
    cancelAction: 'Cancel',
    warnings: 'Warnings',
    pendingReminder: 'There is still a pending action waiting for confirmation.',
    scopeHint: 'Phase one supports product, customer, and expense search plus create flows.',
    cancelled: 'Okay, I did not make any changes.',
    viewRecord: 'Open {label}',
    statuses: {
      pending: 'Pending',
      cancelled: 'Cancelled',
      executed: 'Created',
    },
    errors: {
      network: 'The assistant request could not be completed. Please try again.',
      execution: 'The assistant could not complete that action.',
    },
  },
};

function renderWidget() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantWidget />
    </NextIntlClientProvider>,
  );
}

describe('AssistantWidget', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('opens the widget, prepares a pending action, and confirms it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          type: 'pending_action',
          message: 'I prepared a product for review.',
          pendingAction: {
            type: 'create_product',
            summary: 'Create service "Adobe Creative Cloud" for 42.55 taxable.',
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          message: 'Product created: Adobe Creative Cloud.',
          record: {
            entity: 'products',
            id: 'product-1',
            label: 'Adobe Creative Cloud',
            path: '/products/product-1',
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'Open assistant' }));
    fireEvent.change(screen.getByPlaceholderText('Ask the assistant…'), {
      target: { value: 'Create Adobe Creative Cloud at 42.55 DOP' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('I prepared a product for review.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Product created: Adobe Creative Cloud.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Adobe Creative Cloud' }).getAttribute('href')).toBe(
      '/products/product-1',
    );
  });

  it('restores session-only history from sessionStorage', async () => {
    window.sessionStorage.setItem(
      'crm-assistant-session-v1',
      JSON.stringify({
        open: true,
        entries: [
          { id: 'user-1', role: 'user', content: 'Find Acme' },
          {
            id: 'assistant-1',
            role: 'assistant',
            payload: { kind: 'message', message: 'I found Acme.' },
          },
        ],
      }),
    );

    renderWidget();

    await waitFor(() => {
      expect(screen.getByText('I found Acme.')).toBeTruthy();
    });
  });
});
