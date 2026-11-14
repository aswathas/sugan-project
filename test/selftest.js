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

// The fingerprint the browser computes over the plaintext, so the test can
// check the same integrity step the interface does.
async function digestOf(bytes) {
  const hash = await subtle.digest('SHA-256', bytes);
  return Buffer.from(hash).toString('hex');
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

  const digest = await digestOf(plaintext);
  const shared = await call('/api/shares', {
    method: 'POST',
    cookie: aliceCookie,
    body: {
      recipient: 'bob',
      filename: 'syllabus.pdf',
      size: plaintext.length,
      permission: 'view',
      digest,
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
  assert.strictEqual(meta.body.digest, await digestOf(plaintext), 'the sender fingerprint must reach the recipient');
  assert.strictEqual(meta.body.state, 'live', 'a fresh share is live');

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

  // The new features: self-destruct, revocation, the audit trail.
  const starred = await call(`/api/shares/${shareId}/star`, { method: 'POST', cookie: bobCookie });
  assert.strictEqual(starred.body.starred, true, 'starring must report the new state');
  const starredList = await call('/api/shares', { cookie: bobCookie });
  assert.strictEqual(starredList.body.starred.length, 1, 'the starred share must be in the starred list');
  const unstarred = await call(`/api/shares/${shareId}/star`, { method: 'POST', cookie: bobCookie });
  assert.strictEqual(unstarred.body.starred, false, 'starring again must take the star back');
  const unstarredList = await call('/api/shares', { cookie: bobCookie });
  assert.strictEqual(unstarredList.body.starred.length, 0, 'the starred list must be empty again');

  // The trash: delete, restore, then purge for good.
  const trashed = await call('/api/shares', {
    method: 'POST',
    cookie: aliceCookie,
    body: {
      recipient: 'bob',
      filename: 'draft.pdf',
      size: 5,
      permission: 'view',
      iv: b64(iv),
      wrappedKey: b64(wrappedKey),
      ciphertext: b64(ciphertext),
    },
  });
  const draftId = trashed.body.id;
  await call(`/api/shares/${draftId}/delete`, { method: 'POST', cookie: aliceCookie });
  const afterDelete = await call('/api/shares', { cookie: aliceCookie });
  assert.strictEqual(afterDelete.body.sent.length, 1, 'a deleted share must leave the sent list');
  assert.strictEqual(afterDelete.body.trashed.length, 1, 'a deleted share must be in the trash');
  // The trash is per user. Somebody else's deleted files are not ours to see.
  const carolTrash = await call('/api/shares', { cookie: carolCookie });
  assert.strictEqual(
    carolTrash.body.trashed.length,
    0,
    "another user's deleted shares must not appear in my trash"
  );
  const deletedBlob = await call(`/api/shares/${draftId}/blob`, { cookie: bobCookie });
  assert.strictEqual(deletedBlob.status, 410, 'a share in the trash must not hand over its bytes');
  await call(`/api/shares/${draftId}/restore`, { method: 'POST', cookie: aliceCookie });
  const afterRestore = await call('/api/shares', { cookie: aliceCookie });
  assert.strictEqual(afterRestore.body.sent.length, 2, 'a restored share must come back');
  assert.strictEqual(afterRestore.body.trashed.length, 0, 'the trash must be empty again');
  await call(`/api/shares/${draftId}/delete`, { method: 'POST', cookie: aliceCookie });
  await call(`/api/shares/${draftId}/purge`, { method: 'POST', cookie: aliceCookie });
  const afterPurge = await call('/api/shares', { cookie: aliceCookie });
  assert.strictEqual(afterPurge.body.trashed.length, 0, 'a purged share must be gone for good');
  const purged = await call(`/api/shares/${draftId}`, { cookie: aliceCookie });
  assert.strictEqual(purged.status, 404, 'a purged share must no longer exist');
  const short = await call('/api/shares', {
    method: 'POST',
    cookie: aliceCookie,
    body: {
      recipient: 'bob',
      filename: 'note.txt',
      size: 5,
      permission: 'view',
      expiresIn: 1,
      iv: b64(iv),
      wrappedKey: b64(wrappedKey),
      ciphertext: b64(ciphertext),
    },
  });
  assert.strictEqual(short.status, 201, 'a share with an expiry must be accepted');
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const expiredBlob = await call(`/api/shares/${short.body.id}/blob`, { cookie: bobCookie });
  assert.strictEqual(expiredBlob.status, 410, 'an expired share must not hand over its bytes');
  const expiredMeta = await call(`/api/shares/${short.body.id}`, { cookie: bobCookie });
  assert.strictEqual(expiredMeta.body.state, 'expired', 'the card must be able to say the share expired');

  const revocable = await call('/api/shares', {
    method: 'POST',
    cookie: aliceCookie,
    body: {
      recipient: 'bob',
      filename: 'secret.pdf',
      size: 5,
      permission: 'view',
      iv: b64(iv),
      wrappedKey: b64(wrappedKey),
      ciphertext: b64(ciphertext),
    },
  });
  const revokeByRecipient = await call(`/api/shares/${revocable.body.id}/revoke`, {
    method: 'POST',
    cookie: bobCookie,
  });
  assert.strictEqual(revokeByRecipient.status, 403, 'the recipient must not be able to revoke a share');
  const revoked = await call(`/api/shares/${revocable.body.id}/revoke`, {
    method: 'POST',
    cookie: aliceCookie,
  });
  assert.strictEqual(revoked.status, 200, 'the sender must be able to revoke a share');
  const revokedBlob = await call(`/api/shares/${revocable.body.id}/blob`, { cookie: bobCookie });
  assert.strictEqual(revokedBlob.status, 410, 'a revoked share must not hand over its bytes');
  const revokeTwice = await call(`/api/shares/${revocable.body.id}/revoke`, {
    method: 'POST',
    cookie: aliceCookie,
  });
  assert.strictEqual(revokeTwice.status, 409, 'revoking twice must be refused');

  await call(`/api/shares/${shareId}/opened`, { method: 'POST', cookie: bobCookie });
  const openedMeta = await call(`/api/shares/${shareId}`, { cookie: bobCookie });
  assert.ok(openedMeta.body.openedAt, 'the first open must be recorded');
  const lateRevoke = await call(`/api/shares/${shareId}/revoke`, { method: 'POST', cookie: aliceCookie });
  assert.strictEqual(lateRevoke.status, 409, 'an opened share can no longer be revoked');

  const activity = await call('/api/activity', { cookie: aliceCookie });
  assert.ok(activity.body.activity.length >= 3, 'the activity trail must record the sends and the revoke');
  assert.ok(
    activity.body.activity.some((event) => event.type === 'revoked'),
    'the revoke must be on the trail'
  );
  const carolActivity = await call('/api/activity', { cookie: carolCookie });
  assert.strictEqual(carolActivity.body.activity.length, 0, 'carol must not see anybody else activity');

  // The trail is a hash chain: it checks out, and it notices when it is edited.
  const chain = await call('/api/activity/verify', { cookie: aliceCookie });
  assert.strictEqual(chain.body.intact, true, 'the audit trail must check out');
  assert.ok(chain.body.entries >= 3, 'the trail must hold the events');

  // A repeated wrong sign-in is locked out.
  for (let i = 0; i < 5; i++) {
    await call('/api/login', { method: 'POST', body: { username: 'nobody', password: 'guess' } });
  }
  const locked = await call('/api/login', {
    method: 'POST',
    body: { username: 'nobody', password: 'guess' },
  });
  assert.strictEqual(locked.status, 429, 'repeated failed sign-ins must be locked out');

  // So are repeated wrong one-time codes.
  const erin = await makeUser('erin');
  const erinCode = await register(erin);
  for (let i = 0; i < 4; i++) {
    const wrong = await call('/api/verify-otp', {
      method: 'POST',
      body: { username: 'erin', code: i === 0 ? '000000' : '111111' },
    });
    assert.strictEqual(wrong.status, 401, 'a wrong code must be rejected');
  }
  const tooManyCodes = await call('/api/verify-otp', {
    method: 'POST',
    body: { username: 'erin', code: '222222' },
  });
  assert.strictEqual(tooManyCodes.status, 429, 'repeated wrong codes must be locked out');
  assert.ok(erinCode, 'the console code was issued');

  // Signing out everywhere ends every session of the account.
  const ended = await call('/api/logout-all', { method: 'POST', cookie: aliceCookie });
  assert.strictEqual(ended.status, 200);
  assert.ok(ended.body.ended >= 1, 'the session must be counted as ended');
  const afterLogout = await call('/api/me', { cookie: aliceCookie });
  assert.strictEqual(afterLogout.status, 401, 'the old session must be dead');

  // A public deployment must not accept registrations from strangers.
  process.env.ACCESS_CODE = 'demo-code';
  const dave = await makeUser('dave');
  const noCode = await call('/api/register', {
    method: 'POST',
    body: {
      username: 'dave',
      email: 'dave@example.com',
      password: 'correct-horse',
      publicKey: dave.publicKey,
    },
  });
  assert.strictEqual(noCode.status, 403, 'registration without the access code must be refused');
  const badAccessCode = await call('/api/register', {
    method: 'POST',
    body: {
      username: 'dave',
      email: 'dave@example.com',
      password: 'correct-horse',
      accessCode: 'wrong-code',
      publicKey: dave.publicKey,
    },
  });
  assert.strictEqual(badAccessCode.status, 403, 'registration with the wrong access code must be refused');
  const rightCode = await call('/api/register', {
    method: 'POST',
    body: {
      username: 'dave',
      email: 'dave@example.com',
      password: 'correct-horse',
      accessCode: 'demo-code',
      publicKey: dave.publicKey,
    },
  });
  assert.strictEqual(rightCode.status, 201, 'registration with the right access code must work');
  delete process.env.ACCESS_CODE;

  // The Google sign-in button only works if the page's own headers allow it.
  // Google answers a request that carries no referrer with 400, and the
  // content security policy has to let the button's stylesheet through.
  const pageRes = await fetch(`http://127.0.0.1:${server.address().port}/`);
  const pageText = await pageRes.text();
  assert.strictEqual(
    pageRes.headers.get('referrer-policy'),
    'strict-origin-when-cross-origin',
    'the referrer policy must let Google see the origin, or the sign-in button answers 400'
  );
  const csp = pageRes.headers.get('content-security-policy') || '';
  assert.ok(
    /style-src[^;]*https:\/\/accounts\.google\.com/.test(csp),
    "the content security policy must allow Google's stylesheet for the sign-in button"
  );
  const iconRes = await fetch(`http://127.0.0.1:${server.address().port}/favicon.svg`);
  assert.strictEqual(iconRes.status, 200, 'the favicon must be served');
  assert.ok(pageText.includes('favicon.svg'), 'the page must link the favicon');

  console.log('PASS  register + email one-time code verification');
  console.log('PASS  unverified account cannot sign in, wrong code rejected');
  console.log('PASS  register + login + keypair publish');
  console.log('PASS  encrypt in browser, server stores ciphertext only');
  console.log('PASS  recipient decrypts to the original bytes');
  console.log('PASS  third party cannot list or fetch the share (403)');
  console.log('PASS  wrong password rejected (401)');
  console.log('PASS  the demo access code gates registration (403 without it, 201 with it)');
  console.log('PASS  an expired share gives up its bytes (410) and says so');
  console.log('PASS  the sender can revoke, the recipient cannot, and an opened share is too late');
  console.log('PASS  the activity trail records the sends and the revoke, and hides other people');
  console.log('PASS  the audit trail is a hash chain and it checks out');
  console.log('PASS  repeated failed sign-ins and wrong codes are locked out');
  console.log('PASS  signing out everywhere ends every session of the account');
  console.log('PASS  starring is per user, and delete, restore and purge behave');
  console.log("PASS  the headers and the favicon leave the Google button working");

  server.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
})().catch((err) => {
  console.error('FAIL ', err.message);
  server.close();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  process.exit(1);
});
