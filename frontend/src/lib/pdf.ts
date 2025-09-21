const PDF_PAGE_WIDTH = 595; // A4 em pontos
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN_LEFT = 72;
const PDF_MARGIN_TOP = 60;
const PDF_MARGIN_BOTTOM = 60;
const PDF_FONT_SIZE = 12;
const PDF_LINE_HEIGHT = 16;

const encoder = new TextEncoder();

function htmlToPlainText(html: string): string {
  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = html;
    const text = container.innerText.replace(/\r\n/g, "\n");
    container.remove();
    return text;
  }

  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function renderPage(lines: string[]): string {
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
    parts.push(`(${escapePdfText(line)}) Tj`);
  });

  parts.push("ET");
  return parts.join("\n");
}

function buildPdf(pages: string[][]): Uint8Array {
  const objects: { id: number; content: string }[] = [];

  const addObject = (content: string) => {
    const id = objects.length + 1;
    objects.push({ id, content });
    return id;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const pageIds: number[] = [];

  pages.forEach((pageLines) => {
    const content = renderPage(pageLines);
    const contentBytes = encoder.encode(content);
    const contentObjectId = addObject(
      `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`,
    );
    const pageObjectId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Contents ${contentObjectId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    pageIds.push(pageObjectId);
  });

  if (pageIds.length === 0) {
    const emptyContent = renderPage([""]);
    const contentBytes = encoder.encode(emptyContent);
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
  const headerBytes = encoder.encode(header);
  const objectBytes: Uint8Array[] = [];
  const xrefPositions: number[] = [];
  let offset = headerBytes.length;

  objects.forEach((obj) => {
    const objectString = `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
    const bytes = encoder.encode(objectString);
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
  const xrefBytes = encoder.encode(xref);

  offset += xrefBytes.length;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const trailerBytes = encoder.encode(trailer);

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

export function createSimplePdfFromHtml(title: string, html: string): Blob {
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

  const pdfBytes = buildPdf(pages);
  return new Blob([pdfBytes], { type: "application/pdf" });
}
