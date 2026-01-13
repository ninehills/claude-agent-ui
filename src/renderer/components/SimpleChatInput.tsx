import { useEffect, useRef } from 'react';

interface SimpleChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

export default function SimpleChatInput({
  value,
  onChange,
  onSend,
  isLoading
}: SimpleChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!isLoading && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="border-t border-[var(--line)] bg-[var(--paper-strong)]/70 px-6 py-4 backdrop-blur">
      <div className="flex items-end gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] px-4 py-3 shadow-[var(--shadow-soft)]">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Type a message. Enter to send, Shift+Enter for a new line."
          className="min-h-[44px] w-full resize-none bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={isLoading || !value.trim()}
          className="action-button bg-[var(--ink)] px-5 py-2 text-[11px] font-semibold tracking-[0.2em] text-[var(--paper-strong)] uppercase hover:bg-[var(--accent)]"
        >
          Send
        </button>
      </div>
    </div>
  );
}
