import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "../types";
import { MessageBubble } from "./MessageBubble";
import styles from "./MessageViewport.module.css";

interface MessageViewportProps {
  messages: Message[];
  avatarUrl?: string;
  containerRef: React.RefObject<HTMLDivElement>;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => Promise<Message[]>;
  onStickToBottomChange?: (isNearBottom: boolean) => void;
}

// Mantemos uma janela de mensagens limitada para simular virtualização sem depender de bibliotecas externas.
const WINDOW_COUNT = 40;
const OVERSCAN_PX = 320;

const estimateHeight = (message: Message) => {
  let base = 72;
  if (message.content) {
    base += Math.min(160, Math.ceil(message.content.length / 38) * 18);
  }
  if (message.attachments && message.attachments.length > 0) {
    base += 220;
  }
  return base;
};

export const MessageViewport = ({
  messages,
  avatarUrl,
  containerRef,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onStickToBottomChange,
}: MessageViewportProps) => {
  const heightsRef = useRef<Map<string, number>>(new Map());
  const [heightsVersion, setHeightsVersion] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(messages.length, WINDOW_COUNT) });
  const previousLengthRef = useRef(0);
  const lastStickStateRef = useRef<boolean | null>(null);

  const registerHeight = useCallback((id: string, height: number) => {
    const current = heightsRef.current.get(id);
    if (!current || Math.abs(current - height) > 2) {
      heightsRef.current.set(id, height);
      setHeightsVersion((value) => value + 1);
    }
  }, []);

  const prefixSums = useMemo(() => {
    // 'heightsVersion' garante o recálculo quando uma bolha muda de tamanho.
    const version = heightsVersion;
    void version;
    const sums: number[] = [0];
    for (const message of messages) {
      const height = heightsRef.current.get(message.id) ?? estimateHeight(message);
      sums.push(sums[sums.length - 1] + height);
    }
    return sums;
  }, [messages, heightsVersion]);

  const getIndexForOffset = useCallback(
    (offset: number) => {
      let low = 0;
      let high = prefixSums.length - 1;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (prefixSums[mid] <= offset) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return Math.max(0, low - 1);
    },
    [prefixSums],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    const container = containerRef.current;
    if (!container) return;
    const previousHeight = container.scrollHeight;
    const previousTop = container.scrollTop;
    const loaded = await onLoadMore();
    if (!loaded.length) return;
    requestAnimationFrame(() => {
      const node = containerRef.current;
      if (node) {
        const heightDiff = node.scrollHeight - previousHeight;
        node.scrollTop = previousTop + heightDiff;
      }
    });
  }, [containerRef, hasMore, isLoadingMore, onLoadMore]);

  const updateRange = useCallback(
    (scrollTop: number, clientHeight: number, scrollHeight: number) => {
      const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 120;
      if (lastStickStateRef.current !== isNearBottom) {
        lastStickStateRef.current = isNearBottom;
        onStickToBottomChange?.(isNearBottom);
      }
      const startOffset = Math.max(0, scrollTop - OVERSCAN_PX);
      const endOffset = Math.min(scrollHeight, scrollTop + clientHeight + OVERSCAN_PX);
      const startIndex = getIndexForOffset(startOffset);
      const endIndex = Math.min(messages.length, getIndexForOffset(endOffset) + 1);
      setVisibleRange((previous) => {
        if (previous.start === startIndex && previous.end === endIndex) {
          return previous;
        }
        return { start: startIndex, end: endIndex };
      });
    },
    [getIndexForOffset, messages.length, onStickToBottomChange],
  );

  const handleScroll: React.UIEventHandler<HTMLDivElement> = (event) => {
    const target = event.currentTarget;
    const { scrollTop, clientHeight, scrollHeight } = target;
    if (scrollTop < 120 && hasMore && !isLoadingMore) {
      void loadMore();
    }
    updateRange(scrollTop, clientHeight, scrollHeight);
  };

  useEffect(() => {
    if (previousLengthRef.current === 0 && messages.length > 0) {
      const end = messages.length;
      const start = Math.max(0, end - WINDOW_COUNT);
      setVisibleRange({ start, end });
    }
    previousLengthRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    updateRange(container.scrollTop, container.clientHeight, container.scrollHeight);
  }, [containerRef, updateRange, prefixSums]);

  const paddingTop = prefixSums[visibleRange.start] ?? 0;
  const paddingBottom = (prefixSums[prefixSums.length - 1] ?? 0) - (prefixSums[visibleRange.end] ?? 0);

  const visibleMessages = messages.slice(visibleRange.start, visibleRange.end);

  return (
    <div ref={containerRef} className={styles.container} onScroll={handleScroll}>
      {hasMore && isLoadingMore && <div className={styles.loading}>Carregando histórico...</div>}
      <div className={styles.spacer} style={{ paddingTop, paddingBottom }}>
        {visibleMessages.map((message, index) => {
          const absoluteIndex = visibleRange.start + index;
          const previous = messages[absoluteIndex - 1];
          const isFirstOfGroup = !previous || previous.sender !== message.sender;
          return (
            <MeasuredBubble
              key={message.id}
              message={message}
              isOwnMessage={message.sender === "me"}
              isFirstOfGroup={isFirstOfGroup}
              avatarUrl={avatarUrl}
              onMeasure={registerHeight}
            />
          );
        })}
      </div>
    </div>
  );
};

interface MeasuredBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isFirstOfGroup: boolean;
  avatarUrl?: string;
  onMeasure: (id: string, height: number) => void;
}

const MeasuredBubble = ({ message, isOwnMessage, isFirstOfGroup, avatarUrl, onMeasure }: MeasuredBubbleProps) => {
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = bubbleRef.current;
    if (!node) return;
    const update = () => {
      onMeasure(message.id, node.getBoundingClientRect().height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [message.id, onMeasure, message.content, message.attachments]);

  return (
    <MessageBubble
      ref={bubbleRef}
      message={message}
      isOwnMessage={isOwnMessage}
      isFirstOfGroup={isFirstOfGroup}
      avatarUrl={avatarUrl}
    />
  );
};
