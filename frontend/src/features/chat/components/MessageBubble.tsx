import { forwardRef } from "react";
import { CheckCheck, Download, FileText } from "lucide-react";
import clsx from "clsx";
import type { Message } from "../types";
import { formatTime } from "../utils/format";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isFirstOfGroup: boolean;
  avatarUrl?: string;
}

export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  ({ message, isOwnMessage, isFirstOfGroup, avatarUrl }, ref) => {
    const containerClass = clsx(styles.row, isOwnMessage ? styles.outgoing : styles.incoming, {
      [styles.grouped]: !isFirstOfGroup,
    });

    return (
      <div ref={ref} className={containerClass} aria-live="polite">
        {isOwnMessage ? (
          <div className={styles.avatarPlaceholder} aria-hidden="true" />
        ) : isFirstOfGroup && avatarUrl ? (
          <img src={avatarUrl} alt="" className={styles.avatar} aria-hidden="true" />
        ) : (
          <div className={styles.avatarPlaceholder} aria-hidden="true" />
        )}
        <div className={styles.bubble}>
          {message.attachments?.map((attachment) => {
            if (attachment.type === "audio") {
              return (
                <div key={attachment.id} className={styles.audioWrapper}>
                  <audio
                    controls
                    src={attachment.url}
                    className={styles.audioPlayer}
                    aria-label={`Mensagem de áudio ${attachment.name}`}
                  >
                    Seu navegador não suporta a reprodução de áudio.
                  </audio>
                  {attachment.name && (
                    <span className={styles.attachmentCaption}>{attachment.name}</span>
                  )}
                </div>
              );
            }

            if (attachment.type === "image") {
              return (
                <img
                  key={attachment.id}
                  src={attachment.url}
                  alt={attachment.name}
                  className={styles.attachment}
                />
              );
            }

            const downloadHref = attachment.downloadUrl ?? attachment.url;
            const attachmentName = attachment.name || "Documento";
            return (
              <a
                key={attachment.id}
                href={downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.fileAttachment}
                download={attachmentName}
                aria-label={`Baixar ${attachmentName}`}
              >
                <span className={styles.fileIcon} aria-hidden="true">
                  <FileText size={22} />
                </span>
                <span className={styles.fileContent}>
                  <span className={styles.fileName}>{attachmentName}</span>
                  <span className={styles.fileMeta}>
                    <Download size={16} aria-hidden="true" />
                    <span>Baixar arquivo</span>
                  </span>
                </span>
              </a>
            );
          })}
          {message.type === "image" && !message.attachments?.length && (
            <img
              src={message.content}
              alt="Imagem enviada"
              className={styles.attachment}
            />
          )}
          {message.type === "audio" && !message.attachments?.length && (
            <div className={styles.audioPlaceholder} aria-label="Mensagem de áudio" role="note">
              🎧 Mensagem de áudio
            </div>
          )}
          {message.type === "file" && !message.attachments?.length && (
            <div className={styles.filePlaceholder} role="note" aria-label="Arquivo recebido">
              <span className={styles.fileIcon} aria-hidden="true">
                <FileText size={22} />
              </span>
              <span className={styles.fileContent}>
                <span className={styles.fileName}>{message.content || "Documento"}</span>
                <span className={styles.fileMeta}>Documento recebido</span>
              </span>
            </div>
          )}
          {message.content && (
            <p className={styles.text}>{message.content}</p>
          )}
          <div className={styles.meta}>
            <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>
            {isOwnMessage && (
              <span className={styles.statusIcon} aria-label={`Status: ${message.status}`}>
                <CheckCheck size={16} aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
);

MessageBubble.displayName = "MessageBubble";
