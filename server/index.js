'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { load, save, writeBlob, readBlob, removeBlob } = require('./store');
const { hashPassword, verifyPassword, newToken } = require('./crypto');
const { deliverOtp } = require('./mailer');
const { verifyGoogleIdToken } = require('./google');
const trail = require('./trail');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY = 64 * 1024 * 1024;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_OTP_ATTEMPTS = 5;
const MAX_SHARES_PER_USER = 200;
const MAX_FILENAME = 200;

// The page runs its own script and its own styles and nothing else, so a page
// that is ever injected cannot pull in a remote script of its own.
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data:; font-src 'self'; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; base-uri 'none'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // Google's sign-in button answers 400 when the request carries no referrer,
  // so the origin is sent and nothing more. The path is not.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const db = load();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    out[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim());
  }
  return out;
}

function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const session = db.sessions[token];
  if (!session) return null;
  if (session.expires < Date.now()) {
    delete db.sessions[token];
    return null;
  }
  return session.username;
}

function requireUser(req, res) {
  const username = currentUser(req);
  if (!username) {
    json(res, 401, { error: 'not signed in' });
    return null;
  }
  // Presence without websockets: the server notes that this account is active.
  const user = db.users[username];
  if (user) {
    user.lastSeen = Date.now();
    if (Date.now() - (db.lastSeenSave || 0) > 30000) {
      db.lastSeenSave = Date.now();
      save(db);
    }
  }
  return username;
}

// A Google account gets a username derived from its address, kept unique.
function uniqueUsernameFor(payload) {
  const base =
    String(payload.email || payload.sub || 'user')
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '')
      .slice(0, 24) || 'user';
  let username = base;
  let counter = 1;
  while (db.users[username]) {
    username = `${base}-${counter}`;
    counter += 1;
  }
  return username;
}

// The audit trail. Every event names the share it belongs to, so the activity
// feed can be filtered per user without ever showing a share of somebody else.
// The entries are chained by server/trail.js, so an entry that is edited or
// removed afterwards breaks the chain.
function logEvent(type, actor, share, detail) {
  db.activity = db.activity || [];
  trail.append(db.activity, {
    ts: Date.now(),
    type,
    actor,
    shareId: share ? share.id : null,
    filename: share ? share.filename : null,
    with: share ? (share.from === actor ? share.to : share.from) : null,
    detail: detail || null,
  });
  if (db.activity.length > 500) db.activity = db.activity.slice(-500);
}

function verifyTrail() {
  return trail.verify(db.activity || []);
}

// A share is dead when the sender revoked it or when its time ran out. The
// metadata stays visible so the card can say so; only the bytes are refused.
function shareState(share, now = Date.now()) {
  if (share.deletedAt) return 'trashed';
  if (share.revokedAt) return 'revoked';
  if (share.expiresAt && share.expiresAt <= now) return 'expired';
  return 'live';
}

function shareView(share, username) {
  return {
    id: share.id,
    from: share.from,
    to: share.to,
    filename: share.filename,
    size: share.size,
    storedSize: share.storedSize || share.size,
    permission: share.permission || 'view',
    createdAt: share.createdAt,
    expiresAt: share.expiresAt || null,
    revokedAt: share.revokedAt || null,
    openedAt: share.openedAt || null,
    deletedAt: share.deletedAt || null,
    deletedBy: share.deletedBy || null,
    digest: share.digest || null,
    signature: share.signature || null,
    protected: share.protected || 'key',
    passwordSalt: share.passwordSalt || null,
    passwordWrappedKey: share.passwordWrappedKey || null,
    starred: Boolean(username && (share.starredBy || []).includes(username)),
    state: shareState(share),
  };
}

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/config') {
    // Public configuration the browser needs. Nothing secret is exposed here:
    // the client id is public by design, and the client secret never leaves the server.
    // The authorised origins are published so the page can hide the Google
    // button on an origin Google would refuse, rather than show a broken one.
    const origins = (process.env.GOOGLE_ORIGINS || 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    return json(res, 200, {
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
      authorizedOrigins: origins,
      requireAccessCode: Boolean(process.env.ACCESS_CODE),
    });
  }

  if (route === 'POST /api/google-signin') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return json(res, 503, { error: 'Google sign-in is not configured on this server' });
    }
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    let payload;
    try {
      payload = await verifyGoogleIdToken(body.idToken, clientId);
    } catch (err) {
      return json(res, 401, { error: `Google sign-in failed: ${err.message}` });
    }

    let user = Object.values(db.users).find((u) => u.googleSub === payload.sub);
    let keyProvided = false;
    if (!user) {
      if (typeof body.publicKey !== 'string' || body.publicKey.length < 32) {
        return json(res, 400, { error: 'publicKey missing' });
      }
      user = {
        username: uniqueUsernameFor(payload),
        email: payload.email || `${payload.sub}@google`,
        googleSub: payload.sub,
        publicKey: body.publicKey,
        signingKey: typeof body.signingKey === 'string' ? body.signingKey : null,
        verified: true,
        createdAt: Date.now(),
      };
      db.users[user.username] = user;
      keyProvided = true;
      save(db);
    }

    const token = newToken();
    db.sessions[token] = { username: user.username, expires: Date.now() + SESSION_TTL_MS };
    save(db);
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
    return json(res, 200, { username: user.username, keyProvided });
  }

  if (route === 'POST /api/register') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const { username, email, password, publicKey } = body;
    const signingKey = typeof body.signingKey === 'string' ? body.signingKey : null;
    // A public deployment should not accept registrations from strangers. The
    // check comes first so a stranger cannot even learn which usernames exist.
    if (process.env.ACCESS_CODE) {
      const expected = Buffer.from(process.env.ACCESS_CODE);
      const given = Buffer.from(String(body.accessCode || ''));
      const ok = expected.length === given.length && crypto.timingSafeEqual(expected, given);
      if (!ok) {
        return json(res, 403, { error: 'the access code for this demo is not correct' });
      }
    }
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username || '')) {
      return json(res, 400, { error: 'username must be 3-32 letters, digits, dot, dash or underscore' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) {
      return json(res, 400, { error: 'a valid email address is required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return json(res, 400, { error: 'password must be at least 8 characters' });
    }
    if (typeof publicKey !== 'string' || publicKey.length < 32) {
      return json(res, 400, { error: 'publicKey missing' });
    }
    if (db.users[username]) {
      return json(res, 409, { error: 'username already taken' });
    }
    if (Object.values(db.users).some((u) => u.email === email)) {
      return json(res, 409, { error: 'that email is already registered' });
    }
    const { salt, hash } = hashPassword(password);
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const otp = hashPassword(code);
    db.users[username] = {
      username,
      email,
      salt,
      hash,
      publicKey,
      signingKey,
      verified: false,
      otp: { salt: otp.salt, hash: otp.hash, expires: Date.now() + OTP_TTL_MS },
      createdAt: Date.now(),
    };
    save(db);
    const delivery = await deliverOtp(email, code);
    return json(res, 201, {
      username,
      needsVerification: true,
      delivery: delivery.mode,
      // In console mode the code never leaves this machine; showing it keeps the
      // demo runnable without any email account.
      demoCode: delivery.mode === 'console' ? code : undefined,
    });
  }

  if (route === 'POST /api/verify-otp') {
    const { username, code } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const user = db.users[username];
    if (!user) return json(res, 404, { error: 'no such user' });
    if (user.verified) return json(res, 400, { error: 'account is already verified' });
    if (!user.otp || user.otp.expires < Date.now()) {
      return json(res, 400, { error: 'code expired, register again' });
    }
    if (!verifyPassword(String(code || ''), user.otp.salt, user.otp.hash)) {
      user.otp.attempts = (user.otp.attempts || 0) + 1;
      if (user.otp.attempts >= MAX_OTP_ATTEMPTS) {
        delete user.otp;
        save(db);
        return json(res, 429, { error: 'too many wrong codes, register again' });
      }
      save(db);
      return json(res, 401, { error: 'wrong code' });
    }
    user.verified = true;
    delete user.otp;
    const token = newToken();
    db.sessions[token] = { username, expires: Date.now() + SESSION_TTL_MS };
    save(db);
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
    return json(res, 200, { username });
  }

  if (route === 'POST /api/login') {
    const { username, password } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const attempts = db.loginAttempts || {};
    const record = attempts[username];
    if (record && record.count >= MAX_LOGIN_ATTEMPTS && record.until > Date.now()) {
      return json(res, 429, {
        error: `too many failed sign-ins, try again in ${Math.ceil((record.until - Date.now()) / 60000)} minutes`,
      });
    }
    const user = db.users[username];
    if (!user || !verifyPassword(String(password || ''), user.salt, user.hash)) {
      if (record) {
        record.count += 1;
        record.until = Date.now() + 15 * 60 * 1000;
      } else {
        attempts[username] = { count: 1, until: Date.now() + 15 * 60 * 1000 };
      }
      db.loginAttempts = attempts;
      save(db);
      return json(res, 401, { error: 'wrong username or password' });
    }
    if (!user.verified) {
      return json(res, 403, { error: 'verify your email with the code first' });
    }
    delete attempts[username];
    db.loginAttempts = attempts;
    const token = newToken();
    db.sessions[token] = { username, expires: Date.now() + SESSION_TTL_MS };
    save(db);
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
    return json(res, 200, { username });
  }

  if (route === 'POST /api/logout') {
    const token = parseCookies(req).sid;
    if (token) {
      delete db.sessions[token];
      save(db);
    }
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return json(res, 200, { ok: true });
  }

  if (route === 'POST /api/logout-all') {
    const username = requireUser(req, res);
    if (!username) return;
    let ended = 0;
    for (const [token, session] of Object.entries(db.sessions)) {
      if (session.username === username) {
        delete db.sessions[token];
        ended += 1;
      }
    }
    save(db);
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return json(res, 200, { ok: true, ended });
  }

  if (route === 'GET /api/me') {
    const username = currentUser(req);
    if (!username) return json(res, 401, { error: 'not signed in' });
    return json(res, 200, { username });
  }

  if (route === 'GET /api/users') {
    if (!requireUser(req, res)) return;
    const users = Object.values(db.users)
      .map((u) => ({
        username: u.username,
        publicKey: u.publicKey,
        signingKey: u.signingKey || null,
        lastSeen: u.lastSeen || null,
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
    return json(res, 200, { users });
  }

  if (route === 'POST /api/keys/backup') {
    const username = requireUser(req, res);
    if (!username) return;
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const b64 = /^[A-Za-z0-9+/=]+$/;
    if (
      typeof body.salt !== 'string' || !b64.test(body.salt) ||
      typeof body.iv !== 'string' || !b64.test(body.iv) ||
      typeof body.ciphertext !== 'string' || !b64.test(body.ciphertext)
    ) {
      return json(res, 400, { error: 'the wrapped key must be salt, iv and ciphertext' });
    }
    db.users[username].keyBackup = { salt: body.salt, iv: body.iv, ciphertext: body.ciphertext };
    save(db);
    return json(res, 200, { ok: true });
  }

  if (route === 'GET /api/keys/backup') {
    const username = requireUser(req, res);
    if (!username) return;
    const backup = db.users[username].keyBackup;
    if (!backup) return json(res, 404, { error: 'no key backup on file' });
    return json(res, 200, backup);
  }

  // Recovery, before there is a session: the blob is the private key encrypted
  // under the recovery phrase, so the server hands it over without being able to
  // read it. The phrase never reaches the server.
  if (route === 'POST /api/keys/recover') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const user = db.users[String(body.username || '')];
    if (!user || !user.keyBackup) return json(res, 404, { error: 'no key backup for that account' });
    return json(res, 200, user.keyBackup);
  }

  if (route === 'POST /api/shares') {
    const username = requireUser(req, res);
    if (!username) return;
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const { recipient, filename, size, iv, wrappedKey, ciphertext } = body;
    const permission = body.permission === 'download' ? 'download' : 'view';
    if (!db.users[recipient]) return json(res, 400, { error: 'recipient does not exist' });
    if (!filename || typeof filename !== 'string') return json(res, 400, { error: 'filename missing' });
    if (filename.length > MAX_FILENAME) {
      return json(res, 400, { error: `the file name must be at most ${MAX_FILENAME} characters` });
    }
    const held = Object.values(db.shares).filter((s) => s.from === username || s.to === username).length;
    if (held >= MAX_SHARES_PER_USER) {
      return json(res, 429, { error: `this account already holds the maximum of ${MAX_SHARES_PER_USER} files` });
    }
    if (typeof iv !== 'string' || typeof wrappedKey !== 'string' || typeof ciphertext !== 'string') {
      return json(res, 400, { error: 'iv, wrappedKey and ciphertext are required' });
    }
    if (body.digest != null && !/^[0-9a-f]{64}$/.test(String(body.digest))) {
      return json(res, 400, { error: 'digest must be a sha-256 hex string' });
    }
    if (body.signature != null && typeof body.signature !== 'string') {
      return json(res, 400, { error: 'signature must be a base64 string' });
    }
    if (body.protected === 'password') {
      if (typeof body.passwordSalt !== 'string') {
        return json(res, 400, { error: 'a password protected share needs its salt' });
      }
      if (typeof body.passwordWrappedKey !== 'string') {
        return json(res, 400, { error: 'a password protected share needs its second wrap' });
      }
    }
    // The sender sets the moment the file dies, because the signature covers
    // it and the recipient has to rebuild the same value to check that
    // signature. The server refuses anything outside the range it would have
    // allowed itself, so the stored value is always the signed one.
    let expiresAt = null;
    if (body.expiresAt != null) {
      const asked = Number(body.expiresAt);
      const ceiling = Date.now() + 30 * 24 * 3600 * 1000;
      if (!Number.isFinite(asked) || asked <= Date.now() || asked > ceiling) {
        return json(res, 400, { error: 'the expiry must be in the future and at most 30 days away' });
      }
      expiresAt = asked;
    } else {
      const lifetime = Math.max(0, Math.min(Number(body.expiresIn) || 0, 30 * 24 * 3600));
      expiresAt = lifetime ? Date.now() + lifetime * 1000 : null;
    }
    const blob = Buffer.from(ciphertext, 'base64');
    const id = crypto.randomUUID();
    writeBlob(id, blob);
    db.shares[id] = {
      id,
      from: username,
      to: recipient,
      filename,
      size: Number(size) || blob.length,
      storedSize: blob.length,
      permission,
      iv,
      wrappedKey,
      passwordWrappedKey: body.passwordWrappedKey || null,
      digest: body.digest || null,
      signature: body.signature || null,
      protected: body.protected === 'password' ? 'password' : 'key',
      passwordSalt: body.passwordSalt || null,
      blob: `${id}.bin`,
      createdAt: Date.now(),
      expiresAt,
      revokedAt: null,
      openedAt: null,
    };
    logEvent('sent', username, db.shares[id], permission);
    save(db);
    return json(res, 201, { id });
  }

  if (route === 'GET /api/shares') {
    const username = requireUser(req, res);
    if (!username) return;
    const all = Object.values(db.shares).sort((a, b) => b.createdAt - a.createdAt);
    const view = (s) => shareView(s, username);
    return json(res, 200, {
      inbox: all.filter((s) => s.to === username && !s.deletedAt).map(view),
      sent: all.filter((s) => s.from === username && !s.deletedAt).map(view),
      starred: all.filter((s) => (s.starredBy || []).includes(username) && !s.deletedAt).map(view),
      trashed: all.filter((s) => (s.from === username || s.to === username) && s.deletedAt).map(view),
    });
  }

  if (route === 'GET /api/activity') {
    const username = requireUser(req, res);
    if (!username) return;
    const mine = (db.activity || []).filter((event) => {
      if (event.actor === username) return true;
      const share = event.shareId ? db.shares[event.shareId] : null;
      return share ? share.from === username || share.to === username : false;
    });
    return json(res, 200, { activity: mine.slice(-60).reverse() });
  }

  if (route === 'GET /api/activity/verify') {
    const username = requireUser(req, res);
    if (!username) return;
    return json(res, 200, verifyTrail());
  }

  const starMatch = url.pathname.match(/^\/api\/shares\/([^/]+)\/star$/);
  if (req.method === 'POST' && starMatch) {
    const username = requireUser(req, res);
    if (!username) return;
    const share = db.shares[starMatch[1]];
    if (!share) return json(res, 404, { error: 'not found' });
    if (share.from !== username && share.to !== username) {
      return json(res, 403, { error: 'not your share' });
    }
    share.starredBy = share.starredBy || [];
    const at = share.starredBy.indexOf(username);
    if (at >= 0) share.starredBy.splice(at, 1);
    else share.starredBy.push(username);
    save(db);
    return json(res, 200, { id: share.id, starred: at < 0 });
  }

  const deleteMatch = url.pathname.match(/^\/api\/shares\/([^/]+)\/delete$/);
  if (req.method === 'POST' && deleteMatch) {
    const username = requireUser(req, res);
    if (!username) return;
    const share = db.shares[deleteMatch[1]];
    if (!share) return json(res, 404, { error: 'not found' });
    if (share.from !== username && share.to !== username) {
      return json(res, 403, { error: 'not your share' });
    }
    if (!share.deletedAt) {
      share.deletedAt = Date.now();
      share.deletedBy = username;
      logEvent('deleted', username, share, null);
      save(db);
    }
    return json(res, 200, { id: share.id, deletedAt: share.deletedAt });
  }

  const restoreMatch = url.pathname.match(/^\/api\/shares\/([^/]+)\/restore$/);
  if (req.method === 'POST' && restoreMatch) {
    const username = requireUser(req, res);
    if (!username) return;
    const share = db.shares[restoreMatch[1]];
    if (!share) return json(res, 404, { error: 'not found' });
    if (share.from !== username && share.to !== username) {
      return json(res, 403, { error: 'not your share' });
    }
    if (!share.deletedAt) return json(res, 409, { error: 'this share is not in the trash' });
    share.deletedAt = null;
    share.deletedBy = null;
    logEvent('restored', username, share, null);
    save(db);
    return json(res, 200, { id: share.id });
  }

  const purgeMatch = url.pathname.match(/^\/api\/shares\/([^/]+)\/purge$/);
  if (req.method === 'POST' && purgeMatch) {
    const username = requireUser(req, res);
    if (!username) return;
    const share = db.shares[purgeMatch[1]];
    if (!share) return json(res, 404, { error: 'not found' });
    if (share.from !== username) return json(res, 403, { error: 'only the sender can purge a share' });
    if (!share.deletedAt) return json(res, 409, { error: 'move it to the trash first' });
    delete db.shares[share.id];
    removeBlob(share.id);
    logEvent('purged', username, share, null);
    save(db);
    return json(res, 200, { id: share.id });
  }

  const revokeMatch = url.pathname.match(/^\/api\/shares\/([^/]+)\/revoke$/);
  if (req.method === 'POST' && revokeMatch) {
    const username = requireUser(req, res);
    if (!username) return;
    const share = db.shares[revokeMatch[1]];
    if (!share) return json(res, 404, { error: 'not found' });
    if (share.from !== username) return json(res, 403, { error: 'only the sender can revoke a share' });
    if (share.openedAt) {
      return json(res, 409, { error: 'the recipient already opened this file' });
    }
    if (share.revokedAt) return json(res, 409, { error: 'already revoked' });
    share.revokedAt = Date.now();
    logEvent('revoked', username, share, null);
    save(db);
    return json(res, 200, { id: share.id, revokedAt: share.revokedAt });
  }

  const openedMatch = url.pathname.match(/^\/api\/shares\/([^/]+)\/opened$/);
  if (req.method === 'POST' && openedMatch) {
    const username = requireUser(req, res);
    if (!username) return;
    const share = db.shares[openedMatch[1]];
    if (!share) return json(res, 404, { error: 'not found' });
    if (share.to !== username) return json(res, 403, { error: 'only the recipient can open a share' });
    if (!share.openedAt) {
      share.openedAt = Date.now();
      logEvent('opened', username, share, null);
      save(db);
    }
    return json(res, 200, { id: share.id, openedAt: share.openedAt });
  }

  const metaMatch = url.pathname.match(/^\/api\/shares\/([^/]+)$/);
  if (req.method === 'GET' && metaMatch) {
    const username = requireUser(req, res);
    if (!username) return;
    const share = db.shares[metaMatch[1]];
    if (!share) return json(res, 404, { error: 'not found' });
    if (share.from !== username && share.to !== username) {
      return json(res, 403, { error: 'not your share' });
    }
    return json(res, 200, { ...shareView(share), iv: share.iv, wrappedKey: share.wrappedKey });
  }

  const headMatch = url.pathname.match(/^\/api\/shares\/([^/]+)\/cipher-head$/);
  if (req.method === 'GET' && headMatch) {
    const username = requireUser(req, res);
    if (!username) return;
    const share = db.shares[headMatch[1]];
    if (!share) return json(res, 404, { error: 'not found' });
    if (share.from !== username && share.to !== username) {
      return json(res, 403, { error: 'not your share' });
    }
    const blob = readBlob(share.id);
    if (!blob) return json(res, 404, { error: 'blob missing' });
    const head = blob.subarray(0, 32);
    return json(res, 200, {
      size: blob.length,
      head: head.toString('hex'),
      // The same bytes as text, with anything unprintable shown as a dot, so the
      // professor can see that the stored file is not readable.
      readable: head.toString('utf8').replace(/[^\x20-\x7e]/g, '.'),
    });
  }

  const blobMatch = url.pathname.match(/^\/api\/shares\/([^/]+)\/blob$/);
  if (req.method === 'GET' && blobMatch) {
    const username = requireUser(req, res);
    if (!username) return;
    const share = db.shares[blobMatch[1]];
    if (!share) return json(res, 404, { error: 'not found' });
    if (share.from !== username && share.to !== username) {
      return json(res, 403, { error: 'not your share' });
    }
    // A revoked or expired share keeps its metadata but gives up its bytes.
    const state = shareState(share);
    if (state !== 'live') {
      return json(res, 410, { error: state === 'revoked' ? 'this share was revoked' : 'this share has expired' });
    }
    const blob = readBlob(share.id);
    if (!blob) return json(res, 404, { error: 'blob missing' });
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': blob.length,
    });
    return res.end(blob);
  }

  return json(res, 404, { error: 'no such endpoint' });
}

function serveStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(PUBLIC_DIR, relative);
  if (!target.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target)] || 'application/octet-stream',
      'Content-Length': data.length,
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      serveStatic(res, url.pathname);
    }
  } catch (err) {
    if (!res.headersSent) json(res, 500, { error: err.message || 'server error' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`sugan-project running at http://${HOST}:${server.address().port}`);
});

module.exports = server;
