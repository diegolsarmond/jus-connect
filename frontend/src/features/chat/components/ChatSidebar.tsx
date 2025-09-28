import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus, Search, Pin, X } from "lucide-react";
import type { ConversationSummary } from "../types";
import { formatConversationTimestamp, normalizeText } from "../utils/format";
import styles from "./ChatSidebar.module.css";

interface ChatSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  responsibleFilter: string;
  responsibleOptions: { id: string; name: string }[];
  onResponsibleFilterChange: (value: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  allowUnassignedFilter?: boolean;
  isResponsibleFilterLocked?: boolean;
  onClose?: () => void;
  isMobileView?: boolean;
}

export const ChatSidebar = ({
  conversations,
  activeConversationId,
  searchValue,
  onSearchChange,
  responsibleFilter,
  responsibleOptions,
  onResponsibleFilterChange,
  onSelectConversation,
  onNewConversation,
  searchInputRef,
  loading = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  allowUnassignedFilter = true,
  isResponsibleFilterLocked = false,
  onClose,
  isMobileView = false,
}: ChatSidebarProps) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(searchValue);
    const byResponsible = conversations.filter((conversation) => {
      if (responsibleFilter === "all") return true;
      if (responsibleFilter === "unassigned") return !conversation.responsible;
      return conversation.responsible?.id === responsibleFilter;
    });
    if (!normalizedQuery) {
      return byResponsible;
    }
    return byResponsible.filter((conversation) => {
      const normalizedName = normalizeText(conversation.name);
      const normalizedDescription = normalizeText(conversation.description ?? "");
      const lastMessage = conversation.lastMessage?.preview ? normalizeText(conversation.lastMessage.preview) : "";
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedDescription.includes(normalizedQuery) ||
        lastMessage.includes(normalizedQuery)
      );
    });
  }, [conversations, searchValue, responsibleFilter]);

  useEffect(() => {
    if (!filtered.length) {
      setFocusedIndex(null);
      return;
    }
    if (activeConversationId) {
      const index = filtered.findIndex((conversation) => conversation.id === activeConversationId);
      if (index >= 0) {
        setFocusedIndex(index);
        return;
      }
    }
    setFocusedIndex(0);
  }, [activeConversationId, filtered]);

  useEffect(() => {
    if (focusedIndex === null) return;
    const conversation = filtered[focusedIndex];
    if (!conversation) return;
    const element = document.getElementById(`conversation-item-${conversation.id}`);
    element?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, filtered]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!filtered.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((current) => {
        const next = current === null ? 0 : Math.min(filtered.length - 1, current + 1);
        return next;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((current) => {
        const next = current === null ? 0 : Math.max(0, current - 1);
        return next;
      });
    } else if (event.key === "Home") {
      event.preventDefault();
      setFocusedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setFocusedIndex(filtered.length - 1);
    } else if (event.key === "Enter" && focusedIndex !== null) {
      event.preventDefault();
      const conversation = filtered[focusedIndex];
      if (conversation) {
        onSelectConversation(conversation.id);
      }
    }
  };

  return (
    <aside className={styles.sidebar} aria-label="Lista de conversas">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1>Conversas</h1>
          <div className={styles.titleActions}>
            {isMobileView && onClose ? (
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Fechar lista de conversas"
              >
                <X size={18} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className={styles.newButton}
              onClick={onNewConversation}
              aria-label="Iniciar nova conversa"
            >
              <Plus size={18} aria-hidden="true" /> Nova conversa
            </button>
          </div>
        </div>
        <div className={styles.searchBox}>
          <Search size={18} aria-hidden="true" />
          <input
            ref={searchInputRef}
            className={styles.searchInput}
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar"
            aria-label="Buscar conversa"
          />
          <kbd aria-hidden="true">Ctrl K</kbd>
        </div>
        <label className={styles.filterControl}>
          <span>Responsável</span>
          <select
            className={styles.filterSelect}
            value={responsibleFilter}
            onChange={(event) => onResponsibleFilterChange(event.target.value)}
            disabled={isResponsibleFilterLocked}
          >
            {!isResponsibleFilterLocked && <option value="all">Todos</option>}
            {!isResponsibleFilterLocked && allowUnassignedFilter && (
              <option value="unassigned">Sem responsável</option>
            )}
            {responsibleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className={styles.listContainer}
        role="listbox"
        aria-activedescendant={
          focusedIndex !== null && filtered[focusedIndex]
            ? `conversation-item-${filtered[focusedIndex]!.id}`
            : undefined
        }
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {loading ? (
          <div className={styles.empty}>Carregando conversas...</div>
        ) : (
          <>
            {filtered.length === 0 ? (
              <div className={styles.empty}>Nenhuma conversa encontrada.</div>
            ) : (
              <ul className={styles.list}>
                {filtered.map((conversation, index) => {
                  const isActive = conversation.id === activeConversationId;
                  const isFocused = index === focusedIndex;
                  const preview = conversation.lastMessage?.preview ?? "Nova conversa";
                  const timestamp = conversation.lastMessage?.timestamp
                    ? formatConversationTimestamp(conversation.lastMessage.timestamp)
                    : "";
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        id={`conversation-item-${conversation.id}`}
                        className={styles.itemButton}
                        data-active={isActive}
                        data-focused={isFocused}
                        role="option"
                        onClick={() => onSelectConversation(conversation.id)}
                        aria-selected={isActive}
                      >
                        <img src={conversation.avatar} alt="" className={styles.avatar} aria-hidden="true" />
                        <div className={styles.itemContent}>
                          <div className={styles.itemTitle}>
                            <span>{conversation.name}</span>
                            {conversation.pinned && (
                              <span role="img" aria-label="Conversação fixada">
                                <Pin size={14} aria-hidden="true" />
                              </span>
                            )}
                          </div>
                          <div className={styles.itemPreview}>
                            {conversation.lastMessage?.sender === "me" && <span>Você:</span>}
                            <span>{preview}</span>
                          </div>
                        </div>
                        <div>
                          {timestamp && <div className={styles.timestamp}>{timestamp}</div>}
                          {conversation.isPrivate && (
                            <div className={styles.privateBadge}>Privada</div>
                          )}
                          {conversation.unreadCount > 0 && (
                            <div className={styles.unreadBadge} aria-label={`${conversation.unreadCount} mensagens não lidas`}>
                              {conversation.unreadCount}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {onLoadMore && (hasMore || isLoadingMore) && (
              <div className={styles.loadMoreContainer}>
                <button
                  type="button"
                  className={styles.loadMoreButton}
                  onClick={() => {
                    if (!isLoadingMore) {
                      onLoadMore?.();
                    }
                  }}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Carregando mais conversas...' : 'Carregar mais conversas'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div className={styles.footer}>
              <MessageCircle size={16} aria-hidden="true" /> Esta atualização só comporta mensagens de texto.
      </div>
    </aside>
  );
};
