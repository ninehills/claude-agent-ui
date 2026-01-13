import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { chatClient } from '@/api/chatClient';
import DirectoryPanel from '@/components/DirectoryPanel';
import MessageList from '@/components/MessageList';
import SimpleChatInput from '@/components/SimpleChatInput';
import { useAgentLogs } from '@/hooks/useAgentLogs';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useClaudeChat } from '@/hooks/useClaudeChat';

interface ChatProps {
  agentDir: string;
  sessionState: 'idle' | 'running' | 'error';
}

export default function Chat({ agentDir, sessionState }: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const { messages, setMessages, isLoading, setIsLoading } = useClaudeChat();
  const logs = useAgentLogs();
  const messagesContainerRef = useAutoScroll(isLoading, messages);

  useEffect(() => {
    const unsubscribeInit = chatClient.onInit(() => {
      setAgentError(null);
    });
    const unsubscribeError = chatClient.onAgentError((payload) => {
      setAgentError(payload.message);
    });

    return () => {
      unsubscribeInit();
      unsubscribeError();
    };
  }, []);

  const handleSendMessage = async () => {
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || isLoading || sessionState === 'running') {
      return;
    }
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatClient.sendMessage({ text: trimmedMessage });
      if (!response.success && response.error) {
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: `Error: ${response.error}`,
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsLoading(false);
      }
    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  return (
    <div className="page-enter flex min-h-screen flex-col bg-[var(--paper)] text-[var(--ink)] lg:flex-row">
      <div className="flex w-full flex-1 flex-col border-b border-[var(--line)] bg-[var(--paper-strong)]/70 backdrop-blur lg:w-3/4 lg:border-r lg:border-b-0">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.4em] text-[var(--ink-muted)] uppercase">
              Agent
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="font-display text-xl text-[var(--ink)]">Session</div>
              <span className="rounded-full border border-[var(--line)] bg-[var(--paper-contrast)] px-3 py-1 text-[11px] font-semibold text-[var(--ink-muted)]">
                Status: {sessionState}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[var(--ink-muted)]">
            <button
              type="button"
              onClick={() => setShowLogs((prev) => !prev)}
              className="action-button px-3 py-1 font-semibold"
            >
              {showLogs ? 'Hide logs' : 'Logs'}
            </button>
            <span className="rounded-full border border-[var(--line)] bg-[var(--paper-contrast)] px-3 py-1">
              Single session
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {agentError && (
            <div className="border-b border-[var(--line)] bg-[#f5e4d9]/80 px-4 py-3 text-[11px] text-[var(--ink)]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
                <div className="flex-1">
                  <div className="font-semibold text-[var(--ink)]">Agent error</div>
                  <div className="mt-1 text-[11px] text-[var(--ink-muted)]">{agentError}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setAgentError(null)}
                  className="action-button px-2 py-1 text-[10px] font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {showLogs && (
            <div className="border-b border-[var(--line)] bg-[var(--paper-contrast)]/70 px-4 py-3">
              <div className="mb-2 text-[11px] font-semibold tracking-[0.2em] text-[var(--ink-muted)] uppercase">
                Agent SDK Logs
              </div>
              <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] p-3 font-mono text-[11px] leading-relaxed text-[var(--ink)] shadow-[var(--shadow-soft)]">
                {logs.length === 0 ?
                  <div className="text-[var(--ink-muted)]">No logs yet.</div>
                : logs.map((line, index) => (
                    <div key={`${index}-${line.slice(0, 12)}`} className="whitespace-pre-wrap">
                      {line}
                    </div>
                  ))
                }
              </div>
            </div>
          )}
          <MessageList
            messages={messages}
            isLoading={isLoading}
            containerRef={messagesContainerRef}
            bottomPadding={120}
          />
          <SimpleChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            isLoading={isLoading || sessionState === 'running'}
          />
        </div>
      </div>

      <div className="flex w-full flex-col lg:w-1/4">
        <DirectoryPanel agentDir={agentDir} />
      </div>
    </div>
  );
}
