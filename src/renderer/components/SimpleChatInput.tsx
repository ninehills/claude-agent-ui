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
    <div className="border-t border-neutral-200 bg-white px-6 py-4">
      <div className="flex items-end gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Type a message. Enter to send, Shift+Enter for a new line."
          className="min-h-[44px] w-full resize-none bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={isLoading || !value.trim()}
          className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          Send
        </button>
      </div>
    </div>
  );
}
