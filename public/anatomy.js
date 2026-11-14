'use strict';

// The anatomy of the product: the workspace, three moments, the real code,
// the questions a visitor asks, and the action at the close. It is written
// once here, as data, and mounted wherever it belongs - on the sign in page,
// and in the how-it-works panel once you are inside the workspace. One copy
// of the truth, two places it lives.

const ANATOMY = {
  workspace: {
    tab: 'The workspace',
    heading: 'What you sign into',
    src: 'shots/workspace.png',
    width: 1262,
    height: 804,
    alt: 'Signed-in SecureShare workspace showing Shared with me, Sent by me, and the ciphertext comparison panel',
    caption:
      'The workspace with shared-with-me, sent-by-me, and the tamper-evident audit trail.',
  },
  moments: {
    tab: 'How a share moves',
    heading: 'Three moments from send to receipt',
    items: [
      {
        title: 'Encrypted in your browser',
        body:
          'Before upload begins, your browser hashes the file, encrypts it with a fresh 256-bit AES-GCM key, and wraps that key to the recipient’s RSA-OAEP public key.',
        kind: 'send',
        src: 'shots/encrypted.png',
        width: 1247,
        height: 2185,
        alt: 'New share panel with file chooser, recipient public key fingerprint, permission, self-destruct timer, and Encrypt and send button',
      },
      {
        title: 'The server holds only ciphertext',
        body:
          'Only the encrypted bytes, wrapped key, IV, and share metadata reach the server, shown beside the original header bytes in the cipher strip.',
        kind: 'cipher',
        src: 'shots/encrypted.png',
        width: 1247,
        height: 2185,
        alt: 'What the server actually stored panel comparing your file bytes with the ciphertext stored on the server',
      },
      {
        title: 'Proved afterwards',
        body:
          'After decryption, the recipient’s browser recomputes the SHA-256 fingerprint and verifies the sender’s ECDSA signature, marking the card verified.',
        kind: 'verified',
        src: 'shots/verified.png',
        width: 1262,
        height: 804,
        alt: 'Recipient inbox showing syllabus.pdf marked verified after decryption and fingerprint check',
      },
    ],
  },
  code: {
    tab: 'The code',
    heading: 'Real browser cryptography, not promises',
    label: 'Sample: browser encryption before upload',
    ref: 'public/app.js · the send path',
    source: [
      'const digest = await sha256Hex(plain);',
      '',
      "const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);",
      'const iv = crypto.getRandomValues(new Uint8Array(12));',
      "const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, plain);",
      "const rawAes = await crypto.subtle.exportKey('raw', aes);",
      "const publicKey = await crypto.subtle.importKey('spki', fromB64(target.publicKey), RSA, false, ['encrypt']);",
      '',
      "const wrappedKey = toB64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes));",
      '// and, when the sender sets a password, the same key wrapped a second time:',
      'const passwordWrappedKey = (await KeyGuard.wrapWithPassword(aes, password)).wrappedKey;',
    ].join('\n'),
  },
  cipher: {
    tab: 'Running',
    heading: 'The same encryption, running here',
    body:
      'This is not a picture. The bytes on the right were produced by this browser, with the Web Crypto API, a moment before you read this line.',
  },
  faq: {
    heading: 'Questions before you sign up',
    items: [
      {
        q: 'Does the server ever see my file?',
        a: 'No. Your browser hashes the plaintext with SHA-256, encrypts the bytes with a new 256-bit AES-GCM key, and wraps that key to the recipient’s RSA-OAEP public key before uploading. The server stores only ciphertext and metadata.',
      },
      {
        q: 'What happens if I lose my device?',
        a: 'During registration your browser generates a 12-word recovery phrase, encrypts your private key with a key derived from that phrase via PBKDF2-SHA-256, and uploads the encrypted backup. On a new device, click “Restore my key on a new device” when signing in; the phrase itself never goes to the server and cannot be reset.',
      },
      {
        q: 'Can the sender read the file after sending it?',
        a: 'Not from the server. The file key is wrapped only to the recipient’s public key (and optionally to a share password of at least 10 characters), so the sender’s private key cannot decrypt the server copy. The sender can still revoke an unopened share or delete it.',
      },
      {
        q: 'What does it cost?',
        a: 'Nothing. SecureShare is free to use, with no card required, and runs encryption directly in your browser using the Web Crypto API.',
      },
      {
        q: 'How does the recipient know the file was not altered?',
        a: 'After decrypting the ciphertext, the recipient’s browser recomputes the SHA-256 digest and verifies the sender’s ECDSA P-256 signature over the parties, filename, size, digest, IV, permission, and expiry.',
      },
      {
        q: 'Can I add a second factor to my account?',
        a: 'Yes. The Two-factor button in the header turns on Google Authenticator, and the account then needs both your password and the six digit code the app shows. The code needs no network and no mail service, and turning the factor off needs a code as well.',
      },
    ],
  },
  close: {
    heading: 'Create your key pair and send a file',
    body: 'Your browser generates your RSA-OAEP and signing keys as soon as you register.',
    action: 'Create an account',
  },
};

// A small element builder, so the markup comes out of the data instead of
// being copied into the page a second time.
function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null) continue;
    if (key === 'class') node.className = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function renderAnatomy(mount, data = ANATOMY, prefix = 'anatomy') {
  if (!mount) return null;
  const id = (name) => `${prefix}-${name}`;
  mount.replaceChildren();

  const w = data.workspace;
  mount.append(
    el(
      'section',
      { class: 'auth__section', 'aria-labelledby': id('work-heading') },
      el(
        'div',
        { class: 'auth__section-head' },
        el('span', { class: 'tab' }, w.tab),
        el('h2', { id: id('work-heading') }, w.heading)
      ),
      el(
        'figure',
        { class: 'shot' },
        el('img', {
          class: 'shot__img',
          src: w.src,
          width: w.width,
          height: w.height,
          alt: w.alt,
        }),
        el('figcaption', { class: 'shot__caption' }, w.caption)
      )
    )
  );

  const m = data.moments;
  mount.append(
    el(
      'section',
      { class: 'auth__section', 'aria-labelledby': id('moments-heading') },
      el(
        'div',
        { class: 'auth__section-head' },
        el('span', { class: 'tab' }, m.tab),
        el('h2', { id: id('moments-heading') }, m.heading)
      ),
      el(
        'div',
        { class: 'moments' },
        m.items.map((item) =>
          el(
            'article',
            { class: 'moment' },
            el(
              'div',
              { class: 'moment__body' },
              el('h3', {}, item.title),
              el('p', {}, item.body)
            ),
            el(
              'div',
              { class: `moment__frame moment__frame--${item.kind}` },
              el('img', {
                class: `moment__img moment__img--${item.kind}`,
                src: item.src,
                width: item.width,
                height: item.height,
                alt: item.alt,
              })
            )
          )
        )
      )
    )
  );

  const c = data.code;
  mount.append(
    el(
      'section',
      { class: 'auth__section', 'aria-labelledby': id('code-heading') },
      el(
        'div',
        { class: 'auth__section-head' },
        el('span', { class: 'tab' }, c.tab),
        el('h2', { id: id('code-heading') }, c.heading)
      ),
      el(
        'div',
        { class: 'code-sample' },
        el(
          'div',
          { class: 'code-sample__head' },
          el('span', {}, c.label),
          el('span', { class: 'code-sample__ref' }, c.ref)
        ),
        el('pre', { class: 'code-sample__pre' }, el('code', {}, c.source))
      )
    )
  );

  if (data.cipher) {
    const field = el('div', { class: 'cipher-field__mount' });
    mount.append(
      el(
        'section',
        { class: 'auth__section', 'aria-labelledby': id('cipher-heading') },
        el(
          'div',
          { class: 'auth__section-head' },
          el('span', { class: 'tab' }, data.cipher.tab),
          el('h2', { id: id('cipher-heading') }, data.cipher.heading),
          el('p', { class: 'auth__claim' }, data.cipher.body)
        ),
        field
      )
    );
    // The field draws itself with WebGL and encrypts a real sample.
    if (window.CipherField) window.CipherField.mount(field);
  }

  const f = data.faq;
  mount.append(
    el(
      'section',
      { class: 'auth__section', 'aria-labelledby': id('faq-heading') },
      el('div', { class: 'auth__section-head' }, el('h2', { id: id('faq-heading') }, f.heading)),
      el(
        'div',
        { class: 'faq' },
        f.items.map((item) =>
          el(
            'details',
            { class: 'faq__item' },
            el('summary', { class: 'faq__q' }, item.q),
            el('p', { class: 'faq__a' }, item.a)
          )
        )
      )
    )
  );

  if (data.close) {
    mount.append(
      el(
        'section',
        { class: 'auth__close', 'aria-labelledby': id('close-heading') },
        el(
          'div',
          { class: 'auth__close-copy' },
          el('h2', { id: id('close-heading') }, data.close.heading),
          el('p', {}, data.close.body)
        ),
        el(
          'button',
          { class: 'btn btn--primary', type: 'button', 'data-anatomy-action': 'register' },
          data.close.action
        )
      )
    );
  }

  return mount;
}

// The close of the anatomy is the action: it turns to the register tab.
function wireClose(scope) {
  const trigger = scope && scope.querySelector('[data-anatomy-action="register"]');
  if (!trigger) return;
  trigger.addEventListener('click', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const verifyForm = document.getElementById('verify-form');
    const tabs = document.getElementById('tabs');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const username = document.getElementById('register-username');

    if (tabs) tabs.classList.remove('hidden');
    if (verifyForm) verifyForm.classList.add('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.remove('hidden');
    if (tabLogin) tabLogin.setAttribute('aria-pressed', 'false');
    if (tabRegister) tabRegister.setAttribute('aria-pressed', 'true');
    if (username) {
      username.scrollIntoView({ block: 'center' });
      username.focus();
    }
  });
}

// The same anatomy, opened from inside the workspace.
function open() {
  const dialog = document.getElementById('anatomy-dialog');
  const body = document.getElementById('anatomy-dialog-body');
  if (!dialog || !body) return;
  renderAnatomy(body, { ...ANATOMY, close: null, cipher: null }, 'anatomy-app');
  dialog.classList.remove('hidden');
  const closer = document.getElementById('anatomy-close');
  if (closer) closer.focus();
}

function close() {
  const dialog = document.getElementById('anatomy-dialog');
  if (!dialog) return;
  dialog.classList.add('hidden');
}

function isOpen() {
  const dialog = document.getElementById('anatomy-dialog');
  return Boolean(dialog && !dialog.classList.contains('hidden'));
}

window.Anatomy = { ANATOMY, renderAnatomy, open, close, isOpen };

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('anatomy');
  if (mount) {
    renderAnatomy(mount, ANATOMY, 'anatomy');
    wireClose(mount);
  }
  const trigger = document.getElementById('how-it-works');
  if (trigger) trigger.addEventListener('click', open);
  const closer = document.getElementById('anatomy-close');
  if (closer) closer.addEventListener('click', close);
  const dialog = document.getElementById('anatomy-dialog');
  if (dialog) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
  }
});
