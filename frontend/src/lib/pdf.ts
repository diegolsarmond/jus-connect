const PDF_PAGE_WIDTH = 595; // A4 in points
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN_LEFT = 72;
const PDF_MARGIN_TOP = 60;
const PDF_MARGIN_BOTTOM = 60;
const PDF_FONT_SIZE = 12;
const PDF_LINE_HEIGHT = 16;

const encoder = new TextEncoder();

const WIN_ANSI_EXTRA = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function mapUnicodeToPdfByte(codePoint: number): number {
  if (codePoint === 0x0d) {
    return 0x0a;
  }
  if (codePoint >= 0x00 && codePoint <= 0xff) {
    return codePoint;
  }
  const mapped = WIN_ANSI_EXTRA.get(codePoint);
  if (typeof mapped === "number") {
    return mapped;
  }
  return 0x3f; // '?'
}

function encodePdfDocString(text: string): string {
  let result = "";
  for (const char of text ?? "") {
    const codePoint = char.codePointAt(0);
    if (typeof codePoint !== "number") {
      continue;
    }
    result += String.fromCharCode(mapUnicodeToPdfByte(codePoint));
  }
  return result;
}

function stringToPdfBytes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of value ?? "") {
    const codePoint = char.codePointAt(0);
    if (typeof codePoint !== "number") {
      continue;
    }
    if (codePoint >= 0x00 && codePoint <= 0xff) {
      bytes.push(codePoint);
    } else {
      bytes.push(0x3f);
    }
  }
  return Uint8Array.from(bytes);
}

function hasDomSupport(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function htmlToPlainText(html: string): string {
  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = html;
    const text = container.innerText.replace(/\r\n/g, "\n");
    container.remove();
    return text;
  }

  const normalized = html.replace(/\r\n/g, "\n");
  const withBreaks = normalized
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>\s*/gi, "\n• ")
    .replace(/<\s*\/li\s*>/gi, "")
    .replace(/<\s*(h[1-6]|p|div|section|article|header|footer)[^>]*>\s*/gi, "\n\n")
    .replace(/<\s*\/(h[1-6]|p|div|section|article|header|footer)\s*>/gi, "\n\n")
    .replace(/<\s*\/?(ul|ol)[^>]*>/gi, "\n\n");

  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");
  const withoutNbsp = withoutTags.replace(/\u00a0/g, " ");
  const cleaned = withoutNbsp
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

function wrapLine(line: string, maxChars = 90): string[] {
  const trimmed = line.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) {
    return [""];
  }

  const words = trimmed.split(" ");
  const result: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let i = 0; i < word.length; i += maxChars) {
          result.push(word.slice(i, i + maxChars));
        }
        current = "";
      }
      continue;
    }

    if ((current + " " + word).length <= maxChars) {
      current = `${current} ${word}`;
      continue;
    }

    result.push(current);
    if (word.length <= maxChars) {
      current = word;
    } else {
      for (let i = 0; i < word.length; i += maxChars) {
        result.push(word.slice(i, i + maxChars));
      }
      current = "";
    }
  }

  if (current.length > 0) {
    result.push(current);
  }

  if (result.length === 0) {
    result.push("");
  }

  return result;
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function renderTextPage(lines: string[]): string {
  const safeLines = lines.length > 0 ? lines : [""];
  const startY = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;

  const parts: string[] = [
    "BT",
    `/F1 ${PDF_FONT_SIZE} Tf`,
    `${PDF_LINE_HEIGHT} TL`,
    `${PDF_MARGIN_LEFT} ${startY} Td`,
  ];

  safeLines.forEach((line, index) => {
    if (index > 0) {
      parts.push("T*");
    }
    const encodedLine = encodePdfDocString(line);
    parts.push(`(${escapePdfText(encodedLine)}) Tj`);
  });

  parts.push("ET");
  return parts.join("\n");
}

function buildTextPdf(pages: string[][]): Uint8Array {
  const objects: { id: number; content: string }[] = [];

  const addObject = (content: string) => {
    const id = objects.length + 1;
    objects.push({ id, content });
    return id;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );

  const pageIds: number[] = [];

  pages.forEach((pageLines) => {
    const content = renderTextPage(pageLines);
    const contentBytes = stringToPdfBytes(content);
    const contentObjectId = addObject(
      `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`,
    );
    const pageObjectId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Contents ${contentObjectId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    pageIds.push(pageObjectId);
  });

  if (pageIds.length === 0) {
    const emptyContent = renderTextPage([""]);
    const contentBytes = stringToPdfBytes(emptyContent);
    const contentObjectId = addObject(
      `<< /Length ${contentBytes.length} >>\nstream\n${emptyContent}\nendstream`,
    );
    const pageObjectId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Contents ${contentObjectId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    pageIds.push(pageObjectId);
  }

  objects[catalogId - 1].content = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1].content = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageIds.length} >>`;

  const header = "%PDF-1.4\n";
  const headerBytes = stringToPdfBytes(header);
  const objectBytes: Uint8Array[] = [];
  const xrefPositions: number[] = [];
  let offset = headerBytes.length;

  objects.forEach((obj) => {
    const objectString = `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
    const bytes = stringToPdfBytes(objectString);
    objectBytes.push(bytes);
    xrefPositions.push(offset);
    offset += bytes.length;
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  xref += xrefPositions
    .map((position) => `${position.toString().padStart(10, "0")} 00000 n \n`)
    .join("");
  const xrefBytes = stringToPdfBytes(xref);

  offset += xrefBytes.length;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const trailerBytes = stringToPdfBytes(trailer);

  const totalLength =
    headerBytes.length +
    objectBytes.reduce((acc, bytes) => acc + bytes.length, 0) +
    xrefBytes.length +
    trailerBytes.length;

  const pdfBytes = new Uint8Array(totalLength);
  let position = 0;
  pdfBytes.set(headerBytes, position);
  position += headerBytes.length;

  objectBytes.forEach((bytes) => {
    pdfBytes.set(bytes, position);
    position += bytes.length;
  });

  pdfBytes.set(xrefBytes, position);
  position += xrefBytes.length;
  pdfBytes.set(trailerBytes, position);

  return pdfBytes;
}

function createTextPdfBlob(title: string, html: string): Blob {
  const text = htmlToPlainText(html ?? "");
  const rawLines = text.split(/\r?\n/);
  const wrappedLines = rawLines.flatMap((line) => wrapLine(line));

  const sanitizedTitle = title && title.trim().length > 0 ? title.trim() : "Documento";
  if (sanitizedTitle.length > 0) {
    wrappedLines.unshift("");
    wrappedLines.unshift(sanitizedTitle);
  }

  if (wrappedLines.length === 0) {
    wrappedLines.push("");
  }

  const usableHeight = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP - PDF_MARGIN_BOTTOM;
  const linesPerPage = Math.max(Math.floor(usableHeight / PDF_LINE_HEIGHT), 1);
  const pages: string[][] = [];

  for (let index = 0; index < wrappedLines.length; index += linesPerPage) {
    pages.push(wrappedLines.slice(index, index + linesPerPage));
  }

  const pdfBytes = buildTextPdf(pages);
  return new Blob([pdfBytes], { type: "application/pdf" });
}

function getBaseUrl(): string {
  if (typeof document !== "undefined" && typeof document.baseURI === "string" && document.baseURI) {
    return document.baseURI;
  }
  if (typeof window !== "undefined" && typeof window.location?.href === "string") {
    return window.location.href;
  }
  return "http://localhost/";
}

function isDataUrl(value: string): boolean {
  return /^data:/i.test(value);
}

function isHashUrl(value: string): boolean {
  return value.startsWith("#");
}

function isBlobUrl(value: string): boolean {
  return value.toLowerCase().startsWith("blob:");
}

function shouldInlineUrl(value: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  if (isDataUrl(lower) || isHashUrl(lower) || isBlobUrl(lower)) return false;
  if (lower.startsWith("javascript:")) return false;
  if (lower.startsWith("mailto:")) return false;
  if (lower.startsWith("about:")) return false;
  return true;
}

function resolveAssetUrl(rawUrl: string, baseUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (!shouldInlineUrl(trimmed)) {
    return trimmed;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch (error) {
    if (typeof console !== "undefined") {
      console.warn("Não foi possível resolver a URL do recurso", trimmed, error);
    }
    return null;
  }
}

function guessMimeTypeFromUrl(url: string): string | null {
  const normalized = url.split(/[?#]/)[0] ?? url;
  const extension = normalized.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "svg":
    case "svgz":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "ico":
    case "cur":
      return "image/x-icon";
    default:
      return null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof btoa === "function") {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }

  throw new Error("Base64 encoding não disponível neste ambiente");
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  throw new Error("Base64 decoding não disponível neste ambiente");
}

type AssetCache = Map<string, Promise<string | null>>;

async function fetchAssetAsDataUri(
  url: string,
  cache: AssetCache,
): Promise<string | null> {
  const existing = cache.get(url);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const contentTypeHeader = response.headers.get("Content-Type");
      const contentType = contentTypeHeader?.split(";")[0]?.trim() ?? guessMimeTypeFromUrl(url) ?? "application/octet-stream";
      const base64 = arrayBufferToBase64(arrayBuffer);
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      if (typeof console !== "undefined") {
        console.warn("Falha ao carregar recurso externo para exportação", url, error);
      }
      return null;
    }
  })();

  cache.set(url, promise);
  return promise;
}

async function replaceCssUrls(
  cssText: string,
  baseUrl: string,
  cache: AssetCache,
): Promise<string> {
  const regex = /url\((['\"]?)([^'\")]+)\1\)/gi;
  let match: RegExpExecArray | null;
  let cursor = 0;
  let result = "";

  while ((match = regex.exec(cssText)) !== null) {
    result += cssText.slice(cursor, match.index);
    cursor = regex.lastIndex;

    const rawUrl = match[2]?.trim();
    if (!rawUrl) {
      result += match[0];
      continue;
    }

    const resolved = resolveAssetUrl(rawUrl, baseUrl);
    if (!resolved || !shouldInlineUrl(resolved)) {
      result += match[0];
      continue;
    }

    const dataUri = await fetchAssetAsDataUri(resolved, cache);
    if (dataUri) {
      result += `url("${dataUri}")`;
    } else {
      result += match[0];
    }
  }

  result += cssText.slice(cursor);
  return result;
}

async function inlineImageSources(
  container: ParentNode,
  baseUrl: string,
  cache: AssetCache,
): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      const src = image.getAttribute("src");
      if (!src) return;
      const resolved = resolveAssetUrl(src, baseUrl);
      if (!resolved || !shouldInlineUrl(resolved)) return;
      const dataUri = await fetchAssetAsDataUri(resolved, cache);
      if (dataUri) {
        image.setAttribute("src", dataUri);
        if (image.hasAttribute("srcset")) {
          image.removeAttribute("srcset");
        }
      }
    }),
  );
}

async function inlineStyleAttributes(
  container: ParentNode,
  baseUrl: string,
  cache: AssetCache,
): Promise<void> {
  const styledElements = Array.from(container.querySelectorAll<HTMLElement>("[style]"));
  await Promise.all(
    styledElements.map(async (element) => {
      const styleText = element.getAttribute("style");
      if (!styleText) return;
      const replaced = await replaceCssUrls(styleText, baseUrl, cache);
      if (replaced !== styleText) {
        element.setAttribute("style", replaced);
      }
    }),
  );
}

async function inlineStyleElements(
  container: ParentNode,
  baseUrl: string,
  cache: AssetCache,
): Promise<void> {
  const styleNodes = Array.from(container.querySelectorAll<HTMLStyleElement>("style"));
  await Promise.all(
    styleNodes.map(async (styleNode) => {
      const cssText = styleNode.textContent;
      if (!cssText) return;
      const replaced = await replaceCssUrls(cssText, baseUrl, cache);
      if (replaced !== cssText) {
        styleNode.textContent = replaced;
      }
    }),
  );
}

async function inlineExternalAssets(
  container: HTMLElement,
  baseUrl: string,
  cache?: AssetCache,
): Promise<AssetCache> {
  const effectiveCache = cache ?? new Map<string, Promise<string | null>>();
  await inlineImageSources(container, baseUrl, effectiveCache);
  await inlineStyleAttributes(container, baseUrl, effectiveCache);
  await inlineStyleElements(container, baseUrl, effectiveCache);
  return effectiveCache;
}

const PSEUDO_ELEMENT_ATTRIBUTE = "data-pdf-export-pseudo";

function isElementWithStyle(element: Element): element is HTMLElement | SVGElement {
  return typeof (element as HTMLElement).style !== "undefined";
}

function applyComputedStyle(target: CSSStyleDeclaration, computed: CSSStyleDeclaration): void {
  if (typeof computed.cssText === "string" && computed.cssText.length > 0) {
    target.cssText = computed.cssText;
    return;
  }

  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (!property) {
      continue;
    }
    const value = computed.getPropertyValue(property);
    const priority = computed.getPropertyPriority(property);
    if (priority) {
      target.setProperty(property, value, priority);
    } else {
      target.setProperty(property, value);
    }
  }
}

function cssTextFromComputed(style: CSSStyleDeclaration): string {
  if (typeof style.cssText === "string" && style.cssText.length > 0) {
    return style.cssText;
  }

  const declarations: string[] = [];
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (!property) {
      continue;
    }
    const value = style.getPropertyValue(property);
    const priority = style.getPropertyPriority(property);
    const suffix = priority ? ` !${priority}` : "";
    declarations.push(`${property}: ${value}${suffix};`);
  }
  return declarations.join(" ");
}

function shouldCopyPseudoElement(style: CSSStyleDeclaration): boolean {
  const content = style.getPropertyValue("content");
  if (!content || content === "none" || content === "normal") {
    return false;
  }
  const trimmed = content.trim();
  if (!trimmed || trimmed === "\"\"" || trimmed === "''") {
    return false;
  }
  return true;
}

function cloneComputedStyles(
  source: Element,
  target: Element,
  pseudoRules: string[],
  counter: { value: number },
): void {
  if (isElementWithStyle(target)) {
    const computed = window.getComputedStyle(source);
    applyComputedStyle(target.style, computed);

    (["::before", "::after"] as const).forEach((pseudo) => {
      const pseudoStyle = window.getComputedStyle(source, pseudo);
      if (!shouldCopyPseudoElement(pseudoStyle)) {
        return;
      }

      let identifier = target.getAttribute(PSEUDO_ELEMENT_ATTRIBUTE);
      if (!identifier) {
        counter.value += 1;
        identifier = `p${counter.value}`;
        target.setAttribute(PSEUDO_ELEMENT_ATTRIBUTE, identifier);
      }

      const cssText = cssTextFromComputed(pseudoStyle);
      if (cssText) {
        pseudoRules.push(`[${PSEUDO_ELEMENT_ATTRIBUTE}="${identifier}"]${pseudo} { ${cssText} }`);
      }
    });
  }

  const sourceChildren = Array.from(source.children);
  const targetChildren = Array.from(target.children);
  sourceChildren.forEach((sourceChild, index) => {
    const targetChild = targetChildren[index];
    if (sourceChild && targetChild) {
      cloneComputedStyles(sourceChild, targetChild, pseudoRules, counter);
    }
  });
}

async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  const waits = images.map((image) => {
    if ((image as HTMLImageElement).decode) {
      return (image as HTMLImageElement)
        .decode()
        .catch(() => void 0);
    }

    if (image.complete && image.naturalWidth > 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  });

  await Promise.all(waits);
}

async function waitForFonts(): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts && typeof fonts.ready?.then === "function") {
    try {
      await fonts.ready;
    } catch (error) {
      if (typeof console !== "undefined") {
        console.warn("Não foi possível garantir o carregamento das fontes", error);
      }
    }
  }
}

function ensureTitleNode(container: HTMLElement, title: string): void {
  const sanitizedTitle = title && title.trim().length > 0 ? title.trim() : "Documento";
  if (!sanitizedTitle) {
    return;
  }

  const heading = document.createElement("h1");
  heading.textContent = sanitizedTitle;
  heading.style.margin = "0 0 16px";
  heading.style.fontSize = "24px";
  heading.style.fontWeight = "600";
  heading.style.lineHeight = "1.2";
  heading.style.color = "#111827";

  container.insertBefore(heading, container.firstChild);
}

type RenderToCanvasOptions = {
  baseUrl?: string;
  assetCache?: AssetCache;
};

async function renderElementToCanvas(
  element: HTMLElement,
  options?: RenderToCanvasOptions,
): Promise<HTMLCanvasElement> {
  const rect = element.getBoundingClientRect();
  const width = Math.max(Math.ceil(rect.width), 1);
  const height = Math.max(Math.ceil(rect.height), 1);

  const clone = element.cloneNode(true) as HTMLElement;
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const pseudoRules: string[] = [];
    const counter = { value: 0 };
    cloneComputedStyles(element, clone, pseudoRules, counter);
    if (pseudoRules.length > 0) {
      const styleNode = document.createElement("style");
      styleNode.textContent = pseudoRules.join("\n");
      clone.insertBefore(styleNode, clone.firstChild);
    }
  }

  const baseUrl = options?.baseUrl ?? getBaseUrl();
  await inlineExternalAssets(clone, baseUrl, options?.assetCache);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(Math.round(width * scale), 1);
      canvas.height = Math.max(Math.round(height * scale), 1);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Contexto 2D indisponível"));
        return;
      }
      context.scale(scale, scale);
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    image.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Falha ao rasterizar elemento: ${event instanceof Event ? event.type : event}`));
    };

    image.src = url;
  });
}

type ImagePage = {
  widthPoints: number;
  heightPoints: number;
  pixelWidth: number;
  pixelHeight: number;
  imageBytes: Uint8Array;
  mimeType: string;
  resourceName: string;
};

function dataUriToBytes(dataUri: string): { bytes: Uint8Array; mimeType: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.*)$/i);
  if (!match) {
    throw new Error("Data URI inválida");
  }
  const mimeType = match[1];
  const base64 = match[2];
  const bytes = base64ToUint8Array(base64);
  return { bytes, mimeType };
}

function createImagePagesFromCanvas(canvas: HTMLCanvasElement): ImagePage[] {
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) {
    throw new Error("Dimensões inválidas para renderização do PDF");
  }

  const pageWidthPoints = PDF_PAGE_WIDTH;
  const pageHeightPoints = PDF_PAGE_HEIGHT;
  const scale = pageWidthPoints / width;
  const maxSliceHeightPx = Math.max(Math.floor(pageHeightPoints / scale), 1);

  const pages: ImagePage[] = [];

  for (let offsetY = 0, index = 0; offsetY < height; offsetY += maxSliceHeightPx, index += 1) {
    const sliceHeightPx = Math.min(maxSliceHeightPx, height - offsetY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = width;
    sliceCanvas.height = sliceHeightPx;
    const context = sliceCanvas.getContext("2d");
    if (!context) {
      throw new Error("Contexto 2D indisponível ao fatiar canvas");
    }
    context.drawImage(
      canvas,
      0,
      offsetY,
      width,
      sliceHeightPx,
      0,
      0,
      width,
      sliceHeightPx,
    );
    const dataUrl = sliceCanvas.toDataURL("image/jpeg", 0.92);
    const { bytes, mimeType } = dataUriToBytes(dataUrl);
    const heightPoints = sliceHeightPx * scale;
    pages.push({
      widthPoints: pageWidthPoints,
      heightPoints,
      pixelWidth: width,
      pixelHeight: sliceHeightPx,
      imageBytes: bytes,
      mimeType,
      resourceName: `Im${index + 1}`,
    });
  }

  return pages;
}

class PdfBuilder {
  private chunks: Uint8Array[] = [];
  private offsets: number[] = [0];
  private offset = 0;
  private nextId = 1;

  pushString(value: string): void {
    const bytes = encoder.encode(value);
    this.chunks.push(bytes);
    this.offset += bytes.length;
  }

  pushBinary(data: Uint8Array): void {
    this.chunks.push(data);
    this.offset += data.length;
  }

  allocateObjectId(): number {
    const id = this.nextId;
    this.nextId += 1;
    return id;
  }

  startObject(id: number): void {
    this.offsets[id] = this.offset;
    this.pushString(`${id} 0 obj\n`);
  }

  endObject(): void {
    this.pushString("\nendobj\n");
  }

  finalize(rootId: number): Uint8Array {
    const xrefOffset = this.offset;
    const totalObjects = this.nextId - 1;
    this.pushString(`xref\n0 ${totalObjects + 1}\n`);
    this.pushString("0000000000 65535 f \n");
    for (let id = 1; id <= totalObjects; id += 1) {
      const position = this.offsets[id] ?? 0;
      this.pushString(`${position.toString().padStart(10, "0")} 00000 n \n`);
    }
    this.pushString(`trailer\n<< /Size ${totalObjects + 1} /Root ${rootId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const pdfBytes = new Uint8Array(totalLength);
    let cursor = 0;
    for (const chunk of this.chunks) {
      pdfBytes.set(chunk, cursor);
      cursor += chunk.length;
    }
    return pdfBytes;
  }
}

function buildImagePdf(pages: ImagePage[]): Uint8Array {
  if (pages.length === 0) {
    throw new Error("Nenhuma página disponível para gerar PDF");
  }

  const builder = new PdfBuilder();
  builder.pushString("%PDF-1.4\n");

  const catalogId = builder.allocateObjectId();
  const pagesId = builder.allocateObjectId();

  const pageEntries = pages.map((page) => ({
    page,
    imageId: builder.allocateObjectId(),
    contentId: builder.allocateObjectId(),
    pageId: builder.allocateObjectId(),
  }));

  builder.startObject(catalogId);
  builder.pushString(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  builder.endObject();

  builder.startObject(pagesId);
  builder.pushString(
    `<< /Type /Pages /Kids [${pageEntries
      .map((entry) => `${entry.pageId} 0 R`)
      .join(" ")}] /Count ${pageEntries.length} >>`,
  );
  builder.endObject();

  pageEntries.forEach((entry) => {
    const { page, imageId, contentId, pageId } = entry;
    if (page.mimeType !== "image/jpeg") {
      throw new Error(`Formato de imagem não suportado: ${page.mimeType}`);
    }

    builder.startObject(imageId);
    builder.pushString(
      `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.imageBytes.length} >>\nstream\n`,
    );
    builder.pushBinary(page.imageBytes);
    builder.pushString("\nendstream");
    builder.endObject();

    const translateY = PDF_PAGE_HEIGHT - page.heightPoints;
    const content = [
      "q",
      `${page.widthPoints} 0 0 ${page.heightPoints} 0 ${translateY} cm`,
      `/${page.resourceName} Do`,
      "Q",
    ].join("\n");

    builder.startObject(contentId);
    builder.pushString(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
    builder.endObject();

    builder.startObject(pageId);
    builder.pushString(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Contents ${contentId} 0 R /Resources << /XObject << /${page.resourceName} ${imageId} 0 R >> >> >>`,
    );
    builder.endObject();
  });

  return builder.finalize(catalogId);
}

function canvasToPdf(canvas: HTMLCanvasElement): Uint8Array {
  const pages = createImagePagesFromCanvas(canvas);
  return buildImagePdf(pages);
}

async function createRichPdfFromHtml(title: string, html: string): Promise<Blob> {
  const container = document.createElement("div");
  container.style.width = "794px"; // Aproximação de 210mm em 96 DPI
  container.style.boxSizing = "border-box";
  container.style.padding = "32px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#111827";
  container.style.fontFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.6";

  ensureTitleNode(container, title);

  const contentWrapper = document.createElement("div");
  contentWrapper.innerHTML = html ?? "";
  while (contentWrapper.firstChild) {
    container.appendChild(contentWrapper.firstChild);
  }

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.inset = "0";
  wrapper.style.visibility = "hidden";
  wrapper.style.pointerEvents = "none";
  wrapper.style.overflow = "hidden";
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  try {
    const baseUrl = getBaseUrl();
    const assetCache = await inlineExternalAssets(container, baseUrl);
    await waitForImages(container);
    await waitForFonts();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const canvas = await renderElementToCanvas(container, { baseUrl, assetCache });
    const pdfBytes = canvasToPdf(canvas);
    return new Blob([pdfBytes], { type: "application/pdf" });
  } finally {
    wrapper.remove();
  }
}

export async function __inlineAssetsForTesting(
  container: HTMLElement,
  baseUrl?: string,
): Promise<AssetCache> {
  return inlineExternalAssets(container, baseUrl ?? getBaseUrl());
}

export { createTextPdfBlob as __createTextPdfBlobForTesting };

export async function createSimplePdfFromHtml(title: string, html: string): Promise<Blob> {
  if (!hasDomSupport()) {
    return createTextPdfBlob(title, html);
  }

  try {
    return await createRichPdfFromHtml(title, html);
  } catch (error) {
    if (typeof console !== "undefined") {
      console.warn("Falha ao gerar PDF rico, retornando ao modo texto", error);
    }
    return createTextPdfBlob(title, html);
  }
}
