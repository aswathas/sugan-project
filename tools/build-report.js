'use strict';
// Builds the project report (docx) from the Markdown chapters in docs/report-draft.
//
//   node tools/build-report.js [pathToDocxModuleRoot]
//
// The docx package is not a dependency of SecureShare, because the application itself
// installs nothing. The report builder keeps its own copy outside the project.

const fs = require('fs');
const path = require('path');
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Numbering,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} = require('docx');

const ROOT = path.resolve(__dirname, '..');
const DRAFT = path.join(ROOT, 'docs', 'report-draft');
const FIGURES = path.join(ROOT, 'docs', 'figures', 'png');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const OUT = path.join(ROOT, 'report', 'SecureShare-Project-Report.docx');

const BODY_FONT = 'Times New Roman';
const CONTENT_WIDTH = 9026; // A4 (11906) minus 1 inch margins on each side, in twips
const IMAGE_WIDTH_PX = 590;

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
      run: { font: BODY_FONT, size: 24 },
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
      run: { font: BODY_FONT, size: 32, bold: true },
      paragraph: { spacing: { before: 240, after: 240 }, pageBreakBefore: true, outlineLevel: 0 },
    },
    {
      id: 'Heading2',
      name: 'Heading 2',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { font: BODY_FONT, size: 28, bold: true },
      paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
    },
    {
      id: 'Heading3',
      name: 'Heading 3',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { font: BODY_FONT, size: 26, bold: true },
      paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 2 },
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

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i += 1;
      continue;
    }

    const figure = trimmed.match(/^\[FIGURE:\s*(.+?)\]$/);
    if (figure) {
      blocks.push({ type: 'figure', path: figure[1], caption: pendingCaption });
      pendingCaption = null;
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
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
      pendingCaption = trimmed;
      i += 1;
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||-\s|\d+\.\s|\[FIGURE:)/.test(lines[i].trim())) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

/* ---------------- rendering ---------------- */

function heading(text, level) {
  const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_3 };
  return new Paragraph({ heading: map[level] || HeadingLevel.HEADING_3, children: inlineRuns(text, { size: 24 }) });
}

function captionParagraph(text) {
  return new Paragraph({
    spacing: { before: 120, after: 80 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, font: BODY_FONT, size: 20, italics: false })],
  });
}

function figureBlock(block) {
  const source = block.path.replace(/\\/g, '/');
  const base = path.basename(source).replace(/\.[^.]+$/, '');
  const png = path.join(FIGURES, `${base}.png`);
  const shot = path.join(SHOTS, `${base}.png`);
  const file = fs.existsSync(png) ? png : shot;
  if (!fs.existsSync(file)) {
    return [new Paragraph({ children: [new TextRun({ text: `[missing figure: ${block.path}]`, font: BODY_FONT, size: 22 })] })];
  }
  const size = png === file ? { width: IMAGE_WIDTH_PX, height: Math.round((IMAGE_WIDTH_PX * 675) / 1200) } : { width: IMAGE_WIDTH_PX, height: Math.round((IMAGE_WIDTH_PX * 900) / 1280) };
  const out = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: size })],
    }),
  ];
  if (block.caption) out.push(captionParagraph(block.caption));
  return out;
}

function tableBlock(block) {
  const columns = block.rows[0].length;
  const weights = new Array(columns).fill(1);
  for (let c = 0; c < columns; c += 1) {
    let longest = 0;
    for (const row of block.rows) longest = Math.max(longest, (row[c] || '').length);
    weights[c] = Math.min(Math.max(longest, 6), 60);
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
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: block.caption, font: BODY_FONT, size: 20, bold: true })],
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

function renderBlocks(blocks) {
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
    } else if (block.type === 'figure') children.push(...figureBlock(block));
    else if (block.type === 'table') children.push(...tableBlock(block));
  }
  return children;
}

/* ---------------- front matter ---------------- */

function titlePage() {
  const centre = (text, size, bold, spacing) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: spacing || 0, after: spacing || 0, line: 300 },
      children: [new TextRun({ text, font: BODY_FONT, size, bold })],
    });
  return [
    centre('21ECC402P', 28, true, 1200),
    centre('COMPUTER COMMUNICATION AND NETWORK SECURITY', 28, true, 240),
    centre('', 24, false, 600),
    centre('SECURE FILE SHARING SYSTEM', 36, true, 0),
    centre('USING END-TO-END ENCRYPTION', 36, true, 120),
    centre('AND ACCESS CONTROL', 36, true, 480),
    centre('A report submitted for review', 24, false, 240),
    centre('Project team', 24, true, 240),
    centre('Pradeesh M (RA2311004010278)', 24, false, 60),
    centre('Varun P R (RA2311004010287)', 24, false, 60),
    centre('Sugandhan A (RA2311004010297)', 24, false, 60),
    centre('', 24, false, 600),
    centre('System name: SecureShare', 24, false, 120),
    centre('November 2026', 24, false, 0),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function sectionFromFile(file) {
  const blocks = parseMarkdown(fs.readFileSync(path.join(DRAFT, file), 'utf8'));
  return renderBlocks(blocks);
}

function staticList(items) {
  return items.map((item) =>
    new Paragraph({
      spacing: { after: 60, line: 260 },
      children: [new TextRun({ text: item, font: BODY_FONT, size: 22 })],
    })
  );
}

function collectHeadings(files) {
  const entries = [];
  for (const file of files) {
    const blocks = parseMarkdown(fs.readFileSync(path.join(DRAFT, file), 'utf8'));
    for (const block of blocks) {
      if (block.type === 'heading' && block.level <= 2) entries.push({ text: block.text, level: block.level });
    }
  }
  return entries;
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
  const abstract = front.filter((b) => b.type !== 'heading' && b.type !== 'table');
  const abbreviationTable = front.find((b) => b.type === 'table');
  const listOfTables = front.filter((b) => b.type === 'paragraph' && /^Table\s/.test(b.text)).map((b) => b.text);
  const listOfFigures = front.filter((b) => b.type === 'paragraph' && /^Figure\s/.test(b.text)).map((b) => b.text);

  const children = [];

  children.push(...titlePage());

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'ABSTRACT', font: BODY_FONT, size: 32, bold: true })] }));
  for (const block of abstract) {
    children.push(new Paragraph({ children: inlineRuns(block.text) }));
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'TABLE OF CONTENTS', font: BODY_FONT, size: 32, bold: true })] }));
  for (const entry of collectHeadings(chapters)) {
    children.push(
      new Paragraph({
        spacing: { after: 60, line: 260 },
        indent: entry.level === 1 ? { left: 0 } : { left: 360 },
        children: [new TextRun({ text: entry.text, font: BODY_FONT, size: 22, bold: entry.level === 1 })],
      })
    );
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'LIST OF TABLES', font: BODY_FONT, size: 32, bold: true })] }));
  children.push(...staticList(listOfTables));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'LIST OF FIGURES', font: BODY_FONT, size: 32, bold: true })] }));
  children.push(...staticList(listOfFigures));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'LIST OF ABBREVIATIONS', font: BODY_FONT, size: 32, bold: true })] }));
  if (abbreviationTable) children.push(...tableBlock({ ...abbreviationTable, caption: 'Table A1.1 Abbreviations used in the report' }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  for (const file of chapters) children.push(...sectionFromFile(file));

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'REFERENCES', font: BODY_FONT, size: 32, bold: true })] }));
  for (const block of renderBlocks(parseMarkdown(fs.readFileSync(path.join(DRAFT, 'references.md'), 'utf8')))) {
    if (block instanceof Paragraph) {
      children.push(new Paragraph({ spacing: { after: 120, line: 280 }, indent: { left: 480, hanging: 480 }, children: block.children }));
    }
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(...sectionFromFile('appendices.md'));

  const doc = new Document({
    creator: 'SecureShare project team',
    title: 'Secure File Sharing System Using End-to-End Encryption and Access Control',
    description: 'Project report for 21ECC402P, Computer Communication and Network Security',
    styles,
    numbering,
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Page ', font: BODY_FONT, size: 20 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: BODY_FONT, size: 20 }),
                ],
              }),
            ],
          }),
        },
        children,
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
