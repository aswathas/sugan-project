'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BLOB_DIR = path.join(DATA_DIR, 'blobs');

function load() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return {
      users: db.users || {},
      sessions: db.sessions || {},
      shares: db.shares || {},
      activity: db.activity || [],
      loginAttempts: db.loginAttempts || {},
    };
  } catch {
    return { users: {}, sessions: {}, shares: {}, activity: [], loginAttempts: {} };
  }
}

function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function writeBlob(id, buffer) {
  fs.mkdirSync(BLOB_DIR, { recursive: true });
  fs.writeFileSync(path.join(BLOB_DIR, `${id}.bin`), buffer);
}

function readBlob(id) {
  try {
    return fs.readFileSync(path.join(BLOB_DIR, `${id}.bin`));
  } catch {
    return null;
  }
}

function removeBlob(id) {
  try {
    fs.unlinkSync(path.join(BLOB_DIR, `${id}.bin`));
    return true;
  } catch {
    return false;
  }
}

module.exports = { DATA_DIR, DB_FILE, BLOB_DIR, load, save, writeBlob, readBlob, removeBlob };
