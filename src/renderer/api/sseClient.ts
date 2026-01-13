import { emitEvent } from './eventBus';

const JSON_EVENTS = new Set([
  'chat:init',
  'chat:message-replay',
  'chat:thinking-start',
  'chat:thinking-chunk',
  'chat:tool-use-start',
  'chat:tool-input-delta',
  'chat:content-block-stop',
  'chat:tool-result-start',
  'chat:tool-result-delta',
  'chat:tool-result-complete',
  'chat:subagent-tool-use',
  'chat:subagent-tool-input-delta',
  'chat:subagent-tool-result-start',
  'chat:subagent-tool-result-delta',
  'chat:subagent-tool-result-complete',
  'chat:logs',
  'chat:status',
  'chat:agent-error'
]);

const STRING_EVENTS = new Set([
  'chat:message-chunk',
  'chat:message-error',
  'chat:debug-message',
  'chat:log'
]);

const NULL_EVENTS = new Set(['chat:message-complete', 'chat:message-stopped']);

let eventSource: EventSource | null = null;

function handleEvent(event: MessageEvent<string>): void {
  const { type, data } = event;
  if (JSON_EVENTS.has(type)) {
    try {
      const parsed = JSON.parse(data);
      emitEvent(type, parsed);
    } catch {
      emitEvent(type, null);
    }
    return;
  }

  if (NULL_EVENTS.has(type)) {
    emitEvent(type, null);
    return;
  }

  if (STRING_EVENTS.has(type)) {
    emitEvent(type, data);
  }
}

export function connectSse(): void {
  if (eventSource) {
    return;
  }

  eventSource = new EventSource('/chat/stream');
  const events = [...JSON_EVENTS, ...STRING_EVENTS, ...NULL_EVENTS];
  events.forEach((eventName) => {
    eventSource?.addEventListener(eventName, handleEvent as EventListener);
  });

  eventSource.onerror = () => {
    // Keep the connection open; EventSource will retry automatically.
  };
}

export function disconnectSse(): void {
  if (!eventSource) {
    return;
  }
  eventSource.close();
  eventSource = null;
}
