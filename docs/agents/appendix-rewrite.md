# Brief: bring Appendix 1 and Appendix 2 of the SecureShare report up to date

Work in `C:\Users\ADMIN\Projects\sugan-project`.

**Touch exactly one file:** `docs/report-draft/appendices.md`. Do not touch
any other file, and do not rebuild the report — the build is run afterwards
by someone else.

## Why

The report was built before the last round of work, and Appendix 1 still lists
a prototype of ten files that no longer exists, describing an interface that
has since been rebuilt. Appendix 2 still reproduces the output of a test suite
that has since grown from seven lines to nineteen. A reviewer who reads the
appendix against the repository will find it wrong, and this is the appendix a
reviewer reads to check the honesty of the report.

## Appendix 1, Listing of the Programs Used

Replace the file table with the real one. The project today is:

| File | Lines | What it is |
|---|---|---|
| `package.json` | | Declares the project, the Node.js engine requirement and the scripts `start`, `test`, `test:browser`, `test:live`, `test:all` and `show:ciphertext`. It deliberately declares no dependencies. |
| `server/index.js` | 721 | The HTTP server: static files, registration, verification, sign-in and sign-out, sessions, the share lifecycle (create, list, metadata, blob, star, delete, restore, purge, revoke, opened), the activity trail, the key backup and recovery endpoints, and the security headers on every response. |
| `server/store.js` | 53 | The persistence layer: loads and saves the JSON store, reads and writes the ciphertext blobs. The data directory can be overridden, so a test run never touches demonstration data. |
| `server/crypto.js` | 20 | Password hashing with scrypt and a per-user salt, constant-time verification, and opaque session tokens. |
| `server/mailer.js` | 38 | Delivers the six-digit one-time code. The default console mode prints it in the server terminal, so the demo needs no external service. The optional Resend mode sends it by email. |
| `server/google.js` | 70 | Verifies a Google identity token against Google's published keys with `node:crypto`: RS256, the issuer, the audience, the expiry and the signature are all checked, and the keys are cached for an hour. No client secret is used anywhere. |
| `server/trail.js` | 50 | The audit trail. Each event carries the SHA-256 of the event before it, so the log is a chain that can be walked and proved. |
| `public/index.html` | 459 | The interface markup: the sign-in page, the file-drive workspace (the rail, the search band, the file cards, the send panel, the activity panel) and the three overlays. |
| `public/app.js` | 2184 | The client logic: the key pair in the browser, the non-extractable private key in IndexedDB, the encryption, the key wrapping, the signature, the upload, the download, the decryption, the dashboard rendering, the filters, the bulk actions and the audit trail view. |
| `public/keyguard.js` | 194 | The three extra keys: the ECDSA signing key, the AES-KW password wrap, and the twelve-word recovery phrase that unlocks the private key on a new device. |
| `public/style.css` | | The appearance of the application: the Wayfind theme, the workspace layout, the cards, the overlays and the dark theme. It imports `public/tokens.css` (the tokens) and `public/base.css` (the reset). |
| `public/keyguard.js` … | | |

then the test programs and the build programs:

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

Write the table the way the report writes tables: a caption ("Table A1.1
Programs that make up the prototype"), the rows, then the paragraph that says
why the separation is deliberate. Keep the voice of the existing appendix:
third person, plain, measured, no praise and no exclamation.

Change the sentence that says the prototype consists of ten source files. It
now consists of the files listed.

**The descriptions of the interface must match the interface.** The old table
says "the three-panel arrangement" and "the inbox and the sent list". The
application is now a file-drive workspace: a left rail with counts, a search
band, a grid or list of file cards with type chips and permission badges, a
send panel, and an activity panel. Say what it is.

## Appendix 2, Raw Data from the Test Runs

Replace the reproduced output with the current output. Use exactly these
lines, in this order.

`npm test` (the server contract and the Google verification, 19 checks):

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

`npm run test:browser` (the real interface in headless Chrome, 22 checks):

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

`npm run test:live` (a server that is already running, 15 checks):

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

`npm run test:all` (every check in one command, 10 steps):

```
10 of 10 steps passed
```

Keep the existing sub-sections A2.1, A2.2 and A2.3 structure, and add the two
new commands as their own short sub-sections. Update the sentences that tie
the lines to Table 4.1: the table now runs to TC-45, so say which range each
command's lines correspond to, and say plainly that a line is printed only
after its assertion has passed.

Update the environment table A2.1 if a row is wrong: the browser row should
say Chrome or Edge, whichever was on the machine, driven over the DevTools
protocol with Node's built-in WebSocket and no test dependency. Add a row for
the deployment, saying the live check was also run against the hosted service
at `https://secureshare-2r3j.onrender.com`, and that its disk is ephemeral,
so a redeploy clears the accounts and the shares.

## The bar

- Read the existing appendices first and keep its voice. Do not add a
  "highlights" or a "summary" box; the report has no such boxes.
- Do not claim a check exists that is not in the output above. The counts
  are 19, 22, 15 and 10 steps.
- Keep the Markdown table format exactly as the report's tables are written,
  because the report builder reads this file.
- The file is Markdown that the report builder parses. Do not use HTML, do
  not use code fences around the tables, and do not add new headings above
  `## Appendix 1`.

## Report back

- The new Appendix 1 table, as markdown.
- The new Appendix 2, as markdown.
- The word count before and after.
