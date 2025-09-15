import { forwardRef } from "react";
import { CheckCheck } from "lucide-react";
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
          {message.attachments?.map((attachment) => (
            <img
              key={attachment.id}
              src={attachment.url}
              alt={attachment.name}
              className={styles.attachment}
            />
          ))}
          {message.type === "image" && !message.attachments?.length && (
            <img
              src={message.content}
              alt="Imagem enviada"
              className={styles.attachment}
            />
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
