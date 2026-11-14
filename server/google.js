'use strict';
// Verification of Google ID tokens.
//
// The browser gets an ID token from Google Identity Services; this module checks
// that the token really came from Google, was made for this application, has not
// expired, and carries an intact signature. Only then is the account allowed in.

const crypto = require('crypto');

const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const JWKS_TTL_MS = 60 * 60 * 1000;

let jwksCache = { keys: null, at: 0 };

function decodeSegment(segment) {
  return Buffer.from(segment, 'base64url').toString('utf8');
}

function audienceMatches(aud, clientId) {
  if (Array.isArray(aud)) return aud.includes(clientId);
  return aud === clientId;
}

async function getSigningKeys() {
  if (jwksCache.keys && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
  const url = process.env.GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
  const res = await fetch(url);
  if (!res.ok) throw new Error('the Google signing keys could not be fetched');
  const body = await res.json();
  jwksCache = { keys: body.keys || [], at: Date.now() };
  return jwksCache.keys;
}

async function verifyGoogleIdToken(idToken, clientId) {
  if (!idToken || typeof idToken !== 'string') throw new Error('missing id token');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('malformed id token');

  let header;
  let payload;
  try {
    header = JSON.parse(decodeSegment(parts[0]));
    payload = JSON.parse(decodeSegment(parts[1]));
  } catch (err) {
    throw new Error('the id token could not be decoded');
  }

  if (header.alg !== 'RS256') throw new Error('unexpected token algorithm');
  if (!ISSUERS.has(payload.iss)) throw new Error('unexpected token issuer');
  if (!clientId || !audienceMatches(payload.aud, clientId)) {
    throw new Error('the token was not issued for this application');
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('the token has expired');
  if (!payload.sub) throw new Error('the token has no subject');

  const keys = await getSigningKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error('no signing key matches this token');

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = Buffer.from(parts[2], 'base64url');
  if (!crypto.verify('RSA-SHA256', signed, publicKey, signature)) {
    throw new Error('the token signature does not verify');
  }

  return payload;
}

module.exports = { verifyGoogleIdToken };
