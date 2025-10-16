import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Laugh, Link as LinkIcon, Paperclip, Send, FileText, Mic } from "lucide-react";
import type { MessageAttachment, MessageType, SendMessageInput } from "../types";
import styles from "./ChatInput.module.css";

interface ChatInputProps {
  onSend: (payload: SendMessageInput) => Promise<void> | void;
  disabled?: boolean;
  onTypingActivity?: (isTyping: boolean) => void;
}

const EMOJI_SUGGESTIONS = [
  "😀",
  "😁",
  "😂",
  "😊",
  "😉",
  "😍",
  "😘",
  "🤝",
  "👍",
  "🙏",
  "🚀",
  "💼",
  "📌",
  "🗂️",
  "📎",
  "⚖️",
  "📆",
  "📝",
  "✅",
  "❗",
  "💬",
  "📞",
  "📄",
  "🛡️",
];

export const ChatInput = ({ onSend, disabled = false, onTypingActivity }: ChatInputProps) => {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    if (disabled) {
      onTypingActivity?.(false);
    }
  }, [disabled, onTypingActivity]);

  const canSend = value.trim().length > 0 && !isSending && !disabled;

  const sendTextMessage = async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      await onSend({ content: value.trim(), type: "text" });
      setValue("");
    } finally {
      setIsSending(false);
      onTypingActivity?.(false);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  };

  const sendAttachment = async (file: File, type: MessageType = "image") => {
    const objectUrl = URL.createObjectURL(file);
    const attachment: MessageAttachment = {
      id: `upload-${Date.now()}`,
      type,
      url: objectUrl,
      name: file.name,
    };
    setIsSending(true);
    try {
      await onSend({ content: file.name, type, attachments: [attachment] });
      setShowAttachments(false);
    } finally {
      setIsSending(false);
      onTypingActivity?.(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendTextMessage();
    }
  };

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    onTypingActivity?.(nextValue.trim().length > 0);
  };

  const handleBlur: React.FocusEventHandler<HTMLTextAreaElement> = () => {
    onTypingActivity?.(false);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    const files = Array.from(event.clipboardData?.files ?? []);
    const imageFile = files.find((file) => file.type.startsWith("image/"));
    if (imageFile) {
      event.preventDefault();
      void sendAttachment(imageFile, "image");
    }
  };

  const handleEmojiClick = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const newValue = `${value.slice(0, selectionStart)}${emoji}${value.slice(selectionEnd)}`;
    setValue(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const caretPosition = selectionStart + emoji.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
    });
  };

  const handleFileInputChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      void sendAttachment(file, file.type.startsWith("image/") ? "image" : "file");
      event.target.value = "";
    }
  };

  const handleDocumentInputChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      void sendAttachment(file, "file");
      event.target.value = "";
    }
  };

  const handleAudioInputChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      void sendAttachment(file, "audio");
      event.target.value = "";
    }
  };

  const toggleEmoji = () => {
    setShowEmojiPicker((prev) => !prev);
    setShowAttachments(false);
    textareaRef.current?.focus();
  };

  const toggleAttachments = () => {
    setShowAttachments((prev) => !prev);
    setShowEmojiPicker(false);
  };

  const attachmentOptions = useMemo(
    () => [
      {
        icon: <Image size={18} aria-hidden="true" />, // purely decorativo
        label: "Imagem da galeria",
        action: () => fileInputRef.current?.click(),
      },
      {
        icon: <Mic size={18} aria-hidden="true" />, // purely decorativo
        label: "Mensagem de áudio",
        action: () => audioInputRef.current?.click(),
      },
      {
        icon: <FileText size={18} aria-hidden="true" />, // purely decorativo
        label: "Documento PDF",
        action: () => documentInputRef.current?.click(),
      },
      {
        icon: <LinkIcon size={18} aria-hidden="true" />, // purely decorativo
        label: "Compartilhar link seguro",
        action: () =>
          setValue((current) =>
            `${current}${current && !current.endsWith(" ") ? " " : ""}https://jus.connect/link`,
          ),
      },
    ],
    [],
  );

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={toggleAttachments}
          aria-haspopup="true"
          aria-expanded={showAttachments}
          aria-label="Anexar arquivo"
        >
          <Paperclip size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={toggleEmoji}
          aria-haspopup="true"
          aria-expanded={showEmojiPicker}
          aria-label="Inserir emoji"
        >
          <Laugh size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.textareaWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder="Escreva uma mensagem"
          aria-label="Campo para digitar mensagem"
          disabled={disabled}
        />
        <button
          type="button"
          className={styles.sendButton}
          onClick={() => void sendTextMessage()}
          disabled={!canSend}
          aria-label="Enviar mensagem"
        >
          <Send size={18} aria-hidden="true" />
        </button>
        {showAttachments && (
          <div className={styles.popover} role="menu">
            {attachmentOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  option.action();
                  setShowAttachments(false);
                }}
                role="menuitem"
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
        {showEmojiPicker && (
          <div className={styles.emojiPicker} role="menu">
            {EMOJI_SUGGESTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.emojiButton}
                onClick={() => handleEmojiClick(emoji)}
                aria-label={`Inserir emoji ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: "none" }}
        onChange={handleDocumentInputChange}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        style={{ display: "none" }}
        onChange={handleAudioInputChange}
      />
    </div>
  );
};
