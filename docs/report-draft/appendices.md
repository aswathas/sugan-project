# Appendices

## Appendix 1 Listing of the Programs Used

The prototype consists of the files listed below, grouped into the application itself and the programs that test and build it. No third-party library is used anywhere in the listing; every module is written against the Node.js standard library or the browser's built-in APIs.

Table A1.1 Programs that make up the prototype

| File | Lines | What it is |
|---|---|---|
| `package.json` | 17 | Declares the project, the Node.js engine requirement and the scripts `start`, `test`, `test:browser`, `test:live`, `test:all` and `show:ciphertext`. It deliberately declares no dependencies. |
| `server/index.js` | 721 | The HTTP server: static files, registration, verification, sign-in and sign-out, sessions, the share lifecycle (create, list, metadata, blob, star, delete, restore, purge, revoke, opened), the activity trail, the key backup and recovery endpoints, and the security headers on every response. |
| `server/store.js` | 53 | The persistence layer: loads and saves the JSON store, reads and writes the ciphertext blobs. The data directory can be overridden, so a test run never touches demonstration data. |
| `server/crypto.js` | 20 | Password hashing with scrypt and a per-user salt, constant-time verification, and opaque session tokens. |
| `server/mailer.js` | 38 | Delivers the six-digit one-time code. The default console mode prints it in the server terminal, so the demo needs no external service. The optional Resend mode sends it by email. |
| `server/google.js` | 70 | Verifies a Google identity token against Google's published keys with `node:crypto`: RS256, the issuer, the audience, the expiry and the signature are all checked, and the keys are cached for an hour. No client secret is used anywhere. |
| `server/trail.js` | 50 | The audit trail. Each event carries the SHA-256 of the event before it, so the log is a chain that can be walked and proved. |
| `public/index.html` | 459 | The interface markup: the sign-in page, the file-drive workspace (the rail with its counts, the search band, the grid or list of file cards with type chips and permission badges, the send panel, the activity panel) and the three overlays. |
| `public/app.js` | 2184 | The client logic: the key pair in the browser, the non-extractable private key in IndexedDB, the encryption, the key wrapping, the signature, the upload, the download, the decryption, the dashboard rendering, the filters, the bulk actions and the audit trail view. |
| `public/keyguard.js` | 194 | The three extra keys: the ECDSA signing key, the AES-KW password wrap, and the twelve-word recovery phrase that unlocks the private key on a new device. |
| `public/style.css` | 1617 | The appearance of the application: the Wayfind theme, the workspace layout, the cards, the overlays and the dark theme. It imports `public/tokens.css` (the tokens) and `public/base.css` (the reset). |

Table A1.2 Test programs and build programs

| File | What it is |
|---|---|
| `test/selftest.js` | The server-contract test. Starts the server on an ephemeral port against a temporary data directory and drives the whole contract: registration and the one-time code, the demo access code, the encryption path, the ciphertext on disk, the unauthorised third party, expiry, revocation, starring, the trash, the audit chain, the lockout and the sign-out. 19 checks. |
| `test/googletest.js` | The Google verification test. Serves its own public keys and proves the server refuses a token with the wrong audience, the wrong issuer, an expired token, a tampered token, a forged token and a malformed one. 4 checks. |
| `test/browsertest.js` | The interface test. Launches Chrome or Edge in headless mode with two separate profiles, drives the real forms and buttons over the DevTools protocol, and checks the dashboard, the counts, the evidence panel, the permission and the self-destruct badge, the revocation, the signature, the password protection, the toast, the filters, the bulk bar, the context menu and the shortcut list. 22 checks. It also captures the screenshots used in Chapter 4. |
| `test/livecheck.js` | The read-only check against a server that is already running: the site, the assets, the security headers, the published configuration, the access-code gate and the session gates. 15 checks. |
| `tools/test-all.js` | Runs every check in the project in the order a reviewer would, and says how many steps passed. 10 steps. |
| `tools/build-report.js`, `tools/build-deliverables.js`, `tools/build-deck.js` | The builders for the report and the deck. They live outside the application on purpose: the application stays dependency-free. |
| `tools/show-ciphertext.js` | Prints the bytes the server really holds for a share, next to the bytes the sender started with. |
| `render.yaml` | The deployment description for a free host. It names the service so the address is known before the service exists, which is what lets the OAuth origins be written down in advance. |

The separation of `server/index.js` from `server/store.js`, `server/crypto.js`, `server/trail.js`, `server/mailer.js` and `server/google.js` is intentional. The HTTP interface, the persistence, the password and token primitives, the audit chain, the code delivery and the Google verification can each be read and checked on its own. The client is separated in the same way: `index.html` holds the structure, `app.js` holds the behaviour, `style.css` holds the appearance and `keyguard.js` holds the three keys. The test programs and the builders sit outside the application for the same reason: the tests drive the contract, the interface and a running service without being installed beside the application, and the builders produce the report and the deck while the application itself still installs nothing.

## Appendix 2 Raw Data from the Test Runs

The four commands below were executed on the development machine. The output is reproduced as printed, including the pass lines.

### A2.1 Node self-test and the Google verification

Command: `npm test`

The test starts the server on an ephemeral port, registers its users, and prints the following lines on success.

```
PASS  register + email one-time code verification
PASS  unverified account cannot sign in, wrong code rejected
PASS  register + login + keypair publish
PASS  encrypt in browser, server stores ciphertext only
PASS  recipient decrypts to the original bytes
PASS  third party cannot list or fetch the share (403)
PASS  wrong password rejected (401)
PASS  the demo access code gates registration (403 without it, 201 with it)
PASS  an expired share gives up its bytes (410) and says so
PASS  the sender can revoke, the recipient cannot, and an opened share is too late
PASS  the activity trail records the sends and the revoke, and hides other people
PASS  the audit trail is a hash chain and it checks out
PASS  repeated failed sign-ins and wrong codes are locked out
PASS  signing out everywhere ends every session of the account
PASS  starring is per user, and delete, restore and purge behave
PASS  the headers and the favicon leave the Google button working
PASS  the client id is published for the browser
PASS  a valid Google token signs the user in and stores the key pair
PASS  an existing account keeps the key it already published
PASS  wrong audience, wrong issuer, expired, tampered, forged and malformed tokens are all refused
```

The assertions behind these lines are the ones listed in Table 4.1 as TC-01 to TC-11, TC-16 to TC-27 and TC-32 to TC-37. A line is printed only after its assertion has passed: each condition is checked with the Node.js `assert` module, and an assertion failure ends the run with a `FAIL` line and a non-zero exit status before the pass lines are printed.

### A2.2 Headless browser test

Command: `npm run test:browser`

The test requires Chrome or Edge on the machine. If neither is present, it prints a skip line and exits without failing. When a browser is present, it launches two profiles, drives the interface, and prints the following lines on success.

```
PASS  alice has a twelve word recovery phrase and a wrapped key on the server
PASS  bob has a twelve word recovery phrase and a wrapped key on the server
PASS  two users registered in two separate browser profiles
PASS  the Google sign-in button is wired to the client id and the origin the server publishes
PASS  private key lives in the browser, non-extractable
PASS  the dashboard counts the share and the evidence panel shows different bytes
PASS  file encrypted in the browser and sent to bob
PASS  server disk holds ciphertext, not the file
PASS  the card carries the permission and the self-destruct timer
PASS  the sender revoked the file and the activity panel records what happened
PASS  the recipient dashboard shows the incoming shares, one of them revoked
PASS  recipient decrypted in the browser, verified and signed
PASS  a password protected share refuses the wrong password and opens with the right one
PASS  the sign in screen explains how the encryption works
PASS  the card carries a file type chip
PASS  the actions give a toast
PASS  the filter chips narrow the view
PASS  the bulk bar appears with the count
PASS  a card has a context menu that closes on Escape
PASS  the shortcut list opens and names the keys

ALL BROWSER CHECKS PASSED
```

These checks correspond to TC-12 to TC-15, TC-28 to TC-31 and TC-38 to TC-45 in Table 4.1, and a line is printed only after its assertion has passed. The test plants a marker string in the PDF before sending it, then asserts that the marker does not appear in the stored blob; this is the basis of the eighth line. It reads the stored `CryptoKey` from IndexedDB and asserts that its `extractable` property is `false`; this is the basis of the fifth line.

### A2.3 Live check against a running server

Command: `npm run test:live`

The check reads a server that is already running and changes nothing. It fetches the page and its assets, reads the security headers on the response, reads the published configuration, confirms that registration is refused while the access code is required, and confirms that every endpoint that needs a session refuses without one. It prints the following lines on success.

```
PASS  the site is served
PASS  the stylesheet is served
PASS  the script is served
PASS  the key module is served
PASS  the security headers are on every response
PASS  the configuration is published
PASS  the Google client id is published
PASS  the authorised origins are published
PASS  the access code is required when one is set
PASS  registration without the access code is refused
PASS  /api/users needs a session
PASS  /api/shares needs a session
PASS  /api/activity needs a session
PASS  /api/activity/verify needs a session
PASS  the recovery endpoint refuses an account with no backup

15 of 15 live checks passed
```

These lines restate the transport and the gates that the other layers assume rather than adding a case to Table 4.1, and a line is printed only after its assertion has passed. The run was also made against the hosted deployment recorded in Table A2.1.

### A2.4 Every check in one command

Command: `npm run test:all`

The command runs the layers above in the order a reviewer would meet them, then the two builders, and prints one line per step.

```
10 of 10 steps passed
```

The steps are the server contract, the Google verification, the interface, the live check, the design gate, the interface detector, the deck, the report, the deck file and the contents page. Only the first four correspond to the layers reproduced here, and only those appear in Table 4.1; the remaining steps build and validate the deliverables.

### A2.5 Environment

Table A2.1 records the environment in which the runs were made.

Table A2.1 Test environment

| Item | Value |
|---|---|
| Operating system | Windows |
| Runtime | Node.js 18 or later; tested on Node 23 |
| Browser used for the headless test | Chrome or Edge, whichever was present on the machine, driven over the DevTools protocol with Node's built-in WebSocket and no test dependency |
| Data directory during tests | A temporary directory, removed after the run |
| External services | None; the one-time code is delivered by the default console mailer |
| Deployment | The live check was also run against the hosted service at `https://secureshare-2r3j.onrender.com`. Its disk is ephemeral, so a redeploy clears the accounts and the shares. |

The use of temporary data directories means that repeated test runs do not accumulate state and do not interfere with the JSON store or the blobs used for a demonstration. Each run starts from an empty store, so every result reported above was produced from a clean starting condition.