'use strict';
// Builds the report and its PDF, in two passes, so that the contents page
// carries the real page numbers.
//
//   node tools/build-deliverables.js
//
// Pass one writes the document with the contents entries and no numbers, and
// the PDF is rendered. The page each heading landed on is read back out of
// that PDF, written to report/.toc.json, and pass two writes the numbers in.
// The contents has the same number of lines in both passes, so the pagination
// does not move and the numbers stay true.
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

// Reads back the page each heading is on. The contents page itself is skipped,
// or every heading would be found in the contents first.
const MEASURE = `
import json, pymupdf
d = pymupdf.open(r'${PDF.replace(/\\/g, '/')}')
pages = {}
for index, page in enumerate(d):
    text = page.get_text()
    if 'TABLE OF CONTENTS' in text:
        continue
    for line in text.split('\\n'):
        line = line.strip()
        if line and line not in pages:
            pages[line] = index + 1
print(json.dumps(pages))
`;

function measure() {
  const out = execFileSync('python', ['-c', MEASURE], { encoding: 'utf8', cwd: ROOT });
  return JSON.parse(out);
}

function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // Pass one.
  buildDocx();
  toPdf();
  const measured = measure();
  const previous = fs.existsSync(TOC) ? JSON.parse(fs.readFileSync(TOC, 'utf8')) : {};
  fs.writeFileSync(TOC, JSON.stringify({ ...previous, ...measured }, null, 2));

  // Pass two, with the real numbers in place.
  buildDocx();
  toPdf();
  console.log('report written with the measured contents page numbers');
}

main();
