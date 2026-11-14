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
      const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
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

async function shoot(cdp, sessionId, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
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
  await evaluate(
    cdp,
    sessionId,
    `(() => {
      document.getElementById('tab-register').click();
      document.getElementById('register-username').value = ${JSON.stringify(username)};
      document.getElementById('register-email').value = ${JSON.stringify(username)} + '@example.com';
      document.getElementById('register-password').value = 'correct-horse';
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
}

(async () => {
  await new Promise((resolve) => (server.listening ? resolve() : server.on('listening', resolve)));
  const PORT = server.address().port;
  SITE = `http://127.0.0.1:${PORT}`;

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
    await shoot(alice, alicePage, '02-share-panel.png');
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
    console.log('PASS  file encrypted in the browser and sent to bob');

    // The server holds ciphertext only.
    const blobDir = path.join(DATA_DIR, 'blobs');
    const blobs = fs.readdirSync(blobDir);
    assert.ok(blobs.length === 1, 'exactly one ciphertext blob on disk');
    const stored = fs.readFileSync(path.join(blobDir, blobs[0]));
    assert.ok(!stored.includes(MARKER), 'the server must not hold plaintext');
    console.log('PASS  server disk holds ciphertext, not the file');

    // Bob receives and decrypts.
    await evaluate(bob, bobPage, 'refresh()');
    await waitFor(bob, bobPage, "document.querySelectorAll('#inbox li').length === 1", 'bob sees one file');
    await shoot(bob, bobPage, '04-inbox.png');
    await evaluate(
      bob,
      bobPage,
      `(() => {
        window.__captured = null;
        const original = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (blob) => { window.__captured = blob; return original(blob); };
        document.querySelector('#inbox li button').click();
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
    console.log('PASS  recipient decrypted in the browser to the original bytes');
    await shoot(bob, bobPage, '05-decrypted.png');

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
