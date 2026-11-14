'use strict';
// Builds the report and the PDF, in two passes, so that the contents page
// carries the real page numbers.
//
//   node tools/build-deliverables.js
//
// Pass one writes the document with a placeholder contents list and a note of
// which heading sits on which page. The PDF is rendered, the real page numbers
// are read back out of it, and pass two writes them in. The contents list has
// the same number of lines in both passes, so the pagination does not move and
// the numbers stay true.
//
// LibreOffice and the docx package live outside the project on purpose: the
// application itself installs nothing.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'report');
const DOCX = path.join(REPORT_DIR, 'SecureShare-Project-Report.docx');
const PDF = path.join(REPORT_DIR, 'SecureShare-Project-Report.pdf');
const TOC = path.join(REPORT_DIR, '.toc.json');
const SOFFICE = 'C:/Program Files/LibreOffice/program/soffice.exe';

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', cwd: ROOT });
}

function buildDocx() {
  run(process.execPath, [path.join(__dirname, 'build-report.js')]);
}

function toPdf() {
  run(SOFFICE, ['--headless', '--convert-to', 'pdf', DOCX, '--outdir', REPORT_DIR]);
}

// The headings are read back out of the rendered PDF with the page numbers the
// PDF itself uses, which is what the reader will look up.
function readPageNumbers() {
  let pymupdf;
  try {
    pymupdf = require('pymupdf');
  } catch (err) {
    pymupdf = null;
  }
  if (!pymupdf) {
    const { execFileSync: exec } = require('child_process');
    const script = `
import json, pymupdf
d = pymupdf.open(r'${PDF.replace(/\\/g, '/')}')
out = {}
for i, page in enumerate(d):
    for line in page.get_text().split('\\n'):
        line = line.strip()
        if line:
            out.setdefault(line, i + 1)
print(json.dumps(out))
`;
    const json = exec('python', ['-c', script], { encoding: 'utf8' });
    return JSON.parse(json);
  }
  const doc = pymupdf.open(PDF);
  const map = {};
  doc.forEach((page, index) => {
    for (const line of page.get_text().split('\n')) {
      const text = line.trim();
      if (text && !(text in map)) map[text] = index + 1;
    }
  });
  return map;
}

function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // Pass one.
  buildDocx();
  toPdf();

  const pages = readPageNumbers();
  const previous = fs.existsSync(TOC) ? JSON.parse(fs.readFileSync(TOC, 'utf8')) : {};
  const merged = { ...previous };
  for (const [heading, page] of Object.entries(pages)) {
    if (heading in merged) continue;
    merged[heading] = page;
  }
  fs.writeFileSync(TOC, JSON.stringify(merged, null, 2));

  // Pass two, with the real numbers in place.
  buildDocx();
  toPdf();
  console.log('report written with real contents page numbers');
}

main();
