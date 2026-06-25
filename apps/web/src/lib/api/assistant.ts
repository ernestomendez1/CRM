import 'server-only';
import { apiPost, type ApiResult } from '../api-client';
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantExecuteRequest,
  AssistantExecuteResponse,
} from '@/lib/assistant/types';

export async function assistantChat(
  request: AssistantChatRequest,
): Promise<AssistantChatResponse> {
  // The api returns AssistantChatResponse directly (it's already a
  // discriminated union with ok/!ok shape), not wrapped in ApiResult.
  const res = await apiPost<unknown>('/v1/assistant/chat', request);
  if (res.ok) {
    return res.data as AssistantChatResponse;
  }
  return { ok: false, errorCode: 'provider_error', message: res.error };
}

export async function assistantExecute(
  request: AssistantExecuteRequest,
): Promise<AssistantExecuteResponse> {
  const res = await apiPost<unknown>('/v1/assistant/execute', request);
  if (res.ok) {
    return res.data as AssistantExecuteResponse;
  }
  return { ok: false, errorCode: 'mutation_failed', message: res.error };
}
