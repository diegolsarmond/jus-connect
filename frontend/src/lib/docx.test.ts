import { describe, expect, it } from 'vitest';

import { createDocxBlobFromHtml } from './docx';

const textDecoder = new TextDecoder();

async function readEntry(blob: Blob, filename: string): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  let offset = 0;

  while (offset + 30 <= buffer.length) {
    const view = new DataView(buffer.buffer, offset, buffer.length - offset);
    const signature = view.getUint32(0, true);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressedSize = view.getUint32(18, true);
    const fileNameLength = view.getUint16(26, true);
    const extraFieldLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const name = textDecoder.decode(buffer.slice(nameStart, nameEnd));
    const dataStart = nameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (name === filename) {
      return textDecoder.decode(buffer.slice(dataStart, dataEnd));
    }

    offset = dataEnd;
  }

  throw new Error(`Entry ${filename} not found`);
}

describe('createDocxBlobFromHtml', () => {
  it('preserves inline formatting and whitespace', async () => {
    const html = `
      <h2>Heading</h2>
      <p>Hello&nbsp;<strong>World</strong> and <em>friends</em></p>
    `;

    const blob = createDocxBlobFromHtml(html);
    const documentXml = await readEntry(blob, 'word/document.xml');

    expect(documentXml).toContain('<w:pStyle w:val="Heading2"/>');
    expect(documentXml).toContain('Hello ');
    expect(documentXml).toMatch(/<w:r><w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve">World<\/w:t><\/w:r>/);
    expect(documentXml).toMatch(/<w:r><w:rPr><w:i\/><\/w:rPr><w:t xml:space="preserve">friends<\/w:t><\/w:r>/);
  });

  it('creates numbered paragraphs for list items', async () => {
    const html = `
      <ul>
        <li>First item</li>
        <li>Second <strong>bold</strong></li>
      </ul>
      <ol>
        <li>Item one</li>
      </ol>
    `;

    const blob = createDocxBlobFromHtml(html);
    const documentXml = await readEntry(blob, 'word/document.xml');
    const numberingXml = await readEntry(blob, 'word/numbering.xml');

    expect(documentXml).toMatch(/<w:numPr><w:ilvl w:val="0"\/><w:numId w:val="1"\/><\/w:numPr>/);
    expect(documentXml).toContain('<w:numId w:val="2"/>');
    expect(documentXml).toContain('<w:t xml:space="preserve">Second </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">bold</w:t>');
    expect(numberingXml).toContain('<w:numFmt w:val="bullet"/>');
    expect(numberingXml).toContain('<w:numFmt w:val="decimal"/>');
  });
});
