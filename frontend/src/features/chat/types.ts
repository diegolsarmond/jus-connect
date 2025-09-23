export type MessageStatus = "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "audio" | "file";

export interface MessageAttachment {
  id: string;
  type: "image" | "audio" | "file";
  url: string;
  name: string;
  downloadUrl?: string;
  mimeType?: string;
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

export interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
}

export type ConversationResponsible = TeamMember;

export interface ConversationParticipant {
  id: string;
  name: string;
  avatar?: string;
}

export interface ConversationCustomAttribute {
  id: string;
  label: string;
  value: string;
}

export interface ConversationInternalNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
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
  phoneNumber?: string;
  responsible?: ConversationResponsible | null;
  tags?: string[];
  isLinkedToClient?: boolean;
  clientId?: number | null;
  clientName?: string | null;
  customAttributes?: ConversationCustomAttribute[];
  isPrivate?: boolean;
  internalNotes?: ConversationInternalNote[];
  participants?: ConversationParticipant[];
  metadata?: Record<string, unknown> | null;
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
  phoneNumber?: string;
  responsibleId?: string | null;
  tags?: string[];
  isLinkedToClient?: boolean;
  clientId?: number | null;
  clientName?: string | null;
  customAttributes?: ConversationCustomAttribute[];
  isPrivate?: boolean;
  internalNotes?: ConversationInternalNote[];
  participants?: ConversationParticipant[];
  metadata?: Record<string, unknown> | null;
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
  phoneNumber?: string;
  responsibleId?: string | null;
}

export interface SendMessageInput {
  content: string;
  type?: MessageType;
  attachments?: MessageAttachment[];
}

export interface UpdateConversationPayload {
  responsibleId?: string | null;
  tags?: string[];
  phoneNumber?: string;
  isLinkedToClient?: boolean;
  clientId?: string | number | null;
  clientName?: string | null;
  customAttributes?: ConversationCustomAttribute[];
  isPrivate?: boolean;
  internalNotes?: ConversationInternalNote[];
}
