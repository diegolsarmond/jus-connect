import { useState, useEffect } from 'react';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { useWAHA } from '@/hooks/useWAHA';
import { SessionStatus } from './SessionStatus';

export const WhatsAppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wahaState = useWAHA();

  // Set up webhook receiver for demo purposes
  useEffect(() => {
    window.wahaWebhookReceived = (message) => {
      wahaState.addMessage(message);
    };
    
    return () => {
      delete window.wahaWebhookReceived;
    };
  }, [wahaState.addMessage]);

  return (
    <div className="flex h-screen bg-background overflow-hidden pt-14">
      {/* Session Status Bar */}
      <SessionStatus 
        status={wahaState.sessionStatus} 
        onRefresh={wahaState.checkSessionStatus}
      />
      
      {/* Chat Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-border bg-sidebar`}>
        <ChatSidebar
          chats={wahaState.chats}
          activeChatId={wahaState.activeChatId}
          onSelectChat={wahaState.selectChat}
          loading={wahaState.loading}
          onRefresh={wahaState.loadChats}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatArea
          activeChat={wahaState.activeChat}
          messages={wahaState.activeChatMessages}
          onSendMessage={wahaState.sendMessage}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />
      </div>
    </div>
  );
};