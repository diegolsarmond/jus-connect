const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

const ROOT_RELATIONSHIPS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELATIONSHIPS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/>
      </w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="1"/>
  </w:num>
  <w:abstractNum w:abstractNumId="2">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="2">
    <w:abstractNumId w:val="2"/>
  </w:num>
</w:numbering>`;

const SECTION_PROPERTIES =
  '<w:sectPr>' +
  '<w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>' +
  '</w:sectPr>';

const textEncoder = new TextEncoder();

function stringToUint8Array(value: string): Uint8Array {
  return textEncoder.encode(value);
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      if ((c & 1) !== 0) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c >>>= 1;
      }
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  filename: string;
  data: Uint8Array;
}

function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBytes = stringToUint8Array(entry.filename);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, filenameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(filenameBytes, 30);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + filenameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, filenameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(filenameBytes, 46);

    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  const totalLength = offset + centralSize + endRecord.length;
  const zipBuffer = new Uint8Array(totalLength);
  let position = 0;

  for (const part of localParts) {
    zipBuffer.set(part, position);
    position += part.length;
  }

  for (const part of centralParts) {
    zipBuffer.set(part, position);
    position += part.length;
  }

  zipBuffer.set(endRecord, position);

  return zipBuffer;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface FormattingOptions {
  bold?: boolean;
  italic?: boolean;
}

interface ParagraphOptions {
  style?: string;
  numId?: number;
  level?: number;
}

type ListType = 'bullet' | 'decimal';

const HEADING_STYLES: Record<string, string> = {
  H1: 'Heading1',
  H2: 'Heading2',
  H3: 'Heading3',
  H4: 'Heading4',
  H5: 'Heading5',
  H6: 'Heading6',
};

const LIST_TYPE_TO_NUM_ID: Record<ListType, number> = {
  bullet: 1,
  decimal: 2,
};

function createRunPropertiesXml(formatting: FormattingOptions): string {
  const properties: string[] = [];
  if (formatting.bold) {
    properties.push('<w:b/>');
  }
  if (formatting.italic) {
    properties.push('<w:i/>');
  }

  return properties.length > 0 ? `<w:rPr>${properties.join('')}</w:rPr>` : '';
}

function wrapRun(content: string, formatting: FormattingOptions): string {
  const rPr = createRunPropertiesXml(formatting);
  return `<w:r>${rPr}${content}</w:r>`;
}

function createTextRunXml(text: string, formatting: FormattingOptions): string {
  const escaped = escapeXml(text.replace(/\r\n/g, '\n'));
  return wrapRun(`<w:t xml:space="preserve">${escaped}</w:t>`, formatting);
}

function createBreakRunXml(formatting: FormattingOptions): string {
  return wrapRun('<w:br/>', formatting);
}

function textNodeToRuns(text: string, formatting: FormattingOptions): string[] {
  if (!text) {
    return [];
  }

  const normalized = text.replace(/\r\n/g, '\n');
  const segments = normalized.split('\n');
  const runs: string[] = [];

  segments.forEach((segment, index) => {
    if (segment.length > 0) {
      runs.push(createTextRunXml(segment, formatting));
    }
    if (index < segments.length - 1) {
      runs.push(createBreakRunXml(formatting));
    }
  });

  return runs;
}

function collectRunsFromNode(node: Node, formatting: FormattingOptions): string[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return textNodeToRuns(node.nodeValue ?? '', formatting);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toUpperCase();

  if (tag === 'BR') {
    return [createBreakRunXml(formatting)];
  }

  if (tag === 'STRONG' || tag === 'B') {
    return collectRunsFromNodes(Array.from(element.childNodes), { ...formatting, bold: true });
  }

  if (tag === 'EM' || tag === 'I') {
    return collectRunsFromNodes(Array.from(element.childNodes), { ...formatting, italic: true });
  }

  return collectRunsFromNodes(Array.from(element.childNodes), formatting);
}

function collectRunsFromNodes(nodes: Node[], formatting: FormattingOptions): string[] {
  const runs: string[] = [];
  nodes.forEach(child => {
    runs.push(...collectRunsFromNode(child, formatting));
  });
  return runs;
}

function createParagraphXml(runs: string[], options: ParagraphOptions = {}): string {
  const properties: string[] = [];

  if (options.style) {
    properties.push(`<w:pStyle w:val="${options.style}"/>`);
  }

  if (typeof options.numId === 'number') {
    const level = Math.max(0, Math.min(options.level ?? 0, 8));
    if (!options.style) {
      properties.push('<w:pStyle w:val="ListParagraph"/>');
    }
    properties.push(`<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${options.numId}"/></w:numPr>`);
    const indentLeft = 720 * (level + 1);
    properties.push(`<w:ind w:left="${indentLeft}" w:hanging="360"/>`);
  }

  const pPr = properties.length > 0 ? `<w:pPr>${properties.join('')}</w:pPr>` : '';
  const content = runs.length > 0 ? runs.join('') : '<w:r><w:t/></w:r>';
  return `<w:p>${pPr}${content}</w:p>`;
}

function getHeadingStyle(tagName: string): string | undefined {
  return HEADING_STYLES[tagName as keyof typeof HEADING_STYLES];
}

function buildParagraphFromNodes(nodes: Node[], options: ParagraphOptions = {}): string {
  const runs = collectRunsFromNodes(nodes, {});
  return createParagraphXml(runs, options);
}

function createParagraphFromElement(element: Element, baseOptions: ParagraphOptions, paragraphs: string[]): void {
  const tag = element.tagName.toUpperCase();
  const options: ParagraphOptions = { ...baseOptions };
  const headingStyle = getHeadingStyle(tag);
  if (headingStyle) {
    options.style = headingStyle;
  }

  paragraphs.push(buildParagraphFromNodes(Array.from(element.childNodes), options));
}

function processList(listElement: Element, type: ListType, level: number, paragraphs: string[]): void {
  Array.from(listElement.childNodes).forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      if (element.tagName.toUpperCase() === 'LI') {
        processListItem(element, type, level, paragraphs);
      } else {
        processNodes(Array.from(element.childNodes), paragraphs);
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = child.nodeValue ?? '';
      if (text.replace(/\u00a0/g, ' ').trim().length > 0) {
        paragraphs.push(buildParagraphFromNodes([child], {}));
      }
    }
  });
}

function isParagraphLike(tagName: string): boolean {
  const normalized = tagName.toUpperCase();
  return normalized === 'P' || normalized === 'H1' || normalized === 'H2' || normalized === 'H3' || normalized === 'H4' || normalized === 'H5' || normalized === 'H6';
}

function isInlineElement(tagName: string): boolean {
  const normalized = tagName.toUpperCase();
  return (
    normalized === 'STRONG' ||
    normalized === 'B' ||
    normalized === 'EM' ||
    normalized === 'I' ||
    normalized === 'SPAN' ||
    normalized === 'A' ||
    normalized === 'U'
  );
}

function processListItem(listItem: Element, type: ListType, level: number, paragraphs: string[]): void {
  const inlineBuffer: Node[] = [];
  let createdParagraph = false;
  const numId = LIST_TYPE_TO_NUM_ID[type];

  Array.from(listItem.childNodes).forEach(child => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as Element;
      const tag = element.tagName.toUpperCase();

      if (tag === 'UL') {
        if (inlineBuffer.length > 0) {
          paragraphs.push(createParagraphXml(collectRunsFromNodes(inlineBuffer, {}), { numId, level }));
          inlineBuffer.length = 0;
          createdParagraph = true;
        }
        processList(element, 'bullet', level + 1, paragraphs);
        return;
      }

      if (tag === 'OL') {
        if (inlineBuffer.length > 0) {
          paragraphs.push(createParagraphXml(collectRunsFromNodes(inlineBuffer, {}), { numId, level }));
          inlineBuffer.length = 0;
          createdParagraph = true;
        }
        processList(element, 'decimal', level + 1, paragraphs);
        return;
      }

      if (isParagraphLike(tag)) {
        if (inlineBuffer.length > 0) {
          paragraphs.push(createParagraphXml(collectRunsFromNodes(inlineBuffer, {}), { numId, level }));
          inlineBuffer.length = 0;
          createdParagraph = true;
        }
        createParagraphFromElement(element, { numId, level }, paragraphs);
        createdParagraph = true;
        return;
      }
    }

    inlineBuffer.push(child);
  });

  if (inlineBuffer.length > 0 || !createdParagraph) {
    paragraphs.push(createParagraphXml(collectRunsFromNodes(inlineBuffer, {}), { numId, level }));
  }
}

function processNodes(nodes: Node[], paragraphs: string[]): void {
  const inlineBuffer: Node[] = [];

  const flushInline = (): void => {
    if (inlineBuffer.length === 0) {
      return;
    }
    paragraphs.push(createParagraphXml(collectRunsFromNodes(inlineBuffer, {})));
    inlineBuffer.length = 0;
  };

  nodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue ?? '';
      if (!value) {
        return;
      }
      const hasNonBreakingSpace = value.includes('\u00a0');
      const isWhitespaceOnly = value.trim().length === 0;
      if (isWhitespaceOnly && !hasNonBreakingSpace && inlineBuffer.length === 0) {
        return;
      }
      inlineBuffer.push(node);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as Element;
    const tag = element.tagName.toUpperCase();

    if (tag === 'BR' || isInlineElement(tag)) {
      inlineBuffer.push(element);
      return;
    }

    if (tag === 'P' || tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') {
      flushInline();
      createParagraphFromElement(element, {}, paragraphs);
      return;
    }

    if (tag === 'UL') {
      flushInline();
      processList(element, 'bullet', 0, paragraphs);
      return;
    }

    if (tag === 'OL') {
      flushInline();
      processList(element, 'decimal', 0, paragraphs);
      return;
    }

    if (tag === 'LI') {
      flushInline();
      processListItem(element, 'bullet', 0, paragraphs);
      return;
    }

    flushInline();
    processNodes(Array.from(element.childNodes), paragraphs);
  });

  flushInline();
}

function getRootNodes(html: string): Node[] {
  const input = html ?? '';

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(input, 'text/html');
    return Array.from(documentFragment.body.childNodes);
  }

  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = input;
    return Array.from(container.childNodes);
  }

  return [];
}

function convertHtmlToParagraphXml(html: string): string[] {
  const nodes = getRootNodes(html);
  const paragraphs: string[] = [];
  processNodes(nodes, paragraphs);
  return paragraphs;
}

function fallbackHtmlToParagraphBlocks(html: string): string[] {
  const input = html ?? '';

  const stripped = input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\r\n/g, '\n');

  return stripped
    .split(/\n{2,}/)
    .map(block => block.replace(/\u00a0/g, ' ').trim())
    .filter(block => block.length > 0);
}

function buildDocumentXml(paragraphs: string[]): string {
  const body = paragraphs.length > 0 ? paragraphs.join('') : '<w:p><w:r><w:t/></w:r></w:p>';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}${SECTION_PROPERTIES}</w:body>` +
    '</w:document>'
  );
}

export function createDocxBlobFromHtml(html: string): Blob {
  let paragraphXml = convertHtmlToParagraphXml(html);

  if (paragraphXml.length === 0 && (typeof DOMParser === 'undefined' && typeof document === 'undefined')) {
    const fallbackParagraphs = fallbackHtmlToParagraphBlocks(html);
    paragraphXml = fallbackParagraphs.map(paragraph => {
      const runs = paragraph ? [createTextRunXml(paragraph, {})] : [];
      return createParagraphXml(runs);
    });
  }

  const documentXml = buildDocumentXml(paragraphXml);

  const entries: ZipEntry[] = [
    { filename: '[Content_Types].xml', data: stringToUint8Array(CONTENT_TYPES_XML) },
    { filename: '_rels/.rels', data: stringToUint8Array(ROOT_RELATIONSHIPS_XML) },
    { filename: 'word/_rels/document.xml.rels', data: stringToUint8Array(DOCUMENT_RELATIONSHIPS_XML) },
    { filename: 'word/numbering.xml', data: stringToUint8Array(NUMBERING_XML) },
    { filename: 'word/document.xml', data: stringToUint8Array(documentXml) },
  ];

  const zipBuffer = createZip(entries);
  return new Blob([zipBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
