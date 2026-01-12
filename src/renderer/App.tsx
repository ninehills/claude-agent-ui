import { useEffect, useState } from 'react';

import { connectSse } from '@/api/sseClient';
import { useAgentState } from '@/hooks/useAgentState';
import Chat from '@/pages/Chat';
import Start from '@/pages/Start';

export default function App() {
  const { agentDir, sessionState, hasInitialPrompt } = useAgentState();
  const [manualStart, setManualStart] = useState(false);

  useEffect(() => {
    connectSse();
  }, []);

  const shouldShowStart = !hasInitialPrompt && sessionState === 'idle' && !manualStart;

  if (shouldShowStart) {
    return <Start onStarted={() => setManualStart(true)} />;
  }

  return <Chat agentDir={agentDir} sessionState={sessionState} />;
}
