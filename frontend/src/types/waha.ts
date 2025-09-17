export interface WAHAConfig {
  baseUrl: string;
  apiKey: string;
  session: string;
}

export interface ChatOverview {
  id: string;
  name: string | null;
  isGroup: boolean;
  avatar?: string;
  picture?: string; // Adicionando picture que vem da API
  lastMessage?: {
    id?: string;
    body?: string;
    timestamp: number;
    fromMe: boolean;
    type: string;
    ack?: number;
    ackName?: string;
  };
  unreadCount?: number;
  archived?: boolean;
  pinned?: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  body?: string;
  timestamp: number;
  fromMe: boolean;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact';
  ack?: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ';
  author?: string;
  quotedMsgId?: string;
  hasMedia?: boolean;
  mediaUrl?: string;
  filename?: string;
  caption?: string;
}

export interface SendTextRequest {
  chatId: string;
  text: string;
  session: string;
  reply_to?: string;
  linkPreview?: boolean;
  linkPreviewHighQuality?: boolean;
}

export interface WAHAResponse<T> {
  data?: T;
  error?: string;
  status?: number;
}

export interface WebhookEvent {
  event: 'message' | 'message.ack' | 'session.status' | 'chat.archive' | 'chat.unarchive';
  session: string;
  payload: any;
}

export interface MessageEvent extends WebhookEvent {
  event: 'message';
  payload: Message;
}

export interface SessionStatus {
  name: string;
  status: 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED';
}