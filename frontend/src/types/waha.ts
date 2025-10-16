export interface WAHAConfig {
  baseUrl: string;
  apiKey: string;
  session: string;
}

export interface ChatParticipant {
  id: string;
  name: string;
  avatar?: string;
}

export interface ChatOverview {
  id: string;
  name: string | null;
  isGroup: boolean;
  avatar?: string;
  picture?: string; // Adicionando picture que vem da API
  participants?: ChatParticipant[];
  isOnline?: boolean;
  lastSeen?: number;
  presence?: string;
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
  mimeType?: string;
}

export interface SendTextRequest {
  chatId: string;
  text: string;
  session: string;
  reply_to?: string;
  linkPreview?: boolean;
  linkPreviewHighQuality?: boolean;
}

interface SendMediaBaseRequest {
  chatId: string;
  session: string;
  caption?: string;
  quotedMsgId?: string;
}

export interface SendImageRequest extends SendMediaBaseRequest {
  image: string;
  filename?: string;
  mimetype?: string;
  isBase64?: boolean;
  asSticker?: boolean;
}

export interface SendFileRequest extends SendMediaBaseRequest {
  file: string;
  filename?: string;
  mimetype?: string;
  isBase64?: boolean;
}

export interface SendVoiceRequest extends SendMediaBaseRequest {
  voice: string;
  filename?: string;
  mimetype?: string;
  ptt?: boolean;
  waveform?: number[];
}

export interface WAHAResponse<T> {
  data?: T;
  error?: string;
  status?: number;
}

export interface WebhookEvent {
  event: 'message' | 'message.ack' | 'session.status' | 'chat.archive' | 'chat.unarchive';
  session: string;
  payload: unknown;
}

export interface MessageEvent extends WebhookEvent {
  event: 'message';
  payload: Message;
}

export interface SessionStatus {
  name: string;
  status: 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED';
}

export interface SendImageResponse extends Message {
  type: 'image';
}

export interface SendFileResponse extends Message {
  type: 'document' | 'video' | 'audio';
}

export interface SendVoiceResponse extends Message {
  type: 'audio';
}
