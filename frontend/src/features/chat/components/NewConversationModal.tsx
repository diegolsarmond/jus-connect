import { useEffect, useMemo, useState } from "react";
import { UserPlus, Sparkles } from "lucide-react";
import type { ConversationSummary } from "../types";
import { Modal } from "./Modal";
import styles from "./NewConversationModal.module.css";
import { normalizeText } from "../utils/format";

interface NewConversationModalProps {
  open: boolean;
  suggestions: ConversationSummary[];
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: (name: string) => Promise<string | null>;
}

export const NewConversationModal = ({
  open,
  suggestions,
  onClose,
  onSelectConversation,
  onCreateConversation,
}: NewConversationModalProps) => {
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setIsCreating(false);
    }
  }, [open]);

  const normalizedQuery = normalizeText(search);
  const filtered = useMemo(() => {
    if (!normalizedQuery) return suggestions;
    return suggestions.filter((conversation) => {
      const normalizedName = normalizeText(conversation.name);
      const normalizedDescription = normalizeText(conversation.description ?? "");
      return (
        normalizedName.includes(normalizedQuery) ||
        (normalizedDescription && normalizedDescription.includes(normalizedQuery))
      );
    });
  }, [normalizedQuery, suggestions]);

  const exactMatch = useMemo(() => {
    if (!normalizedQuery) return false;
    return suggestions.some((conversation) => normalizeText(conversation.name) === normalizedQuery);
  }, [normalizedQuery, suggestions]);

  const canCreate = normalizedQuery.length > 0 && !exactMatch && !isCreating;

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    try {
      const createdId = await onCreateConversation(search.trim());
      if (createdId) {
        onSelectConversation(createdId);
        onClose();
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter" && canCreate) {
      event.preventDefault();
      void handleCreate();
    }
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Iniciar nova conversa">
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <h2>Nova conversa</h2>
          <p>Pesquise um contato existente ou crie um novo canal de atendimento instantaneamente.</p>
        </header>
        <div className={styles.search}>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pesquisar cliente, processo ou etiqueta"
            aria-label="Pesquisar contato"
            autoFocus
          />
          <button
            type="button"
            className={styles.createButton}
            onClick={handleCreate}
            disabled={!canCreate}
          >
            <UserPlus size={18} aria-hidden="true" />
            {isCreating ? "Criando..." : "Criar contato"}
          </button>
        </div>
        <section aria-live="polite">
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <Sparkles size={18} aria-hidden="true" /> Nenhum resultado. Pressione Enter para criar "{search.trim()}".
            </div>
          ) : (
            <ul className={styles.list} role="listbox" aria-label="Contatos sugeridos">
              {filtered.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      onSelectConversation(conversation.id);
                      onClose();
                    }}
                    aria-label={`Abrir conversa com ${conversation.name}`}
                  >
                    <img
                      src={conversation.avatar}
                      alt=""
                      className={styles.itemAvatar}
                      aria-hidden="true"
                    />
                    <div>
                      <div className={styles.itemName}>{conversation.name}</div>
                      {conversation.description && (
                        <div className={styles.itemDescription}>{conversation.description}</div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
};
