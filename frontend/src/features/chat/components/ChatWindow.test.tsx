import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { ChatWindow } from "./ChatWindow";
import type { ConversationSummary, Message } from "../types";

const mockFetchChatTags = vi.fn();

vi.mock("../services/chatApi", async () => {
  const actual = await vi.importActual<typeof import("../services/chatApi")>("../services/chatApi");
  return {
    ...actual,
    fetchChatTags: mockFetchChatTags,
  };
});

const baseConversation: ConversationSummary = {
  id: "conv-1",
  name: "Cliente Exemplo",
  avatar: "",
  shortStatus: "Aberta",
  unreadCount: 0,
  responsible: null,
  tags: [],
  isLinkedToClient: false,
  clientName: null,
  customAttributes: [],
  isPrivate: false,
  internalNotes: [],
  participants: [],
};

const baseMessages: Message[] = [
  {
    id: "msg-1",
    conversationId: "conv-1",
    sender: "me",
    content: "Olá",
    timestamp: new Date().toISOString(),
    status: "sent",
    type: "text",
  },
];

describe("ChatWindow responsável selector", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockFetchChatTags.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  const flushEffects = async () => {
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it("renders responsible options combining the operator name and role", async () => {
    mockFetchChatTags.mockResolvedValue([]);

    const handleSend = vi.fn().mockResolvedValue(undefined);
    const handleLoadOlder = vi.fn().mockResolvedValue([]);
    const handleUpdate = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <ChatWindow
          conversation={baseConversation}
          messages={baseMessages}
          hasMore={false}
          isLoading={false}
          isLoadingMore={false}
          onSendMessage={handleSend}
          onLoadOlder={handleLoadOlder}
          onUpdateConversation={handleUpdate}
          responsibleOptions={[
            { id: "1", name: "Ana Paula", role: "Coordenadora" },
            { id: "2", name: "Bruno Lima" },
          ]}
        />,
      );
    });

    await flushEffects();

    const selectElements = Array.from(container.querySelectorAll("select"));
    const responsibleSelect = selectElements.find((element) => {
      const options = Array.from(element.querySelectorAll("option"));
      return options.some((option) => option.textContent?.trim() === "Sem responsável");
    });

    expect(responsibleSelect).toBeDefined();

    const optionTexts = Array.from(responsibleSelect!.querySelectorAll("option")).map((option) =>
      option.textContent?.trim(),
    );

    expect(optionTexts).toContain("Ana Paula — Coordenadora");
    expect(optionTexts).toContain("Bruno Lima");
  });
});
