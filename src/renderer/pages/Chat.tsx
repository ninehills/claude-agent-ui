import { useState } from 'react';

import { chatClient } from '@/api/chatClient';
import DirectoryPanel from '@/components/DirectoryPanel';
import MessageList from '@/components/MessageList';
import SimpleChatInput from '@/components/SimpleChatInput';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useClaudeChat } from '@/hooks/useClaudeChat';

interface ChatProps {
  agentDir: string;
  sessionState: 'idle' | 'running' | 'error';
}

export default function Chat({ agentDir, sessionState }: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const { messages, setMessages, isLoading, setIsLoading } = useClaudeChat();
  const messagesContainerRef = useAutoScroll(isLoading, messages);

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
    <div className="flex h-screen bg-white text-neutral-900">
      <div className="flex w-3/4 flex-col border-r border-neutral-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-neutral-700">Claude Agent</div>
            <div className="text-xs text-neutral-500">Status: {sessionState}</div>
          </div>
          <div className="text-xs text-neutral-400">Single session</div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
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

      <div className="flex w-1/4 flex-col">
        <DirectoryPanel agentDir={agentDir} />
      </div>
    </div>
  );
}
