'use strict';

const $ = (id) => document.getElementById(id);

const RSA = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

let me = null;
let myKeys = null;
let users = [];
let pendingUser = null;
let permission = 'view';
let lastEvidence = null;
let view = 'inbox';
let query = '';
let shares = { inbox: [], sent: [] };

/* ---------------- base64 ---------------- */

function toB64(bytes) {
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let out = '';
  for (let i = 0; i < arr.length; i += 0x8000) {
    out += String.fromCharCode.apply(null, arr.subarray(i, i + 0x8000));
  }
  return btoa(out);
}

function fromB64(b64) {
  if (typeof b64 !== 'string' || !b64) throw new Error('missing encoded value');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

async function generateKeyPair() {
  // extractable=false keeps the private key non-extractable: it can be stored and
  // used, but never exported out of this browser.
  const pair = await crypto.subtle.generateKey(RSA, false, ['encrypt', 'decrypt']);
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  return { pair, publicKeyB64: toB64(spki) };
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
  me = session.username;
  myKeys = (await idbGet(me)) || null;
  showApp();
  await refresh();
  if (!myKeys) {
    $('share-status').textContent =
      'No key pair on this device for this account, so files sent to you cannot be decrypted here.';
  }
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('auth-error').textContent = '';
  try {
    await signIn($('login-username').value.trim(), $('login-password').value);
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
    const { pair, publicKeyB64 } = await generateKeyPair();
    const result = await api('/api/register', {
      method: 'POST',
      body: {
        username,
        email,
        password,
        publicKey: publicKeyB64,
        accessCode: $('register-access-code').value.trim(),
      },
    });
    await idbPut(username, { privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyB64 });

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
  } catch (err) {
    $('auth-error').textContent = err.message;
  }
});

function setTab(which) {
  const login = which === 'login';
  $('tab-login').setAttribute('aria-pressed', String(login));
  $('tab-register').setAttribute('aria-pressed', String(!login));
  $('login-form').classList.toggle('hidden', !login);
  $('register-form').classList.toggle('hidden', login);
}

$('tab-login').addEventListener('click', () => setTab('login'));
$('tab-register').addEventListener('click', () => setTab('register'));

$('logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  location.reload();
});

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
    const { pair, publicKeyB64 } = await generateKeyPair();
    const result = await api('/api/google-signin', {
      method: 'POST',
      body: { idToken: response.credential, publicKey: publicKeyB64 },
    });
    me = result.username;
    if (result.keyProvided) {
      await idbPut(me, { privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyB64 });
    }
    myKeys = (await idbGet(me)) || null;
    showApp();
    await refresh();
    if (!myKeys) {
      $('share-status').textContent =
        'This account was first used on another device, so this device holds no private key for it. Files sent to you cannot be decrypted here.';
    }
  } catch (err) {
    $('auth-error').textContent = err.message;
  }
}

initGoogleSignIn();

/* ---------------- permission ---------------- */

for (const cell of document.querySelectorAll('[data-permission]')) {
  cell.addEventListener('click', () => {
    permission = cell.dataset.permission;
    for (const other of document.querySelectorAll('[data-permission]')) {
      other.setAttribute('aria-pressed', String(other === cell));
    }
  });
}

/* ---------------- the dashboard ---------------- */

const VIEWS = {
  inbox: { title: 'Shared with me', files: () => shares.inbox, direction: () => 'from' },
  sent: { title: 'Sent by me', files: () => shares.sent, direction: () => 'to' },
  recent: {
    title: 'Recent',
    files: () => [...shares.inbox, ...shares.sent].sort((a, b) => b.createdAt - a.createdAt),
    direction: (file) => (file.from === me ? 'to' : 'from'),
  },
};

async function refresh() {
  const list = await api('/api/users');
  users = list.users;

  const select = $('recipient');
  select.innerHTML = '';
  for (const user of users) {
    if (user.username === me) continue;
    const option = document.createElement('option');
    option.value = user.username;
    option.textContent = user.username;
    select.appendChild(option);
  }
  await showRecipientKey();

  const loaded = await api('/api/shares');
  shares = loaded;
  render();
}

function render() {
  const opened = openedShares();
  const bytes = [...shares.inbox, ...shares.sent].reduce((sum, share) => sum + (share.size || 0), 0);
  $('count-inbox').textContent = String(shares.inbox.length);
  $('count-sent').textContent = String(shares.sent.length);
  $('count-recent').textContent = String(shares.inbox.length + shares.sent.length);
  $('stat-stored').textContent = formatSize(bytes);
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

  if (isNew) {
    $('view-title').textContent = 'New share';
    $('view-meta').textContent = 'Encrypt a file for one person';
    return;
  }

  const current = VIEWS[view];
  $('view-title').textContent = current.title;
  const files = current.files().filter((file) => !query || file.filename.toLowerCase().includes(query));
  const unread = files.filter((file) => current.direction(file) === 'from' && !opened.has(file.id)).length;
  $('view-meta').textContent =
    `${files.length} file${files.length === 1 ? '' : 's'}` + (unread ? `, ${unread} unopened` : '');
  renderCards(files, current.direction);
}

function renderCards(files, direction) {
  const container = $('cards');
  container.innerHTML = '';
  if (!files.length) {
    const empty = document.createElement('div');
    empty.className = 'cards__empty';
    empty.textContent = query
      ? 'Nothing matches that search.'
      : view === 'sent'
        ? 'You have not sent anything yet.'
        : 'Nothing has been shared with you yet.';
    container.appendChild(empty);
    return;
  }

  const opened = openedShares();
  for (const file of files) {
    const directionKey = direction(file);
    const unread = directionKey === 'from' && !opened.has(file.id);
    const card = document.createElement('article');
    card.className = unread ? 'card-file card-file--unread' : 'card-file';

    const top = document.createElement('div');
    top.className = 'card-file__top';
    const name = document.createElement('div');
    name.className = 'card-file__name';
    name.textContent = file.filename;
    if (unread) {
      const live = document.createElement('span');
      live.className = 'live';
      live.setAttribute('aria-hidden', 'true');
      top.appendChild(live);
    }
    top.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'card-file__meta';
    const who = document.createElement('span');
    who.textContent = directionKey === 'from' ? `from ${file.from}` : `to ${file.to}`;
    const size = document.createElement('span');
    size.textContent = formatSize(file.size);
    const when = document.createElement('span');
    when.textContent = new Date(file.createdAt).toLocaleString();
    meta.append(who, size, when);

    const foot = document.createElement('div');
    foot.className = 'card-file__foot';
    const access = document.createElement('span');
    access.className = 'badge';
    access.textContent = file.permission === 'view' ? 'view only' : 'view and download';
    foot.appendChild(access);
    const button = document.createElement('button');
    button.className = 'btn btn--small';
    button.type = 'button';
    button.textContent = directionKey === 'from' ? 'Decrypt' : 'Details';
    button.addEventListener('click', () => (directionKey === 'from' ? openShare(file.id) : showSent(file.id)));
    foot.appendChild(button);

    card.append(top, meta, foot);
    container.appendChild(card);
  }
}

for (const item of document.querySelectorAll('.rail__item')) {
  item.addEventListener('click', () => {
    view = item.dataset.view;
    render();
  });
}

$('new-share').addEventListener('click', () => {
  view = 'new';
  render();
  $('file').focus();
});

$('search').addEventListener('input', (event) => {
  query = event.target.value.trim().toLowerCase();
  render();
});

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

$('recipient').addEventListener('change', showRecipientKey);

/* ---------------- share ---------------- */

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
    const originalBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const originalHead = [...originalBytes].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');

    const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, await file.arrayBuffer());
    const rawAes = await crypto.subtle.exportKey('raw', aes);
    const publicKey = await crypto.subtle.importKey('spki', fromB64(target.publicKey), RSA, false, ['encrypt']);
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes);

    const share = await api('/api/shares', {
      method: 'POST',
      body: {
        recipient,
        filename: file.name,
        size: file.size,
        permission,
        iv: toB64(iv),
        wrappedKey: toB64(wrappedKey),
        ciphertext: toB64(ciphertext),
      },
    });
    status.className = 'status status--ok';
    status.textContent =
      permission === 'view'
        ? `Encrypted and sent to ${recipient}. They can open it, not save it.`
        : `Encrypted and sent to ${recipient}. They can open and save it.`;
    $('file').value = '';
    await refresh();
    await showEvidence(share.id, file.name, originalHead);
    view = 'sent';
    render();
  } catch (err) {
    status.className = 'status status--error';
    status.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

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

const OPENED_KEY = 'secureshare-opened';

function openedShares() {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPENED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markOpened(id) {
  const opened = openedShares();
  opened.add(id);
  localStorage.setItem(OPENED_KEY, JSON.stringify([...opened]));
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

async function openShare(id) {
  const status = $('share-status');
  status.className = 'status';
  try {
    if (!myKeys) throw new Error('No key pair on this device for this account.');
    const meta = await api(`/api/shares/${id}`);
    const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, myKeys.privateKey, fromB64(meta.wrappedKey));
    const aes = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);

    const res = await fetch(`/api/shares/${id}/blob`);
    if (!res.ok) throw new Error('could not download the encrypted file');
    const ciphertext = await res.arrayBuffer();
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(meta.iv) }, aes, ciphertext);

    const blob = new Blob([plaintext], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    markOpened(id);

    if (meta.permission === 'view') {
      const tab = window.open(url, '_blank');
      if (!tab) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.click();
      }
      status.className = 'status status--ok';
      status.textContent = 'Opened in a new tab. The sender marked this file view only, so there is no save button.';
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = meta.filename;
      link.click();
      status.className = 'status status--ok';
      status.textContent = 'Decrypted and saved to your downloads.';
    }
    URL.revokeObjectURL(url);
    await refresh();
  } catch (err) {
    status.className = 'status status--error';
    status.textContent = `Decrypt failed: ${err.message}`;
  }
}

async function showSent(id) {
  const status = $('share-status');
  try {
    const meta = await api(`/api/shares/${id}`);
    status.className = 'status status--ok';
    status.textContent =
      `Sent to ${meta.to}. The server holds ciphertext only, and ${meta.permission === 'view' ? 'the file is marked view only' : 'the file can be saved'}.`;
    await showEvidence(meta.id, meta.filename, null);
  } catch (err) {
    status.className = 'status status--error';
    status.textContent = err.message;
  }
}
