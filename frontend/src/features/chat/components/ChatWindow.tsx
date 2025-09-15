import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, Video, MoreVertical, Search, Archive, Monitor } from "lucide-react";
import type { ConversationSummary, Message, SendMessageInput } from "../types";
import { ChatInput } from "./ChatInput";
import { MessageViewport } from "./MessageViewport";
import { DeviceLinkModal } from "./DeviceLinkModal";
import styles from "./ChatWindow.module.css";

interface ChatWindowProps {
  conversation?: ConversationSummary;
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onSendMessage: (payload: SendMessageInput) => Promise<void>;
  onLoadOlder: () => Promise<Message[]>;
}

export const ChatWindow = ({
  conversation,
  messages,
  hasMore,
  isLoading,
  isLoadingMore,
  onSendMessage,
  onLoadOlder,
}: ChatWindowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const previousConversationRef = useRef<string | undefined>(undefined);
  const previousLengthRef = useRef(0);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Mantemos o foco no final da conversa sempre que o usuário estiver no final do histórico.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const conversationChanged = previousConversationRef.current !== conversation?.id;
    const appendedMessage = messages.length > previousLengthRef.current;
    if (conversationChanged) {
      container.scrollTop = container.scrollHeight;
    } else if (appendedMessage && stickToBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: messages.length < 4 ? "auto" : "smooth" });
    }
    previousConversationRef.current = conversation?.id;
    previousLengthRef.current = messages.length;
  }, [conversation?.id, messages, stickToBottom]);

  const handleSend = async (payload: SendMessageInput) => {
    if (!conversation) return;
    await onSendMessage(payload);
    setStickToBottom(true);
  };

  const placeholder = useMemo(() => (
    <div className={styles.placeholder}>
      <div>
        <h3>Selecione uma conversa</h3>
        <p>
          Utilize a barra lateral para escolher um contato, iniciar um novo chat ou pesquisar processos.
          Os atalhos Ctrl+K e Ctrl+N aceleram sua navegação.
        </p>
      </div>
    </div>
  ), []);

  if (!conversation) {
    return <div className={styles.wrapper}>{placeholder}</div>;
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <img src={conversation.avatar} alt="" aria-hidden="true" />
          <div className={styles.headerText}>
            <h2>{conversation.name}</h2>
            <span className={styles.status}>{conversation.shortStatus}</span>
          </div>
        </div>
        <div className={styles.actions} ref={menuRef}>
          <button type="button" className={styles.actionButton} aria-label="Iniciar ligação">
            <Phone size={18} aria-hidden="true" />
          </button>
          <button type="button" className={styles.actionButton} aria-label="Iniciar chamada de vídeo">
            <Video size={18} aria-hidden="true" />
          </button>
          <div className={styles.menu}>
            <button
              type="button"
              className={styles.actionButton}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label="Abrir menu de ações"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreVertical size={18} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className={styles.menuPanel} role="menu">
                <button type="button" onClick={() => setMenuOpen(false)} role="menuitem">
                  <Search size={16} aria-hidden="true" /> Pesquisar nesta conversa
                </button>
                <button type="button" onClick={() => setMenuOpen(false)} role="menuitem">
                  <Archive size={16} aria-hidden="true" /> Arquivar conversa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceModalOpen(true);
                    setMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <Monitor size={16} aria-hidden="true" /> Conectar dispositivo
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className={styles.viewportWrapper}>
        {isLoading && <div className={styles.loadingOverlay}>Carregando conversa...</div>}
        <MessageViewport
          messages={messages}
          avatarUrl={conversation.avatar}
          containerRef={scrollRef}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadOlder}
          onStickToBottomChange={setStickToBottom}
        />
      </div>
      <ChatInput onSend={handleSend} disabled={isLoading} />
      <DeviceLinkModal open={deviceModalOpen} onClose={() => setDeviceModalOpen(false)} />
    </div>
  );
};
