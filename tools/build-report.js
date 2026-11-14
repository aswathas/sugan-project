'use strict';
// Builds the project report (docx) from the Markdown chapters in docs/report-draft.
//
//   node tools/build-report.js [pathToDocxModuleRoot]
//
// The docx package is not a dependency of SecureShare, because the application itself
// installs nothing. The report builder keeps its own copy outside the project.

const fs = require('fs');
const path = require('path');

function loadDocx() {
  const arg = process.argv[2];
  if (arg) {
    const candidates = [
      path.resolve(arg, 'node_modules', 'docx'),
      path.resolve(arg, 'docx'),
      path.resolve(arg),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'package.json'))) {
        let layout = null;
        try { layout = require(path.join(candidate, 'dist', 'layout.cjs')); } catch (_) {}
        return { docx: require(candidate), layout };
      }
    }
  }
  let layout = null;
  try { layout = require('docx/layout'); } catch (_) {}
  return { docx: require('docx'), layout };
}

const { docx, layout } = loadDocx();
const {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  PageReference,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} = docx;

const ROOT = path.resolve(__dirname, '..');
const DRAFT = path.join(ROOT, 'docs', 'report-draft');
const FIGURES = path.join(ROOT, 'docs', 'figures', 'png');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const LOGO = path.join(ROOT, 'docs', 'brand', 'srm-logo.jpeg');
const OUT = path.join(ROOT, 'report', 'SecureShare-Project-Report.docx');

const BODY_FONT = 'Times New Roman';
const PAGE_WIDTH = 11906; // A4 width in twips
const PAGE_HEIGHT = 16838; // A4 height in twips
const MARGIN = 1440; // 1 inch in twips
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 9026 twips
const IMAGE_WIDTH_PX = 590;
const LOGO_WIDTH_PX = 230; // ~2.4 inches at 96 dpi

const numbering = {
  config: [
    {
      reference: 'bullets',
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: 'numbers',
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
  ],
};

const styles = {
  default: {
    document: {
      run: { font: BODY_FONT, size: 24, color: '000000' },
      paragraph: { spacing: { line: 360, after: 140 }, alignment: AlignmentType.JUSTIFIED },
    },
  },
  paragraphStyles: [
    {
      id: 'Heading1',
      name: 'Heading 1',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { font: BODY_FONT, size: 32, bold: true, color: '000000' },
      paragraph: {
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
        pageBreakBefore: true,
        outlineLevel: 0,
      },
    },
    {
      id: 'Heading2',
      name: 'Heading 2',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { font: BODY_FONT, size: 28, bold: true, color: '000000' },
      paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 280, after: 140 }, outlineLevel: 1 },
    },
    {
      id: 'Heading3',
      name: 'Heading 3',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { font: BODY_FONT, size: 26, bold: true, color: '000000' },
      paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 220, after: 120 }, outlineLevel: 2 },
    },
    {
      id: 'TOC1',
      name: 'toc 1',
      basedOn: 'Normal',
      next: 'Normal',
      run: { font: BODY_FONT, size: 22, bold: true, color: '000000' },
      paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 80, after: 60, line: 260 } },
    },
    {
      id: 'TOC2',
      name: 'toc 2',
      basedOn: 'Normal',
      next: 'Normal',
      run: { font: BODY_FONT, size: 22, color: '000000' },
      paragraph: { alignment: AlignmentType.LEFT, indent: { left: 360 }, spacing: { after: 40, line: 260 } },
    },
    {
      id: 'TOC3',
      name: 'toc 3',
      basedOn: 'Normal',
      next: 'Normal',
      run: { font: BODY_FONT, size: 22, color: '000000' },
      paragraph: { alignment: AlignmentType.LEFT, indent: { left: 720 }, spacing: { after: 40, line: 260 } },
    },
  ],
};

/* ---------------- inline markdown ---------------- */

function inlineRuns(text, options = {}) {
  const base = { font: options.font || BODY_FONT, size: options.size || 24, bold: options.bold || false };
  const runs = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      runs.push(new TextRun({ ...base, text: text.slice(last, match.index) }));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      runs.push(new TextRun({ ...base, text: token.slice(2, -2), bold: true }));
    } else if (token.startsWith('`')) {
      runs.push(new TextRun({ ...base, text: token.slice(1, -1), font: 'Consolas', size: (options.size || 24) - 2 }));
    } else {
      runs.push(new TextRun({ ...base, text: token.slice(1, -1), italics: true }));
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ ...base, text: text.slice(last) }));
  }
  return runs.length ? runs : [new TextRun({ ...base, text: '' })];
}

/* ---------------- block parser ---------------- */

function parseMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let pendingCaption = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i += 1;
      continue;
    }

    const figureMatch = trimmed.match(/^\[FIGURE:\s*(.+?)\]$/);
    if (figureMatch) {
      blocks.push({ type: 'figure', path: figureMatch[1], caption: pendingCaption });
      pendingCaption = null;
      i += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', lines: codeLines });
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        rows.push(lines[i].trim());
        i += 1;
      }
      const parsed = rows
        .filter((row) => !/^\|[\s:|-]+\|$/.test(row))
        .map((row) =>
          row
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim())
        );
      if (parsed.length && !/^-+$/.test(parsed[0][0] || '')) {
        blocks.push({ type: 'table', rows: parsed, caption: pendingCaption });
        pendingCaption = null;
      }
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^-\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'bullets', items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'numbers', items });
      continue;
    }

    if (/^(Table|Figure)\s+[A-Za-z0-9.]+\s/.test(trimmed)) {
      let nextIndex = i + 1;
      while (nextIndex < lines.length && !lines[nextIndex].trim()) nextIndex += 1;
      const next = (lines[nextIndex] || '').trim();
      const isFigureCaption = trimmed.startsWith('Figure ') && next.startsWith('[FIGURE:');
      const isTableCaption = trimmed.startsWith('Table ') && next.startsWith('|');
      if (isFigureCaption || isTableCaption) {
        pendingCaption = trimmed;
        i += 1;
        continue;
      }
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|-\s|\d+\.\s|\[FIGURE:|```)/.test(lines[i].trim()) && !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|'))) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

/* ---------------- image helpers ---------------- */

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('Expected a valid PNG with an IHDR chunk');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    const segLen = buffer.readUInt16BE(offset + 2);
    offset += 2 + segLen;
  }
  return { width: 234, height: 106 };
}

/* ---------------- rendering ---------------- */

function heading(text, level) {
  const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_3 };
  const sizes = { 1: 32, 2: 28, 3: 26, 4: 26 };
  return new Paragraph({
    heading: map[level] || HeadingLevel.HEADING_3,
    children: inlineRuns(text, { size: sizes[level] || 26, bold: true }),
  });
}

function captionParagraph(text, bookmarkId) {
  const run = new TextRun({ text, font: BODY_FONT, size: 20, italics: false });
  return new Paragraph({
    spacing: { before: 120, after: 80 },
    alignment: AlignmentType.CENTER,
    children: bookmarkId ? [new Bookmark({ id: bookmarkId, children: [run] })] : [run],
  });
}

function figureBlock(block, tracker) {
  const source = block.path.replace(/\\/g, '/');
  const base = path.basename(source).replace(/\.[^.]+$/, '');
  const png = path.join(FIGURES, `${base}.png`);
  const shot = path.join(SHOTS, `${base}.png`);
  const file = fs.existsSync(png) ? png : shot;
  if (!fs.existsSync(file)) {
    return [new Paragraph({ children: [new TextRun({ text: `[missing figure: ${block.path}]`, font: BODY_FONT, size: 22 })] })];
  }
  const data = fs.readFileSync(file);
  const { width, height } = pngDimensions(data);
  const size = {
    width: IMAGE_WIDTH_PX,
    height: Math.round((IMAGE_WIDTH_PX * height) / width),
  };
  const out = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      keepNext: Boolean(block.caption),
      children: [new ImageRun({ type: 'png', data, transformation: size })],
    }),
  ];
  if (block.caption) {
    let bookmarkId = null;
    if (tracker) {
      bookmarkId = `fig_${tracker.figures.length + 1}`;
      tracker.figures.push({ id: bookmarkId, caption: block.caption });
    }
    out.push(captionParagraph(block.caption, bookmarkId));
  }
  return out;
}

function tableBlock(block, tracker) {
  const columns = block.rows[0].length;
  const weights = new Array(columns).fill(1);
  for (let c = 0; c < columns; c += 1) {
    let longest = 0;
    for (const row of block.rows) longest = Math.max(longest, (row[c] || '').length);
    weights[c] = Math.min(Math.max(longest, 12), 55);
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((w / total) * CONTENT_WIDTH));
  widths[widths.length - 1] += CONTENT_WIDTH - widths.reduce((a, b) => a + b, 0);

  const cellSize = columns >= 5 ? 18 : columns >= 4 ? 19 : 20;
  const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
  const borders = { top: border, bottom: border, left: border, right: border };

  const rows = block.rows.map((row, rowIndex) => {
    const header = rowIndex === 0;
    return new TableRow({
      tableHeader: header,
      children: widths.map((width, c) => {
        const text = (row[c] || '').replace(/&amp;/g, '&');
        return new TableCell({
          width: { size: width, type: WidthType.DXA },
          borders,
          shading: header ? { type: ShadingType.CLEAR, fill: 'EDEDED' } : undefined,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { line: 240, after: 0 },
              children: inlineRuns(text, { size: cellSize, bold: header }),
            }),
          ],
        });
      }),
    });
  });

  const out = [];
  if (block.caption) {
    let bookmarkId = null;
    if (tracker) {
      bookmarkId = `tbl_${tracker.tables.length + 1}`;
      tracker.tables.push({ id: bookmarkId, caption: block.caption });
    }
    const run = new TextRun({ text: block.caption, font: BODY_FONT, size: 20, bold: true });
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        keepNext: true,
        children: bookmarkId ? [new Bookmark({ id: bookmarkId, children: [run] })] : [run],
      })
    );
  }
  out.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      rows,
    })
  );
  out.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
  return out;
}

function renderBlocks(blocks, tracker) {
  const children = [];
  for (const block of blocks) {
    if (block.type === 'heading') children.push(heading(block.text, block.level));
    else if (block.type === 'paragraph') children.push(new Paragraph({ children: inlineRuns(block.text) }));
    else if (block.type === 'bullets') {
      for (const item of block.items) {
        children.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: inlineRuns(item) }));
      }
    } else if (block.type === 'numbers') {
      for (const item of block.items) {
        children.push(new Paragraph({ numbering: { reference: 'numbers', level: 0 }, children: inlineRuns(item) }));
      }
    } else if (block.type === 'code') {
      block.lines.forEach((line, idx) => {
        const isLast = idx === block.lines.length - 1;
        children.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            indent: { left: 360 },
            spacing: { before: idx === 0 ? 80 : 0, after: isLast ? 120 : 20, line: 240 },
            children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 19 })],
          })
        );
      });
    } else if (block.type === 'figure') children.push(...figureBlock(block, tracker));
    else if (block.type === 'table') children.push(...tableBlock(block, tracker));
  }
  return children;
}

/* ---------------- title page, header, footer ---------------- */

function titlePage() {
  const centre = (text, size, bold, spacing, italics = false) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: spacing.before || 0, after: spacing.after || 0, line: spacing.line || 300 },
      children: [new TextRun({ text, font: BODY_FONT, size, bold, italics })],
    });

  const children = [];

  if (fs.existsSync(LOGO)) {
    const logoData = fs.readFileSync(LOGO);
    const { width, height } = jpegDimensions(logoData);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [
          new ImageRun({
            type: 'jpg',
            data: logoData,
            transformation: {
              width: LOGO_WIDTH_PX,
              height: Math.round((LOGO_WIDTH_PX * height) / width),
            },
          }),
        ],
      })
    );
  }

  children.push(
    centre('SRM Institute of Science and Technology', 32, true, { before: 80, after: 60 }),
    centre('College of Engineering and Technology', 28, true, { after: 60 }),
    centre('Department of Electronics and Communication Engineering', 26, true, { after: 80 }),
    centre('Academic Year: 2026-2027 (ODD)', 24, true, { before: 60, after: 480 }),
    centre('21ECC402P', 28, true, { after: 60 }),
    centre('COMPUTER COMMUNICATION AND NETWORK SECURITY', 26, true, { after: 480 }),
    centre('SECURE FILE SHARING SYSTEM', 34, true, { after: 60 }),
    centre('USING END-TO-END ENCRYPTION', 34, true, { after: 60 }),
    centre('AND ACCESS CONTROL', 34, true, { after: 420 }),
    centre('By', 24, false, { after: 220 }, true)
  );

  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
  const team = [
    ['1. PRADEESH M', '-RA2311004010278'],
    ['2. VARUN P R', '-RA2311004010287'],
    ['3. SUGANDHAN A', '-RA2311004010297'],
  ];

  children.push(
    new Table({
      alignment: AlignmentType.CENTER,
      width: { size: 6400, type: WidthType.DXA },
      columnWidths: [3400, 3000],
      layout: TableLayoutType.FIXED,
      rows: team.map(([name, reg]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 3400, type: WidthType.DXA },
              borders: noBorders,
              margins: { top: 40, bottom: 40, left: 120, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0, line: 280 },
                  children: [new TextRun({ text: name, font: BODY_FONT, size: 24 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3000, type: WidthType.DXA },
              borders: noBorders,
              margins: { top: 40, bottom: 40, left: 80, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0, line: 280 },
                  children: [new TextRun({ text: reg, font: BODY_FONT, size: 24 })],
                }),
              ],
            }),
          ],
        })
      ),
    })
  );

  children.push(
    centre('System name: SecureShare', 24, true, { before: 480, after: 80 }),
    centre('November 2026', 24, false, { after: 0 })
  );

  return children;
}

function runningHeader() {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 20, line: 240 },
        children: [
          new TextRun({
            text: 'SRM Institute of Science and Technology | Department of Electronics and Communication Engineering',
            font: BODY_FONT,
            size: 18,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80, line: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '888888', space: 4 } },
        children: [
          new TextRun({
            text: '21ECC402P - Computer Communication and Network Security | SecureShare',
            font: BODY_FONT,
            size: 18,
            bold: true,
          }),
        ],
      }),
    ],
  });
}

function pageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: 'Page ', font: BODY_FONT, size: 20 }),
          new TextRun({ children: [PageNumber.CURRENT], font: BODY_FONT, size: 20 }),
        ],
      }),
    ],
  });
}

/* ---------------- front matter helpers ---------------- */

function heading1Paragraph(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: BODY_FONT, size: 32, bold: true })],
  });
}

function extractAbstractBlocks(frontBlocks) {
  const out = [];
  let inAbstract = false;
  for (const block of frontBlocks) {
    if (block.type === 'heading') {
      if (/^abstract$/i.test(block.text.trim())) {
        inAbstract = true;
        continue;
      }
      if (inAbstract) break;
      continue;
    }
    if (inAbstract && block.type === 'paragraph') out.push(block);
  }
  return out;
}

function captionListTable(entries, numberLabel) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
  const widths = [1200, 6626, 1200];

  const makeCell = (width, alignment, content) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: noBorders,
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      children: [
        new Paragraph({
          alignment,
          spacing: { after: 0, line: 260 },
          children: content,
        }),
      ],
    });

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      makeCell(widths[0], AlignmentType.LEFT, [new TextRun({ text: numberLabel, font: BODY_FONT, size: 22, bold: true })]),
      makeCell(widths[1], AlignmentType.LEFT, [new TextRun({ text: 'Parameters', font: BODY_FONT, size: 22, bold: true })]),
      makeCell(widths[2], AlignmentType.RIGHT, [new TextRun({ text: 'Page No.', font: BODY_FONT, size: 22, bold: true })]),
    ],
  });

  const dataRows = entries.map(({ id, caption }) => {
    const match = caption.match(/^(?:Table|Figure)\s+(A\s*\d+(?:\.\d+)*|\d+(?:\.\d+)*)\s+(.*)$/);
    const num = match ? match[1] : '';
    const title = match ? match[2] : caption;
    return new TableRow({
      children: [
        makeCell(widths[0], AlignmentType.LEFT, [new TextRun({ text: num, font: BODY_FONT, size: 22 })]),
        makeCell(widths[1], AlignmentType.LEFT, [new TextRun({ text: title, font: BODY_FONT, size: 22 })]),
        makeCell(widths[2], AlignmentType.RIGHT, [new PageReference(id)]),
      ],
    });
  });

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

function publicationDetailsSection() {
  const line = (text, spacing = { after: 120, line: 320 }) =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing,
      children: [new TextRun({ text, font: BODY_FONT, size: 24 })],
    });

  return [
    heading1Paragraph('PUBLICATION DETAILS'),
    new Paragraph({
      children: [
        new TextRun({
          text: 'The paper published by the students during the period of the project work is given below. The proof of the published paper or the publication certificate is attached after this page.',
          font: BODY_FONT,
          size: 24,
        }),
      ],
    }),
    line('Title of paper: [Title of the published paper]', { before: 120, after: 120, line: 320 }),
    line('Authors: Pradeesh M, Varun P R, Sugandhan A'),
    line('Journal / Conference: [Name of the journal or conference]'),
    line('Volume, pages: [Volume (issue), pp. xx-xx]'),
    line('Date: [Month year of publication]'),
    line('Status: [Published / Accepted]'),
  ];
}

function sectionFromFile(file, tracker) {
  const blocks = parseMarkdown(fs.readFileSync(path.join(DRAFT, file), 'utf8'));
  return renderBlocks(blocks, tracker);
}

function main() {
  const chapters = [
    'ch1-introduction.md',
    'ch2-literature-review.md',
    'ch3-system-design.md',
    'ch4-results.md',
    'ch5-conclusion.md',
  ];

  const front = parseMarkdown(fs.readFileSync(path.join(DRAFT, 'front-matter.md'), 'utf8'));
  const abstract = extractAbstractBlocks(front);
  const abbreviationTable = front.find((b) => b.type === 'table');

  const tracker = { tables: [], figures: [] };
  const chapterChildren = [];
  for (const file of chapters) {
    chapterChildren.push(...sectionFromFile(file, tracker));
  }

  const referencesChildren = [];
  referencesChildren.push(heading1Paragraph('REFERENCES'));
  const referencesBlocks = parseMarkdown(fs.readFileSync(path.join(DRAFT, 'references.md'), 'utf8')).filter((b) => b.type !== 'heading');
  for (const block of referencesBlocks) {
    if (block.type === 'paragraph') {
      referencesChildren.push(
        new Paragraph({
          spacing: { after: 120, line: 280 },
          indent: { left: 480, hanging: 480 },
          children: inlineRuns(block.text),
        })
      );
    }
  }

  const appendicesMd = fs.readFileSync(path.join(DRAFT, 'appendices.md'), 'utf8');
  const appendicesChildren = renderBlocks(parseMarkdown(appendicesMd), tracker);
  const hasPublicationDetails = /^#{1,3}\s+publication\s+details\b/im.test(appendicesMd);

  const bodyChildren = [];

  bodyChildren.push(heading1Paragraph('ABSTRACT'));
  for (const block of abstract) {
    bodyChildren.push(new Paragraph({ children: inlineRuns(block.text) }));
  }

  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      pageBreakBefore: true,
      spacing: { before: 240, after: 240 },
      children: [new TextRun({ text: 'TABLE OF CONTENTS', font: BODY_FONT, size: 32, bold: true })],
    }),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
    })
  );

  bodyChildren.push(heading1Paragraph('LIST OF TABLES'));
  bodyChildren.push(captionListTable(tracker.tables, 'Table No.'));

  bodyChildren.push(heading1Paragraph('LIST OF FIGURES'));
  bodyChildren.push(captionListTable(tracker.figures, 'Fig. No.'));

  bodyChildren.push(heading1Paragraph('LIST OF ABBREVIATIONS'));
  if (abbreviationTable) {
    bodyChildren.push(...tableBlock({ ...abbreviationTable, caption: abbreviationTable.caption || 'Table A1.1 Abbreviations used in the report' }));
  }

  bodyChildren.push(...chapterChildren);
  bodyChildren.push(...referencesChildren);
  bodyChildren.push(...appendicesChildren);
  if (!hasPublicationDetails) {
    bodyChildren.push(...publicationDetailsSection());
  }

  const pageConfig = {
    size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
  };

  const doc = new Document({
    creator: 'SecureShare project team',
    title: 'Secure File Sharing System Using End-to-End Encryption and Access Control',
    description: 'Project report for 21ECC402P, Computer Communication and Network Security',
    features: { updateFields: true },
    pageNumbers: layout ? layout.estimatePageNumbersWith({ guess: true }) : undefined,
    styles,
    numbering,
    sections: [
      {
        properties: { page: pageConfig },
        children: titlePage(),
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            ...pageConfig,
            pageNumbers: { start: 1 },
          },
        },
        headers: { default: runningHeader() },
        footers: { default: pageFooter() },
        children: bodyChildren,
      },
    ],
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(OUT, buffer);
    console.log('wrote', OUT, buffer.length, 'bytes');
  });
}

main();
