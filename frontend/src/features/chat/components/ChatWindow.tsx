import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type FormEventHandler,
} from "react";
import {
  CalendarPlus,
  CheckSquare,
  Info,
  MoreVertical,
  Search,
  Archive,
  Monitor,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import type {
  ConversationInternalNote,
  ConversationParticipant,
  ConversationSummary,
  Message,
  SendMessageInput,
  UpdateConversationPayload,
} from "../types";
import { ChatInput } from "./ChatInput";
import { MessageViewport } from "./MessageViewport";
import styles from "./ChatWindow.module.css";
import { DeviceLinkContent } from "./DeviceLinkModal";
import { fetchChatResponsibles, fetchChatTags, type ChatResponsibleOption } from "../services/chatApi";

const CLIENT_SUGGESTIONS = [
  "Prado & Cia Consultoria",
  "Inovatech Brasil",
  "Tribunal de Justiça SP",
  "Tech&Law Holding",
  "Luz Arquitetura",
  "Paula & Carlos Empreendimentos",
  "FinanceX Serviços",
  "Grupo Aurora",
];

const createId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2, 10)}`;

const MAX_VISIBLE_PARTICIPANTS = 6;

const getParticipantName = (participant: ConversationParticipant): string => {
  const name = participant.name?.trim();
  if (name && name.length > 0) {
    return name;
  }
  const id = participant.id.trim();
  const atIndex = id.indexOf("@");
  return atIndex > 0 ? id.slice(0, atIndex) : id;
};

const getParticipantInitials = (name: string): string => {
  const parts = name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2);
  if (parts.length === 0) {
    return name.slice(0, 2).toUpperCase();
  }
  return parts.map((part) => part[0]!.toUpperCase()).join("");
};

interface ChatWindowProps {
  conversation?: ConversationSummary;
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onSendMessage: (payload: SendMessageInput) => Promise<void>;
  onLoadOlder: () => Promise<Message[]>;
  onUpdateConversation: (conversationId: string, changes: UpdateConversationPayload) => Promise<void>;
  isUpdatingConversation?: boolean;
  onOpenDeviceLinkModal?: () => void;
}

export const ChatWindow = ({
  conversation,
  messages,
  hasMore,
  isLoading,
  isLoadingMore,
  onSendMessage,
  onLoadOlder,
  onUpdateConversation,
  isUpdatingConversation = false,
  onOpenDeviceLinkModal,
}: ChatWindowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [responsibleOptions, setResponsibleOptions] = useState<ChatResponsibleOption[]>([]);
  const [isLoadingResponsibles, setIsLoadingResponsibles] = useState(false);
  const [clientInput, setClientInput] = useState("");
  const [newAttributeLabel, setNewAttributeLabel] = useState("");
  const [newAttributeValue, setNewAttributeValue] = useState("");
  const [internalNoteContent, setInternalNoteContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const previousConversationRef = useRef<string | undefined>(undefined);
  const previousLengthRef = useRef(0);
  const previousLastMessageRef = useRef<string | undefined>(undefined);
  const noteFormatter = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    [],
  );
  const tags = conversation?.tags ?? [];
  const customAttributes = conversation?.customAttributes ?? [];
  const internalNotes = conversation?.internalNotes ?? [];
  const participants = conversation?.participants ?? [];
  const visibleParticipants = participants.slice(0, MAX_VISIBLE_PARTICIPANTS);
  const overflowCount = participants.length - visibleParticipants.length;
  const tagOptions = useMemo(() => {
    const all = new Set<string>();
    for (const tag of availableTags) {
      if (tag) {
        all.add(tag);
      }
    }
    for (const tag of tags) {
      if (tag) {
        all.add(tag);
      }
    }
    return Array.from(all).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [availableTags, tags]);
  const tagSelectSize = Math.min(Math.max(tagOptions.length, 4), 6);

  useEffect(() => {
    setDetailsOpen(false);
    if (!conversation) return;
    setClientInput(conversation.clientName ?? "");
    setNewAttributeLabel("");
    setNewAttributeValue("");
    setInternalNoteContent("");
  }, [conversation]);

  useEffect(() => {
    let canceled = false;
    const loadResponsibles = async () => {
      try {
        setIsLoadingResponsibles(true);
        const options = await fetchChatResponsibles();
        if (!canceled) {
          setResponsibleOptions(options);
        }
      } catch (error) {
        console.error("Falha ao carregar responsáveis", error);
      } finally {
        if (!canceled) {
          setIsLoadingResponsibles(false);
        }
      }
    };

    loadResponsibles();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const loadTags = async () => {
      try {
        setIsLoadingTags(true);
        const tagsFromApi = await fetchChatTags();
        if (!canceled) {
          setAvailableTags(tagsFromApi);
        }
      } catch (error) {
        console.error("Falha ao carregar etiquetas", error);
      } finally {
        if (!canceled) {
          setIsLoadingTags(false);
        }
      }
    };

    loadTags();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!conversation?.responsible) {
      return;
    }
    setResponsibleOptions((prev) => {
      if (prev.some((option) => option.id === conversation.responsible!.id)) {
        return prev;
      }
      const next = [
        ...prev,
        {
          id: conversation.responsible.id,
          name: conversation.responsible.name,
          role: conversation.responsible.role,
        },
      ];
      return next.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    });
  }, [conversation?.responsible?.id, conversation?.responsible?.name, conversation?.responsible?.role]);

  useEffect(() => {
    if (!conversation?.tags) {
      return;
    }
    setAvailableTags((prev) => {
      const merged = new Set(prev);
      let changed = false;
      for (const tag of conversation.tags ?? []) {
        if (!tag) {
          continue;
        }
        if (!merged.has(tag)) {
          merged.add(tag);
          changed = true;
        }
      }
      if (!changed) {
        return prev;
      }
      return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
    });
  }, [conversation?.tags]);

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

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const conversationChanged = previousConversationRef.current !== conversation?.id;
    const lastMessageId = messages[messages.length - 1]?.id;
    const appendedMessage =
      !conversationChanged &&
      messages.length > previousLengthRef.current &&
      lastMessageId !== undefined &&
      lastMessageId !== previousLastMessageRef.current;

    const scrollToBottom = (behavior: ScrollBehavior) => {
      if (typeof window === "undefined") {
        const node = scrollRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight;
        return;
      }

      window.requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (!node) return;
        if (behavior === "smooth") {
          node.scrollTo({ top: node.scrollHeight, behavior });
        } else {
          node.scrollTop = node.scrollHeight;
        }
      });
    };

    if (conversationChanged) {
      setStickToBottom(true);
      scrollToBottom("auto");
    } else if (appendedMessage && stickToBottom) {
      scrollToBottom(messages.length < 4 ? "auto" : "smooth");
    }

    previousConversationRef.current = conversation?.id;
    previousLengthRef.current = messages.length;
    previousLastMessageRef.current = lastMessageId;
  }, [conversation?.id, messages, stickToBottom]);

  const conversationId = conversation?.id;

  useEffect(() => {
    if (!conversationId) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [conversationId]);

  const runUpdate = async (changes: UpdateConversationPayload) => {
    if (!conversation) return;
    try {
      await onUpdateConversation(conversation.id, changes);
    } catch (error) {
      console.error("Falha ao atualizar conversa", error);
    }
  };

  const handleSend = async (payload: SendMessageInput) => {
    if (!conversation) return;
    await onSendMessage(payload);
    setStickToBottom(true);
  };

  const handleAssignResponsible: ChangeEventHandler<HTMLSelectElement> = async (event) => {
    await runUpdate({ responsibleId: event.target.value === "" ? null : event.target.value });
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!conversation) return;
    await runUpdate({ tags: tags.filter((tag) => tag !== tagToRemove) });
  };

  const handleTagSelectionChange: ChangeEventHandler<HTMLSelectElement> = async (event) => {
    const selected = Array.from(event.target.selectedOptions, (option) => option.value);
    if (
      selected.length === tags.length &&
      selected.every((value) => tags.includes(value)) &&
      tags.every((value) => selected.includes(value))
    ) {
      return;
    }
    await runUpdate({ tags: selected });
  };

  const handleClientSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!conversation) return;
    const trimmed = clientInput.trim();
    await runUpdate({
      clientName: trimmed.length > 0 ? trimmed : null,
      isLinkedToClient: trimmed.length > 0,
    });
  };

  const handleUnlinkClient = async () => {
    if (!conversation) return;
    setClientInput("");
    await runUpdate({ clientName: null, isLinkedToClient: false });
  };

  const handleAttributeSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!conversation) return;
    const label = newAttributeLabel.trim();
    const value = newAttributeValue.trim();
    if (!label || !value) return;
    const nextAttributes = [
      ...customAttributes,
      { id: createId(), label, value },
    ];
    await runUpdate({ customAttributes: nextAttributes });
    setNewAttributeLabel("");
    setNewAttributeValue("");
  };

  const handleRemoveAttribute = async (attributeId: string) => {
    if (!conversation) return;
    await runUpdate({
      customAttributes: customAttributes.filter((attribute) => attribute.id !== attributeId),
    });
  };

  const handleTogglePrivate = async () => {
    if (!conversation) return;
    await runUpdate({ isPrivate: !conversation.isPrivate });
  };

  const handleInternalNoteSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!conversation) return;
    const trimmed = internalNoteContent.trim();
    if (!trimmed) return;
    const newNote: ConversationInternalNote = {
      id: createId(),
      author: "Você",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const payload: UpdateConversationPayload = {
      internalNotes: [...internalNotes, newNote],
    };
    if (!conversation.isPrivate) {
      payload.isPrivate = true;
    }
    await runUpdate(payload);
    setInternalNoteContent("");
  };

  const handleRemoveInternalNote = async (noteId: string) => {
    if (!conversation) return;
    await runUpdate({
      internalNotes: internalNotes.filter((note) => note.id !== noteId),
    });
  };

  if (!conversation) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.mainColumn}>
          <div className={styles.viewportWrapper}>
            <div className={styles.deviceLinkPlaceholder}>
              <DeviceLinkContent
                isActive
                layout="inline"
                className={styles.deviceLinkContent}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const detailsPanelId = `chat-details-${conversation.id}`;
  const isClientLinked = Boolean(conversation?.isLinkedToClient && conversation?.clientName);

  return (
    <div
      className={styles.wrapper}
      data-private={conversation.isPrivate ? "true" : undefined}
      data-details-open={detailsOpen ? "true" : undefined}
    >
      <div className={styles.mainColumn}>
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <img src={conversation.avatar} alt="" aria-hidden="true" />
            <div className={styles.headerText}>
              <div className={styles.headerTitleRow}>
                <h2>{conversation.name}</h2>
                {conversation.isPrivate && (
                  <span className={styles.privateIndicator}>
                    <Shield size={14} aria-hidden="true" /> Privada
                  </span>
                )}
              </div>
              <div className={styles.headerDetails}>
                <span className={styles.status}>{conversation.shortStatus}</span>
                <span className={styles.phoneNumber}>
                  {conversation.phoneNumber ?? "Telefone não informado"}
                </span>
              </div>
              <div className={styles.headerMeta}>
                <span className={styles.headerResponsible}>
                  <UserRound size={14} aria-hidden="true" />
                  {conversation.responsible?.name ?? "Sem responsável"}
                </span>
                {tags.length > 0 ? (
                  <div className={styles.headerTags}>
                    {tags.map((tag) => (
                      <span key={tag} className={styles.headerTagChip}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className={styles.headerNoTags}>Sem etiquetas</span>
                )}
              </div>
              {visibleParticipants.length > 0 && (
                <div className={styles.participantsRow}>
                  <span className={styles.participantsLabel}>Participantes</span>
                  <div className={styles.participantsList} role="list">
                    {visibleParticipants.map((participant) => {
                      const name = getParticipantName(participant);
                      const avatar = participant.avatar?.trim();
                      const initials = getParticipantInitials(name);
                      return (
                        <div key={participant.id} className={styles.participantItem} role="listitem">
                          <div className={styles.participantAvatar} aria-hidden="true">
                            {avatar ? <img src={avatar} alt="" /> : <span>{initials}</span>}
                          </div>
                          <span className={styles.participantName} title={name}>
                            {name}
                          </span>
                        </div>
                      );
                    })}
                    {overflowCount > 0 && (
                      <span
                        className={styles.participantOverflow}
                        aria-label={`${overflowCount} participantes adicionais`}
                      >
                        +{overflowCount}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className={styles.actions} ref={menuRef}>
            <button type="button" className={styles.actionButton} aria-label="Criar tarefa">
              <CheckSquare size={18} aria-hidden="true" />
            </button>
            <button type="button" className={styles.actionButton} aria-label="Criar agendamento">
              <CalendarPlus size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.actionButton}
              aria-label={detailsOpen ? "Ocultar detalhes da conversa" : "Exibir detalhes da conversa"}
              aria-controls={detailsPanelId}
              aria-expanded={detailsOpen}
              data-active={detailsOpen ? "true" : undefined}
              onClick={() => setDetailsOpen(true)}
            >
              <Info size={18} aria-hidden="true" />
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
                      onOpenDeviceLinkModal?.();
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
          {isLoading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingOverlayContent} role="status" aria-live="polite" aria-busy="true">
                <span className={styles.loadingSpinner} aria-hidden="true" />
                <span>Carregando conversa...</span>
              </div>
            </div>
          )}
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
        <div className={styles.inputContainer}>
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </div>
      <aside
        id={detailsPanelId}
        className={`${styles.detailsPanel} ${detailsOpen ? styles.detailsPanelOpen : ""}`.trim()}
        aria-hidden={!detailsOpen}
      >
        <div className={styles.detailsHeader}>
          <h3>Detalhes da conversa</h3>
          <button
            type="button"
            className={styles.detailsCloseButton}
            onClick={() => setDetailsOpen(false)}
            aria-label="Fechar detalhes da conversa"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.detailsContent}>
          <div className={styles.metadataRow}>
            <div className={styles.metadataGroup}>
              <span className={styles.metadataLabel}>
                <UserRound size={14} aria-hidden="true" /> Responsável
              </span>
              <select
                className={styles.metadataSelect}
                value={conversation.responsible?.id ?? ""}
                onChange={handleAssignResponsible}
                disabled={isUpdatingConversation || isLoadingResponsibles}
              >
                <option value="">Sem responsável</option>
                {responsibleOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.role ? `${member.name} — ${member.role}` : member.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.metadataGroup}>
              <span className={styles.metadataLabel}>
                <Shield size={14} aria-hidden="true" /> Privacidade
              </span>
              <div className={styles.metadataActions}>
                <span>{conversation.isPrivate ? "Visível apenas para a equipe" : "Visível para toda a equipe"}</span>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleTogglePrivate}
                  disabled={isUpdatingConversation}
                >
                  {conversation.isPrivate ? "Tornar pública" : "Marcar como privada"}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.metadataGroup}>
            <span className={styles.metadataLabel}>Etiquetas</span>
            <div className={styles.tagsEditor}>
              <div className={styles.tagsList}>
                {tags.map((tag) => (
                  <span key={tag} className={styles.tagPill}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      aria-label={`Remover etiqueta ${tag}`}
                      disabled={isUpdatingConversation}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {tags.length === 0 && <span className={styles.emptyHint}>Nenhuma etiqueta cadastrada</span>}
              </div>
              <label className={styles.tagsSelector}>
                <span className={styles.tagsSelectorText}>Selecionar etiquetas</span>
                <select
                  multiple
                  size={tagSelectSize}
                  className={styles.tagsSelect}
                  value={tags}
                  onChange={handleTagSelectionChange}
                  disabled={isUpdatingConversation || isLoadingTags}
                  aria-label="Selecionar etiquetas da conversa"
                >
                  {tagOptions.length === 0 ? (
                    <option value="" disabled>
                      {isLoadingTags ? "Carregando etiquetas..." : "Nenhuma etiqueta disponível"}
                    </option>
                  ) : (
                    tagOptions.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))
                  )}
                </select>
              </label>
              {isLoadingTags && tagOptions.length > 0 && (
                <span className={styles.tagsLoading}>Atualizando lista de etiquetas…</span>
              )}
            </div>
          </div>

          <div className={styles.metadataGroup}>
            <span className={styles.metadataLabel}>Cliente vinculado</span>
            <form onSubmit={handleClientSubmit} className={styles.inlineForm}>
              <input
                type="text"
                value={clientInput}
                onChange={(event) => setClientInput(event.target.value)}
                list="client-suggestions"
                placeholder="Nome do cliente"
                aria-label="Nome do cliente"
                disabled={isUpdatingConversation}
              />
              <datalist id="client-suggestions">
                {CLIENT_SUGGESTIONS.map((client) => (
                  <option key={client} value={client} />
                ))}
              </datalist>
              <button type="submit" disabled={isUpdatingConversation}>
                {isClientLinked ? "Atualizar vínculo" : "Vincular cliente"}
              </button>
              {isClientLinked && (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleUnlinkClient}
                  disabled={isUpdatingConversation}
                >
                  Remover vínculo
                </button>
              )}
            </form>
          </div>

          <div className={styles.metadataGroup}>
            <span className={styles.metadataLabel}>Atributos personalizados</span>
            {customAttributes.length === 0 ? (
              <p className={styles.emptyHint}>Nenhum atributo cadastrado.</p>
            ) : (
              <ul className={styles.attributeList}>
                {customAttributes.map((attribute) => (
                  <li key={attribute.id}>
                    <div>
                      <strong>{attribute.label}</strong>
                      <span>{attribute.value}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttribute(attribute.id)}
                      aria-label={`Remover atributo ${attribute.label}`}
                      disabled={isUpdatingConversation}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAttributeSubmit} className={styles.attributeForm}>
              <input
                type="text"
                value={newAttributeLabel}
                onChange={(event) => setNewAttributeLabel(event.target.value)}
                placeholder="Nome do atributo"
                aria-label="Nome do atributo"
                disabled={isUpdatingConversation}
              />
              <input
                type="text"
                value={newAttributeValue}
                onChange={(event) => setNewAttributeValue(event.target.value)}
                placeholder="Valor"
                aria-label="Valor do atributo"
                disabled={isUpdatingConversation}
              />
              <button
                type="submit"
                disabled={
                  isUpdatingConversation ||
                  newAttributeLabel.trim().length === 0 ||
                  newAttributeValue.trim().length === 0
                }
              >
                Adicionar atributo
              </button>
            </form>
          </div>

          <div className={styles.metadataGroup}>
            <span className={styles.metadataLabel}>Notas internas</span>
            {internalNotes.length === 0 ? (
              <p className={styles.emptyHint}>Nenhuma nota registrada. Utilize este espaço para histórico interno.</p>
            ) : (
              <ul className={styles.noteList}>
                {internalNotes.map((note) => (
                  <li key={note.id}>
                    <div className={styles.noteContent}>{note.content}</div>
                    <div className={styles.noteMeta}>
                      <span>{note.author}</span>
                      <time dateTime={note.createdAt}>{noteFormatter.format(new Date(note.createdAt))}</time>
                      <button
                        type="button"
                        onClick={() => handleRemoveInternalNote(note.id)}
                        aria-label="Excluir nota"
                        disabled={isUpdatingConversation}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleInternalNoteSubmit} className={styles.noteForm}>
              <textarea
                value={internalNoteContent}
                onChange={(event) => setInternalNoteContent(event.target.value)}
                placeholder="Registrar nota interna"
                aria-label="Registrar nota interna"
                disabled={isUpdatingConversation}
              />
              <button
                type="submit"
                disabled={isUpdatingConversation || internalNoteContent.trim().length === 0}
              >
                Adicionar nota
              </button>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
};
