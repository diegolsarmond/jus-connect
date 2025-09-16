const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELATIONSHIPS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

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

function htmlToParagraphBlocks(html: string): string[] {
  const input = html ?? '';

  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = input;
    const textContent = container.innerText.replace(/\r\n/g, '\n');
    const normalized = textContent.replace(/\u00a0/g, ' ').trim();
    if (!normalized) {
      return [];
    }
    return normalized
      .split(/\n{2,}/)
      .map(block => block.trim())
      .filter(block => block.length > 0);
  }

  const fallback = input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ');

  return fallback
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(block => block.length > 0);
}

function paragraphToXml(paragraph: string): string {
  if (!paragraph) {
    return '<w:p><w:r><w:t/></w:r></w:p>';
  }

  const lines = paragraph.split(/\n+/);
  const runs: string[] = [];

  lines.forEach((line, index) => {
    const escaped = escapeXml(line);
    runs.push(`<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>`);
    if (index < lines.length - 1) {
      runs.push('<w:r><w:br/></w:r>');
    }
  });

  return `<w:p>${runs.join('')}</w:p>`;
}

function buildDocumentXml(paragraphs: string[]): string {
  const body = paragraphs.length > 0 ? paragraphs.map(paragraphToXml).join('') : '<w:p><w:r><w:t/></w:r></w:p>';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}${SECTION_PROPERTIES}</w:body>` +
    '</w:document>'
  );
}

export function createDocxBlobFromHtml(html: string): Blob {
  const paragraphs = htmlToParagraphBlocks(html);
  const documentXml = buildDocumentXml(paragraphs);

  const entries: ZipEntry[] = [
    { filename: '[Content_Types].xml', data: stringToUint8Array(CONTENT_TYPES_XML) },
    { filename: '_rels/.rels', data: stringToUint8Array(ROOT_RELATIONSHIPS_XML) },
    { filename: 'word/document.xml', data: stringToUint8Array(documentXml) },
  ];

  const zipBuffer = createZip(entries);
  return new Blob([zipBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
