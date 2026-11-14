'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BLOB_DIR = path.join(DATA_DIR, 'blobs');

function emptyDb() {
  return {
    users: {},
    sessions: {},
    shares: {},
    activity: [],
    loginAttempts: {},
    pendingLogins: {},
    pendingTotp: {},
    trailAnchor: null,
  };
}

function load() {
  let raw;
  try {
    raw = fs.readFileSync(DB_FILE, 'utf8');
  } catch {
    return emptyDb();
  }
  try {
    const db = JSON.parse(raw);
    return {
      ...emptyDb(),
      users: db.users || {},
      sessions: db.sessions || {},
      shares: db.shares || {},
      activity: db.activity || [],
      loginAttempts: db.loginAttempts || {},
      pendingLogins: db.pendingLogins || {},
      pendingTotp: db.pendingTotp || {},
      trailAnchor: db.trailAnchor || null,
    };
  } catch (err) {
    // The file cannot be read. Keep it under another name so nothing is lost,
    // and say so, rather than starting as if no account had ever existed.
    const kept = `${DB_FILE}.broken-${Date.now()}`;
    try {
      fs.renameSync(DB_FILE, kept);
      console.error(`the database could not be read (${err.message}); it was kept as ${kept}`);
    } catch (moveErr) {
      console.error(`the database could not be read (${err.message}) and could not be moved aside`);
    }
    return emptyDb();
  }
}

// The write goes to a file beside the database and is then renamed over it.
// The rename is atomic, so the database is always the old one or the new one,
// never half of each.
function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
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
