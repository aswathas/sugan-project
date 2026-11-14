'use strict';
// Runs every check in the project, in the order a reviewer would.
//
//   node tools/test-all.js
//
// Each step prints its own lines. The last line says how many steps passed.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HALLMARK = 'C:/Users/ADMIN/.claude/skills/hallmark/scripts/sloplint.mjs';
const IMPECCABLE = 'C:/Users/ADMIN/.claude/skills/impeccable/scripts/impeccable';
const VALIDATE = 'C:/Users/ADMIN/.claude/skills/pptx/scripts/office/validate.py';
const NODE_MODULES = 'C:/Users/ADMIN/AppData/Local/Temp';

const steps = [
  {
    name: 'server contract and the Google verification',
    cmd: process.execPath,
    args: ['test/selftest.js'],
    env: {},
  },
  { name: 'Google verification', cmd: process.execPath, args: ['test/googletest.js'], env: {} },
  { name: 'the real interface in headless Chrome', cmd: process.execPath, args: ['test/browsertest.js'], env: {} },
  { name: 'the running server', cmd: process.execPath, args: ['test/livecheck.js'], env: {} },
  { name: 'the design gate', cmd: process.execPath, args: [HALLMARK, 'public', '--scope', 'app', '--genre', 'modern-minimal'], env: {} },
  {
    name: 'the interface detector',
    cmd: 'bash',
    args: [IMPECCABLE, 'detect', 'public'],
    env: {},
  },
  {
    name: 'the deck',
    cmd: process.execPath,
    args: ['tools/build-deck.js'],
    env: { NODE_PATH: `${NODE_MODULES}/pptxbuild/node_modules` },
  },
  {
    name: 'the report',
    cmd: process.execPath,
    args: ['tools/build-deliverables.js'],
    env: { NODE_PATH: `${NODE_MODULES}/docxbuild/node_modules` },
  },
];

const results = [];
for (const step of steps) {
  console.log(`\n=== ${step.name} ===`);
  const run = spawnSync(step.cmd, step.args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...step.env },
    shell: step.cmd === 'bash',
  });
  results.push({ name: step.name, ok: run.status === 0 });
}

// The deck must open in PowerPoint, and the report's contents must name the
// pages the headings are actually on.
console.log('\n=== the deck file ===');
const validate = spawnSync('python', [VALIDATE, path.join(ROOT, 'report', 'SecureShare-REVIEW-3.pptx')], {
  stdio: 'inherit',
});
results.push({ name: 'the deck validates', ok: validate.status === 0 });

console.log('\n=== the contents page ===');
const contents = spawnSync(
  'python',
  [
    '-c',
    `
import re, sys, pymupdf
d = pymupdf.open(r'${path.join(ROOT, 'report', 'SecureShare-Project-Report.pdf').replace(/\\/g, '/')}')
toc = None
for i in range(1, 8):
    if 'TABLE OF CONTENTS' in d[i].get_text():
        toc = i
        break
if toc is None:
    print('no contents page')
    sys.exit(1)
words = d[toc].get_text('words')
lines = {}
for w in words:
    lines.setdefault(round(w[1] / 3), []).append(w)
entries = {}
for key in sorted(lines):
    ws = sorted(lines[key], key=lambda w: w[0])
    text = ' '.join(w[4] for w in ws)
    m = re.match(r'^(.*?)\\.{3,}\\s*(\\d+)$', text)
    if m:
        entries[m.group(1).strip()] = int(m.group(2))
real = {}
for p in range(len(d)):
    if p == toc:
        continue
    for line in d[p].get_text().split('\\n'):
        line = line.strip()
        if line and line not in real:
            real[line] = p + 1
bad = [(k, v, real[k]) for k, v in entries.items() if k in real and real[k] != v]
print(f'{len(entries)} entries, {len(bad)} wrong')
for k, v, r in bad[:5]:
    print('  ', k, 'says', v, 'is on', r)
sys.exit(1 if bad or not entries else 0)
`,
  ],
  { stdio: 'inherit' }
);
results.push({ name: 'the contents page numbers are right', ok: contents.status === 0 });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} steps passed`);
if (failed.length) {
  console.log('failed: ' + failed.map((f) => f.name).join(', '));
  process.exit(1);
}
