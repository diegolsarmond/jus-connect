import { describe, expect, it, vi, afterEach } from "vitest";

import { __inlineAssetsForTesting } from "./pdf";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("inlineExternalAssets", () => {
  it("inlines remote images referenced in HTML", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div>
        <img src="https://cdn.example.com/assets/logo.png" alt="Logo" />
        <div class="with-background" style="background-image: url('https://cdn.example.com/assets/logo.png'); width: 10px; height: 10px;"></div>
      </div>
    `;

    const binary = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const response = new Response(binary, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });

    const fetchMock = vi.fn(async () => response.clone());
    vi.stubGlobal("fetch", fetchMock);

    await __inlineAssetsForTesting(container);

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src") ?? "").toMatch(/^data:image\/png;base64,/);

    const backgroundDiv = container.querySelector<HTMLElement>('.with-background');
    expect(backgroundDiv).not.toBeNull();
    expect(backgroundDiv?.getAttribute("style") ?? "").toContain("data:image/png;base64,");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call?.[1]?.credentials).toBe("include");
  });
});
