'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bot, Check, Loader2, Search, SendHorizonal, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  AssistantChatResponse,
  AssistantExecuteResponse,
  AssistantHistoryMessage,
  AssistantPendingAction,
  AssistantSearchResults,
} from '@/lib/assistant/types';

const STORAGE_KEY = 'crm-assistant-session-v1';

type AssistantEntry =
  | { id: string; role: 'user'; content: string }
  | { id: string; role: 'assistant'; payload: AssistantPayload };

type AssistantPayload =
  | { kind: 'message'; message: string }
  | { kind: 'clarification'; message: string; missingFields: string[] }
  | { kind: 'error'; message: string }
  | {
      kind: 'pending_action';
      message: string;
      pendingAction: AssistantPendingAction;
      status: 'pending' | 'cancelled' | 'executed';
    }
  | { kind: 'search_results'; message: string; results: AssistantSearchResults }
  | {
      kind: 'execution_result';
      message: string;
      record: {
        entity: 'products' | 'customers' | 'expenses';
        id: string;
        label: string;
        path: string;
      };
    };

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toAssistantPayload(response: AssistantChatResponse): AssistantPayload {
  if (!response.ok) {
    return { kind: 'error', message: response.message };
  }

  switch (response.type) {
    case 'message':
      return { kind: 'message', message: response.message };
    case 'clarification':
      return {
        kind: 'clarification',
        message: response.message,
        missingFields: response.missingFields,
      };
    case 'pending_action':
      return {
        kind: 'pending_action',
        message: response.message,
        pendingAction: response.pendingAction,
        status: 'pending',
      };
    case 'search_results':
      return {
        kind: 'search_results',
        message: response.message,
        results: response.results,
      };
  }
}

function buildHistory(entries: AssistantEntry[]): AssistantHistoryMessage[] {
  return entries
    .map((entry) => {
      if (entry.role === 'user') {
        return { role: 'user' as const, content: entry.content };
      }

      return { role: 'assistant' as const, content: entry.payload.message };
    })
    .slice(-12);
}

function readStoredEntries() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { entries: AssistantEntry[]; open: boolean };
  } catch {
    return null;
  }
}

export function AssistantWidget() {
  const t = useTranslations('assistant');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AssistantEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = readStoredEntries();
    if (!stored) return;
    setEntries(stored.entries ?? []);
    setOpen(Boolean(stored.open));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, open }));
  }, [entries, open]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries, isSubmitting]);

  const hasEntries = entries.length > 0;
  const latestPendingEntry = useMemo(
    () =>
      entries.findLast(
        (entry): entry is Extract<AssistantEntry, { role: 'assistant' }> =>
          entry.role === 'assistant' &&
          entry.payload.kind === 'pending_action' &&
          entry.payload.status === 'pending',
      ),
    [entries],
  );

  async function handleSubmit() {
    const message = draft.trim();
    if (!message || isSubmitting) return;

    const userEntry: AssistantEntry = {
      id: newId(),
      role: 'user',
      content: message,
    };

    const nextEntries = [...entries, userEntry];
    setEntries(nextEntries);
    setDraft('');
    setOpen(true);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: buildHistory(entries),
          locale,
        }),
      });
      const payload = (await response.json()) as AssistantChatResponse;

      setEntries((current) => [
        ...current,
        {
          id: newId(),
          role: 'assistant',
          payload: toAssistantPayload(
            response.ok
              ? payload
              : {
                  ok: false,
                  errorCode: payload.ok ? 'request_failed' : payload.errorCode,
                  message: payload.message,
                },
          ),
        },
      ]);
    } catch {
      setEntries((current) => [
        ...current,
        {
          id: newId(),
          role: 'assistant',
          payload: {
            kind: 'error',
            message: t('errors.network'),
          },
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function executePendingAction(entryId: string, pendingAction: AssistantPendingAction) {
    setExecutingId(entryId);
    try {
      const response = await fetch('/api/assistant/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingAction, locale }),
      });
      const payload = (await response.json()) as AssistantExecuteResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message);
      }

      setEntries((current) => [
        ...current.map((entry) =>
          entry.id === entryId && entry.role === 'assistant' && entry.payload.kind === 'pending_action'
            ? {
                ...entry,
                payload: {
                  ...entry.payload,
                  status: 'executed' as const,
                },
              }
            : entry,
        ),
        {
          id: newId(),
          role: 'assistant',
          payload: {
            kind: 'execution_result',
            message: payload.message,
            record: payload.record,
          },
        },
      ]);
    } catch (error) {
      setEntries((current) => [
        ...current,
        {
          id: newId(),
          role: 'assistant',
          payload: {
            kind: 'error',
            message: error instanceof Error ? error.message : t('errors.execution'),
          },
        },
      ]);
    } finally {
      setExecutingId(null);
    }
  }

  function cancelPendingAction(entryId: string) {
    setEntries((current) => [
      ...current.map((entry) =>
        entry.id === entryId && entry.role === 'assistant' && entry.payload.kind === 'pending_action'
          ? {
              ...entry,
              payload: {
                ...entry.payload,
                status: 'cancelled' as const,
              },
            }
          : entry,
      ),
      {
        id: newId(),
        role: 'assistant',
        payload: {
          kind: 'message',
          message: t('cancelled'),
        },
      },
    ]);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <>
      {open && (
        <div className="fixed inset-x-4 bottom-20 z-40 md:inset-x-auto md:right-4 md:w-[24rem]">
          <Card className="h-[min(38rem,calc(100vh-7rem))] border-primary/10 shadow-2xl">
            <CardHeader className="border-b bg-gradient-to-r from-primary/8 via-primary/3 to-transparent">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('title')}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setOpen(false)}
                  aria-label={t('close')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col px-0">
              <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {!hasEntries && !isSubmitting && (
                  <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{t('emptyTitle')}</p>
                    <p className="mt-1">{t('emptyBody')}</p>
                  </div>
                )}

                {entries.map((entry) =>
                  entry.role === 'user' ? (
                    <div key={entry.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground shadow-sm">
                        {entry.content}
                      </div>
                    </div>
                  ) : (
                    <div key={entry.id} className="flex justify-start">
                      <div className="max-w-[90%] space-y-2 rounded-2xl rounded-bl-sm border bg-card px-3 py-3 text-sm shadow-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Bot className="h-3.5 w-3.5" />
                          {t('assistantLabel')}
                        </div>
                        <p>{entry.payload.message}</p>

                        {entry.payload.kind === 'search_results' && (() => {
                          const payload = entry.payload;

                          return (
                            <div className="space-y-2">
                              {payload.results.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-xl border bg-muted/30 px-3 py-2 text-sm"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <Link
                                      href={`/${payload.results.entity}/${item.id}`}
                                      className="font-medium underline-offset-4 hover:underline"
                                    >
                                      {'name' in item ? item.name : item.vendor_name}
                                    </Link>
                                    <Badge variant="secondary">
                                      <Search className="h-3 w-3" />
                                      {payload.results.entity.slice(0, -1)}
                                    </Badge>
                                  </div>
                                  {'company_name' in item && item.company_name && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {item.company_name}
                                    </p>
                                  )}
                                  {'sku' in item && item.sku && (
                                    <p className="mt-1 text-xs text-muted-foreground">{item.sku}</p>
                                  )}
                                  {'expense_date' in item && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {item.expense_date} · {item.currency} {Number(item.total).toFixed(2)}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {entry.payload.kind === 'pending_action' && (() => {
                          const payload = entry.payload;

                          return (
                            <div className="rounded-xl border bg-muted/30 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{t('reviewTitle')}</span>
                                <Badge
                                  variant={
                                    payload.status === 'executed'
                                      ? 'default'
                                      : payload.status === 'cancelled'
                                        ? 'secondary'
                                        : 'outline'
                                  }
                                >
                                  {payload.status === 'executed'
                                    ? t('statuses.executed')
                                    : payload.status === 'cancelled'
                                      ? t('statuses.cancelled')
                                      : t('statuses.pending')}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm">{payload.pendingAction.summary}</p>
                              {payload.pendingAction.warnings.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    {t('warnings')}
                                  </p>
                                  <div className="space-y-1">
                                    {payload.pendingAction.warnings.map((warning) => (
                                      <p key={warning} className="text-xs text-muted-foreground">
                                        {warning}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {payload.status === 'pending' && (
                                <div className="mt-3 flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => executePendingAction(entry.id, payload.pendingAction)}
                                    disabled={executingId === entry.id}
                                  >
                                    {executingId === entry.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                    {t('confirmAction')}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cancelPendingAction(entry.id)}
                                    disabled={executingId === entry.id}
                                  >
                                    <X className="h-4 w-4" />
                                    {t('cancelAction')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {entry.payload.kind === 'execution_result' && (
                          <div className="rounded-xl border bg-emerald-500/5 p-3">
                            <Link
                              href={entry.payload.record.path}
                              className="text-sm font-medium underline-offset-4 hover:underline"
                            >
                              {t('viewRecord', { label: entry.payload.record.label })}
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}

                {isSubmitting && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('thinking')}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="block border-t bg-background p-4">
              {latestPendingEntry && (
                <div className="mb-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  {t('pendingReminder')}
                </div>
              )}
              <div className="space-y-3">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder={t('placeholder')}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">{t('scopeHint')}</p>
                  <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || !draft.trim()}>
                    <SendHorizonal className="h-4 w-4" />
                    {t('send')}
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-40">
        <Button
          type="button"
          size="lg"
          className={cn(
            'h-12 rounded-full px-4 shadow-xl',
            open && 'bg-primary/90',
          )}
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? t('close') : t('open')}
        >
          <Sparkles className="h-4 w-4" />
          {t('launcher')}
        </Button>
      </div>
    </>
  );
}
