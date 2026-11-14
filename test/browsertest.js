'use strict';
// Drives the real site in headless Chrome, with two separate browser profiles so
// cookies and IndexedDB are genuinely per user. Alice registers and sends a file;
// Bob receives it and decrypts it back to the original bytes.
//
// Needs Chrome on the machine. No npm dependencies: Chrome is driven over the
// DevTools protocol using Node's built-in WebSocket.

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sugan-browsertest-'));
process.env.DATA_DIR = DATA_DIR;
process.env.PORT = '0';
// A client id of the right shape, so the page takes the Google path. The button
// is rendered by Google, so only our own wiring is asserted here.
process.env.GOOGLE_CLIENT_ID = '000000000000-testclient.apps.googleusercontent.com';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const chromePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chromePath) {
  console.log('SKIP  no Chrome or Edge found on this machine');
  process.exit(0);
}

const server = require('../server/index.js');
const MARKER = 'CONFIDENTIAL-SYLLABUS-MARKER-42';
let SITE = '';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchChrome(profileDir) {
  const child = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--window-size=1280,900',
      `--user-data-dir=${profileDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  const portFile = path.join(profileDir, 'DevToolsActivePort');
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(portFile)) {
      // Chrome writes this file while it starts, so a read can catch it locked.
      let port = 0;
      try {
        port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
      } catch {
        port = 0;
      }
      if (port) return { child, port };
    }
    await delay(100);
  }
  child.kill();
  throw new Error('chrome did not report a debugging port');
}

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.onopen = resolve;
      this.socket.onerror = () => reject(new Error('cdp socket failed'));
    });
    this.socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.socket.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.socket.close();
  }
}

async function openPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('DOM.enable', {}, sessionId);
  return sessionId;
}

async function evaluate(cdp, sessionId, expression) {
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  );
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || 'page error');
  }
  return res.result.value;
}

const SHOTS = path.join(__dirname, '..', 'docs', 'screenshots');

async function shoot(cdp, sessionId, name, fullPage = false) {
  const { data } = await cdp.send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: fullPage },
    sessionId
  );
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, name), Buffer.from(data, 'base64'));
}

async function waitFor(cdp, sessionId, expression, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let value = false;
    try {
      value = await evaluate(cdp, sessionId, expression);
    } catch (err) {
      value = false;
    }
    if (value) return value;
    await delay(120);
  }
  throw new Error(`timed out waiting for: ${label}`);
}

async function signUp(cdp, sessionId, username) {
  await cdp.send('Page.navigate', { url: SITE }, sessionId);
  await waitFor(cdp, sessionId, "document.readyState === 'complete'", 'page load');
  // The confirmation is checked before anything is created: a typo must not
  // become an account nobody can sign in to.
  await evaluate(
    cdp,
    sessionId,
    `(() => {
      document.getElementById('tab-register').click();
      document.getElementById('register-username').value = ${JSON.stringify(username)};
      document.getElementById('register-email').value = ${JSON.stringify(username)} + '@example.com';
      document.getElementById('register-password').value = 'correct-horse';
      document.getElementById('register-confirm').value = 'correct-horse-typo';
      document.getElementById('register-form').requestSubmit();
      return true;
    })()`
  );
  await waitFor(
    cdp,
    sessionId,
    "document.getElementById('auth-error').textContent.includes('not the same')",
    'the two passwords are refused'
  );
  await evaluate(
    cdp,
    sessionId,
    `(() => {
      document.getElementById('register-confirm').value = 'correct-horse';
      document.getElementById('register-form').requestSubmit();
      return true;
    })()`
  );
  await shoot(cdp, sessionId, '00-register.png');
  await waitFor(
    cdp,
    sessionId,
    "!document.getElementById('verify-form').classList.contains('hidden')",
    'verification step shown'
  );
  await shoot(cdp, sessionId, '01-verify.png');
  await evaluate(cdp, sessionId, `(() => {
    document.getElementById('verify-form').requestSubmit();
    return true;
  })()`);
  await waitFor(
    cdp,
    sessionId,
    "!document.getElementById('app').classList.contains('hidden') && document.getElementById('who').textContent === '" +
      username +
      "'",
    `${username} signed in`
  );
  // The recovery phrase is shown once, and the wrapped private key is on file.
  const phrase = await waitFor(
    cdp,
    sessionId,
    `(() => {
      const panel = document.getElementById('phrase-panel');
      const words = document.getElementById('phrase-words').textContent.trim();
      return !panel.classList.contains('hidden') && words.split(' ').length === 12 ? words : false;
    })()`,
    'the recovery phrase is shown'
  );
  const backedUp = await evaluate(
    cdp,
    sessionId,
    "fetch('/api/keys/backup').then((r) => r.json()).then((d) => !!d.ciphertext && !!d.salt && !!d.iv)"
  );
  assert.ok(backedUp, 'the wrapped private key must be on the server');
  assert.ok(phrase.split(' ').length === 12, 'the recovery phrase must be twelve words');
  console.log(`PASS  ${username} has a twelve word recovery phrase and a wrapped key on the server`);
}

(async () => {
  await new Promise((resolve) => (server.listening ? resolve() : server.on('listening', resolve)));
  const PORT = server.address().port;
  SITE = `http://127.0.0.1:${PORT}`;
  // The server reads this per request, and the Google button only appears on
  // an origin Google has been given, so the test tells it which one this is.
  process.env.GOOGLE_ORIGINS = SITE;

  const aliceProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'sugan-alice-'));
  const bobProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'sugan-bob-'));
  const aliceChrome = await launchChrome(aliceProfile);
  const bobChrome = await launchChrome(bobProfile);

  const aliceVersion = await (await fetch(`http://127.0.0.1:${aliceChrome.port}/json/version`)).json();
  const alice = new Cdp(aliceVersion.webSocketDebuggerUrl);
  const bobVersion = await (await fetch(`http://127.0.0.1:${bobChrome.port}/json/version`)).json();
  const bob = new Cdp(bobVersion.webSocketDebuggerUrl);

  const alicePage = await openPage(alice);
  const bobPage = await openPage(bob);

  try {
    await signUp(alice, alicePage, 'alice');
    await signUp(bob, bobPage, 'bob');
    console.log('PASS  two users registered in two separate browser profiles');
    console.log('PASS  the register form refuses two passwords that differ');

    // The recovery phrase is shown when it is made and when it is asked for.
    // It must not open over the workspace every time you sign in.
    await evaluate(alice, alicePage, "document.getElementById('logout').click()");
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('auth').classList.contains('hidden')",
      'the sign in page is back'
    );
    // The figure: the sealing press, drawn as an isometric machine with the
    // anatomy kit, on the sign in page.
    const figureSrc = await evaluate(
      alice,
      alicePage,
      "(() => { const f = document.querySelector('.figure-frame iframe'); return f ? f.getAttribute('src') : ''; })()"
    );
    assert.ok(figureSrc.includes('sealing-press.html'), 'the sign in page must carry the figure');
    await evaluate(
      alice,
      alicePage,
      "(() => { document.querySelector('.figure-frame').scrollIntoView({ block: 'center' }); return true; })()"
    );
    const drawn = await waitFor(
      alice,
      alicePage,
      `(() => {
        const frame = document.querySelector('.figure-frame iframe');
        const doc = frame && frame.contentDocument;
        const svg = doc && doc.querySelector('svg.seal-front');
        const head = doc && doc.querySelector('[data-part="head"]');
        return Boolean(svg && svg.querySelectorAll('path').length > 40 && head && head.getAttribute('transform'));
      })()`,
      'the figure draws'
    );
    assert.ok(drawn, 'the figure must draw its parts');
    // A drawing that stands still is a picture. The press has to work.
    const moved = await evaluate(
      alice,
      alicePage,
      `(async () => {
        const frame = document.querySelector('.figure-frame iframe');
        const doc = frame && frame.contentDocument;
        if (!doc) return false;
        // The press works in bursts, so the check watches the head and the
        // readout together over a whole turn of the cycle.
        const signature = () => {
          const head = doc.querySelector('[data-part="head"]');
          const readout = doc.querySelector('[data-readout]');
          return (head ? head.getAttribute('transform') : '') + '|' + (readout ? readout.textContent : '');
        };
        const seen = new Set();
        for (let i = 0; i < 16; i++) {
          seen.add(signature());
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        return seen.size;
      })()`
    );
    assert.ok(moved >= 2, 'the figure must move, not only draw');
    console.log('PASS  the sign in page carries the sealing press figure, and the press works');
    await evaluate(
      alice,
      alicePage,
      `(() => {
        document.getElementById('tab-login').click();
        document.getElementById('login-username').value = 'alice';
        document.getElementById('login-password').value = 'correct-horse';
        document.getElementById('login-form').requestSubmit();
        return true;
      })()`
    );
    // Every sign-in wants the second factor. This account has never had one,
    // so the form offers the code to scan and the test plays the part of the
    // phone: it reads the secret and computes the code.
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('login-enrol').classList.contains('hidden')",
      'the sign in offers an authenticator'
    );
    const enrolSecret = await evaluate(
      alice,
      alicePage,
      "document.getElementById('login-secret').textContent.trim()"
    );
    // The note must say which account is being enrolled: the factor belongs to
    // a record, and one address can carry two of them.
    const enrolNote = await evaluate(
      alice,
      alicePage,
      "document.getElementById('login-totp-note').textContent"
    );
    assert.ok(
      enrolNote.includes('alice@example.com'),
      'the enrolment note must name the account'
    );
    console.log('PASS  the enrolment note names the account');
    const totp = require('../server/totp.js');
    const enrolCode = totp.codeAt(enrolSecret, Math.floor(Date.now() / 1000 / 30));
    // The setup shows a code the phone's camera can read.
    const enrolQr = await evaluate(
      alice,
      alicePage,
      "document.querySelectorAll('#login-qr svg rect, #login-qr svg path').length"
    );
    assert.ok(enrolQr > 0, 'the authenticator setup must show a code the phone can scan');
    console.log('PASS  the authenticator setup shows a code the phone can scan');
    await evaluate(
      alice,
      alicePage,
      `(() => {
        document.getElementById('login-totp-code').value = ${JSON.stringify(enrolCode)};
        document.getElementById('totp-form').requestSubmit();
        return true;
      })()`
    );
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('app').classList.contains('hidden')",
      'alice signed in again'
    );
    const factorNow = await evaluate(
      alice,
      alicePage,
      "(async () => (await (await fetch('/api/totp')).json()).enabled)()"
    );
    assert.strictEqual(factorNow, true, 'every account must hold a second factor after signing in');
    console.log('PASS  every sign-in asks for the second factor, and a new account is given one');
    const phraseHidden = await evaluate(
      alice,
      alicePage,
      "document.getElementById('phrase-panel').classList.contains('hidden')"
    );
    assert.ok(phraseHidden, 'the recovery phrase panel must not open on every sign in');
    await evaluate(alice, alicePage, "document.getElementById('settings-open').click()");
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('settings-panel').classList.contains('hidden')",
      'the settings dialog opens'
    );
    await evaluate(alice, alicePage, "document.getElementById('phrase-open').click()");
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('phrase-panel').classList.contains('hidden')",
      'the phrase opens when it is asked for'
    );
    await evaluate(alice, alicePage, "document.getElementById('phrase-close').click()");
    await evaluate(alice, alicePage, "document.getElementById('settings-close').click()");
    console.log('PASS  the recovery phrase opens when asked for, not on every sign in');

    // The Google button appears because the server publishes the client id.
    const google = await evaluate(
      alice,
      alicePage,
      `(() => ({
        shown: !document.getElementById('google-block').classList.contains('hidden'),
        script: !!document.querySelector('script[src*="accounts.google.com/gsi/client"]'),
        accessCode: !document.getElementById('register-access').classList.contains('hidden'),
        origins: null,
        note: document.getElementById('google-note').textContent,
        origin: window.location.origin,
        config: null,
      }))()`
    );
    google.config = await evaluate(alice, alicePage, "fetch('/api/config').then((r) => r.text())");
    assert.ok(google.shown, 'the Google sign-in block must be shown when a client id is configured: ' + JSON.stringify(google));
    assert.ok(google.script, 'the Google Identity script must be loaded');
    const config = await evaluate(
      alice,
      alicePage,
      "fetch('/api/config').then((r) => r.json()).then((d) => JSON.stringify(d.authorizedOrigins))"
    );
    assert.ok(config.includes('127.0.0.1'), 'the server must publish the authorised origins');
    console.log('PASS  the Google sign-in button is wired to the client id and the origin the server publishes');

    // Alice's private key is on her device only.
    const aliceKey = await evaluate(
      alice,
      alicePage,
      `new Promise((resolve) => {
        const req = indexedDB.open('secure-share', 1);
        req.onsuccess = () => {
          const get = req.result.transaction('keys', 'readonly').objectStore('keys').get('alice');
          get.onsuccess = () => resolve({ found: !!get.result, extractable: get.result ? get.result.privateKey.extractable : null });
        };
      })`
    );
    assert.ok(aliceKey.found, 'alice private key should be in her browser IndexedDB');
    assert.strictEqual(aliceKey.extractable, false, 'the stored private key must be non-extractable');
    console.log('PASS  private key lives in the browser, non-extractable');

    // Alice sends a file to Bob. Her recipient list was filled before he existed.
    await evaluate(alice, alicePage, 'refresh()');
    await waitFor(
      alice,
      alicePage,
      `!!document.getElementById('recipient').querySelector('option[value="bob"]')`,
      'bob in alice recipient list'
    );
    await evaluate(alice, alicePage, "document.getElementById('new-share').click()");
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('new-form').classList.contains('hidden')",
      'send panel opens'
    );
    await shoot(alice, alicePage, '02-share-panel.png', true);
    const uploadPath = path.join(DATA_DIR, 'syllabus.pdf');
    fs.writeFileSync(uploadPath, `%PDF-1.4 ${MARKER}`);
    const { root } = await alice.send('DOM.getDocument', {}, alicePage);
    const { nodeId } = await alice.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#file' }, alicePage);
    await alice.send('DOM.setFileInputFiles', { files: [uploadPath], nodeId }, alicePage);

    await evaluate(
      alice,
      alicePage,
      `(() => {
        const select = document.getElementById('recipient');
        select.value = 'bob';
        select.dispatchEvent(new Event('change'));
        document.getElementById('share').click();
        return true;
      })()`
    );
    await waitFor(
      alice,
      alicePage,
      "document.getElementById('share-status').textContent.includes('Encrypted and sent')",
      'alice send confirmation'
    );
    await shoot(alice, alicePage, '03-sent.png');

    // The dashboard counts what was sent.
    await waitFor(
      alice,
      alicePage,
      "document.getElementById('count-sent').textContent === '1'",
      'the dashboard counts the share'
    );
    const counts = await evaluate(
      alice,
      alicePage,
      `(() => ({
        sent: document.getElementById('count-sent').textContent,
      }))()`
    );
    assert.strictEqual(counts.sent, '1', 'the dashboard counts the share that was sent');
    console.log('PASS  the dashboard counts the share that was sent');
    console.log('PASS  file encrypted in the browser and sent to bob');

    // The server holds ciphertext only.
    const blobDir = path.join(DATA_DIR, 'blobs');
    const blobs = fs.readdirSync(blobDir);
    assert.ok(blobs.length === 1, 'exactly one ciphertext blob on disk');
    const stored = fs.readFileSync(path.join(blobDir, blobs[0]));
    assert.ok(!stored.includes(MARKER), 'the server must not hold plaintext');
    console.log('PASS  server disk holds ciphertext, not the file');

    // A second file, this one with a self-destruct timer.
    await evaluate(alice, alicePage, "document.getElementById('new-share').click()");
    await evaluate(alice, alicePage, "document.querySelector('[data-expiry=\"3600\"]').click()");
    const secondPath = path.join(DATA_DIR, 'notes.txt');
    fs.writeFileSync(secondPath, 'SECOND-MARKER-77');
    const { root: secondRoot } = await alice.send('DOM.getDocument', {}, alicePage);
    const { nodeId: secondNode } = await alice.send(
      'DOM.querySelector',
      { nodeId: secondRoot.nodeId, selector: '#file' },
      alicePage
    );
    await alice.send('DOM.setFileInputFiles', { files: [secondPath], nodeId: secondNode }, alicePage);
    await evaluate(
      alice,
      alicePage,
      `(() => {
        const select = document.getElementById('recipient');
        select.value = 'bob';
        select.dispatchEvent(new Event('change'));
        document.getElementById('share').click();
        return true;
      })()`
    );
    await waitFor(
      alice,
      alicePage,
      "document.getElementById('count-sent').textContent === '2'",
      'the second file was sent'
    );
    const secondCard = await evaluate(
      alice,
      alicePage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('notes.txt'));
        return card ? card.textContent : '';
      })()`
    );
    assert.ok(
      /expires in \d+ (min|h|days)/.test(secondCard),
      'the card shows the self-destruct timer'
    );
    assert.ok(secondCard.includes('view only'), 'the card shows the permission the sender chose');
    console.log('PASS  the card carries the permission and the self-destruct timer');

    // The sender calls it off before the recipient opens it.
    await evaluate(
      alice,
      alicePage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('notes.txt'));
        [...card.querySelectorAll('button')].find((b) => b.textContent === 'Revoke').click();
        return true;
      })()`
    );
    await waitFor(alice, alicePage, "!!document.querySelector('#cards .badge--dead')", 'the revoked badge');
    const activity = await evaluate(
      alice,
      alicePage,
      `(() => ({
        text: document.getElementById('activity').textContent,
        events: document.querySelectorAll('#activity .activity__item').length,
      }))()`
    );
    assert.ok(activity.text.includes('sent'), 'the activity panel records the send');
    assert.ok(activity.events >= 2, 'the activity panel lists both sends');
    console.log('PASS  the sender revoked the file and the activity panel records what happened');

    // Bob receives and decrypts.
    await evaluate(bob, bobPage, 'refresh()');
    await waitFor(bob, bobPage, "document.querySelectorAll('#cards .card-file').length === 2", 'bob sees two files');
    const bobStats = await evaluate(
      bob,
      bobPage,
      `(() => {
        const cards = [...document.querySelectorAll('#cards .card-file')];
        const dead = cards.find((c) => c.textContent.includes('revoked'));
        const deadButton = dead ? [...dead.querySelectorAll('button')].find((b) => b.textContent === 'Decrypt') : null;
        return {
          inbox: document.getElementById('count-inbox').textContent,
          unread: document.querySelectorAll('.card-file--unread').length,
          title: document.getElementById('view-title').textContent,
          revoked: !!dead,
          revokedDisabled: deadButton ? deadButton.disabled : null,
        };
      })()`
    );
    assert.strictEqual(bobStats.inbox, '2', 'the recipient dashboard counts the incoming shares');
    assert.strictEqual(bobStats.unread, 2, 'both shares are marked unread');
    assert.strictEqual(bobStats.title, 'Shared with me', 'the recipient lands on the inbox view');
    assert.ok(bobStats.revoked, 'the recipient sees that one share was revoked');
    assert.strictEqual(bobStats.revokedDisabled, true, 'a revoked share cannot be opened');
    console.log('PASS  the recipient dashboard shows the incoming shares, one of them revoked');
    await shoot(bob, bobPage, '04-inbox.png');
    await evaluate(
      bob,
      bobPage,
      `(() => {
        window.__captured = null;
        const original = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (blob) => { window.__captured = blob; return original(blob); };
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('syllabus.pdf'));
        [...card.querySelectorAll('button')].find((b) => b.textContent === 'Decrypt').click();
        return true;
      })()`
    );
    await waitFor(bob, bobPage, 'window.__captured !== null', 'bob decrypted a blob');
    const decoded = await evaluate(
      bob,
      bobPage,
      `window.__captured.arrayBuffer().then((buf) => {
        let out = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
        return btoa(out);
      })`
    );
    assert.ok(
      Buffer.from(decoded, 'base64').toString('utf8').includes(MARKER),
      'bob must get the original file back'
    );
    const afterOpen = await evaluate(
      bob,
      bobPage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('syllabus.pdf'));
        return {
          verified: !!card.querySelector('.badge--good'),
          badge: card.querySelector('.badge--good') ? card.querySelector('.badge--good').textContent : '',
          status: document.getElementById('main-status').textContent,
          activity: document.getElementById('activity').textContent,
        };
      })()`
    );
    assert.ok(afterOpen.verified, 'the card shows that the file was verified against the sender fingerprint');
    assert.strictEqual(afterOpen.badge, 'verified');
    assert.ok(afterOpen.status.includes('Verified'), 'the interface says the file was verified');
    assert.ok(afterOpen.status.includes('signature checks out'), 'the sender signature must be checked');
    assert.ok(afterOpen.activity.includes('opened'), 'the activity panel records the open');
    console.log('PASS  recipient decrypted in the browser, verified and signed');
    await shoot(bob, bobPage, '05-decrypted.png');

    // A share protected with a password: the recipient cannot open it without it.
    await evaluate(alice, alicePage, "document.getElementById('new-share').click()");
    await evaluate(alice, alicePage, "document.querySelector('[data-protection=\"password\"]').click()");
    const secretPath = path.join(DATA_DIR, 'locked.txt');
    fs.writeFileSync(secretPath, 'LOCKED-MARKER-99');
    const { root: lockRoot } = await alice.send('DOM.getDocument', {}, alicePage);
    const { nodeId: lockNode } = await alice.send(
      'DOM.querySelector',
      { nodeId: lockRoot.nodeId, selector: '#file' },
      alicePage
    );
    await alice.send('DOM.setFileInputFiles', { files: [secretPath], nodeId: lockNode }, alicePage);
    await evaluate(
      alice,
      alicePage,
      `(() => {
        document.getElementById('share-password').value = 'open-sesame';
        const select = document.getElementById('recipient');
        select.value = 'bob';
        select.dispatchEvent(new Event('change'));
        document.getElementById('share').click();
        return true;
      })()`
    );
    await waitFor(
      alice,
      alicePage,
      "document.getElementById('count-sent').textContent === '3'",
      'the protected file was sent: ' +
        (await evaluate(alice, alicePage, "document.getElementById('share-status').textContent"))
    );
    await evaluate(bob, bobPage, 'refresh()');
    await waitFor(bob, bobPage, "document.querySelectorAll('#cards .card-file').length === 3", 'bob sees the protected file');
    await evaluate(
      bob,
      bobPage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('locked.txt'));
        [...card.querySelectorAll('button')].find((b) => b.textContent === 'Decrypt').click();
        return true;
      })()`
    );
    await waitFor(
      bob,
      bobPage,
      "!document.getElementById('password-dialog').classList.contains('hidden')",
      'the password gate opens'
    );
    await evaluate(
      bob,
      bobPage,
      `(() => {
        document.getElementById('password-input').value = 'wrong-password';
        document.getElementById('password-ok').click();
        return true;
      })()`
    );
    await waitFor(
      bob,
      bobPage,
      "document.getElementById('main-status').textContent.includes('Decrypt failed')",
      'the wrong password is refused'
    );
    await evaluate(
      bob,
      bobPage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('locked.txt'));
        [...card.querySelectorAll('button')].find((b) => b.textContent === 'Decrypt').click();
        return true;
      })()`
    );
    await waitFor(
      bob,
      bobPage,
      "!document.getElementById('password-dialog').classList.contains('hidden')",
      'the password gate opens again'
    );
    await evaluate(
      bob,
      bobPage,
      `(() => {
        window.__captured = null;
        const original = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (blob) => { window.__captured = blob; return original(blob); };
        document.getElementById('password-input').value = 'open-sesame';
        document.getElementById('password-ok').click();
        return true;
      })()`
    );
    await waitFor(bob, bobPage, 'window.__captured !== null', 'the right password opens the file');
    const unlocked = await evaluate(
      bob,
      bobPage,
      `window.__captured.arrayBuffer().then((buf) => {
        let out = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
        return btoa(out);
      })`
    );
    assert.ok(
      Buffer.from(unlocked, 'base64').toString('utf8').includes('LOCKED-MARKER-99'),
      'the right password must open the protected file'
    );
    console.log('PASS  a password protected share refuses the wrong password and opens with the right one');


    // The polish pass: toasts, the file type chip, the filters, the bulk bar,
    // the context menu, the sign-in anatomy and the shortcut list.
    const explainer = await evaluate(
      alice,
      alicePage,
      `(() => {
        const page = document.getElementById('auth');
        return page ? page.textContent.replace(/\\s+/g, ' ').trim() : '';
      })()`
    );
    assert.ok(explainer.length > 400, 'the sign in screen must explain how the encryption works');
    assert.ok(explainer.toLowerCase().includes('ciphertext'), 'the sign in screen must say what the server holds');
    for (const moment of ['Encrypted in your browser', 'The server holds only ciphertext', 'Proved afterwards']) {
      assert.ok(explainer.includes(moment), `the sign in screen must name the moment: ${moment}`);
    }
    assert.ok(
      await evaluate(alice, alicePage, "!!document.querySelector('.code-sample__pre code')"),
      'the sign in screen must show the real encryption code'
    );
    assert.ok(
      await evaluate(alice, alicePage, "document.querySelectorAll('.faq__item').length >= 4"),
      'the sign in screen must answer the questions a visitor asks'
    );
    console.log('PASS  the sign in screen explains how the encryption works');



    await waitFor(
      bob,
      bobPage,
      "[...document.querySelectorAll('#cards .card-file')].some((c) => c.textContent.includes('syllabus.pdf'))",
      'the card is on screen'
    );
    const chip = await evaluate(
      bob,
      bobPage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('syllabus.pdf'));
        const chip = card ? card.querySelector('.file-chip') : null;
        return chip ? chip.textContent.trim() : '';
      })()`
    );
    assert.strictEqual(chip, 'PDF', 'the card must carry a file type chip');
    console.log('PASS  the card carries a file type chip');

    await waitFor(
      bob,
      bobPage,
      "!![...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('syllabus.pdf'))",
      'the card is on screen'
    );
    await evaluate(
      bob,
      bobPage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('syllabus.pdf'));
        const star = [...card.querySelectorAll('button')].find((b) => {
          const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
          return label.includes('star');
        });
        if (star) star.click();
        return true;
      })()`
    );
    await waitFor(bob, bobPage, "!!document.querySelector('#toasts .toast')", 'a toast appears');
    const toast = await evaluate(bob, bobPage, "document.getElementById('toasts').textContent.trim()");
    assert.ok(toast.length > 0, 'the toast must say what happened');
    console.log('PASS  the actions give a toast');

    await evaluate(bob, bobPage, "document.querySelector('[data-filter=\"starred\"]').click()");
    await waitFor(
      bob,
      bobPage,
      "document.querySelectorAll('#cards .card-file').length === 1",
      'the starred filter shows one file'
    );
    const filtered = await evaluate(
      bob,
      bobPage,
      `(() => {
        const card = document.querySelector('#cards .card-file');
        return card ? card.textContent.includes('syllabus.pdf') : false;
      })()`
    );
    assert.ok(filtered, 'the starred filter must show the starred file');
    console.log('PASS  the filter chips narrow the view');

    await evaluate(bob, bobPage, "document.querySelector('[data-filter=\"all\"]').click()");
    await evaluate(
      bob,
      bobPage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('syllabus.pdf'));
        const box = card.querySelector('input[type="checkbox"]');
        box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      })()`
    );
    await waitFor(bob, bobPage, "!document.getElementById('bulk-bar').classList.contains('hidden')", 'the bulk bar appears');
    const bulk = await evaluate(bob, bobPage, "document.getElementById('bulk-count').textContent.trim()");
    assert.ok(/1/.test(bulk), 'the bulk bar must count the selection');
    console.log('PASS  the bulk bar appears with the count');

    await evaluate(
      bob,
      bobPage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('syllabus.pdf'));
        card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }));
        return true;
      })()`
    );
    await waitFor(bob, bobPage, "!document.getElementById('card-menu').classList.contains('hidden')", 'the context menu opens');
    await evaluate(bob, bobPage, "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    await waitFor(bob, bobPage, "document.getElementById('card-menu').classList.contains('hidden')", 'the context menu closes');
    console.log('PASS  a card has a context menu that closes on Escape');

    await evaluate(bob, bobPage, "document.getElementById('shortcuts-button').click()");
    await waitFor(
      bob,
      bobPage,
      "!document.getElementById('shortcuts-panel').classList.contains('hidden')",
      'the shortcut list opens'
    );
    const shortcuts = await evaluate(bob, bobPage, "document.getElementById('shortcuts-panel').textContent");
    assert.ok(shortcuts.includes('/') && shortcuts.includes('j'), 'the shortcut list must name the keys');
    console.log('PASS  the shortcut list opens and names the keys');

    // The details panel must show the whole chain for one file, not just its
    // name: the fingerprint, the signature, what the server really stored and
    // how the file was protected.
    await evaluate(
      bob,
      bobPage,
      `(() => {
        const card = [...document.querySelectorAll('#cards .card-file')].find((c) => c.textContent.includes('syllabus.pdf'));
        const name = card ? card.querySelector('.card-file__name') : null;
        if (name) name.click();
        return true;
      })()`
    );
    await waitFor(
      bob,
      bobPage,
      "!document.getElementById('preview-dialog').classList.contains('hidden')",
      'the details panel opens'
    );
    const chain = await evaluate(
      bob,
      bobPage,
      `(() => {
        const read = (id) => (document.getElementById(id) || {}).textContent || '';
        return {
          digest: read('preview-digest').trim(),
          signature: read('preview-signature').trim(),
          stored: read('preview-stored').trim(),
          protection: read('preview-protection').trim(),
        };
      })()`
    );
    assert.ok(/^[0-9a-f]{64}$/.test(chain.digest), 'the details panel must show the sha-256 fingerprint');
    assert.ok(chain.signature.includes('ECDSA'), 'the details panel must name the signature');
    assert.ok(/of ciphertext \(\d+ bytes\)/.test(chain.stored), 'the details panel must say how many bytes the server holds');
    assert.ok(chain.protection.length > 5, 'the details panel must say how the file was protected');
    console.log('PASS  the details panel shows the whole chain for a file');

    // The receipt is the artefact a reviewer reads, so it must be copyable.
    await evaluate(bob, bobPage, "document.getElementById('preview-receipt').click()");
    await waitFor(
      bob,
      bobPage,
      "[...document.querySelectorAll('#toasts .toast')].some((t) => t.textContent.includes('receipt'))",
      'the receipt toast appears'
    );
    await evaluate(bob, bobPage, "document.getElementById('preview-close').click()");
    console.log('PASS  the security receipt can be copied');

    // A file that arrives while the page is open must be announced.
    await evaluate(
      alice,
      alicePage,
      `(async () => {
        const response = await fetch('/api/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: 'bob',
            filename: 'arrived.pdf',
            size: 12,
            permission: 'view',
            digest: 'a'.repeat(64),
            iv: 'AAAAAAAAAAAAAAAA',
            wrappedKey: 'AAAA',
            ciphertext: 'AAAA',
          }),
        });
        return response.status;
      })()`
    );
    await evaluate(bob, bobPage, "window.__watch()");
    await waitFor(
      bob,
      bobPage,
      "[...document.querySelectorAll('#toasts .toast')].some((t) => t.textContent.includes('arrived.pdf'))",
      'the arrival is announced'
    );
    console.log('PASS  a file that arrives is announced');

    // The second factor is on, because every sign-in demands one. It is not a
    // switch: the settings offer no way to remove it, and the server refuses.
    await evaluate(alice, alicePage, "document.getElementById('settings-open').click()");
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('settings-panel').classList.contains('hidden')",
      'the settings dialog opens'
    );
    await waitFor(
      alice,
      alicePage,
      "document.getElementById('totp-state').textContent.includes('always asks')",
      'the factor is on'
    );
    const noSwitch = await evaluate(
      alice,
      alicePage,
      "document.getElementById('totp-disable') === null"
    );
    assert.ok(noSwitch, 'the settings must not offer a switch to turn the second factor off');
    const refused = await evaluate(
      alice,
      alicePage,
      "fetch('/api/totp/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '000000' }) }).then((r) => r.status)"
    );
    assert.strictEqual(refused, 403, 'the server must refuse to turn the second factor off');
    const factorOn = await evaluate(
      alice,
      alicePage,
      "(async () => (await (await fetch('/api/totp')).json()).enabled)()"
    );
    assert.strictEqual(factorOn, true, 'the account must ask for a code after this');
    console.log('PASS  the second factor is on and cannot be turned off');

    // Signing out asks for nothing. The session ends on one click, and the
    // sign in page comes back.
    await evaluate(bob, bobPage, "document.getElementById('logout').click()");
    await waitFor(
      bob,
      bobPage,
      "!document.getElementById('auth').classList.contains('hidden')",
      'the sign in page is back after signing out'
    );
    const signedOut = await evaluate(bob, bobPage, "fetch('/api/me').then((r) => r.status)");
    assert.strictEqual(signedOut, 401, 'the session must be gone after signing out');
    console.log('PASS  signing out needs no code, and the session ends');

    // The authenticator alone opens the account: the phone holds the secret,
    // so the six digits it shows are the proof.
    await evaluate(alice, alicePage, "document.getElementById('logout').click()");
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('auth').classList.contains('hidden')",
      'the sign in page is back before the code sign in'
    );
    await evaluate(
      alice,
      alicePage,
      `(() => {
        document.getElementById('code-toggle').click();
        document.getElementById('code-username').value = 'alice';
        document.getElementById('code-value').value = ${JSON.stringify(
          totp.codeAt(enrolSecret, Math.floor(Date.now() / 1000 / 30))
        )};
        document.getElementById('code-form').requestSubmit();
        return true;
      })()`
    );
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('app').classList.contains('hidden') && document.getElementById('who').textContent === 'alice'",
      'the code alone opens the account'
    );
    console.log('PASS  the authenticator code alone opens the account');

    // The phone is lost: the email on the account proves it, and the
    // authenticator is replaced with a new one the phone scans again.
    await evaluate(alice, alicePage, "document.getElementById('logout').click()");
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('auth').classList.contains('hidden')",
      'the sign in page is back before the relink'
    );
    await evaluate(
      alice,
      alicePage,
      `(() => {
        document.getElementById('relink-toggle').click();
        document.getElementById('relink-username').value = 'alice';
        document.getElementById('relink-form').requestSubmit();
        return true;
      })()`
    );
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('relink-code-field').classList.contains('hidden')",
      'the relink asks for the code from the email'
    );
    const relinkNote = await evaluate(
      alice,
      alicePage,
      "document.getElementById('relink-note').textContent"
    );
    const mailCode = relinkNote.match(/(\d{6})/);
    assert.ok(mailCode, 'the demo mode must show the code that was sent to the email');
    await evaluate(
      alice,
      alicePage,
      `(() => {
        document.getElementById('relink-code').value = ${JSON.stringify(mailCode[1])};
        document.getElementById('relink-form').requestSubmit();
        return true;
      })()`
    );
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('relink-qr-block').classList.contains('hidden')",
      'the new authenticator is shown to scan'
    );
    const relinkQr = await evaluate(
      alice,
      alicePage,
      "document.querySelectorAll('#relink-qr svg rect, #relink-qr svg path').length"
    );
    assert.ok(relinkQr > 0, 'the relink must show a code the phone can scan');
    const newSecret = await evaluate(
      alice,
      alicePage,
      "document.getElementById('relink-secret').textContent.trim()"
    );
    // The new phone opens the account, and the lost one cannot.
    await evaluate(
      alice,
      alicePage,
      `(() => {
        document.getElementById('code-toggle').click();
        document.getElementById('code-username').value = 'alice';
        document.getElementById('code-value').value = ${JSON.stringify(
          totp.codeAt(newSecret, Math.floor(Date.now() / 1000 / 30))
        )};
        document.getElementById('code-form').requestSubmit();
        return true;
      })()`
    );
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('app').classList.contains('hidden') && document.getElementById('who').textContent === 'alice'",
      'the relinked phone opens the account'
    );
    console.log('PASS  a lost authenticator is relinked by the email, and the new one opens the account');

    // A reload must not cost a sign-in: the session cookie lasts a week.
    await alice.send('Page.navigate', { url: SITE }, alicePage);
    await waitFor(
      alice,
      alicePage,
      "!document.getElementById('app').classList.contains('hidden')",
      'the session survives a reload'
    );
    const stillMe = await evaluate(alice, alicePage, "document.getElementById('who').textContent");
    assert.ok(stillMe.length > 0, 'the workspace shows who is signed in after a reload');
    console.log('PASS  a reload keeps the session, so there is no second sign-in');

    // The 3D scene: the whole trip of one file. It must draw and it must move.
    await alice.send('Page.navigate', { url: SITE + '/figure/journey.html' }, alicePage);
    await waitFor(alice, alicePage, '!!window.__journey', 'the scene loads');
    const scene = await evaluate(
      alice,
      alicePage,
      `(async () => {
        const seen = new Set();
        for (let i = 0; i < 16; i++) {
          seen.add(window.__journey.step() + ':' + Math.round(window.__journey.capsuleX()));
          await new Promise((r) => setTimeout(r, 250));
        }
        return JSON.stringify({ states: seen.size, labels: window.__journey.labels() });
      })()`
    );
    const read = JSON.parse(scene);
    assert.ok(read.states >= 2, 'the capsule must travel across the bench');
    assert.ok(read.labels >= 8, 'the scene must label the parts');
    console.log('PASS  the 3D scene draws, labels the parts and moves the file across the boundary');

    console.log('\nALL BROWSER CHECKS PASSED');
  } finally {
    alice.close();
    bob.close();
    aliceChrome.child.kill();
    bobChrome.child.kill();
    server.close();
    await delay(500);
    for (const dir of [DATA_DIR, aliceProfile, bobProfile]) {
      try {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch (err) {
        // Chrome can still hold a lock on its profile for a moment; a leftover temp
        // directory must not fail the test.
      }
    }
  }
})().catch((err) => {
  console.error('FAIL ', err.message);
  process.exit(1);
});
