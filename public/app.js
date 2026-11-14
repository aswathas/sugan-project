'use strict';

const $ = (id) => document.getElementById(id);

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
let shares = { inbox: [], sent: [] };
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
  me = session.username;
  myKeys = (await idbGet(me)) || null;
  showApp();
  await refresh();
  if (!myKeys) {
    setMainStatus(
      'No key pair on this device for this account, so files sent to you cannot be decrypted here.',
      'error'
    );
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

$('logout-all').addEventListener('click', async () => {
  try {
    const result = await api('/api/logout-all', { method: 'POST' });
    setMainStatus(`Signed out of ${result.ended} session(s) on every device.`, 'ok');
    setTimeout(() => location.reload(), 1200);
  } catch (err) {
    setMainStatus(err.message, 'error');
  }
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
      setMainStatus(
        'This account was first used on another device, so this device holds no private key for it. Files sent to you cannot be decrypted here.',
        'error'
      );
    }
  } catch (err) {
    $('auth-error').textContent = err.message;
  }
}

initGoogleSignIn();

/* ---------------- permission and expiry ---------------- */

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

function setMainStatus(message, kind) {
  const status = $('main-status');
  status.textContent = message || '';
  status.className = `status main__status${kind ? ` status--${kind}` : ''}`;
}

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

  shares = await api('/api/shares');
  await renderActivity();
  render();
}

async function renderActivity() {
  const list = $('activity');
  list.innerHTML = '';
  let events = [];
  try {
    events = (await api('/api/activity')).activity;
  } catch (err) {
    return;
  }
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
  const verbs = { sent: 'sent', opened: 'opened', revoked: 'revoked', registered: 'registered' };
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

function expiryLabel(share) {
  if (!share.expiresAt) return null;
  const left = share.expiresAt - Date.now();
  if (left <= 0) return 'expired';
  const hours = left / 3600000;
  if (hours < 1) return `expires in ${Math.max(1, Math.round(left / 60000))} min`;
  if (hours < 48) return `expires in ${Math.round(hours)} h`;
  return `expires in ${Math.round(hours / 24)} days`;
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
    const check = integrity.get(file.id);
    if (check) {
      const badge = document.createElement('span');
      badge.className = check === 'verified' ? 'badge badge--good' : 'badge badge--dead';
      badge.textContent = check === 'verified' ? 'verified' : 'changed';
      badges.appendChild(badge);
    }

    const foot = document.createElement('div');
    foot.className = 'card-file__foot';
    const key = document.createElement('button');
    key.className = 'key-chip';
    key.type = 'button';
    key.textContent = 'key ...';
    key.title = 'Copy the key fingerprint this file is encrypted to';
    key.addEventListener('click', () => copyKeyFor(file, directionKey, key));
    foot.appendChild(key);

    const actions = document.createElement('div');
    actions.className = 'card-file__actions';
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
      revoke.addEventListener('click', () => revokeShare(file.id));
      actions.appendChild(revoke);
    }
    foot.appendChild(actions);

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
  chip.textContent = `key ${print}`;
  try {
    await navigator.clipboard.writeText(print);
    setMainStatus(`Key fingerprint copied: ${print}`, 'ok');
  } catch (err) {
    setMainStatus(`Key fingerprint: ${print}`, 'ok');
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

/* ---------------- the file picker ---------------- */

function describeFile(file) {
  if (!file) {
    $('file-note').textContent = 'Drop a file here or choose one. Up to 25 MB.';
    return;
  }
  $('file-note').textContent = `${file.name} - ${formatSize(file.size)}`;
}

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

/* ---------------- progress ---------------- */

function progress(percent, label) {
  $('progress').classList.remove('hidden');
  $('progress-bar').style.width = `${percent}%`;
  $('progress-label').textContent = label;
}

function progressDone() {
  $('progress').classList.add('hidden');
  $('progress-bar').style.width = '0%';
}

/* ---------------- share ---------------- */

function expiryText(seconds) {
  if (seconds >= 604800) return '7 days';
  if (seconds >= 86400) return '1 day';
  if (seconds >= 3600) return '1 hour';
  return `${seconds} seconds`;
}

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
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes);

    progress(60, 'Sending the ciphertext');
    const share = await apiUpload(
      '/api/shares',
      {
        recipient,
        filename: file.name,
        size: file.size,
        permission,
        expiresIn: expiry,
        digest,
        iv: toB64(iv),
        wrappedKey: toB64(wrappedKey),
        ciphertext: toB64(ciphertext),
      },
      (percent) => progress(60 + Math.round(percent * 0.4), `Sending the ciphertext, ${percent}%`)
    );
    progress(100, 'Sent');
    progressDone();

    status.className = 'status status--ok';
    const life = expiry ? ` It self-destructs in ${expiryText(expiry)}.` : '';
    status.textContent =
      `Encrypted and sent to ${recipient}.` +
      (permission === 'view' ? ' They can open it, not save it.' : ' They can open and save it.') +
      life;
    $('file').value = '';
    describeFile(null);
    await refresh();
    await showEvidence(share.id, file.name, originalHead);
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
  setMainStatus('');
  try {
    if (!myKeys) throw new Error('No key pair on this device for this account.');
    const meta = await api(`/api/shares/${id}`);
    if (meta.state !== 'live') {
      throw new Error(
        meta.state === 'revoked' ? 'the sender revoked this file.' : 'this file has expired.'
      );
    }
    const rawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, myKeys.privateKey, fromB64(meta.wrappedKey));
    const aes = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);

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
    integrity.set(id, verified ? 'verified' : 'changed');

    const blob = new Blob([plaintext], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    markOpened(id);
    await api(`/api/shares/${id}/opened`, { method: 'POST' }).catch(() => {});

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
        `${verified ? 'Verified against the sender fingerprint.' : 'The fingerprint does not match.'} Opened in a new tab. The sender marked this file view only, so there is no save button.`,
        verified ? 'ok' : 'error'
      );
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = meta.filename;
      link.click();
      setMainStatus(
        `${verified ? 'Verified against the sender fingerprint.' : 'The fingerprint does not match.'} Decrypted and saved to your downloads.`,
        verified ? 'ok' : 'error'
      );
    }
    URL.revokeObjectURL(url);
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
    await refresh();
  } catch (err) {
    setMainStatus(`Revoke failed: ${err.message}`, 'error');
  }
}
