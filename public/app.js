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
      'No key pair on this device for this account — files sent to you cannot be decrypted here.';
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
      body: { username, email, password, publicKey: publicKeyB64 },
    });
    await idbPut(username, { privateKey: pair.privateKey, publicKey: pair.publicKey, publicKeyB64 });

    pendingUser = username;
    $('verify-email').textContent = email;
    if (result.demoCode) {
      $('verify-note').textContent =
        `Demo mode — no email service is configured, so the code is ${result.demoCode}. With a mail service set up it would arrive by email.`;
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

$('tab-login').addEventListener('click', () => {
  $('tab-login').classList.add('active');
  $('tab-register').classList.remove('active');
  $('login-form').classList.remove('hidden');
  $('register-form').classList.add('hidden');
});

$('tab-register').addEventListener('click', () => {
  $('tab-register').classList.add('active');
  $('tab-login').classList.remove('active');
  $('register-form').classList.remove('hidden');
  $('login-form').classList.add('hidden');
});

$('logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  location.reload();
});

/* ---------------- share ---------------- */

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
  showRecipientKey();

  const shares = await api('/api/shares');
  renderFiles($('inbox'), shares.inbox, 'from');
  renderFiles($('sent'), shares.sent, 'to');
}

async function showRecipientKey() {
  const user = users.find((u) => u.username === $('recipient').value);
  if (!user) {
    $('recipient-key').textContent = 'No other users registered yet — share the URL so a friend can register.';
    return;
  }
  $('recipient-key').textContent = `Encrypting to ${user.username} — public key ${await fingerprint(user.publicKey)}`;
}

$('recipient').addEventListener('change', showRecipientKey);

$('share').addEventListener('click', async () => {
  const file = $('file').files[0];
  const recipient = $('recipient').value;
  const status = $('share-status');
  status.textContent = '';
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
    const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, await file.arrayBuffer());
    const rawAes = await crypto.subtle.exportKey('raw', aes);
    const publicKey = await crypto.subtle.importKey('spki', fromB64(target.publicKey), RSA, false, ['encrypt']);
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes);

    await api('/api/shares', {
      method: 'POST',
      body: {
        recipient,
        filename: file.name,
        size: file.size,
        iv: toB64(iv),
        wrappedKey: toB64(wrappedKey),
        ciphertext: toB64(ciphertext),
      },
    });
    status.textContent = `Encrypted and sent to ${recipient}. The server only stored ciphertext.`;
    $('file').value = '';
    await refresh();
  } catch (err) {
    status.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

/* ---------------- inbox ---------------- */

function renderFiles(container, files, directionKey) {
  container.innerHTML = '';
  if (!files.length) {
    const empty = document.createElement('li');
    empty.className = 'meta';
    empty.textContent = 'Nothing yet.';
    container.appendChild(empty);
    return;
  }
  for (const file of files) {
    const item = document.createElement('li');

    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = file.filename;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const other = directionKey === 'from' ? file.from : file.to;
    meta.textContent = `${other} · ${formatSize(file.size)} · ${new Date(file.createdAt).toLocaleString()}`;
    left.appendChild(name);
    left.appendChild(meta);

    const button = document.createElement('button');
    button.textContent = directionKey === 'from' ? 'Decrypt & download' : 'View';
    button.addEventListener('click', () => (directionKey === 'from' ? openShare(file.id) : showSent(file.id)));

    item.appendChild(left);
    item.appendChild(button);
    container.appendChild(item);
  }
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
    const link = document.createElement('a');
    link.href = url;
    link.download = meta.filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    $('share-status').textContent = `Decrypt failed: ${err.message}`;
  }
}

async function showSent(id) {
  try {
    const meta = await api(`/api/shares/${id}`);
    $('share-status').textContent =
      `Sent to ${meta.to} — ${meta.filename}. The server holds ciphertext only; ${meta.to} is the only one who can read it.`;
  } catch (err) {
    $('share-status').textContent = err.message;
  }
}
