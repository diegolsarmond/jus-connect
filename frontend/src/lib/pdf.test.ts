import { describe, expect, it, vi, afterEach } from "vitest";

import { __inlineAssetsForTesting, createSimplePdfFromHtml } from "./pdf";

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

describe("createSimplePdfFromHtml", () => {
  it("preserves computed styles from style elements when generating rich PDFs", async () => {
    const html = `
      <style>
        .accent { color: rgb(255, 0, 0); font-weight: 700; }
        .accent::before { content: "Prefix"; display: inline-block; margin-right: 4px; }
      </style>
      <div class="accent">Styled</div>
    `;

    const fakeContext = {
      drawImage: vi.fn(),
      scale: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fakeContext);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
      const base64 = Buffer.from("jpeg-data").toString("base64");
      return `data:image/jpeg;base64,${base64}`;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => void 0);

    const rafMock = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("requestAnimationFrame", rafMock);

    class ImmediateImage {
      onload: (() => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      set src(_value: string) {
        if (typeof this.onload === "function") {
          this.onload();
        }
      }
    }

    vi.stubGlobal("Image", ImmediateImage as unknown as typeof Image);

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      bottom: 100,
      right: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const originalSerialize = XMLSerializer.prototype.serializeToString;
    let capturedHtml = "";
    vi.spyOn(XMLSerializer.prototype, "serializeToString").mockImplementation(function (this: XMLSerializer, node: Node) {
      if (node instanceof Element) {
        capturedHtml = (node as Element).outerHTML;
      }
      return originalSerialize.call(this, node);
    });

    const blob = await createSimplePdfFromHtml("Demo", html);

    expect(blob.type).toBe("application/pdf");
    expect(capturedHtml).toContain("data-pdf-export-pseudo");
    const styleMatch = capturedHtml.match(/<div[^>]+class=\"accent\"[^>]*style=\"([^\"]*)\"/);
    expect(styleMatch?.[1] ?? "").toContain("color: rgb(255, 0, 0)");

    const pseudoIdMatch = capturedHtml.match(/data-pdf-export-pseudo=\"(p\d+)\"/);
    expect(pseudoIdMatch).not.toBeNull();
    const pseudoSelector = `[data-pdf-export-pseudo="${pseudoIdMatch?.[1]}"]::before`;
    expect(capturedHtml).toContain(pseudoSelector);
    expect(capturedHtml).toContain("Prefix");
  });
});
