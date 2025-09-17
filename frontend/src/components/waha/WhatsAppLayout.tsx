import { useState, useEffect } from 'react';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { useWAHA } from '@/hooks/useWAHA';
import { SessionStatus } from './SessionStatus';

export const WhatsAppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wahaState = useWAHA();
  const { addMessage } = wahaState;

  // Set up webhook receiver for demo purposes
  useEffect(() => {
    window.wahaWebhookReceived = (message) => {
      addMessage(message);
    };

    return () => {
      delete window.wahaWebhookReceived;
    };
  }, [addMessage]);

  return (
    <div className="relative flex h-full min-h-0 bg-background overflow-hidden">
      {/* Session Status Bar */}
      <SessionStatus
        status={wahaState.sessionStatus}
        onRefresh={wahaState.checkSessionStatus}
      />

      <div className="flex flex-1 h-full overflow-hidden pt-14 box-border">
        {/* Chat Sidebar */}
        <div
          className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-border bg-sidebar h-full box-border min-w-0`}
        >
          <ChatSidebar
            chats={wahaState.chats}
            activeChatId={wahaState.activeChatId}
            onSelectChat={wahaState.selectChat}
            loading={wahaState.loading}
            onRefresh={wahaState.loadChats}
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatArea
            activeChat={wahaState.activeChat}
            messages={wahaState.activeChatMessages}
            onSendMessage={wahaState.sendMessage}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
          />
        </div>
      </div>
    </div>
  );
};