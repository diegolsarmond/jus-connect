export type MessageStatus = "sent" | "delivered" | "read";
export type MessageType = "text" | "image";

export interface MessageAttachment {
  id: string;
  type: "image";
  url: string;
  name: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: "me" | "contact";
  content: string;
  timestamp: string;
  status: MessageStatus;
  type: MessageType;
  attachments?: MessageAttachment[];
}

export interface ConversationSummary {
  id: string;
  name: string;
  avatar: string;
  shortStatus: string;
  description?: string;
  unreadCount: number;
  pinned?: boolean;
  lastMessage?: ConversationLastMessage;
}

export interface ConversationLastMessage {
  id: string;
  content: string;
  preview: string;
  timestamp: string;
  sender: "me" | "contact";
  type: MessageType;
  status: MessageStatus;
}

export interface ConversationDatasetEntry {
  id: string;
  name: string;
  avatar: string;
  shortStatus: string;
  description?: string;
  unreadCount: number;
  pinned?: boolean;
}

export interface ChatDataset {
  conversations: ConversationDatasetEntry[];
  messages: Record<string, Message[]>;
}

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

export interface NewConversationInput {
  name: string;
  description?: string;
  avatar?: string;
}

export interface SendMessageInput {
  content: string;
  type?: MessageType;
  attachments?: MessageAttachment[];
}
