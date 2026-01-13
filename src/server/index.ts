import { existsSync } from 'fs';
import { mkdir, stat } from 'fs/promises';
import { basename, join, relative, resolve } from 'path';

import {
  enqueueUserMessage,
  getAgentState,
  getLogLines,
  getMessages,
  initializeAgent,
  interruptCurrentResponse
} from './agent-session';
import { buildDirectoryTree } from './dir-info';
import { createSseClient } from './sse';

type SendMessagePayload = {
  text?: string;
};

function parseArgs(argv: string[]): { agentDir: string; initialPrompt?: string; port: number } {
  const args = argv.slice(2);
  const getArgValue = (flag: string) => {
    const index = args.indexOf(flag);
    if (index === -1) {
      return null;
    }
    return args[index + 1] ?? null;
  };

  const agentDir = getArgValue('--agent-dir') ?? '';
  const initialPrompt = getArgValue('--prompt') ?? undefined;
  const port = Number(getArgValue('--port') ?? 3000);

  if (!agentDir) {
    throw new Error('Missing required argument: --agent-dir <path>');
  }

  return { agentDir, initialPrompt, port: Number.isNaN(port) ? 3000 : port };
}

async function ensureAgentDir(dir: string): Promise<string> {
  const resolved = resolve(dir);
  if (!existsSync(resolved)) {
    await mkdir(resolved, { recursive: true });
  }
  const info = await stat(resolved);
  if (!info.isDirectory()) {
    throw new Error(`Agent directory is not a directory: ${resolved}`);
  }
  return resolved;
}

function resolveAgentPath(root: string, relativePath: string): string | null {
  const normalized = relativePath.replace(/^\/+/, '');
  const resolved = resolve(root, normalized);
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

const TEXT_EXTENSIONS = new Set([
  'md',
  'markdown',
  'txt',
  'json',
  'yaml',
  'yml',
  'log',
  'csv',
  'ts',
  'tsx',
  'js',
  'jsx',
  'css',
  'html',
  'htm',
  'xml',
  'svg',
  'env',
  'toml',
  'ini',
  'conf',
  'sh',
  'py',
  'java',
  'go',
  'rs',
  'rb',
  'php',
  'c',
  'cpp',
  'h',
  'hpp',
  'sql',
  'graphql',
  'gql'
]);

function isPreviewableText(name: string, mimeType: string | undefined): boolean {
  if (mimeType) {
    if (mimeType.startsWith('text/')) {
      return true;
    }
    if (['application/json', 'application/xml', 'application/x-yaml'].includes(mimeType)) {
      return true;
    }
  }
  const extension = name.toLowerCase().split('.').pop() ?? '';
  return TEXT_EXTENSIONS.has(extension);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function serveStatic(pathname: string): Promise<Response | null> {
  const distRoot = resolve(process.cwd(), 'dist');
  const resolvedPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = join(distRoot, resolvedPath);
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file);
  }

  const indexFile = Bun.file(join(distRoot, 'index.html'));
  if (await indexFile.exists()) {
    return new Response(indexFile);
  }

  return null;
}

async function main() {
  const { agentDir, initialPrompt, port } = parseArgs(process.argv);
  const resolvedAgentDir = await ensureAgentDir(agentDir);

  initializeAgent(resolvedAgentDir, initialPrompt);

  Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      const pathname = url.pathname;
      console.log(`[http] ${request.method} ${pathname}`);

      if (pathname === '/chat/stream' && request.method === 'GET') {
        const { client, response } = createSseClient(() => {});
        const state = getAgentState();
        client.send('chat:init', state);
        getMessages().forEach((message) => {
          client.send('chat:message-replay', { message });
        });
        client.send('chat:logs', { lines: getLogLines() });
        return response;
      }

      if (pathname === '/chat/send' && request.method === 'POST') {
        let payload: SendMessagePayload;
        try {
          payload = (await request.json()) as SendMessagePayload;
        } catch {
          return jsonResponse({ success: false, error: 'Invalid JSON payload.' }, 400);
        }
        const text = payload?.text?.trim() ?? '';
        if (!text) {
          return jsonResponse({ success: false, error: 'Message cannot be empty.' }, 400);
        }

        try {
          console.log(`[chat] send text="${text.slice(0, 200)}"`);
          await enqueueUserMessage(text);
          return jsonResponse({ success: true });
        } catch (error) {
          return jsonResponse(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500
          );
        }
      }

      if (pathname === '/chat/stop' && request.method === 'POST') {
        try {
          console.log('[chat] stop');
          const stopped = await interruptCurrentResponse();
          if (!stopped) {
            return jsonResponse({ success: false, error: 'No active response to stop.' }, 400);
          }
          return jsonResponse({ success: true });
        } catch (error) {
          return jsonResponse(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            500
          );
        }
      }

      if (pathname === '/agent/dir' && request.method === 'GET') {
        try {
          console.log('[agent] dir');
          const info = await buildDirectoryTree(resolvedAgentDir);
          return jsonResponse(info);
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            500
          );
        }
      }

      if (pathname === '/agent/download' && request.method === 'GET') {
        const relativePath = url.searchParams.get('path') ?? '';
        if (!relativePath) {
          return jsonResponse({ error: 'Missing path.' }, 400);
        }
        const resolvedPath = resolveAgentPath(resolvedAgentDir, relativePath);
        if (!resolvedPath) {
          return jsonResponse({ error: 'Invalid path.' }, 400);
        }
        const file = Bun.file(resolvedPath);
        if (!(await file.exists())) {
          return jsonResponse({ error: 'File not found.' }, 404);
        }
        const name = basename(resolvedPath);
        return new Response(file, {
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${name}"`
          }
        });
      }

      if (pathname === '/agent/file' && request.method === 'GET') {
        const relativePath = url.searchParams.get('path') ?? '';
        if (!relativePath) {
          return jsonResponse({ error: 'Missing path.' }, 400);
        }
        const resolvedPath = resolveAgentPath(resolvedAgentDir, relativePath);
        if (!resolvedPath) {
          return jsonResponse({ error: 'Invalid path.' }, 400);
        }
        const file = Bun.file(resolvedPath);
        if (!(await file.exists())) {
          return jsonResponse({ error: 'File not found.' }, 404);
        }
        const name = basename(resolvedPath);
        if (!isPreviewableText(name, file.type)) {
          return jsonResponse({ error: 'File type not supported.' }, 415);
        }
        const size = file.size;
        const maxSize = 512 * 1024;
        if (size > maxSize) {
          return jsonResponse({ error: 'File too large to preview.' }, 413);
        }
        try {
          const content = await file.text();
          return jsonResponse({ content, name, size });
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : 'Failed to read file.' },
            500
          );
        }
      }

      if (pathname === '/agent/upload' && request.method === 'POST') {
        const targetParam = url.searchParams.get('path') ?? '';
        const resolvedTarget =
          targetParam ? resolveAgentPath(resolvedAgentDir, targetParam) : resolvedAgentDir;
        if (!resolvedTarget) {
          return jsonResponse({ error: 'Invalid path.' }, 400);
        }
        try {
          const formData = await request.formData();
          const files = Array.from(formData.values()).filter(
            (value) => typeof value !== 'string'
          ) as File[];
          if (files.length === 0) {
            return jsonResponse({ error: 'No files provided.' }, 400);
          }
          await mkdir(resolvedTarget, { recursive: true });
          const saved: string[] = [];
          for (const file of files) {
            const safeName = file.name.replace(/[<>:"/\\|?*]/g, '_');
            const destination = join(resolvedTarget, safeName);
            await Bun.write(destination, file);
            saved.push(relative(resolvedAgentDir, destination));
          }
          return jsonResponse({ success: true, files: saved });
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            500
          );
        }
      }

      const staticResponse = await serveStatic(pathname);
      if (staticResponse) {
        return staticResponse;
      }

      return new Response('Not Found', { status: 404 });
    }
  });

  console.log(`Web UI server listening on http://localhost:${port}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
