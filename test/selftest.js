'use strict';
// End-to-end check of the share flow, using Node's WebCrypto (the same API the
// browser uses): two users, a file encrypted before upload, shared to one of
// them, decrypted by them. A third user must not be able to read it.
//
// Also covers the registration authentication: email + one-time code before the
// account can be used.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { webcrypto } = require('node:crypto');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sugan-selftest-'));
process.env.DATA_DIR = DATA_DIR;
process.env.PORT = '0';

const { subtle } = webcrypto;
const RSA = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const server = require('../server/index.js');

function b64(bytes) {
  return Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).toString('base64');
}
function unb64(text) {
  return new Uint8Array(Buffer.from(text, 'base64'));
}

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
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null, text };
}

async function makeUser(username) {
  const pair = await subtle.generateKey(RSA, false, ['encrypt', 'decrypt']);
  const spki = await subtle.exportKey('spki', pair.publicKey);
  return { username, pair, publicKey: b64(spki) };
}

async function register(user) {
  const res = await call('/api/register', {
    method: 'POST',
    body: {
      username: user.username,
      email: `${user.username}@example.com`,
      password: 'correct-horse',
      publicKey: user.publicKey,
    },
  });
  assert.strictEqual(res.status, 201, `register failed for ${user.username}: ${res.text}`);
  assert.ok(res.body.demoCode, 'console mail mode should hand back the code for the demo');
  return res.body.demoCode;
}

async function verify(username, code) {
  const res = await call('/api/verify-otp', { method: 'POST', body: { username, code } });
  assert.strictEqual(res.status, 200, `verify failed for ${username}: ${res.text}`);
  return res.headers.get('set-cookie').split(';')[0];
}

(async () => {
  await new Promise((resolve) => (server.listening ? resolve() : server.on('listening', resolve)));

  const alice = await makeUser('alice');
  const bob = await makeUser('bob');
  const carol = await makeUser('carol');
  const plaintext = Buffer.from('%PDF-1.4 pretend this is a confidential syllabus');

  const aliceCode = await register(alice);
  const bobCode = await register(bob);
  const carolCode = await register(carol);

  // An account is useless until the email code is verified.
  const earlyLogin = await call('/api/login', {
    method: 'POST',
    body: { username: 'alice', password: 'correct-horse' },
  });
  assert.strictEqual(earlyLogin.status, 403, 'unverified accounts must not be able to sign in');

  const wrongCode = await call('/api/verify-otp', {
    method: 'POST',
    body: { username: 'alice', code: '000000' === aliceCode ? '111111' : '000000' },
  });
  assert.strictEqual(wrongCode.status, 401, 'a wrong code must be rejected');

  const aliceCookie = await verify('alice', aliceCode);
  const bobCookie = await verify('bob', bobCode);
  const carolCookie = await verify('carol', carolCode);

  const badLogin = await call('/api/login', { method: 'POST', body: { username: 'alice', password: 'wrong' } });
  assert.strictEqual(badLogin.status, 401, 'wrong password must be rejected');

  const users = await call('/api/users', { cookie: aliceCookie });
  const bobOnServer = users.body.users.find((u) => u.username === 'bob');
  assert.ok(bobOnServer, 'bob should be listed');
  assert.strictEqual(bobOnServer.publicKey, bob.publicKey, 'server must store the public key it was given');

  // Alice encrypts for Bob: AES-GCM key, wrapped with Bob's public key.
  const aes = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, plaintext);
  const rawAes = await subtle.exportKey('raw', aes);
  const bobPublic = await subtle.importKey('spki', unb64(bob.publicKey), RSA, false, ['encrypt']);
  const wrappedKey = await subtle.encrypt({ name: 'RSA-OAEP' }, bobPublic, rawAes);

  const shared = await call('/api/shares', {
    method: 'POST',
    cookie: aliceCookie,
    body: {
      recipient: 'bob',
      filename: 'syllabus.pdf',
      size: plaintext.length,
      permission: 'view',
      iv: b64(iv),
      wrappedKey: b64(wrappedKey),
      ciphertext: b64(ciphertext),
    },
  });
  assert.strictEqual(shared.status, 201, `share failed: ${shared.text}`);
  const shareId = shared.body.id;

  const aliceShares = await call('/api/shares', { cookie: aliceCookie });
  assert.strictEqual(aliceShares.body.sent.length, 1, 'alice should see one sent share');
  assert.strictEqual(aliceShares.body.inbox.length, 0, 'alice inbox should be empty');

  const bobShares = await call('/api/shares', { cookie: bobCookie });
  assert.strictEqual(bobShares.body.inbox.length, 1, 'bob should see one received share');
  assert.strictEqual(bobShares.body.inbox[0].filename, 'syllabus.pdf');
  assert.strictEqual(bobShares.body.inbox[0].permission, 'view', 'the sender permission must reach the recipient');

  const carolShares = await call('/api/shares', { cookie: carolCookie });
  assert.strictEqual(carolShares.body.inbox.length, 0, 'carol must not see the share');

  const carolBlob = await call(`/api/shares/${shareId}/blob`, { cookie: carolCookie });
  assert.strictEqual(carolBlob.status, 403, 'carol must not be able to fetch the blob');

  const meta = await call(`/api/shares/${shareId}`, { cookie: bobCookie });
  assert.strictEqual(meta.status, 200);

  const blobRes = await fetch(`http://127.0.0.1:${server.address().port}/api/shares/${shareId}/blob`, {
    headers: { cookie: bobCookie },
  });
  const stored = Buffer.from(await blobRes.arrayBuffer());
  assert.ok(!stored.includes(plaintext.toString('utf8')), 'the server must not hold plaintext');

  // Bob decrypts with his private key.
  const unwrapped = await subtle.decrypt({ name: 'RSA-OAEP' }, bob.pair.privateKey, unb64(meta.body.wrappedKey));
  const aesForBob = await subtle.importKey('raw', unwrapped, { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = Buffer.from(await subtle.decrypt({ name: 'AES-GCM', iv: unb64(meta.body.iv) }, aesForBob, stored));
  assert.strictEqual(decrypted.toString('utf8'), plaintext.toString('utf8'), 'decrypted file must match the original');

  console.log('PASS  register + email one-time code verification');
  console.log('PASS  unverified account cannot sign in, wrong code rejected');
  console.log('PASS  register + login + keypair publish');
  console.log('PASS  encrypt in browser, server stores ciphertext only');
  console.log('PASS  recipient decrypts to the original bytes');
  console.log('PASS  third party cannot list or fetch the share (403)');
  console.log('PASS  wrong password rejected (401)');

  server.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
})().catch((err) => {
  console.error('FAIL ', err.message);
  server.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(1);
});
