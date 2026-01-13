import { useState } from 'react';

import { chatClient } from '@/api/chatClient';

interface StartProps {
  onStarted: () => void;
}

export default function Start({ onStarted }: StartProps) {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStart = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await chatClient.sendMessage({ text: trimmed });
      if (!response.success) {
        setError(response.error ?? 'Failed to start the session.');
        setIsSubmitting(false);
        return;
      }
      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start the session.');
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleStart();
    }
  };

  return (
    <div className="page-enter flex min-h-screen items-center bg-[var(--paper)] px-6 py-10 text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 lg:flex-row lg:items-center">
        <div className="lg:w-5/12">
          <div className="text-[10px] font-semibold tracking-[0.4em] text-[var(--ink-muted)] uppercase">
            Agent
          </div>
          <h1 className="font-display mt-4 text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
            Start a focused run with a single, clear prompt.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--ink-muted)]">
            Seed the session with intent. The agent will stay on track, stream progress, and keep
            your workspace organized.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px]">
            <span className="rounded-full border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-1 text-[var(--ink-muted)]">
              Single session
            </span>
            <span className="rounded-full border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-1 text-[var(--ink-muted)]">
              Bun + SSE
            </span>
            <span className="rounded-full border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-1 text-[var(--ink-muted)]">
              React 19 UI
            </span>
          </div>
        </div>

        <div className="lg:w-7/12">
          <div className="glass-panel relative overflow-hidden p-6 sm:p-8">
            <div className="absolute -top-3 left-6 rounded-full border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-[var(--ink-muted)] uppercase shadow-[var(--shadow-soft)]">
              Session
            </div>
            <div className="text-lg font-semibold text-[var(--ink)]">Initial prompt</div>
            <div className="mt-2 text-sm text-[var(--ink-muted)]">
              Be specific about what you want to build or explore.
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              placeholder="Describe the outcome, the constraints, and any context the agent should know."
              className="mt-5 w-full resize-none rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)]/80 px-4 py-3 text-sm text-[var(--ink)] shadow-[var(--shadow-soft)] transition outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_2px_rgba(194,109,58,0.15)]"
            />
            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-[var(--ink-muted)]">
                Press Enter to run, Shift+Enter for a new line.
              </div>
              <button
                type="button"
                onClick={handleStart}
                disabled={isSubmitting || !prompt.trim()}
                className="action-button bg-[var(--ink)] px-6 py-2 text-[11px] font-semibold tracking-[0.2em] text-[var(--paper-strong)] uppercase hover:bg-[var(--accent)]"
              >
                Run
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
