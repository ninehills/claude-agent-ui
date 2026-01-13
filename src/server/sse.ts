import { randomUUID } from 'crypto';

type SseClient = {
  id: string;
  send: (event: string, data: unknown) => void;
  close: () => void;
};

const encoder = new TextEncoder();
const clients = new Set<SseClient>();
const HEARTBEAT_INTERVAL_MS = 15000;

function summarizePayload(event: string, data: unknown): string {
  if (event === 'chat:message-replay' && typeof data === 'object' && data !== null) {
    const message = (data as { message?: { id?: string } }).message;
    if (message?.id) {
      return `messageId=${message.id}`;
    }
  }
  if (event === 'chat:message-chunk' && typeof data === 'string') {
    return `chars=${data.length}`;
  }
  if (typeof data === 'string') {
    const trimmed = data.replace(/\s+/g, ' ').slice(0, 120);
    return `text="${trimmed}"`;
  }
  if (data === null || data === undefined) {
    return 'data=null';
  }
  try {
    return `data=${JSON.stringify(data).slice(0, 160)}`;
  } catch {
    return 'data=[unserializable]';
  }
}

function formatSse(event: string, data: unknown): Uint8Array {
  const lines: string[] = [];
  if (event) {
    lines.push(`event: ${event}`);
  }

  const safeJsonStringify = (value: unknown): string => {
    try {
      return JSON.stringify(value);
    } catch {
      return JSON.stringify({ error: 'unserializable_payload' });
    }
  };

  if (data === undefined) {
    lines.push('data:');
  } else if (data === null) {
    lines.push('data: null');
  } else if (typeof data === 'string') {
    const parts = data.split(/\r?\n/);
    parts.forEach((part) => {
      lines.push(`data: ${part}`);
    });
  } else {
    lines.push(`data: ${safeJsonStringify(data)}`);
  }

  lines.push('');
  return encoder.encode(`${lines.join('\n')}\n`);
}

function heartbeatChunk(): Uint8Array {
  return encoder.encode(': ping\n\n');
}

export function broadcast(event: string, data: unknown): void {
  console.log(`[sse] ${event} -> ${summarizePayload(event, data)}`);
  for (const client of clients) {
    client.send(event, data);
  }
}

export function createSseClient(onClose: (client: SseClient) => void): {
  client: SseClient;
  response: Response;
} {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let client: SseClient | null = null;
  const pending: Uint8Array[] = [];
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
      if (pending.length > 0) {
        pending.forEach((chunk) => {
          controller?.enqueue(chunk);
        });
        pending.length = 0;
      }
    },
    cancel() {
      if (controller) {
        controller = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (client) {
        clients.delete(client);
        onClose(client);
        console.log(`[sse] client disconnected id=${client.id} total=${clients.size}`);
        client = null;
      }
    }
  });

  client = {
    id: randomUUID(),
    send: (event, data) => {
      try {
        const payload = formatSse(event, data);
        if (!controller) {
          pending.push(payload);
          return;
        }
        controller.enqueue(payload);
      } catch {
        if (client) {
          clients.delete(client);
          onClose(client);
          console.log(`[sse] client disconnected id=${client.id} total=${clients.size}`);
          client = null;
        }
      }
    },
    close: () => {
      if (!controller) {
        return;
      }
      controller.close();
      controller = null;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (client) {
        clients.delete(client);
        onClose(client);
        console.log(`[sse] client disconnected id=${client.id} total=${clients.size}`);
        client = null;
      }
    }
  };

  clients.add(client);
  console.log(`[sse] client connected id=${client.id} total=${clients.size}`);

  heartbeatTimer = setInterval(() => {
    if (!controller) {
      return;
    }
    try {
      controller.enqueue(heartbeatChunk());
    } catch {
      if (client) {
        clients.delete(client);
        onClose(client);
        console.log(`[sse] client disconnected id=${client.id} total=${clients.size}`);
        client = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });

  response.headers.set('X-SSE-Client-Id', client.id);

  return { client, response };
}
