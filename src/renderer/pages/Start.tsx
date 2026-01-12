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
    <div className="flex h-screen items-center justify-center bg-neutral-50 px-6 text-neutral-900">
      <div className="w-full max-w-2xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="text-lg font-semibold">Start Claude Agent</div>
        <div className="mt-2 text-sm text-neutral-500">
          Enter the initial prompt to begin the session.
        </div>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Enter the initial prompt..."
          className="mt-4 w-full resize-none rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-400"
        />
        {error && <div className="mt-3 text-sm text-red-500">{error}</div>}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleStart}
            disabled={isSubmitting || !prompt.trim()}
            className="rounded-full bg-neutral-900 px-5 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
}
