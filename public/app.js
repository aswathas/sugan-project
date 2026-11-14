'use strict';

const $ = (id) => document.getElementById(id);

const THEME_KEY = 'secureshare-theme';
const LAYOUT_KEY = 'secureshare-layout';
const OPENED_KEY = 'secureshare-opened';

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in restricted contexts.
  }
}

function applyTheme(theme, persist = true) {
  const dark = theme === 'dark';
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  if (persist) writeStored(THEME_KEY, dark ? 'dark' : 'paper');
  const btn = $('theme-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', String(dark));
    btn.textContent = dark ? 'Paper theme' : 'Dark theme';
    btn.setAttribute('aria-label', dark ? 'Switch to paper theme' : 'Switch to dark theme');
  }
}

// Apply the remembered theme immediately in <head> before the page paints.
if (readStored(THEME_KEY) === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

const RSA = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;

let me = null;
let myKeys = null;
let users = [];
let pendingUser = null;
let permission = 'view';
let expiry = 0;
let lastEvidence = null;
let view = 'inbox';
let query = '';
let filterBy = 'all';
let sortBy = 'newest';
let layout = readStored(LAYOUT_KEY) === 'list' ? 'list' : 'grid';
let shares = { inbox: [], sent: [], starred: [], trashed: [] };
let visibleFiles = [];
let activeCardId = null;
let draggedShareId = null;
let previewShareId = null;
// Set while a sign-in waits for the second factor.
let pendingChallenge = null;
// The trail as the server last returned it, so a receipt can quote the
// events for one file.
let activityEvents = [];
let previewLastFocus = null;
let shortcutsLastFocus = null;
let cardMenuLastFocus = null;
const selectedIds = new Set();
const sentFilesCache = new Map();
// The integrity result of each file this browser has decrypted, so the card can
// show that the bytes that arrived are the bytes that were sent.
const integrity = new Map();

/* ---------------- base64 ---------------- */

function toB64(bytes) {
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let out = '';
  for (let i = 0; i < arr.length; i += 0x8000) {
    out += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
  }
  return btoa(out);
}

// Two byte strings, compared in full and in constant time. A file key that
// came back from two different wraps has to be exactly the same key.
function sameBytes(a, b) {
  const left = a instanceof ArrayBuffer ? new Uint8Array(a) : new Uint8Array(a.buffer || a);
  const right = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer || b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

function fromB64(b64) {
  if (typeof b64 !== 'string' || !b64) throw new Error('missing encoded value');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/* ---------------- key storage (IndexedDB) ---------------- */

const IDB_NAME = 'secure-share';
const IDB_STORE = 'keys';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------------- crypto ---------------- */

async function generateKeyPair(extractable = false) {
  // extractable=false keeps the private key non-extractable: it can be stored and
  // used, but never exported out of this browser. Registration needs one
  // exportable copy so the recovery phrase can wrap it.
  const pair = await crypto.subtle.generateKey(RSA, extractable, ['encrypt', 'decrypt']);
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  return { pair, publicKeyB64: toB64(spki) };
}

// The key the device keeps for daily work: non-extractable, so it can never be
// read out of the browser even by a script on the page.
async function nonExtractableCopy(pair) {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, RSA, false, ['decrypt']);
  return privateKey;
}

async function fingerprint(publicKeyB64) {
  if (typeof publicKeyB64 !== 'string' || !publicKeyB64) return 'none';
  const digest = await crypto.subtle.digest('SHA-256', fromB64(publicKeyB64));
  return toB64(digest).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase();
}

/* ---------------- api ---------------- */

async function api(path, options = {}) {
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// fetch cannot report upload progress, so the one call that sends a file body
// goes over XMLHttpRequest instead.
function apiUpload(path, body, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || xhr.statusText));
    };
    xhr.onerror = () => reject(new Error('the upload did not reach the server'));
    xhr.send(JSON.stringify(body));
  });
}

/* ---------------- auth ---------------- */

function showApp() {
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('session').classList.remove('hidden');
  $('search-wrap').classList.remove('hidden');
  $('who').textContent = me;
}

async function signIn(username, password) {
  const session = await api('/api/login', { method: 'POST', body: { username, password } });
  if (session.requiresTotp) {
    // The password was right, but the account has a second factor. The
    // session waits for the code.
    pendingChallenge = session.challenge;
    $('login-totp-field').classList.remove('hidden');
    $('login-totp-code').value = '';
    $('login-totp-code').focus();
    return;
  }
  await completeSignIn(session.username);
}

async function completeSignIn(username) {
  pendingChallenge = null;
  $('login-totp-field').classList.add('hidden');
  me = username;
  myKeys = (await idbGet(me)) || null;
  await recoverKeyIfAsked(username);
  showApp();
  await refresh();
  await uploadBackup();
  if (!myKeys) {
    setMainStatus(
      'No key pair on this device for this account, so files sent to you cannot be decrypted here.',
      'error'
    );
  }
}

/* ---------------- the second factor ---------------- */

// An authenticator app: Google Authenticator or any other that speaks the
// same scheme. The secret is shown once and kept on the phone.
function isTotpOpen() {
  const panel = $('totp-panel');
  return Boolean(panel && !panel.classList.contains('hidden'));
}

async function openTotpPanel() {
  try {
    const state = await api('/api/totp');
    $('totp-panel').classList.remove('hidden');
    $('totp-code').value = '';
    if (state.enabled) {
      $('totp-setup').classList.add('hidden');
      $('totp-state').textContent =
        'This account needs a six digit code from your authenticator app as well as the password.';
      $('totp-confirm').classList.add('hidden');
      $('totp-disable').classList.remove('hidden');
    } else {
      $('totp-setup').classList.remove('hidden');
      $('totp-state').textContent =
        'Turn on a second factor and this account will need the authenticator app and the password to sign in.';
      $('totp-confirm').classList.remove('hidden');
      $('totp-disable').classList.add('hidden');
      const setup = await api('/api/totp/enroll', { method: 'POST' });
      $('totp-secret').textContent = setup.secret;
      $('totp-uri').textContent = setup.uri;
    }
    $('totp-close').focus();
  } catch (err) {
    setMainStatus(err.message, 'error');
  }
}

function closeTotpPanel() {
  if (!isTotpOpen()) return;
  $('totp-panel').classList.add('hidden');
  $('totp-code').value = '';
}

async function confirmTotp() {
  try {
    await api('/api/totp/confirm', { method: 'POST', body: { code: $('totp-code').value.trim() } });
    toast('The second factor is on. The next sign-in asks for a code.');
    closeTotpPanel();
  } catch (err) {
    $('totp-state').textContent = err.message;
  }
}

async function disableTotp() {
  try {
    await api('/api/totp/disable', { method: 'POST', body: { code: $('totp-code').value.trim() } });
    toast('The second factor is off.');
    closeTotpPanel();
  } catch (err) {
    $('totp-state').textContent = err.message;
  }
}

// The recovery phrase restores the private key on a new device. The password
// opens the session; the phrase opens the key. The phrase never goes to the
// server.
async function recoverKeyIfAsked(username) {
  const phrase = $('recovery-phrase').value.trim();
  if (!phrase) return;
  try {
    const blob = await api('/api/keys/recover', { method: 'POST', body: { username } });
    const privateKey = await KeyGuard.unwrapPrivateKey(blob, phrase);
    const existing = (await idbGet(username)) || {};
    await idbPut(username, { ...existing, privateKey, phrase });
    myKeys = await idbGet(username);
    setMainStatus('The recovery phrase worked. Your private key is back on this device.', 'ok');
  } catch (err) {
    setMainStatus(`That phrase did not unlock the key: ${err.message}`, 'error');
  }
}

// The wrapped private key goes to the server so a lost device can be rescued.
// The server holds it encrypted and cannot read it. If the upload fails the
// user must know, because this blob is the only way a new device can be
// rescued, and the phrase is still shown either way.
async function uploadBackup() {
  if (!myKeys || !myKeys.backup) return;
  try {
    await api('/api/keys/backup', { method: 'POST', body: myKeys.backup });
    showPhrase(myKeys.phrase);
  } catch (err) {
    showPhrase(myKeys.phrase);
    setMainStatus(
      `Your recovery key could not be saved on the server: ${err.message}. Keep the phrase below somewhere safe; without it a new device cannot open your files.`,
      'error'
    );
  }
}

function showPhrase(phrase) {
  if (!phrase) return;
  $('phrase-panel').classList.remove('hidden');
  $('phrase-words').textContent = phrase;
}

function setTab(which) {
  const login = which === 'login';
  $('tab-login').setAttribute('aria-pressed', String(login));
  $('tab-register').setAttribute('aria-pressed', String(!login));
  $('login-form').classList.toggle('hidden', !login);
  $('register-form').classList.toggle('hidden', login);
}

/* ---------------- google sign-in ---------------- */

async function initGoogleSignIn() {
  let config;
  try {
    config = await api('/api/config');
  } catch (err) {
    return;
  }
  if (config.requireAccessCode) {
    $('register-access').classList.remove('hidden');
  }
  if (!config.googleClientId) return;

  // Google refuses an origin it was not given, with an error the user cannot
  // act on. So the button only appears where it can work.
  const origins = config.authorizedOrigins || [];
  if (origins.length && !origins.includes(window.location.origin)) {
    $('google-note').textContent =
      `Google sign-in is set up for ${origins.join(' and ')}. Open the site there to use it.`;
    return;
  }

  $('google-block').classList.remove('hidden');
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: onGoogleCredential,
      ux_mode: 'popup',
    });
    window.google.accounts.id.renderButton($('google-button'), {
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      width: 320,
    });
  };
  script.onerror = () => {
    $('google-note').textContent = 'Google sign-in needs internet. The email code works offline.';
  };
  document.head.appendChild(script);
}

async function onGoogleCredential(response) {
  try {
    // A Google account gets the same three keys as a password account: the
    // file key pair, the signing key and the recovery phrase. Without the
    // phrase a Google user could never open a file on a second device.
    const { pair, publicKeyB64 } = await generateKeyPair(true);
    const signing = await KeyGuard.generateSigningKey();
    const phrase = KeyGuard.randomPhrase(12);
    const backup = await KeyGuard.wrapPrivateKey(pair.privateKey, phrase);
    const result = await api('/api/google-signin', {
      method: 'POST',
      body: {
        idToken: response.credential,
        publicKey: publicKeyB64,
        signingKey: signing.publicKeyB64,
      },
    });
    me = result.username;
    if (result.keyProvided) {
      await idbPut(me, {
        privateKey: await nonExtractableCopy(pair),
        publicKey: pair.publicKey,
        publicKeyB64,
        signingPrivateKey: signing.pair.privateKey,
        signingPublicKeyB64: signing.publicKeyB64,
        phrase,
        backup,
      });
    }
    myKeys = (await idbGet(me)) || null;
    showApp();
    await refresh();
    if (!myKeys) {
      setMainStatus(
        'This account was first used on another device, so this device holds no private key for it. Files sent to you cannot be decrypted here.',
        'error'
      );
    } else {
      await uploadBackup();
    }
  } catch (err) {
    $('auth-error').textContent = err.message;
  }
}

/* ---------------- the dashboard ---------------- */

const VIEWS = {
  inbox: { title: 'Shared with me', files: () => shares.inbox || [], direction: () => 'from' },
  sent: { title: 'Sent by me', files: () => shares.sent || [], direction: () => 'to' },
  starred: {
    title: 'Starred',
    files: () => shares.starred || [],
    direction: (file) => (file.from === me ? 'to' : 'from'),
  },
  recent: {
    title: 'Recent',
    files: () => [...(shares.inbox || []), ...(shares.sent || [])],
    direction: (file) => (file.from === me ? 'to' : 'from'),
  },
  trashed: {
    title: 'Trashed',
    files: () => (shares.trashed || []).filter((file) => file.from === me || file.to === me),
    direction: (file) => (file.from === me ? 'to' : 'from'),
  },
};

function setMainStatus(message, kind) {
  const status = $('main-status');
  status.textContent = message || '';
  status.className = `status main__status${kind ? ` status--${kind}` : ''}`;
}

function toast(message, options = {}) {
  const container = $('toasts');
  if (!container) return;

  const plate = document.createElement('div');
  plate.className = 'toast';
  plate.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.className = 'toast__message';
  text.textContent = message;
  plate.appendChild(text);

  let timer = null;
  const dismiss = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (plate.parentNode) plate.remove();
  };

  if (options && options.action && typeof options.onAction === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast__action';
    btn.textContent = options.action;
    btn.setAttribute('aria-label', `${options.action}: ${message}`);
    btn.addEventListener('click', () => {
      dismiss();
      options.onAction();
    });
    plate.appendChild(btn);
  }

  container.appendChild(plate);
  timer = setTimeout(dismiss, 4000);
}

function setFilter(next) {
  filterBy = next || 'all';
  for (const chip of document.querySelectorAll('#filter-chips .filter-chip')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.filter === filterBy));
  }
}

function matchesFilter(file, activeFilter, opened) {
  if (activeFilter === 'unread') {
    return file.state !== 'trashed' && !file.openedAt && !opened.has(file.id);
  }
  if (activeFilter === 'starred') {
    return Boolean(file.starred);
  }
  if (activeFilter === 'expiring') {
    if (!file.expiresAt) return false;
    const left = file.expiresAt - Date.now();
    return left > 0 && left <= 24 * 60 * 60 * 1000;
  }
  if (activeFilter === 'view') {
    return file.permission === 'view';
  }
  return true;
}

function createTypeChip(filename) {
  const ext = fileExtension(filename);
  const raw = ext === 'other' ? 'other' : ext.slice(1);
  const upper = raw.toUpperCase();
  const label = upper.slice(0, 3);

  let variant = 'file-chip--other';
  if (ext === '.pdf') {
    variant = 'file-chip--pdf';
  } else if (ext === '.txt' || ext === '.md' || ext === '.csv') {
    variant = 'file-chip--doc';
  } else if (ext === '.jpg' || ext === '.png' || ext === '.gif') {
    variant = 'file-chip--img';
  }

  const chip = document.createElement('span');
  chip.className = `file-chip ${variant}`;
  chip.textContent = label;
  chip.setAttribute('aria-hidden', 'true');
  return chip;
}

function renderSkeletonCards() {
  const container = $('cards');
  if (!container || view === 'new') return;
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const row = document.createElement('div');
    row.className = 'card-skeleton';
    row.setAttribute('aria-hidden', 'true');

    const title = document.createElement('div');
    title.className = 'skeleton-line skeleton-line--title';
    const meta = document.createElement('div');
    meta.className = 'skeleton-line skeleton-line--meta';
    const badges = document.createElement('div');
    badges.className = 'skeleton-badges';
    const b1 = document.createElement('span');
    b1.className = 'skeleton-badge';
    const b2 = document.createElement('span');
    b2.className = 'skeleton-badge';
    badges.append(b1, b2);
    const foot = document.createElement('div');
    foot.className = 'skeleton-line skeleton-line--foot';

    row.append(title, meta, badges, foot);
    container.appendChild(row);
  }
}

function applyLayout(next) {
  layout = next === 'list' ? 'list' : 'grid';
  writeStored(LAYOUT_KEY, layout);
  const cards = $('cards');
  if (cards) cards.classList.toggle('cards--list', layout === 'list');
  if ($('layout-grid')) $('layout-grid').setAttribute('aria-pressed', String(layout === 'grid'));
  if ($('layout-list')) $('layout-list').setAttribute('aria-pressed', String(layout === 'list'));
}

function sortFiles(list) {
  const copy = [...list];
  if (sortBy === 'name') {
    copy.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' }) || b.createdAt - a.createdAt);
  } else if (sortBy === 'oldest') {
    copy.sort((a, b) => a.createdAt - b.createdAt);
  } else if (sortBy === 'size') {
    copy.sort((a, b) => (b.size || 0) - (a.size || 0) || b.createdAt - a.createdAt);
  } else {
    copy.sort((a, b) => b.createdAt - a.createdAt);
  }
  return copy;
}

function fileExtension(filename) {
  const base = String(filename || '').trim();
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return 'other';
  return `.${base.slice(dot + 1).toLowerCase()}`;
}

function renderStorage() {
  const seen = new Map();
  for (const list of [shares.inbox || [], shares.sent || [], shares.starred || [], shares.trashed || []]) {
    for (const share of list) {
      if (share.from !== me && share.to !== me) continue;
      if (!seen.has(share.id)) seen.set(share.id, share);
    }
  }
  const all = [...seen.values()];
  // The server reports the bytes it really stored, so this panel counts
  // ciphertext and not the size of the file that went in.
  const storedOf = (share) => share.storedSize || share.size || 0;
  const totalBytes = all.reduce((sum, share) => sum + storedOf(share), 0);
  $('stat-stored').textContent = formatSize(totalBytes);

  const breakdown = $('storage-breakdown');
  breakdown.innerHTML = '';
  if (!totalBytes) {
    const empty = document.createElement('li');
    empty.className = 'storage__empty';
    empty.textContent = 'No ciphertext stored yet.';
    breakdown.appendChild(empty);
    return;
  }

  const byExt = new Map();
  for (const share of all) {
    const ext = fileExtension(share.filename);
    byExt.set(ext, (byExt.get(ext) || 0) + storedOf(share));
  }
  const top = [...byExt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  for (const [ext, bytes] of top) {
    const pct = totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0;
    const pctLabel = bytes > 0 && pct === 0 ? '<1%' : `${pct}%`;

    const row = document.createElement('li');
    row.className = 'storage__row';

    const head = document.createElement('div');
    head.className = 'storage__row-head';
    const extEl = document.createElement('span');
    extEl.className = 'storage__ext';
    extEl.textContent = ext;
    const valEl = document.createElement('span');
    valEl.className = 'storage__val';
    valEl.textContent = `${formatSize(bytes)} (${pctLabel})`;
    head.append(extEl, valEl);

    const track = document.createElement('div');
    track.className = 'storage__track';
    const fill = document.createElement('div');
    fill.className = 'storage__fill';
    fill.style.width = `${Math.max(2, pct)}%`;
    track.appendChild(fill);

    row.append(head, track);
    breakdown.appendChild(row);
  }
}

function renderPeople() {
  const list = $('rail-people');
  list.innerHTML = '';
  const others = users.filter((u) => u.username !== me);
  if (!others.length) {
    const empty = document.createElement('li');
    empty.className = 'rail__people-empty';
    empty.textContent = 'No other accounts yet.';
    list.appendChild(empty);
    return;
  }
  for (const user of others) {
    const item = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rail__person';
    btn.dataset.username = user.username;
    btn.setAttribute('aria-label', `Share a file with ${user.username}`);

    const name = document.createElement('span');
    name.textContent = user.username;
    const hint = document.createElement('span');
    hint.className = 'rail__person-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'drop';
    btn.append(name, hint);

    btn.addEventListener('click', async () => {
      await openNewShareFor(user.username);
    });
    btn.addEventListener('dragenter', (event) => {
      event.preventDefault();
      btn.classList.add('rail__person--over');
    });
    btn.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      btn.classList.add('rail__person--over');
    });
    btn.addEventListener('dragleave', (event) => {
      if (!btn.contains(event.relatedTarget)) {
        btn.classList.remove('rail__person--over');
      }
    });
    btn.addEventListener('drop', async (event) => {
      event.preventDefault();
      btn.classList.remove('rail__person--over');
      const shareId = (event.dataTransfer && event.dataTransfer.getData('text/plain')) || draggedShareId;
      if (shareId) await startShareFromCard(shareId, user.username);
    });

    item.appendChild(btn);
    list.appendChild(item);
  }
}

function findShareById(id) {
  for (const list of [shares.inbox || [], shares.sent || [], shares.starred || [], shares.trashed || []]) {
    const found = list.find((s) => s.id === id);
    if (found) return found;
  }
  return null;
}

async function openNewShareFor(recipientUsername) {
  view = 'new';
  setFilter('all');
  closeCardMenu();
  selectedIds.clear();
  activeCardId = null;
  render();
  if (recipientUsername) {
    $('recipient').value = recipientUsername;
    await showRecipientKey();
  }
  $('file').focus();
}

async function startShareFromCard(shareId, recipientUsername) {
  const share = findShareById(shareId);
  await openNewShareFor(recipientUsername);
  const status = $('share-status');
  status.textContent = '';
  status.className = 'status';

  if (sentFilesCache.has(shareId)) {
    const cached = sentFilesCache.get(shareId);
    const transfer = new DataTransfer();
    transfer.items.add(cached);
    $('file').files = transfer.files;
    describeFile(cached);
    status.className = 'status status--ok';
    status.textContent = `Ready to encrypt "${cached.name}" for ${recipientUsername}.`;
    return;
  }

  if (share && share.to === me && share.state === 'live' && myKeys) {
    $('file-note').textContent = `Decrypting "${share.filename}" in this browser...`;
    try {
      const { plaintext, meta } = await decryptShareBytes(share.id);
      const file = new File([plaintext], meta.filename);
      const transfer = new DataTransfer();
      transfer.items.add(file);
      $('file').files = transfer.files;
      describeFile(file);
      status.className = 'status status--ok';
      status.textContent = `Ready to encrypt "${meta.filename}" for ${recipientUsername}.`;
      return;
    } catch (err) {
      describeFile(null);
      status.className = 'status status--error';
      status.textContent = `Could not prefill "${share.filename}": ${err.message}`;
      return;
    }
  }

  $('file').value = '';
  describeFile(null);
  if (share) {
    $('file-note').textContent = `Recipient set to ${recipientUsername}. Choose "${share.filename}" from your device to encrypt it for them.`;
    status.className = 'status status--ok';
    status.textContent = `Recipient filled in as ${recipientUsername}. End-to-end encrypted files sent to others cannot be re-encrypted without the original file.`;
  }
}

async function refresh() {
  let list;
  try {
    list = await api('/api/users');
  } catch (err) {
    setMainStatus(`Could not load the workspace: ${err.message}`, 'error');
    renderLoadFailure('The people list could not be loaded.');
    return;
  }
  users = list.users;

  const select = $('recipient');
  const previousRecipient = select.value;
  select.innerHTML = '';
  for (const user of users) {
    if (user.username === me) continue;
    const option = document.createElement('option');
    option.value = user.username;
    option.textContent = user.username;
    select.appendChild(option);
  }
  if (previousRecipient && users.some((u) => u.username === previousRecipient && u.username !== me)) {
    select.value = previousRecipient;
  }
  await showRecipientKey();
  renderPeople();

  renderSkeletonCards();
  try {
    shares = await api('/api/shares');
  } catch (err) {
    setMainStatus(`Could not load your files: ${err.message}`, 'error');
    renderLoadFailure('Your files could not be loaded.');
    return;
  } finally {
    if ($('cards')) $('cards').removeAttribute('aria-busy');
  }
  await renderActivity();
  render();
  // The watcher starts once there is something to watch, so the first poll
  // cannot mistake the files already on screen for new arrivals.
  startWatching();
}

// A failed load must not leave the skeleton placeholders on the screen with
// nothing to say why. The reader gets a plain sentence and a way to try
// again.
function renderLoadFailure(message) {
  const container = $('cards');
  if (!container) return;
  container.removeAttribute('aria-busy');
  container.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'cards__empty';

  const line = document.createElement('p');
  line.textContent = message;
  empty.appendChild(line);

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'btn btn--primary btn--small';
  again.textContent = 'Try again';
  again.addEventListener('click', () => refresh());
  empty.appendChild(again);

  container.appendChild(empty);
}

async function renderActivity() {
  const list = $('activity');
  list.innerHTML = '';
  let events = [];
  try {
    events = (await api('/api/activity')).activity;
  } catch (err) {
    $('trail-state').textContent = 'The activity feed could not be loaded.';
    return;
  }
  activityEvents = events;
  try {
    const chain = await api('/api/activity/verify');
    $('trail-state').textContent = chain.intact
      ? `The trail is tamper-evident: ${chain.entries} entries, each one carrying the hash of the one before it, and the chain still checks out.`
      : `The trail does not check out: entry ${chain.brokenAt + 1} has been altered.`;
  } catch (err) {
    $('trail-state').textContent = 'The trail could not be checked.';
  }
  if (!events.length) {
    const empty = document.createElement('li');
    empty.className = 'activity__empty';
    empty.textContent = 'Nothing has happened yet.';
    list.appendChild(empty);
    return;
  }
  const verbs = {
    sent: 'sent',
    opened: 'opened',
    revoked: 'revoked',
    deleted: 'deleted',
    restored: 'restored',
    purged: 'purged',
    registered: 'registered',
  };
  for (const event of events.slice(0, 12)) {
    const item = document.createElement('li');
    item.className = 'activity__item';
    const what = document.createElement('span');
    what.className = 'activity__what';
    const who = document.createElement('span');
    who.className = 'activity__who';
    const when = document.createElement('span');
    when.className = 'activity__when';

    what.textContent = `${verbs[event.type] || event.type} ${event.filename || ''}`.trim();
    who.textContent = event.type === 'sent' ? `${event.actor} to ${event.with}` : `${event.actor}`;
    when.textContent = new Date(event.ts).toLocaleString();
    item.append(what, who, when);
    list.appendChild(item);
  }
}

function renderBulkBar(files) {
  const bar = $('bulk-bar');
  if (view === 'new') {
    bar.classList.add('hidden');
    return;
  }
  const visibleIds = new Set(files.map((file) => file.id));
  for (const id of [...selectedIds]) {
    if (!visibleIds.has(id)) selectedIds.delete(id);
  }
  const selectedShares = files.filter((file) => selectedIds.has(file.id));
  if (!selectedShares.length) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  $('bulk-count').textContent = `${selectedShares.length} selected`;

  const canStar = selectedShares.some((s) => s.state !== 'trashed' && s.state !== 'revoked');
  const canRevoke = selectedShares.some((s) => s.from === me && s.state === 'live' && !s.openedAt);
  const canDelete = selectedShares.some((s) => s.state !== 'trashed');

  $('bulk-star').disabled = !canStar;
  $('bulk-revoke').disabled = !canRevoke;
  $('bulk-delete').disabled = !canDelete;
}

function render() {
  const opened = openedShares();
  const inbox = shares.inbox || [];
  const sent = shares.sent || [];
  const starred = shares.starred || [];
  const trashed = (shares.trashed || []).filter((file) => file.from === me || file.to === me);

  $('count-inbox').textContent = String(inbox.length);
  $('count-sent').textContent = String(sent.length);
  $('count-starred').textContent = String(starred.length);
  $('count-recent').textContent = String(inbox.length + sent.length);
  $('count-trashed').textContent = String(trashed.length);
  renderStorage();

  if (myKeys && myKeys.publicKeyB64) {
    fingerprint(myKeys.publicKeyB64).then((print) => {
      $('stat-key').textContent = print;
    });
  }

  for (const item of document.querySelectorAll('.rail__item')) {
    item.setAttribute('aria-pressed', String(item.dataset.view === view));
  }

  const isNew = view === 'new';
  $('new-form').classList.toggle('hidden', !isNew);
  $('cards').classList.toggle('hidden', isNew);
  $('view-tools').classList.toggle('hidden', isNew);
  applyLayout(layout);

  if (isNew) {
    $('bulk-bar').classList.add('hidden');
    $('view-title').textContent = 'New share';
    $('view-meta').textContent = 'Encrypt a file for one person';
    visibleFiles = [];
    return;
  }

  const current = VIEWS[view] || VIEWS.inbox;
  $('view-title').textContent = current.title;
  const filtered = current.files().filter(
    (file) => (!query || file.filename.toLowerCase().includes(query)) && matchesFilter(file, filterBy, opened)
  );
  const files = sortFiles(filtered);
  visibleFiles = files;

  const unread = files.filter(
    (file) => file.state !== 'trashed' && current.direction(file) === 'from' && !opened.has(file.id)
  ).length;
  $('view-meta').textContent =
    `${files.length} file${files.length === 1 ? '' : 's'}` + (unread ? `, ${unread} unopened` : '');
  renderBulkBar(files);
  renderCards(files, current.direction);
}

function expiryLabel(share) {
  if (!share.expiresAt) return null;
  const left = share.expiresAt - Date.now();
  if (left <= 0) return 'expired';
  const hours = left / 3600000;
  if (hours < 1) return `expires in ${Math.max(1, Math.round(left / 60000))} min`;
  if (hours < 48) return `expires in ${Math.round(hours)} h`;
  return `expires in ${Math.round(hours / 24)} days`;
}

/* ---------------- the workspace watches itself ---------------- */

// A file that arrives while the page is open is announced, and a file that
// expires says so without waiting for a click. The clock decides expiry, so
// that part is worked out here rather than asked of the server.
const WATCH_INTERVAL_MS = 20000;
let watchTimer = null;
let knownShareIds = new Set();

function everyShare() {
  return [...(shares.inbox || []), ...(shares.sent || []), ...(shares.starred || [])];
}

function startWatching() {
  if (watchTimer) return;
  knownShareIds = new Set(everyShare().map((share) => share.id));
  watchTimer = setInterval(watch, WATCH_INTERVAL_MS);
}

async function watch() {
  if (document.hidden || !$('cards')) return;

  let expired = false;
  for (const share of everyShare()) {
    if (share.state === 'live' && share.expiresAt && share.expiresAt <= Date.now()) {
      share.state = 'expired';
      expired = true;
    }
  }
  if (expired) render();

  let list;
  try {
    list = await api('/api/shares');
  } catch (err) {
    return;
  }
  const inbox = list.inbox || [];
  const sent = list.sent || [];
  const arrived = inbox.filter((share) => !knownShareIds.has(share.id));
  for (const share of [...inbox, ...sent]) knownShareIds.add(share.id);
  if (!arrived.length) return;

  const names = arrived.map((share) => share.filename).join(', ');
  toast(
    arrived.length === 1 ? `${arrived[0].filename} was shared with you.` : `${arrived.length} files were shared with you: ${names}`,
    {
      action: 'Open',
      onAction: () => {
        setView('inbox');
        openShare(arrived[0].id);
      },
    }
  );
  await refresh();
}

// A way to force the watcher to run now. The test uses it, and so can anyone
// who wants to see the arrival check without waiting for the timer.
window.__watch = watch;

function emptyMessageFor(currentView) {
  if (query || filterBy !== 'all') return 'No file matches that search';
  if (currentView === 'sent') return 'You have not sent anything yet.';
  if (currentView === 'starred') return 'No starred files yet.';
  if (currentView === 'trashed') return 'Nothing to restore';
  if (currentView === 'recent') return 'No recent files yet.';
  return 'Nothing has been shared with you yet.';
}

function createStarIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  path.setAttribute('points', '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2');
  svg.appendChild(path);
  return svg;
}

function renderCards(files, direction) {
  const container = $('cards');
  container.removeAttribute('aria-busy');
  container.innerHTML = '';
  if (!files.length) {
    activeCardId = null;
    const empty = document.createElement('div');
    empty.className = 'cards__empty';

    const message = document.createElement('p');
    message.textContent = emptyMessageFor(view);
    empty.appendChild(message);

    if (query || filterBy !== 'all') {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'btn btn--small';
      clearBtn.textContent = 'Clear the search';
      clearBtn.addEventListener('click', () => {
        query = '';
        if ($('search')) $('search').value = '';
        setFilter('all');
        render();
      });
      empty.appendChild(clearBtn);
    } else if (view !== 'trashed') {
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'btn btn--primary btn--small';
      shareBtn.textContent = 'Share a file';
      shareBtn.addEventListener('click', () => openNewShareFor(null));
      empty.appendChild(shareBtn);
    }

    container.appendChild(empty);
    return;
  }

  if (activeCardId && !files.some((file) => file.id === activeCardId)) {
    activeCardId = null;
  }

  const opened = openedShares();
  for (const file of files) {
    const directionKey = direction(file);
    const isTrashed = file.state === 'trashed';
    const unread = !isTrashed && directionKey === 'from' && !opened.has(file.id);
    const isSelected = selectedIds.has(file.id);
    const isActive = activeCardId === file.id;

    const card = document.createElement('article');
    card.className =
      'card-file' +
      (unread ? ' card-file--unread' : '') +
      (isSelected ? ' card-file--selected' : '') +
      (isActive ? ' card-file--active' : '');
    card.dataset.shareId = file.id;
    card.tabIndex = -1;

    if (!isTrashed) {
      card.draggable = true;
      card.title = 'Drag onto a person in the rail to share';
      card.addEventListener('dragstart', (event) => {
        draggedShareId = file.id;
        card.classList.add('card-file--dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('text/plain', file.id);
        }
      });
      card.addEventListener('dragend', () => {
        draggedShareId = null;
        card.classList.remove('card-file--dragging');
        for (const el of document.querySelectorAll('.rail__person--over')) {
          el.classList.remove('rail__person--over');
        }
      });
    }

    const top = document.createElement('div');
    top.className = 'card-file__top';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'card-file__check';
    check.checked = isSelected;
    check.setAttribute('aria-label', `Select ${file.filename}`);
    check.addEventListener('change', () => {
      if (check.checked) selectedIds.add(file.id);
      else selectedIds.delete(file.id);
      card.classList.toggle('card-file--selected', check.checked);
      renderBulkBar(visibleFiles);
    });
    top.appendChild(check);

    if (!isTrashed) {
      const grip = document.createElement('span');
      grip.className = 'card-file__grip';
      grip.setAttribute('aria-hidden', 'true');
      grip.textContent = '::';
      top.appendChild(grip);
    }

    if (unread) {
      const live = document.createElement('span');
      live.className = 'live';
      live.setAttribute('aria-hidden', 'true');
      top.appendChild(live);
    }

    top.appendChild(createTypeChip(file.filename));

    const name = document.createElement('button');
    name.type = 'button';
    name.className = 'card-file__name';
    name.textContent = file.filename;
    name.setAttribute('aria-label', `Preview ${file.filename}`);
    name.addEventListener('click', () => openPreview(file));
    top.appendChild(name);

    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    starBtn.className = 'card-file__star';
    const starred = Boolean(file.starred);
    starBtn.setAttribute('aria-pressed', String(starred));
    starBtn.setAttribute('aria-label', starred ? `Unstar ${file.filename}` : `Star ${file.filename}`);
    starBtn.title = starred ? 'Remove star' : 'Star file';
    starBtn.disabled = file.state === 'trashed' || file.state === 'revoked';
    starBtn.appendChild(createStarIcon());
    starBtn.addEventListener('click', () => toggleStar(file.id));
    top.appendChild(starBtn);

    const meta = document.createElement('div');
    meta.className = 'card-file__meta';
    const who = document.createElement('span');
    who.textContent = directionKey === 'from' ? `from ${file.from}` : `to ${file.to}`;
    const size = document.createElement('span');
    size.textContent = formatSize(file.size);
    const when = document.createElement('span');
    when.textContent = new Date(file.createdAt).toLocaleString();
    meta.append(who, size, when);

    const badges = document.createElement('div');
    badges.className = 'card-file__badges';
    const access = document.createElement('span');
    access.className = 'badge';
    access.textContent = file.permission === 'view' ? 'view only' : 'view and download';
    badges.appendChild(access);
    const life = expiryLabel(file);
    if (life) {
      const badge = document.createElement('span');
      badge.className = 'badge badge--quiet';
      badge.textContent = life;
      badges.appendChild(badge);
    }
    if (file.state && file.state !== 'live') {
      const badge = document.createElement('span');
      badge.className = 'badge badge--dead';
      badge.textContent = file.state;
      badges.appendChild(badge);
    }
    if (file.openedAt) {
      const badge = document.createElement('span');
      badge.className = 'badge badge--quiet';
      badge.textContent = 'opened';
      badges.appendChild(badge);
    }
    const checkState = integrity.get(file.id);
    if (checkState) {
      const badge = document.createElement('span');
      badge.className = checkState === 'verified' ? 'badge badge--good' : 'badge badge--dead';
      badge.textContent = checkState === 'verified' ? 'verified' : 'changed';
      badges.appendChild(badge);
    }

    const foot = document.createElement('div');
    foot.className = 'card-file__foot';
    const key = document.createElement('button');
    key.className = 'key-chip';
    key.type = 'button';
    key.textContent = 'key ...';
    key.title = 'Copy the key fingerprint this file is encrypted to';
    key.setAttribute('aria-label', `Copy key fingerprint for ${file.filename}`);
    key.addEventListener('click', () => copyKeyFor(file, directionKey, key));
    foot.appendChild(key);

    const actions = document.createElement('div');
    actions.className = 'card-file__actions';
    if (isTrashed) {
      const restore = document.createElement('button');
      restore.className = 'btn btn--small';
      restore.type = 'button';
      restore.textContent = 'Restore';
      restore.addEventListener('click', () => restoreShare(file.id));
      actions.appendChild(restore);

      const purge = document.createElement('button');
      purge.className = 'btn btn--small';
      purge.type = 'button';
      purge.textContent = 'Purge';
      purge.disabled = file.from !== me;
      if (file.from !== me) purge.title = 'Only the sender can purge permanently';
      purge.addEventListener('click', () => purgeShare(file.id, file.filename));
      actions.appendChild(purge);
    } else {
      if (directionKey === 'from') {
        const open = document.createElement('button');
        open.className = 'btn btn--small';
        open.type = 'button';
        open.textContent = 'Decrypt';
        open.disabled = file.state !== 'live';
        open.addEventListener('click', () => openShare(file.id));
        actions.appendChild(open);
      } else {
        const details = document.createElement('button');
        details.className = 'btn btn--small';
        details.type = 'button';
        details.textContent = 'Details';
        details.addEventListener('click', () => showSent(file.id));
        actions.appendChild(details);
        const revoke = document.createElement('button');
        revoke.className = 'btn btn--small';
        revoke.type = 'button';
        revoke.textContent = 'Revoke';
        revoke.disabled = file.state !== 'live' || Boolean(file.openedAt);
        // A disabled button with no reason reads as a broken app, so it says
        // why it cannot be pressed.
        if (revoke.disabled) {
          revoke.title = file.openedAt
            ? 'The recipient already opened this file, so it cannot be revoked.'
            : file.state === 'expired'
              ? 'This file has already expired.'
              : 'This file is not live.';
        }
        revoke.addEventListener('click', () => revokeShare(file.id));
        actions.appendChild(revoke);
      }
      const del = document.createElement('button');
      del.className = 'btn btn--small';
      del.type = 'button';
      del.textContent = 'Delete';
      del.addEventListener('click', () => deleteShare(file.id));
      actions.appendChild(del);
    }
    foot.appendChild(actions);

    card.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openCardMenu(file, directionKey, event.clientX, event.clientY, key);
    });

    card.append(top, meta, badges, foot);
    container.appendChild(card);
  }
}

async function copyKeyFor(file, directionKey, chip) {
  const other = directionKey === 'from' ? me : file.to;
  const user = users.find((u) => u.username === other);
  if (!user) {
    setMainStatus('No public key is on file for that account.', 'error');
    return;
  }
  const print = await fingerprint(user.publicKey);
  if (chip) chip.textContent = `key ${print}`;
  try {
    await navigator.clipboard.writeText(print);
    setMainStatus(`Key fingerprint copied: ${print}`, 'ok');
    toast('Key fingerprint copied.');
  } catch (err) {
    setMainStatus(`Key fingerprint: ${print}`, 'ok');
  }
}

/* ---------------- card context menu ---------------- */

function isCardMenuOpen() {
  const menu = $('card-menu');
  return Boolean(menu && !menu.classList.contains('hidden'));
}

function closeCardMenu(restoreFocus = false) {
  const menu = $('card-menu');
  if (!menu || menu.classList.contains('hidden')) return;
  menu.classList.add('hidden');
  menu.innerHTML = '';
  if (restoreFocus && cardMenuLastFocus && document.contains(cardMenuLastFocus)) {
    cardMenuLastFocus.focus();
  }
  cardMenuLastFocus = null;
}

function addCardMenuItem(menu, label, disabled, onClick) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'card-menu__item';
  item.setAttribute('role', 'menuitem');
  item.textContent = label;
  item.disabled = Boolean(disabled);
  item.addEventListener('click', () => {
    closeCardMenu();
    onClick();
  });
  menu.appendChild(item);
}

function openCardMenu(file, directionKey, clientX, clientY, keyChip) {
  const menu = $('card-menu');
  if (!menu) return;
  cardMenuLastFocus = document.activeElement;
  menu.innerHTML = '';

  if (file.state === 'trashed') {
    addCardMenuItem(menu, 'Restore', false, () => restoreShare(file.id));
    addCardMenuItem(menu, 'Purge', file.from !== me, () => purgeShare(file.id, file.filename));
  } else {
    if (directionKey === 'from') {
      addCardMenuItem(menu, 'Open', file.state !== 'live', () => openShare(file.id));
    } else {
      addCardMenuItem(menu, 'Details', false, () => showSent(file.id));
    }
    addCardMenuItem(
      menu,
      file.starred ? 'Unstar' : 'Star',
      file.state === 'revoked',
      () => toggleStar(file.id)
    );
    addCardMenuItem(
      menu,
      'Revoke',
      !(file.from === me && file.state === 'live' && !file.openedAt),
      () => revokeShare(file.id)
    );
    addCardMenuItem(menu, 'Delete', false, () => deleteShare(file.id));
    addCardMenuItem(menu, 'Copy the key fingerprint', false, () => copyKeyFor(file, directionKey, keyChip));
  }

  menu.style.left = '0px';
  menu.style.top = '0px';
  menu.classList.remove('hidden');

  const rect = menu.getBoundingClientRect();
  const maxX = Math.max(8, window.innerWidth - rect.width - 8);
  const maxY = Math.max(8, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.min(Math.max(8, clientX), maxX)}px`;
  menu.style.top = `${Math.min(Math.max(8, clientY), maxY)}px`;

  const firstEnabled = menu.querySelector('.card-menu__item:not(:disabled)');
  if (firstEnabled) firstEnabled.focus();
}

/* ---------------- shortcuts panel ---------------- */

function isShortcutsOpen() {
  const panel = $('shortcuts-panel');
  return Boolean(panel && !panel.classList.contains('hidden'));
}

function openShortcuts() {
  const panel = $('shortcuts-panel');
  if (!panel) return;
  closeCardMenu();
  shortcutsLastFocus = document.activeElement;
  panel.classList.remove('hidden');
  if ($('shortcuts-button')) $('shortcuts-button').setAttribute('aria-expanded', 'true');
  if ($('shortcuts-close')) $('shortcuts-close').focus();
}

function closeShortcuts() {
  if (!isShortcutsOpen()) return;
  $('shortcuts-panel').classList.add('hidden');
  if ($('shortcuts-button')) $('shortcuts-button').setAttribute('aria-expanded', 'false');
  if (shortcutsLastFocus && document.contains(shortcutsLastFocus)) {
    shortcutsLastFocus.focus();
  }
  shortcutsLastFocus = null;
}

/* ---------------- star, trash, bulk actions ---------------- */

function selectAllBulk() {
  for (const file of visibleFiles) {
    selectedIds.add(file.id);
  }
  for (const card of document.querySelectorAll('#cards .card-file')) {
    card.classList.add('card-file--selected');
    const cb = card.querySelector('.card-file__check');
    if (cb) cb.checked = true;
  }
  renderBulkBar(visibleFiles);
}

async function toggleStar(id) {
  try {
    const result = await api(`/api/shares/${id}/star`, { method: 'POST' });
    setMainStatus(result.starred ? 'Added to starred.' : 'Removed from starred.', 'ok');
    toast(result.starred ? 'Starred.' : 'Unstarred.');
    await refresh();
  } catch (err) {
    setMainStatus(`Star failed: ${err.message}`, 'error');
  }
}

async function deleteShare(id) {
  try {
    await api(`/api/shares/${id}/delete`, { method: 'POST' });
    selectedIds.delete(id);
    setMainStatus('Moved to trash.', 'ok');
    toast('File moved to the trash', {
      action: 'Undo',
      onAction: () => restoreShare(id),
    });
    await refresh();
  } catch (err) {
    setMainStatus(`Delete failed: ${err.message}`, 'error');
  }
}

async function restoreShare(id) {
  try {
    await api(`/api/shares/${id}/restore`, { method: 'POST' });
    selectedIds.delete(id);
    setMainStatus('Restored from trash.', 'ok');
    toast('File restored.');
    await refresh();
  } catch (err) {
    setMainStatus(`Restore failed: ${err.message}`, 'error');
  }
}

async function purgeShare(id, filename) {
  if (!window.confirm(`Permanently delete "${filename}"? This cannot be undone.`)) return;
  try {
    await api(`/api/shares/${id}/purge`, { method: 'POST' });
    selectedIds.delete(id);
    setMainStatus('Permanently deleted.', 'ok');
    toast('File purged.');
    await refresh();
  } catch (err) {
    setMainStatus(`Purge failed: ${err.message}`, 'error');
  }
}

async function bulkStar() {
  const selectedShares = visibleFiles.filter((s) => selectedIds.has(s.id));
  const starable = selectedShares.filter((s) => s.state !== 'trashed' && s.state !== 'revoked');
  if (!starable.length) return;
  const unstarred = starable.filter((s) => !s.starred);
  const targets = unstarred.length ? unstarred : starable;
  try {
    for (const share of targets) {
      await api(`/api/shares/${share.id}/star`, { method: 'POST' });
    }
    const msg = unstarred.length ? `Starred ${targets.length} file(s).` : `Unstarred ${targets.length} file(s).`;
    setMainStatus(msg, 'ok');
    toast(msg);
    await refresh();
  } catch (err) {
    setMainStatus(`Star failed: ${err.message}`, 'error');
  }
}

async function bulkRevoke() {
  const selectedShares = visibleFiles.filter((s) => selectedIds.has(s.id));
  const revokable = selectedShares.filter((s) => s.from === me && s.state === 'live' && !s.openedAt);
  if (!revokable.length) return;
  try {
    for (const share of revokable) {
      await api(`/api/shares/${share.id}/revoke`, { method: 'POST' });
      selectedIds.delete(share.id);
    }
    setMainStatus(`Revoked ${revokable.length} share(s).`, 'ok');
    toast(revokable.length === 1 ? 'Share revoked. The file stays revoked.' : `Revoked ${revokable.length} shares. They stay revoked.`);
    await refresh();
  } catch (err) {
    setMainStatus(`Revoke failed: ${err.message}`, 'error');
  }
}

async function bulkDelete() {
  const selectedShares = visibleFiles.filter((s) => selectedIds.has(s.id));
  const deletable = selectedShares.filter((s) => s.state !== 'trashed');
  if (!deletable.length) return;
  const deletedIds = deletable.map((s) => s.id);
  try {
    for (const share of deletable) {
      await api(`/api/shares/${share.id}/delete`, { method: 'POST' });
      selectedIds.delete(share.id);
    }
    setMainStatus(`Moved ${deletable.length} file(s) to trash.`, 'ok');
    toast(deletedIds.length === 1 ? 'File moved to the trash' : `${deletedIds.length} files moved to the trash`, {
      action: 'Undo',
      onAction: async () => {
        try {
          for (const sid of deletedIds) {
            await api(`/api/shares/${sid}/restore`, { method: 'POST' });
          }
          setMainStatus('Restored from trash.', 'ok');
          toast('File restored.');
          await refresh();
        } catch (err) {
          setMainStatus(`Restore failed: ${err.message}`, 'error');
        }
      },
    });
    await refresh();
  } catch (err) {
    setMainStatus(`Delete failed: ${err.message}`, 'error');
  }
}

/* ---------------- preview panel ---------------- */

function isPreviewOpen() {
  const dialog = $('preview-dialog');
  return Boolean(dialog && !dialog.classList.contains('hidden'));
}

async function openPreview(file) {
  previewShareId = file.id;
  previewLastFocus = document.activeElement;

  $('preview-title').textContent = file.filename;
  $('preview-size').textContent = formatSize(file.size);
  $('preview-who').textContent = file.from === me ? `Sent to ${file.to}` : `Shared by ${file.from}`;
  $('preview-when').textContent = new Date(file.createdAt).toLocaleString();
  $('preview-permission').textContent = file.permission === 'view' ? 'View only' : 'View and download';
  $('preview-expiry').textContent = expiryLabel(file) || 'Never expires';
  $('preview-state').textContent = file.state || 'live';
  $('preview-key').textContent = 'checking...';
  $('preview-digest').textContent = file.digest || 'not recorded';
  $('preview-signature').textContent = file.signature
    ? `ECDSA P-256 by ${file.from}`
    : 'not signed';
  const stored = file.storedSize || file.size || 0;
  $('preview-stored').textContent = `${formatSize(stored)} of ciphertext (${stored} bytes)`;
  $('preview-protection').textContent =
    file.protected === 'password'
      ? 'The recipient key and a password are both needed'
      : "The recipient's public key only";

  $('preview-dialog').classList.remove('hidden');
  $('preview-close').focus();

  const recipientUser = users.find((u) => u.username === file.to);
  const publicKey = recipientUser ? recipientUser.publicKey : file.to === me && myKeys ? myKeys.publicKeyB64 : null;
  const print = await fingerprint(publicKey);
  if (previewShareId === file.id) {
    $('preview-key').textContent = print;
  }
}

// The receipt is what a reviewer can read: the whole chain for one file, in
// plain text, with the events the audit trail holds for it.
function receiptFor(file) {
  const stored = file.storedSize || file.size || 0;
  const lines = [
    'SECURESHARE SECURITY RECEIPT',
    `File:        ${file.filename}`,
    `From:        ${file.from}`,
    `To:          ${file.to}`,
    `Permission:  ${file.permission === 'view' ? 'view only' : 'view and download'}`,
    `Sent:        ${new Date(file.createdAt).toLocaleString()}`,
    `Expires:     ${expiryLabel(file) || 'never'}`,
    `State:       ${file.state || 'live'}`,
    `Original:    ${file.size} bytes`,
    `Stored:      ${stored} bytes of ciphertext`,
    'Cipher:      AES-GCM 256, the key wrapped to the recipient RSA-OAEP 2048 public key',
    `Protection:  ${file.protected === 'password' ? 'recipient key and password' : 'recipient key only'}`,
    `Fingerprint: ${file.digest || 'not recorded'}`,
    `Signature:   ${file.signature ? `ECDSA P-256 by ${file.from}` : 'not signed'}`,
  ];
  const events = (activityEvents || []).filter((event) => event.shareId === file.id);
  if (events.length) {
    lines.push('Events:');
    for (const event of events.slice().reverse()) {
      lines.push(`  ${new Date(event.ts).toLocaleString()}  ${event.type} by ${event.actor}`);
    }
  }
  return lines.join('\n');
}

async function copyReceipt(file) {
  const text = receiptFor(file);
  try {
    await navigator.clipboard.writeText(text);
    toast('The security receipt is on the clipboard.');
  } catch (err) {
    // A browser that will not write to the clipboard still lets the text be
    // selected by hand.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    toast(copied ? 'The security receipt is on the clipboard.' : 'The receipt could not be copied.');
  }
}

function closePreview() {
  if (!isPreviewOpen()) return;
  $('preview-dialog').classList.add('hidden');
  previewShareId = null;
  if (previewLastFocus && document.contains(previewLastFocus)) {
    previewLastFocus.focus();
  }
  previewLastFocus = null;
}

/* ---------------- keyboard navigation ---------------- */

function moveActiveCard(delta) {
  if (!visibleFiles.length) return;
  let index = visibleFiles.findIndex((file) => file.id === activeCardId);
  if (index < 0) index = delta > 0 ? 0 : visibleFiles.length - 1;
  else index = Math.max(0, Math.min(visibleFiles.length - 1, index + delta));

  activeCardId = visibleFiles[index].id;
  for (const card of document.querySelectorAll('#cards .card-file')) {
    const match = card.dataset.shareId === activeCardId;
    card.classList.toggle('card-file--active', match);
    if (match) {
      card.focus({ preventScroll: true });
      card.scrollIntoView({ block: 'nearest' });
    }
  }
}

/* ---------------- recipient key ---------------- */

async function showRecipientKey() {
  const user = users.find((u) => u.username === $('recipient').value);
  const note = $('recipient-key');
  note.innerHTML = '';
  if (!user) {
    note.textContent = 'No other users registered yet. Share the address so someone can register.';
    return;
  }
  const print = await fingerprint(user.publicKey);
  const plate = document.createElement('span');
  plate.className = 'plate';
  const caption = document.createElement('span');
  caption.textContent = 'public key';
  const figure = document.createElement('span');
  figure.className = 'plate__figure';
  figure.textContent = print;
  plate.append(caption, figure);
  note.appendChild(plate);
}

/* ---------------- the file picker ---------------- */

function describeFile(file) {
  if (!file) {
    $('file-note').textContent = 'Drop a file here or choose one. Up to 25 MB.';
    return;
  }
  $('file-note').textContent = `${file.name} - ${formatSize(file.size)}`;
}

/* ---------------- progress ---------------- */

function progress(percent, label) {
  $('progress').classList.remove('hidden');
  $('progress-bar').style.transform = `scaleX(${percent / 100})`;
  $('progress-label').textContent = label;
}

function progressDone() {
  $('progress').classList.add('hidden');
  $('progress-bar').style.transform = 'scaleX(0)';
}

/* ---------------- share ---------------- */

function expiryText(seconds) {
  if (seconds >= 604800) return '7 days';
  if (seconds >= 86400) return '1 day';
  if (seconds >= 3600) return '1 hour';
  return `${seconds} seconds`;
}

/* ---------------- evidence: what the server really stored ---------------- */

async function showEvidence(shareId, filename, originalHead) {
  try {
    const head = await api(`/api/shares/${shareId}/cipher-head`);
    $('evidence-original').textContent = originalHead || 'not kept by the browser';
    $('evidence-stored').textContent = head.head.slice(0, 32);
    $('evidence-foot').textContent =
      `The server holds ${formatSize(head.size)} for ${filename}. The same bytes on disk are in data/blobs/${shareId}.bin and start ${head.readable}. ` +
      'Open that file in any hex viewer, or run the show:ciphertext script, to see it for yourself.';
    lastEvidence = { shareId, filename };
  } catch (err) {
    $('evidence-foot').textContent = err.message;
  }
}

/* ---------------- opening a file ---------------- */

function openedShares() {
  try {
    return new Set(JSON.parse(readStored(OPENED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markOpened(id) {
  const opened = openedShares();
  opened.add(id);
  writeStored(OPENED_KEY, JSON.stringify([...opened]));
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

async function decryptShareBytes(id) {
  if (!myKeys) throw new Error('No key pair on this device for this account.');
  const meta = await api(`/api/shares/${id}`);
  if (meta.state !== 'live') {
    if (meta.state === 'trashed') throw new Error('this file is in the trash.');
    throw new Error(meta.state === 'revoked' ? 'the sender revoked this file.' : 'this file has expired.');
  }

  let aes;
  if (meta.protected === 'password') {
    // The file key was wrapped twice: to the recipient's public key and to
    // the password. Both are needed, and both must name the same key.
    const password = await askPassword(
      'The sender protected this file with a password. Ask them for it.'
    );
    if (!password) throw new Error('the password is needed to open this file');
    const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, myKeys.privateKey, fromB64(meta.wrappedKey));
    let fromPassword;
    try {
      fromPassword = await KeyGuard.unwrapWithPassword(meta.passwordWrappedKey, meta.passwordSalt, password);
    } catch (err) {
      throw new Error('that password does not open this file');
    }
    const passwordRaw = new Uint8Array(await crypto.subtle.exportKey('raw', fromPassword));
    if (!sameBytes(rawAes, passwordRaw)) {
      throw new Error('the two keys for this file do not match, so it was not opened');
    }
    aes = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
  } else {
    const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, myKeys.privateKey, fromB64(meta.wrappedKey));
    aes = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
  }

  const res = await fetch(`/api/shares/${id}/blob`);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || 'could not download the encrypted file');
  }
  const ciphertext = await res.arrayBuffer();
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(meta.iv) }, aes, ciphertext);

  // The sender's fingerprint of the plaintext, recomputed here after
  // decryption: this is the check that crosses the encrypted boundary.
  const check = await sha256Hex(plaintext);
  const verified = !meta.digest || check === meta.digest;

  // And the sender's signature over the fingerprint and the metadata, so the
  // recipient can tell who vouched for it.
  let signed = null;
  if (meta.signature) {
    const sender = users.find((u) => u.username === meta.from);
    signed = sender && sender.signingKey
      ? await KeyGuard.verifyShare(KeyGuard.sharePayload(meta), meta.signature, sender.signingKey)
      : false;
  }
  return { meta, plaintext, verified, signed };
}

// The password gate, a small panel rather than a browser prompt.
function askPassword(note) {
  return new Promise((resolve) => {
    const dialog = $('password-dialog');
    $('password-note').textContent = note;
    $('password-input').value = '';
    dialog.classList.remove('hidden');
    const finish = (value) => {
      dialog.classList.add('hidden');
      $('password-ok').removeEventListener('click', onOk);
      $('password-close').removeEventListener('click', onCancel);
      resolve(value);
    };
    const onOk = () => finish($('password-input').value);
    const onCancel = () => finish(null);
    $('password-ok').addEventListener('click', onOk);
    $('password-close').addEventListener('click', onCancel);
    $('password-input').focus();
  });
}

async function openShare(id) {
  setMainStatus('');
  try {
    const { meta, plaintext, verified, signed } = await decryptShareBytes(id);
    integrity.set(id, verified ? 'verified' : 'changed');

    const blob = new Blob([plaintext], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    markOpened(id);
    await api(`/api/shares/${id}/opened`, { method: 'POST' }).catch(() => {});

    const proof = [
      verified ? 'Verified against the sender fingerprint.' : 'The fingerprint does not match.',
      signed === true ? 'The signature checks out.' : signed === false ? 'The signature does not check out.' : '',
    ]
      .filter(Boolean)
      .join(' ');

    if (meta.permission === 'view') {
      const tab = window.open(url, '_blank');
      if (!tab) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.click();
      }
      setMainStatus(
        `${proof} Opened in a new tab. The sender marked this file view only, so there is no save button.`,
        verified && signed !== false ? 'ok' : 'error'
      );
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = meta.filename;
      link.click();
      setMainStatus(
        `${proof} Decrypted and saved to your downloads.`,
        verified && signed !== false ? 'ok' : 'error'
      );
    }
    // The new tab loads the blob asynchronously, so the URL has to outlive the
    // click that opened it. Revoking it in the same tick leaves the tab with
    // a dead address.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    const toastParts = ['Decrypted'];
    if (verified) toastParts.push('verified');
    if (signed === true) toastParts.push('signed');
    toast(`${toastParts.join(', ')}.`);
    await refresh();
  } catch (err) {
    setMainStatus(`Decrypt failed: ${err.message}`, 'error');
  }
}

async function showSent(id) {
  try {
    const meta = await api(`/api/shares/${id}`);
    const life = expiryLabel(meta);
    setMainStatus(
      `Sent to ${meta.to}. The server holds ciphertext only, and ${meta.permission === 'view' ? 'the file is marked view only' : 'the file can be saved'}.` +
        (life ? ` It ${life}.` : '') +
        (meta.openedAt ? ' The recipient opened it.' : ' The recipient has not opened it yet.'),
      'ok'
    );
    await showEvidence(meta.id, meta.filename, null);
  } catch (err) {
    setMainStatus(err.message, 'error');
  }
}

async function revokeShare(id) {
  try {
    await api(`/api/shares/${id}/revoke`, { method: 'POST' });
    setMainStatus('Revoked. The server will not hand the file over any more.', 'ok');
    toast('Share revoked. The file stays revoked.');
    await refresh();
  } catch (err) {
    setMainStatus(`Revoke failed: ${err.message}`, 'error');
  }
}

/* ---------------- initialisation ---------------- */

function bindEvents() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'paper', false);
  applyLayout(layout);

  $('theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(isDark ? 'paper' : 'dark');
  });

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('auth-error').textContent = '';
    try {
      if (pendingChallenge) {
        const result = await api('/api/login/totp', {
          method: 'POST',
          body: { challenge: pendingChallenge, code: $('login-totp-code').value.trim() },
        });
        await completeSignIn(result.username);
      } else {
        await signIn($('login-username').value.trim(), $('login-password').value);
      }
    } catch (err) {
      $('auth-error').textContent = err.message;
    }
  });

  $('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('auth-error').textContent = '';
    try {
      const username = $('register-username').value.trim();
      const email = $('register-email').value.trim();
      const password = $('register-password').value;
      const { pair, publicKeyB64 } = await generateKeyPair(true);
      const signing = await KeyGuard.generateSigningKey();
      const phrase = KeyGuard.randomPhrase(12);
      const backup = await KeyGuard.wrapPrivateKey(pair.privateKey, phrase);
      const result = await api('/api/register', {
        method: 'POST',
        body: {
          username,
          email,
          password,
          publicKey: publicKeyB64,
          signingKey: signing.publicKeyB64,
          accessCode: $('register-access-code').value.trim(),
        },
      });
      await idbPut(username, {
        privateKey: await nonExtractableCopy(pair),
        publicKey: pair.publicKey,
        publicKeyB64,
        signingPrivateKey: signing.pair.privateKey,
        signingPublicKeyB64: signing.publicKeyB64,
        phrase,
        backup,
      });

      pendingUser = username;
      $('verify-email').textContent = email;
      if (result.demoCode) {
        $('verify-note').textContent =
          `Demo mode: no email service is configured, so the code is ${result.demoCode}. With a mail service set up it would arrive by email.`;
        $('verify-code').value = result.demoCode;
      } else {
        $('verify-note').textContent = 'We sent a 6-digit code to your email. It expires in 10 minutes.';
      }
      $('tabs').classList.add('hidden');
      $('login-form').classList.add('hidden');
      $('register-form').classList.add('hidden');
      $('verify-form').classList.remove('hidden');
    } catch (err) {
      $('auth-error').textContent = err.message;
    }
  });

  $('verify-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('auth-error').textContent = '';
    try {
      const session = await api('/api/verify-otp', {
        method: 'POST',
        body: { username: pendingUser, code: $('verify-code').value.trim() },
      });
      me = session.username;
      myKeys = (await idbGet(me)) || null;
      showApp();
      await refresh();
      await uploadBackup();
    } catch (err) {
      $('auth-error').textContent = err.message;
    }
  });

  $('recovery-toggle').addEventListener('click', () => {
    $('recovery-field').classList.toggle('hidden');
    $('recovery-phrase').focus();
  });

  $('phrase-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('phrase-words').textContent);
      setMainStatus('Recovery phrase copied. Keep it somewhere safe.', 'ok');
      toast('Recovery phrase copied.');
    } catch (err) {
      setMainStatus('Copy it by hand from the panel.', 'error');
    }
  });

  $('tab-login').addEventListener('click', () => setTab('login'));
  $('tab-register').addEventListener('click', () => setTab('register'));

  $('logout').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    location.reload();
  });

  $('logout-all').addEventListener('click', async () => {
    try {
      const result = await api('/api/logout-all', { method: 'POST' });
      setMainStatus(`Signed out of ${result.ended} session(s) on every device.`, 'ok');
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      setMainStatus(err.message, 'error');
    }
  });

  for (const cell of document.querySelectorAll('[data-permission]')) {
    cell.addEventListener('click', () => {
      permission = cell.dataset.permission;
      for (const other of document.querySelectorAll('[data-permission]')) {
        other.setAttribute('aria-pressed', String(other === cell));
      }
    });
  }

  for (const cell of document.querySelectorAll('[data-expiry]')) {
    cell.addEventListener('click', () => {
      expiry = Number(cell.dataset.expiry);
      for (const other of document.querySelectorAll('[data-expiry]')) {
        other.setAttribute('aria-pressed', String(other === cell));
      }
    });
  }

  // Key only, or the file key is wrapped with a password as well, so the
  // recipient cannot open the file at all without it.
  let protection = 'key';
  for (const cell of document.querySelectorAll('[data-protection]')) {
    cell.addEventListener('click', () => {
      protection = cell.dataset.protection;
      for (const other of document.querySelectorAll('[data-protection]')) {
        other.setAttribute('aria-pressed', String(other === cell));
      }
      $('password-field').classList.toggle('hidden', protection !== 'password');
      $('protection-note').textContent =
        protection === 'password'
          ? 'The file key is wrapped twice: to the recipient key and to the password.'
          : "The file key is wrapped to the recipient's public key.";
    });
  }

  for (const item of document.querySelectorAll('.rail__item')) {
    item.addEventListener('click', () => {
      view = item.dataset.view;
      setFilter('all');
      closeCardMenu();
      selectedIds.clear();
      activeCardId = null;
      render();
    });
  }

  for (const chip of document.querySelectorAll('#filter-chips .filter-chip')) {
    chip.addEventListener('click', () => {
      setFilter(chip.dataset.filter);
      render();
    });
  }

  $('new-share').addEventListener('click', () => {
    openNewShareFor(null);
  });

  $('search').addEventListener('input', (event) => {
    query = event.target.value.trim().toLowerCase();
    render();
  });

  $('sort-select').addEventListener('change', (event) => {
    sortBy = event.target.value;
    render();
  });

  $('layout-grid').addEventListener('click', () => applyLayout('grid'));
  $('layout-list').addEventListener('click', () => applyLayout('list'));

  $('bulk-select-all').addEventListener('click', selectAllBulk);
  $('bulk-star').addEventListener('click', bulkStar);
  $('bulk-revoke').addEventListener('click', bulkRevoke);
  $('bulk-delete').addEventListener('click', bulkDelete);
  $('bulk-clear').addEventListener('click', () => {
    selectedIds.clear();
    render();
  });

  $('shortcuts-button').addEventListener('click', openShortcuts);
  $('shortcuts-close').addEventListener('click', closeShortcuts);
  $('shortcuts-panel').addEventListener('click', (event) => {
    if (event.target === $('shortcuts-panel')) closeShortcuts();
  });

  document.addEventListener('click', (event) => {
    const menu = $('card-menu');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(event.target)) {
      closeCardMenu();
    }
  });
  document.addEventListener('contextmenu', (event) => {
    const menu = $('card-menu');
    if (menu && !menu.classList.contains('hidden') && !event.target.closest('#cards .card-file')) {
      closeCardMenu();
    }
  });
  window.addEventListener('resize', () => closeCardMenu());
  window.addEventListener('scroll', () => closeCardMenu(), true);

  $('preview-close').addEventListener('click', closePreview);
  $('preview-dialog').addEventListener('click', (event) => {
    if (event.target === $('preview-dialog')) closePreview();
  });
  $('preview-receipt').addEventListener('click', () => {
    const file = findShareById(previewShareId);
    if (file) copyReceipt(file);
  });

  $('recipient').addEventListener('change', showRecipientKey);

  $('totp-open').addEventListener('click', openTotpPanel);
  $('totp-close').addEventListener('click', closeTotpPanel);
  $('totp-confirm').addEventListener('click', confirmTotp);
  $('totp-disable').addEventListener('click', disableTotp);
  $('totp-panel').addEventListener('click', (event) => {
    if (event.target === $('totp-panel')) closeTotpPanel();
  });

  $('file').addEventListener('change', (event) => describeFile(event.target.files[0]));

  $('drop').addEventListener('dragover', (event) => {
    event.preventDefault();
    $('drop').classList.add('drop--over');
  });

  $('drop').addEventListener('dragleave', () => $('drop').classList.remove('drop--over'));

  $('drop').addEventListener('drop', (event) => {
    event.preventDefault();
    $('drop').classList.remove('drop--over');
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    $('file').files = transfer.files;
    describeFile(file);
  });

  $('share').addEventListener('click', async () => {
    const file = $('file').files[0];
    const recipient = $('recipient').value;
    const status = $('share-status');
    status.textContent = '';
    status.className = 'status';
    if (!file) {
      status.textContent = 'Pick a file first.';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      status.textContent = `That file is ${formatSize(file.size)}. The limit is 25 MB.`;
      return;
    }
    if (!recipient) {
      status.textContent = 'Pick a recipient first.';
      return;
    }
    const target = users.find((u) => u.username === recipient);
    if (!target) {
      status.textContent = 'Recipient not found.';
      return;
    }

    const button = $('share');
    button.disabled = true;
    try {
      progress(5, 'Reading the file');
      const plain = await file.arrayBuffer();
      const originalBytes = new Uint8Array(plain.slice(0, 16));
      const originalHead = [...originalBytes].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');

      progress(25, 'Hashing the file');
      const digest = await sha256Hex(plain);

      progress(40, 'Encrypting in this browser');
      const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, plain);
      const rawAes = await crypto.subtle.exportKey('raw', aes);
      const publicKey = await crypto.subtle.importKey('spki', fromB64(target.publicKey), RSA, false, ['encrypt']);

      // The file key always goes to the recipient's public key. When the sender
      // asks for the password as well, the same key is wrapped a second time
      // with the password, so the file needs the recipient's key and the
      // password to open. Either one alone is not enough.
      const password = protection === 'password' ? $('share-password').value : '';
      if (protection === 'password' && password.length < 10) {
        throw new Error('Give the file a password of at least ten characters.');
      }
      const wrappedKey = toB64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes));
      let passwordWrappedKey = null;
      let passwordSalt = null;
      if (protection === 'password') {
        const wrapped = await KeyGuard.wrapWithPassword(aes, password);
        passwordWrappedKey = wrapped.wrappedKey;
        passwordSalt = wrapped.salt;
      }

      // The moment the file dies is set here, not by the server, because the
      // signature has to cover it and the recipient has to rebuild it.
      const expiresAt = expiry ? Date.now() + expiry * 1000 : null;

      // The signature covers the parties, the file, its fingerprint, the
      // permission the sender chose and the expiry, so the recipient can prove
      // who sent it and what it said.
      let signature = null;
      if (myKeys && myKeys.signingPrivateKey) {
        const payload = KeyGuard.sharePayload({
          from: me,
          to: recipient,
          filename: file.name,
          size: file.size,
          digest,
          iv: toB64(iv),
          permission,
          expiresAt,
        });
        signature = await KeyGuard.signShare(payload, myKeys.signingPrivateKey);
      }

      progress(60, 'Sending the ciphertext');
      const share = await apiUpload(
        '/api/shares',
        {
          recipient,
          filename: file.name,
          size: file.size,
          permission,
          expiresAt,
          digest,
          iv: toB64(iv),
          wrappedKey,
          passwordWrappedKey,
          ciphertext: toB64(ciphertext),
          signature,
          protected: protection,
          passwordSalt,
        },
        (percent) => progress(60 + Math.round(percent * 0.4), `Sending the ciphertext, ${percent}%`)
      );
      sentFilesCache.set(share.id, file);
      progress(100, 'Sent');
      progressDone();

      status.className = 'status status--ok';
      const life = expiry ? ` It self-destructs in ${expiryText(expiry)}.` : '';
      status.textContent =
        `Encrypted and sent to ${recipient}.` +
        (permission === 'view' ? ' They can open it, not save it.' : ' They can open and save it.') +
        (protection === 'password' ? ' It also needs the password you set.' : '') +
        (signature ? ' It carries your signature.' : '') +
        life;
      $('file').value = '';
      describeFile(null);
      toast('Encrypted and sent.');
      await refresh();
      await showEvidence(share.id, file.name, originalHead);
      setFilter('all');
      view = 'sent';
      render();
    } catch (err) {
      progressDone();
      status.className = 'status status--error';
      status.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (isShortcutsOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeShortcuts();
      }
      return;
    }

    if (isCardMenuOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCardMenu(true);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const items = [...document.querySelectorAll('#card-menu .card-menu__item:not(:disabled)')];
        if (!items.length) return;
        const idx = items.indexOf(document.activeElement);
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = idx < 0 ? 0 : (idx + delta + items.length) % items.length;
        items[next].focus();
        return;
      }
      if (event.key === 'Tab') {
        closeCardMenu();
      }
      return;
    }

    if (isPreviewOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreview();
      }
      return;
    }

    if (isTotpOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTotpPanel();
      }
      return;
    }

    if (window.Anatomy && window.Anatomy.isOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        window.Anatomy.close();
      }
      return;
    }

    if ($('password-dialog') && !$('password-dialog').classList.contains('hidden')) return;

    if (!me || $('app').classList.contains('hidden')) return;

    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      $('search').focus();
      $('search').select();
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    const tag = target && target.tagName ? target.tagName.toUpperCase() : '';
    const isTypingField =
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      (target && target.isContentEditable) ||
      (tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(target.type));

    if (event.key === 'Escape' && (!isTypingField || target === $('search'))) {
      event.preventDefault();
      selectedIds.clear();
      activeCardId = null;
      query = '';
      $('search').value = '';
      if (target === $('search')) $('search').blur();
      render();
      return;
    }

    if (isTypingField) return;

    if (event.key === '/') {
      event.preventDefault();
      $('search').focus();
      $('search').select();
      return;
    }

    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      openNewShareFor(null);
      return;
    }

    if (view === 'new' || !visibleFiles.length) return;

    if (event.key === 'j' || event.key === 'J') {
      event.preventDefault();
      moveActiveCard(1);
      return;
    }

    if (event.key === 'k' || event.key === 'K') {
      event.preventDefault();
      moveActiveCard(-1);
      return;
    }

    if (event.key === 'Enter' && activeCardId) {
      if (target && target.closest('button, a, input, select, textarea')) return;
      const file = visibleFiles.find((f) => f.id === activeCardId);
      if (file) {
        event.preventDefault();
        openPreview(file);
      }
    }
  });

  initGoogleSignIn();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindEvents);
} else {
  bindEvents();
}
