import { WAHAConfig, ChatOverview, Message, SendTextRequest, WAHAResponse, SessionStatus } from '@/types/waha';

class WAHAService {
  private config: WAHAConfig;

  constructor() {
    // WAHA API Configuration
    this.config = {
      baseUrl: 'https://waha.quantumtecnologia.com.br',
      apiKey: '4YF9gDywbivQWAP_JpGZsGTVgVz3gP55T1hXbYAg8y8',
      session: 'QuantumTecnologia01'
    };
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<WAHAResponse<T>> {
    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Api-Key': this.config.apiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      console.error('WAHA API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500 
      };
    }
  }

  // Get session status
  async getSessionStatus(): Promise<WAHAResponse<SessionStatus>> {
    return this.makeRequest<SessionStatus>(`/api/sessions/${this.config.session}`);
  }

  // Get chats overview
  async getChatsOverview(limit = 50, offset = 0): Promise<WAHAResponse<ChatOverview[]>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    
    const response = await this.makeRequest<any[]>(`/api/${this.config.session}/chats/overview?${params}`);
    
    if (response.data) {
      console.log('📊 Raw chats data:', response.data.length, 'chats');
      
      // Filtrar e mapear os chats válidos
      const validChats = response.data
        .filter((chat: any) => {
          // Filtrar chats inválidos como status@broadcast
          const isValid = chat.id && 
                         chat.id !== 'status@broadcast' && 
                         chat.name !== null;
          if (!isValid) {
            console.log('🚫 Chat filtrado:', chat.id, chat.name);
          }
          return isValid;
        })
        .map((chat: any): ChatOverview => {
          console.log('🔄 Processando chat:', chat.name, chat.id);
          return {
            id: chat.id,
            name: chat.name || 'Unknown Chat',
            isGroup: chat.id.includes('@g.us'),
            avatar: chat.picture || chat.avatar,
            lastMessage: chat.lastMessage ? {
              id: chat.lastMessage.id,
              body: chat.lastMessage.body,
              timestamp: chat.lastMessage.timestamp * 1000, // Converter para milliseconds
              fromMe: chat.lastMessage.fromMe,
              type: chat.lastMessage.hasMedia ? 'document' : 'text', // Ajustado para tipo válido
              ack: chat.lastMessage.ack,
              ackName: chat.lastMessage.ackName,
            } : undefined,
            unreadCount: 0, // WAHA não fornece isso na overview, seria necessário calcular
          };
        });
      
      console.log('✅ Chats válidos processados:', validChats.length);
      return { ...response, data: validChats };
    }
    
    return response as WAHAResponse<ChatOverview[]>;
  }

  // Get messages from a chat
  async getChatMessages(
    chatId: string, 
    options: {
      limit?: number;
      offset?: number;
      downloadMedia?: boolean;
    } = {}
  ): Promise<WAHAResponse<Message[]>> {
    const params = new URLSearchParams({
      limit: (options.limit || 50).toString(),
      offset: (options.offset || 0).toString(),
      downloadMedia: (options.downloadMedia || false).toString(),
    });
    
    const response = await this.makeRequest<any[]>(`/api/${this.config.session}/chats/${chatId}/messages?${params}`);
    
    if (response.data) {
      const messages = response.data.map((msg: any): Message => ({
        id: msg.id,
        chatId: chatId,
        body: msg.body,
        timestamp: msg.timestamp * 1000, // Converter para milliseconds
        fromMe: msg.fromMe,
        type: msg.hasMedia ? 'document' : 'text', // Ajustado para tipo válido
        ack: msg.ackName === 'READ' ? 'READ' : 
             msg.ackName === 'DELIVERED' ? 'DELIVERED' : 
             msg.ackName === 'SENT' ? 'SENT' : 'PENDING',
        author: msg.participant || msg.from,
        hasMedia: msg.hasMedia,
      }));
      
      return { ...response, data: messages };
    }
    
    return response as WAHAResponse<Message[]>;
  }

  // Send text message
  async sendTextMessage(request: Omit<SendTextRequest, 'session'>): Promise<WAHAResponse<Message>> {
    const payload: SendTextRequest = {
      ...request,
      session: this.config.session,
    };

    return this.makeRequest<Message>('/api/sendText', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Mark messages as read
  async markAsRead(chatId: string, messages = 30): Promise<WAHAResponse<void>> {
    const params = new URLSearchParams({
      messages: messages.toString(),
    });
    
    return this.makeRequest<void>(`/api/${this.config.session}/chats/${chatId}/messages/read?${params}`, {
      method: 'POST',
    });
  }

  // Get chat info
  async getChatInfo(chatId: string): Promise<WAHAResponse<any>> {
    return this.makeRequest(`/api/${this.config.session}/chats/${chatId}`);
  }

  // Get QR Code for authentication (if needed)
  async getQRCode(): Promise<WAHAResponse<{ mimetype: string; data: string }>> {
    return this.makeRequest(`/api/${this.config.session}/auth/qr?format=image`);
  }

  // Utility method to format phone number to WhatsApp ID
  static formatPhoneToWhatsAppId(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    // Add @c.us suffix for individual chats
    return `${cleaned}@c.us`;
  }

  // Utility method to extract phone number from WhatsApp ID
  static extractPhoneFromWhatsAppId(whatsappId: string): string {
    return whatsappId.replace('@c.us', '').replace('@g.us', '');
  }

  // Get webhook URL that should be configured in WAHA
  getWebhookUrl(baseUrl: string): string {
    return `${baseUrl}/api/webhook/waha`;
  }
}

export const wahaService = new WAHAService();
export default WAHAService;