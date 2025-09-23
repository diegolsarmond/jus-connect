import { describe, expect, it } from "vitest";

import type { Message as WAHAMessage } from "@/types/waha";
import { mapMessageToCRM } from "./WhatsAppLayout";

const baseMessage: Pick<WAHAMessage, "chatId" | "fromMe" | "timestamp"> = {
  chatId: "chat-1",
  fromMe: false,
  timestamp: 1_700_000_000,
};

describe("mapMessageToCRM media handling", () => {
  it("ignores body payloads that match the media URL and uses friendly fallback for audio", () => {
    const message: WAHAMessage = {
      ...baseMessage,
      id: "audio-1",
      type: "audio",
      hasMedia: true,
      body: "https://cdn.example.com/audio.ogg",
      mediaUrl: "https://cdn.example.com/audio.ogg",
    };

    const mapped = mapMessageToCRM(message);

    expect(mapped.content).toBe("Mensagem de áudio");
    expect(mapped.attachments).toEqual([
      {
        id: "audio-1-attachment",
        type: "audio",
        url: "https://cdn.example.com/audio.ogg",
        downloadUrl: "https://cdn.example.com/audio.ogg",
        mimeType: undefined,
        name: "Mensagem de áudio",
      },
    ]);
  });

  it("omits data payloads from image content", () => {
    const message: WAHAMessage = {
      ...baseMessage,
      id: "image-1",
      type: "image",
      hasMedia: true,
      body: "data:image/png;base64,AAA",
      mediaUrl: "https://cdn.example.com/image.png",
    };

    const mapped = mapMessageToCRM(message);

    expect(mapped.content).toBe("Imagem");
    expect(mapped.attachments?.[0]?.name).toBe("Imagem");
  });

  it("uses a friendly description for documents without filename", () => {
    const message: WAHAMessage = {
      ...baseMessage,
      id: "file-1",
      type: "document",
      hasMedia: true,
      body: "http://api.example.com/download?id=123",
      mediaUrl: "https://cdn.example.com/file",
    };

    const mapped = mapMessageToCRM(message);

    expect(mapped.content).toBe("Documento");
    expect(mapped.attachments?.[0]).toMatchObject({
      type: "file",
      name: "Documento",
    });
  });
});
