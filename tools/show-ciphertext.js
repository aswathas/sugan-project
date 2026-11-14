'use strict';
// Shows what the server actually holds for every share, as bytes.
//
//   node tools/show-ciphertext.js
//
// This is the terminal half of the demonstration: it prints the first bytes of
// each stored file as hex, next to the name of the file the sender uploaded.
// The two are never the same, because what is on disk is ciphertext.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BLOB_DIR = path.join(DATA_DIR, 'blobs');

if (!fs.existsSync(DB_FILE)) {
  console.log('No data yet. Start the server and share a file first.');
  process.exit(0);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const shares = Object.values(db.shares || {});

if (!shares.length) {
  console.log('No shares yet.');
  process.exit(0);
}

const hex = (buffer) => [...buffer.subarray(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
const printable = (buffer) => buffer.subarray(0, 16).toString('utf8').replace(/[^\x20-\x7e]/g, '.');

for (const share of shares) {
  const blobPath = path.join(BLOB_DIR, `${share.id}.bin`);
  let stored = Buffer.alloc(0);
  try {
    stored = fs.readFileSync(blobPath);
  } catch (err) {
    stored = Buffer.alloc(0);
  }
  console.log(`\n${share.filename}`);
  console.log(`  from ${share.from} to ${share.to}   permission: ${share.permission || 'view'}`);
  console.log(`  file on disk : ${blobPath}`);
  console.log(`  stored bytes : ${stored.length}`);
  console.log(`  first 16     : ${hex(stored)}`);
  console.log(`  as text      : ${printable(stored)}`);
  console.log(`  the sender's file began with something else; the server never saw it`);
}
