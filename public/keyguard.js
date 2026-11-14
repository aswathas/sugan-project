'use strict';

// The extra keys and the extra protections, in one place.
//
// Everything here is Web Crypto, in the browser, with no dependency:
//   - a signing key per user, so a share carries the sender's signature
//   - a password protected share, so "view only" is a cryptographic rule
//   - a recovery phrase, so a lost device does not mean lost files
//
// The server never sees a private key in the clear. The recovery blob it holds
// is the private key encrypted under a key derived from the phrase.

const KeyGuard = (() => {
  const WORDS = [
    'amber', 'anchor', 'apple', 'arrow', 'atlas', 'badge', 'bamboo', 'basin',
    'beacon', 'birch', 'bishop', 'bloom', 'brave', 'brick', 'brook', 'cable',
    'cactus', 'candle', 'canyon', 'cedar', 'cipher', 'clay', 'cliff', 'cloud',
    'cobalt', 'comet', 'copper', 'coral', 'crane', 'crest', 'dawn', 'delta',
    'drift', 'dune', 'ember', 'falcon', 'fern', 'flint', 'forge', 'frost',
    'garnet', 'glacier', 'granite', 'grove', 'harbor', 'hazel', 'heron', 'indigo',
    'ivory', 'jasper', 'jetty', 'juniper', 'kelp', 'lagoon', 'lantern', 'ledge',
    'lilac', 'lotus', 'lumen', 'maple', 'marble', 'meadow', 'mesa', 'mint',
    'monsoon', 'mosaic', 'nectar', 'nickel', 'nimbus', 'oasis', 'onyx', 'opal',
    'orbit', 'otter', 'pebble', 'pecan', 'pilot', 'pine', 'plume', 'quartz',
    'quiver', 'rapid', 'raven', 'reef', 'ridge', 'river', 'rowan', 'saffron',
    'sage', 'salmon', 'sandbar', 'satin', 'shadow', 'sierra', 'silver', 'solstice',
    'spruce', 'summit', 'tallow', 'tandem', 'thicket', 'timber', 'topaz', 'tulip',
    'tundra', 'umbra', 'valley', 'velvet', 'verdant', 'violet', 'walnut', 'willow',
  ];

  const PBKDF2_ROUNDS = 210000;

  function toB64(bytes) {
    const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    let out = '';
    for (let i = 0; i < arr.length; i += 0x8000) {
      out += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
    }
    return btoa(out);
  }

  function fromB64(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function randomPhrase(count = 12) {
    const bytes = crypto.getRandomValues(new Uint8Array(count));
    return [...bytes].map((byte) => WORDS[byte % WORDS.length]).join(' ');
  }

  // A password derived key. The wrapping of a file key needs AES-KW, the
  // wrapping of the private key needs AES-GCM, and the two are not the same
  // key type.
  async function deriveKey(secret, saltBytes, algorithm = 'AES-GCM') {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, [
      'deriveKey',
    ]);
    const shape =
      algorithm === 'AES-KW'
        ? { name: 'AES-KW', length: 256 }
        : { name: 'AES-GCM', length: 256 };
    const uses = algorithm === 'AES-KW' ? ['wrapKey', 'unwrapKey'] : ['encrypt', 'decrypt'];
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ROUNDS, hash: 'SHA-256' },
      material,
      shape,
      false,
      uses
    );
  }

  /* ---------------- the signing key ---------------- */

  async function generateSigningKey() {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'sign',
      'verify',
    ]);
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
    return { pair, publicKeyB64: toB64(spki) };
  }

  // The signed payload is exactly what the recipient can rebuild from the share
  // metadata, so the signature covers the file, the parties, the fingerprint,
  // the permission the sender chose and the moment the file dies. A server
  // that quietly turns "view only" into "view and download" breaks the
  // signature instead of quietly granting it.
  function sharePayload(share) {
    return [
      share.from,
      share.to,
      share.filename,
      share.size,
      share.digest || '',
      share.iv || '',
      share.permission || '',
      share.expiresAt || '',
    ].join('|');
  }

  async function signShare(payload, privateKey) {
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(payload)
    );
    return toB64(signature);
  }

  async function verifyShare(payload, signatureB64, publicKeyB64) {
    try {
      const key = await crypto.subtle.importKey(
        'spki',
        fromB64(publicKeyB64),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
      return await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        fromB64(signatureB64),
        new TextEncoder().encode(payload)
      );
    } catch (err) {
      return false;
    }
  }

  /* ---------------- a share protected with a password ---------------- */

  // The file key is wrapped with a key derived from the password instead of the
  // recipient's public key, so without the password the file cannot be opened.
  async function wrapWithPassword(rawFileKey, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const wrappingKey = await deriveKey(password, salt, 'AES-KW');
    const wrapped = await crypto.subtle.wrapKey('raw', rawFileKey, wrappingKey, 'AES-KW');
    return { wrappedKey: toB64(wrapped), salt: toB64(salt) };
  }

  async function unwrapWithPassword(wrappedKeyB64, saltB64, password) {
    const wrappingKey = await deriveKey(password, fromB64(saltB64), 'AES-KW');
    return crypto.subtle.unwrapKey(
      'raw',
      fromB64(wrappedKeyB64),
      wrappingKey,
      'AES-KW',
      { name: 'AES-GCM' },
      true,
      ['decrypt']
    );
  }

  /* ---------------- the recovery phrase ---------------- */

  // The private key is exported, encrypted under a key derived from the phrase,
  // and only the encrypted form is kept or sent. The device keeps a
  // non-extractable copy for daily use.
  async function wrapPrivateKey(privateKey, phrase) {
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrappingKey = await deriveKey(phrase, salt);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      wrappingKey,
      pkcs8
    );
    return { salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(ciphertext) };
  }

  async function unwrapPrivateKey(blob, phrase) {
    const wrappingKey = await deriveKey(phrase, fromB64(blob.salt));
    const pkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(blob.iv) },
      wrappingKey,
      fromB64(blob.ciphertext)
    );
    return crypto.subtle.importKey(
      'pkcs8',
      pkcs8,
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      false,
      ['decrypt']
    );
  }

  return {
    WORDS,
    toB64,
    fromB64,
    randomPhrase,
    deriveKey,
    generateSigningKey,
    sharePayload,
    signShare,
    verifyShare,
    wrapWithPassword,
    unwrapWithPassword,
    wrapPrivateKey,
    unwrapPrivateKey,
  };
})();
