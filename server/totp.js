'use strict';
// A time-based one-time password, as RFC 6238 describes it and as every
// authenticator app expects: Google Authenticator, Authy, Aegis, all the
// same. The app on the phone holds the shared secret and shows a six digit
// code that changes every thirty seconds; the server holds the same secret
// and recomputes the code to check it.
//
// The scheme has one property that has to be said plainly: the secret is
// shared, so a server that holds it could generate a valid code itself. That
// is true of every authenticator app, and it is the reason the report calls
// this a second factor and not a second key.

const crypto = require('node:crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text) {
  const clean = String(text || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

// The code for one thirty second step, as RFC 6238 computes it.
function codeAt(secret, counter) {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

// The window of one step on either side absorbs a clock that is a little
// fast or a little slow. Every step in the window is compared, so the time
// taken does not say which one matched.
function verify(secret, code, window = 1) {
  const given = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return false;
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  let matched = false;
  for (let drift = -window; drift <= window; drift++) {
    const expected = codeAt(secret, counter + drift);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) matched = true;
  }
  return matched;
}

// Shown in groups of four, the way the setup screens show it.
function group(secret) {
  return String(secret || '')
    .match(/.{1,4}/g)
    .join(' ');
}

// The address an authenticator app reads. Any app that accepts the
// otpauth scheme can be pointed at it.
function uri(secret, username, issuer = 'SecureShare') {
  const label = encodeURIComponent(`${issuer}:${username}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

module.exports = { generateSecret, verify, group, uri, codeAt, STEP_SECONDS };
