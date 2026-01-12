import type { ContentBlock } from '@/types/chat';

import type { SendMessagePayload, SendMessageResponse } from '../../shared/types/ipc';
import type {
  ContentBlockStop,
  ThinkingChunk,
  ThinkingStart,
  ToolInputDelta,
  ToolResultComplete,
  ToolResultDelta,
  ToolResultStart,
  ToolUse
} from '../electron';
import { onEvent } from './eventBus';

export type ChatInitPayload = {
  agentDir: string;
  sessionState: 'idle' | 'running' | 'error';
  hasInitialPrompt: boolean;
};

export type ChatMessageReplayPayload = {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
    timestamp: string;
    attachments?: {
      id: string;
      name: string;
      size: number;
      mimeType: string;
      savedPath?: string;
      relativePath?: string;
      previewUrl?: string;
      isImage?: boolean;
    }[];
  };
};

export type ChatStatusPayload = {
  sessionState: 'idle' | 'running' | 'error';
};

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return (await response.json()) as T;
}

export const chatClient = {
  sendMessage: (payload: SendMessagePayload): Promise<SendMessageResponse> =>
    postJson('/chat/send', payload),
  stopMessage: (): Promise<{ success: boolean; error?: string }> => postJson('/chat/stop'),
  onInit: (callback: (payload: ChatInitPayload) => void) => onEvent('chat:init', callback),
  onMessageReplay: (callback: (payload: ChatMessageReplayPayload) => void) =>
    onEvent('chat:message-replay', callback),
  onStatus: (callback: (payload: ChatStatusPayload) => void) => onEvent('chat:status', callback),
  onMessageChunk: (callback: (chunk: string) => void) => onEvent('chat:message-chunk', callback),
  onThinkingStart: (callback: (data: ThinkingStart) => void) =>
    onEvent('chat:thinking-start', callback),
  onThinkingChunk: (callback: (data: ThinkingChunk) => void) =>
    onEvent('chat:thinking-chunk', callback),
  onMessageComplete: (callback: () => void) => onEvent('chat:message-complete', callback),
  onMessageStopped: (callback: () => void) => onEvent('chat:message-stopped', callback),
  onMessageError: (callback: (error: string) => void) => onEvent('chat:message-error', callback),
  onDebugMessage: (callback: (message: string) => void) => onEvent('chat:debug-message', callback),
  onToolUseStart: (callback: (tool: ToolUse) => void) => onEvent('chat:tool-use-start', callback),
  onToolInputDelta: (callback: (data: ToolInputDelta) => void) =>
    onEvent('chat:tool-input-delta', callback),
  onContentBlockStop: (callback: (data: ContentBlockStop) => void) =>
    onEvent('chat:content-block-stop', callback),
  onToolResultStart: (callback: (data: ToolResultStart) => void) =>
    onEvent('chat:tool-result-start', callback),
  onToolResultDelta: (callback: (data: ToolResultDelta) => void) =>
    onEvent('chat:tool-result-delta', callback),
  onToolResultComplete: (callback: (data: ToolResultComplete) => void) =>
    onEvent('chat:tool-result-complete', callback)
};
