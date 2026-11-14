'use strict';
// The audit trail, as a hash chain.
//
// Each entry carries the SHA-256 of the entry before it, so an entry that is
// edited or removed after the fact breaks the chain and the break is found by
// walking it.

const crypto = require('crypto');

const GENESIS = 'genesis';

function material(event, previousHash) {
  return [
    previousHash,
    event.ts,
    event.type,
    event.actor,
    event.shareId || '',
    event.filename || '',
    event.with || '',
  ].join('|');
}

function hashEvent(event, previousHash) {
  return crypto.createHash('sha256').update(material(event, previousHash)).digest('hex');
}

// Appends an entry to the chain and returns it.
function append(trail, event) {
  const previousHash = trail.length ? trail[trail.length - 1].hash : GENESIS;
  const entry = { ...event, prev: previousHash };
  entry.hash = hashEvent(entry, previousHash);
  trail.push(entry);
  return entry;
}

// Walks the chain and reports the first entry that no longer fits.
function verify(trail) {
  let previousHash = GENESIS;
  for (let i = 0; i < trail.length; i++) {
    const event = trail[i];
    if (event.prev !== previousHash || event.hash !== hashEvent(event, previousHash)) {
      return { intact: false, entries: trail.length, brokenAt: i };
    }
    previousHash = event.hash;
  }
  return { intact: true, entries: trail.length, brokenAt: null };
}

module.exports = { append, verify, hashEvent, GENESIS };
