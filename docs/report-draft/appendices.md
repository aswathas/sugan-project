# Appendices

## Appendix 1 Listing of the Programs Used

The prototype consists of ten source files. Each is listed below with the part it plays and what it does. No third-party library is used anywhere in the listing; every module is written against the Node.js standard library or the browser's built-in APIs.

Table A1.1 Programs that make up the prototype

| Program | Language and platform | What it does |
|---|---|---|
| `package.json` | JSON | Declares the project, the Node.js engine requirement and the three scripts: `start`, `test` and `test:browser`. It deliberately declares no dependencies. |
| `server/index.js` | JavaScript, Node.js (`node:http`, `node:crypto`, `node:fs`, `node:path`) | The HTTP server. Serves the static client, implements the registration, verification, sign-in, sign-out, user listing, share creation, share listing, share metadata and blob endpoints, manages sessions and cookies, and enforces that only the sender or the recipient may read a share. |
| `server/store.js` | JavaScript, Node.js (`node:fs`, `node:path`) | The persistence layer. Loads and saves the JSON store, and writes and reads ciphertext blobs in the blob directory. The data directory can be overridden for tests, so a test run never touches demonstration data. |
| `server/crypto.js` | JavaScript, Node.js (`node:crypto`) | Password hashing with scrypt and a per-user salt, constant-time password verification, and generation of opaque session tokens. |
| `server/mailer.js` | JavaScript, Node.js | Delivers the six-digit one-time code. In the default console mode it prints the code in the server terminal, so no external service is needed and the demo works offline. In the optional Resend mode, selected by an environment variable, it sends the code through a free email provider. |
| `public/index.html` | HTML | The interface markup: the sign-in and registration tabs, the verification form, the session header, the share panel, the inbox and the sent list. |
| `public/app.js` | JavaScript, browser (Web Crypto, IndexedDB, Fetch, Blob) | The client logic. Generates the RSA-OAEP key pair, stores the non-extractable private key in IndexedDB, publishes the public key, encrypts a file with AES-GCM, wraps the AES key with the recipient's public key, uploads the share, downloads the ciphertext, unwraps and decrypts it, and renders the inbox and the sent list. It also computes the public-key fingerprint shown beside the recipient selector. |
| `public/style.css` | CSS | The layout and appearance of the interface: the three-panel arrangement, the forms and the file lists. |
| `test/selftest.js` | JavaScript, Node.js (`node:crypto` Web Crypto) | The server-contract test. Registers three users, checks the unverified and wrong-code cases, publishes and compares public keys, encrypts a file for one user, uploads it, checks that the stored blob contains no plaintext, decrypts it as the recipient, and checks that the third user is refused with 403. Runs against a temporary data directory. |
| `test/browsertest.js` | JavaScript, Node.js (`node:child_process`, built-in WebSocket) | The interface test. Launches Chrome or Edge in headless mode with two separate profiles, drives the real forms and buttons over the DevTools protocol, checks that the stored private key is non-extractable, sends a PDF, checks that the blob on disk is ciphertext, has the recipient decrypt through the interface, and captures the screenshots used in Chapter 4. |

The separation of `server/index.js` from `server/store.js`, `server/crypto.js` and `server/mailer.js` is intentional. The HTTP interface, the persistence, the password and token primitives and the code delivery can each be read and checked on its own. The client is separated in the same way: `index.html` holds the structure, `app.js` holds the behaviour and `style.css` holds the appearance.

## Appendix 2 Raw Data from the Test Runs

The two commands below were executed on the development machine. The output is reproduced as printed, including the pass lines.

### A2.1 Node self-test

Command: `npm test`

The test starts the server on an ephemeral port, registers three users, and prints the following lines on success.

```
PASS  register + email one-time code verification
PASS  unverified account cannot sign in, wrong code rejected
PASS  register + login + keypair publish
PASS  encrypt in browser, server stores ciphertext only
PASS  recipient decrypts to the original bytes
PASS  third party cannot list or fetch the share (403)
PASS  wrong password rejected (401)
```

The assertions behind these lines are the ones listed in Table 4.1 as TC-01 to TC-11. Each line is printed only after the corresponding assertion has been checked with the Node.js `assert` module; an assertion failure ends the run with a `FAIL` line and a non-zero exit status.

### A2.2 Headless browser test

Command: `npm run test:browser`

The test requires Chrome or Edge on the machine. If neither is present, it prints a skip line and exits without failing. When a browser is present, it launches two profiles, drives the interface, and prints the following lines on success.

```
PASS  two users registered in two separate browser profiles
PASS  private key lives in the browser, non-extractable
PASS  file encrypted in the browser and sent to bob
PASS  server disk holds ciphertext, not the file
PASS  recipient decrypted in the browser to the original bytes

ALL BROWSER CHECKS PASSED
```

These checks correspond to TC-12 to TC-15 in Table 4.1. The test plants a marker string in the PDF before sending it, then asserts that the marker does not appear in the stored blob; this is the basis of the fourth line. It reads the stored `CryptoKey` from IndexedDB and asserts that its `extractable` property is `false`; this is the basis of the second line.

### A2.3 Environment

Table A2.1 records the environment in which the runs were made.

Table A2.1 Test environment

| Item | Value |
|---|---|
| Operating system | Windows |
| Runtime | Node.js 18 or later; tested on Node 23 |
| Browser used for the headless test | Chrome or Edge, whichever was present on the machine |
| Test driver | The DevTools protocol over Node's built-in WebSocket, with no test dependency |
| Data directory during tests | A temporary directory, removed after the run |
| External services | None; the one-time code is delivered by the default console mailer |

The use of temporary data directories means that repeated test runs do not accumulate state and do not interfere with the JSON store or the blobs used for a demonstration. Each run starts from an empty store, so every result reported above was produced from a clean starting condition.
