'use strict';
// Checks the Google sign-in path without touching Google.
//
// A local JWKS endpoint stands in for Google's signing keys, and the tokens are
// signed here with a throwaway RSA key, so every branch of the verification can
// be exercised: a good token, the wrong audience, an expired token, a tampered
// token and a token signed by somebody else.

const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sugan-googletest-'));
process.env.DATA_DIR = DATA_DIR;
process.env.PORT = '0';
process.env.GOOGLE_CLIENT_ID = CLIENT_ID;

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key-1';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const jwksServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ keys: [jwk] }));
});

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function makeToken(payload, { signer = privateKey, kid = KID } = {}) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const body = `${header}.${b64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(body), signer);
  return `${body}.${b64url(signature)}`;
}

function payloadFor(overrides = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'google-subject-123',
    email: 'sugan@example.com',
    email_verified: true,
    name: 'Sugan',
    ...overrides,
  };
}

function tamperWith(token) {
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  payload.sub = 'google-subject-999';
  return `${parts[0]}.${b64url(JSON.stringify(payload))}.${parts[2]}`;
}

const server = require('../server/index.js');

async function call(pathname, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`http://127.0.0.1:${server.address().port}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

(async () => {
  await new Promise((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
  process.env.GOOGLE_JWKS_URL = `http://127.0.0.1:${jwksServer.address().port}/certs`;
  await new Promise((resolve) => (server.listening ? resolve() : server.on('listening', resolve)));

  const publicKeyB64 = 'aGVsbG8tdGhpcy1pcy1hLXNwa2ktcHVibGljLWtleS1mb3ItdGhlLXRlc3Qtb25seQ';

  const config = await call('/api/config');
  assert.strictEqual(config.status, 200);
  assert.strictEqual(config.body.googleClientId, CLIENT_ID, 'the browser needs the client id');

  const noKey = await call('/api/google-signin', {
    method: 'POST',
    body: { idToken: makeToken(payloadFor()) },
  });
  assert.strictEqual(noKey.status, 400, 'a new account needs a public key for its key pair');

  const good = await call('/api/google-signin', {
    method: 'POST',
    body: { idToken: makeToken(payloadFor()), publicKey: publicKeyB64 },
  });
  assert.strictEqual(good.status, 200, `a valid token must be accepted: ${JSON.stringify(good.body)}`);
  assert.strictEqual(good.body.username, 'sugan', 'the username comes from the account address');
  assert.strictEqual(good.body.keyProvided, true, 'a new account stores the key the browser generated');
  assert.strictEqual(good.body.requiresTotp, true, 'a Google sign-in asks for the second factor as well');
  assert.ok(good.body.challenge, 'the sign-in waits for the code');
  assert.ok(!good.headers.get('set-cookie'), 'no session is granted before the code');

  // The code from the phone opens the session.
  const totp = require('../server/totp.js');
  const enrolCode = totp.codeAt(good.body.secret, Math.floor(Date.now() / 1000 / 30));
  const opened = await call('/api/login/totp', {
    method: 'POST',
    body: { challenge: good.body.challenge, code: enrolCode },
  });
  assert.strictEqual(opened.status, 200, `the code must open the session: ${JSON.stringify(opened.body)}`);

  const cookie = opened.headers.get('set-cookie').split(';')[0];
  const me = await call('/api/me', { cookie });
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.body.username, 'sugan');

  const again = await call('/api/google-signin', {
    method: 'POST',
    body: { idToken: makeToken(payloadFor()), publicKey: 'another-public-key-value-that-is-long-enough-xxx' },
  });
  assert.strictEqual(again.status, 200);
  assert.strictEqual(again.body.keyProvided, false, 'an existing account keeps the key it already published');
  assert.strictEqual(again.body.requiresTotp, true, 'the second factor is asked for every time');
  assert.ok(!again.body.enrol, 'the account already holds a factor');
  assert.ok(!again.headers.get('set-cookie'), 'no session is granted before the code');
  const wrongCode = await call('/api/login/totp', {
    method: 'POST',
    body: { challenge: again.body.challenge, code: '000000' },
  });
  assert.strictEqual(wrongCode.status, 401, 'a wrong code must not open the session');

  const wrongAudience = await call('/api/google-signin', {
    method: 'POST',
    body: { idToken: makeToken(payloadFor({ aud: 'somebody-elses-client-id' })), publicKey: publicKeyB64 },
  });
  assert.strictEqual(wrongAudience.status, 401, 'a token made for another application must be refused');

  const wrongIssuer = await call('/api/google-signin', {
    method: 'POST',
    body: { idToken: makeToken(payloadFor({ iss: 'https://evil.example' })), publicKey: publicKeyB64 },
  });
  assert.strictEqual(wrongIssuer.status, 401, 'a token from another issuer must be refused');

  const expired = await call('/api/google-signin', {
    method: 'POST',
    body: { idToken: makeToken(payloadFor({ exp: Math.floor(Date.now() / 1000) - 60 })), publicKey: publicKeyB64 },
  });
  assert.strictEqual(expired.status, 401, 'an expired token must be refused');

  const tampered = await call('/api/google-signin', {
    method: 'POST',
    body: {
      idToken: tamperWith(makeToken(payloadFor())),
      publicKey: publicKeyB64,
    },
  });
  assert.strictEqual(tampered.status, 401, 'a tampered token must fail the signature check');

  const impostor = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const forged = await call('/api/google-signin', {
    method: 'POST',
    body: { idToken: makeToken(payloadFor(), { signer: impostor.privateKey }), publicKey: publicKeyB64 },
  });
  assert.strictEqual(forged.status, 401, 'a token signed by another key must be refused');

  const garbage = await call('/api/google-signin', {
    method: 'POST',
    body: { idToken: 'not.a.token', publicKey: publicKeyB64 },
  });
  assert.strictEqual(garbage.status, 401, 'a malformed token must be refused');

  console.log('PASS  the client id is published for the browser');
  console.log('PASS  a valid Google token is accepted, and the sign-in waits for the authenticator code');
  console.log('PASS  no session is granted before the code, and a wrong code opens nothing');
  console.log('PASS  an existing account keeps the key it already published');
  console.log('PASS  wrong audience, wrong issuer, expired, tampered, forged and malformed tokens are all refused');

  server.close();
  jwksServer.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
})().catch((err) => {
  console.error('FAIL ', err.message);
  server.close();
  jwksServer.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(1);
});
