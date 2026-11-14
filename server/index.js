'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { load, save, writeBlob, readBlob } = require('./store');
const { hashPassword, verifyPassword, newToken } = require('./crypto');
const { deliverOtp } = require('./mailer');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY = 64 * 1024 * 1024;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

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
  return username;
}

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'POST /api/register') {
    const { username, email, password, publicKey } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username || '')) {
      return json(res, 400, { error: 'username must be 3-32 letters, digits, dot, dash or underscore' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) {
      return json(res, 400, { error: 'a valid email address is required' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return json(res, 400, { error: 'password must be at least 6 characters' });
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
      return json(res, 400, { error: 'code expired — register again' });
    }
    if (!verifyPassword(String(code || ''), user.otp.salt, user.otp.hash)) {
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
    const user = db.users[username];
    if (!user || !verifyPassword(String(password || ''), user.salt, user.hash)) {
      return json(res, 401, { error: 'wrong username or password' });
    }
    if (!user.verified) {
      return json(res, 403, { error: 'verify your email with the code first' });
    }
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

  if (route === 'GET /api/me') {
    const username = currentUser(req);
    if (!username) return json(res, 401, { error: 'not signed in' });
    return json(res, 200, { username });
  }

  if (route === 'GET /api/users') {
    if (!requireUser(req, res)) return;
    const users = Object.values(db.users)
      .map((u) => ({ username: u.username, publicKey: u.publicKey }))
      .sort((a, b) => a.username.localeCompare(b.username));
    return json(res, 200, { users });
  }

  if (route === 'POST /api/shares') {
    const username = requireUser(req, res);
    if (!username) return;
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const { recipient, filename, size, iv, wrappedKey, ciphertext } = body;
    if (!db.users[recipient]) return json(res, 400, { error: 'recipient does not exist' });
    if (!filename || typeof filename !== 'string') return json(res, 400, { error: 'filename missing' });
    if (typeof iv !== 'string' || typeof wrappedKey !== 'string' || typeof ciphertext !== 'string') {
      return json(res, 400, { error: 'iv, wrappedKey and ciphertext are required' });
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
      iv,
      wrappedKey,
      blob: `${id}.bin`,
      createdAt: Date.now(),
    };
    save(db);
    return json(res, 201, { id });
  }

  if (route === 'GET /api/shares') {
    const username = requireUser(req, res);
    if (!username) return;
    const all = Object.values(db.shares).sort((a, b) => b.createdAt - a.createdAt);
    const strip = (s) => ({
      id: s.id,
      from: s.from,
      to: s.to,
      filename: s.filename,
      size: s.size,
      createdAt: s.createdAt,
    });
    return json(res, 200, {
      inbox: all.filter((s) => s.to === username).map(strip),
      sent: all.filter((s) => s.from === username).map(strip),
    });
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
    return json(res, 200, {
      id: share.id,
      from: share.from,
      to: share.to,
      filename: share.filename,
      size: share.size,
      iv: share.iv,
      wrappedKey: share.wrappedKey,
      createdAt: share.createdAt,
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
