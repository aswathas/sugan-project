# Report update spec (v2 features)

You are updating the project report draft of **SecureShare**, a college project on end-to-end
encrypted file sharing (course 21ECC402P). The system has grown since the draft was written. Your
job is to bring the draft in line with the code as it now stands, and to widen the reported scope
where the new work warrants it.

Work only on these three files in `C:\Users\ADMIN\Projects\sugan-project\docs\report-draft\`:
`ch3-system-design.md`, `ch4-results.md`, `ch5-conclusion.md`.

Keep the existing voice, section numbering, heading style, table style and level of formality.
Extend what is there; do not rewrite chapters that are still correct. Do not touch any other file.
Do not invent numbers, papers, citations or results. Everything you write must come from the facts
below or from the existing draft.

## What the system is now

**SecureShare** shares one file with one person. Every user generates an RSA-OAEP 2048 key pair in
their own browser; the private key is a non-extractable `CryptoKey` held in IndexedDB and never
leaves the device. The sender encrypts the file with a fresh AES-GCM 256 key under a random 96-bit
IV, wraps that key with the recipient's RSA public key, and uploads only ciphertext, the IV, the
wrapped key and a SHA-256 fingerprint of the plaintext. The server stores ciphertext only.

### Modules

- `server/index.js` - HTTP server, JSON API, static files
- `server/store.js` - JSON store plus ciphertext blobs on disk
- `server/crypto.js` - scrypt password hashing, session tokens
- `server/mailer.js` - the one-time code: console by default, a free email provider optional
- `server/google.js` - **new**: verifies a Google ID token on the server with Node's built-in
  crypto only. It checks RS256, the issuer, the audience and the expiry, and verifies the
  signature against Google's published keys (JWKS, cached for an hour). No package was added.

The application has **zero npm dependencies**: `node:http`, `node:crypto`, `node:fs`, `node:path`
and the browser's WebCrypto API.

### The HTTP interface (complete list)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/config` | publishes the Google client id and whether an access code is required |
| POST | `/api/google-signin` | verifies the Google ID token, links the account, starts a session |
| POST | `/api/register` | registers a user; needs the access code when one is configured |
| POST | `/api/verify-otp` | verifies the emailed one-time code |
| POST | `/api/login` | password sign-in |
| POST | `/api/logout` | ends the current session |
| POST | `/api/logout-all` | **new**: ends every session of the signed-in account |
| GET | `/api/me` | the signed-in account |
| GET | `/api/users` | the account list with public keys |
| POST | `/api/shares` | creates a share; accepts `recipient`, `filename`, `size`, `permission`, `expiresIn`, `digest`, `iv`, `wrappedKey`, `ciphertext` |
| GET | `/api/shares` | the signed-in user's inbox and sent shares |
| GET | `/api/shares/:id` | the metadata of one share |
| GET | `/api/shares/:id/blob` | the ciphertext bytes; refused with `410` when the share is revoked or expired |
| GET | `/api/shares/:id/cipher-head` | **new**: the first bytes the server really holds, for the evidence panel |
| POST | `/api/shares/:id/revoke` | **new**: the sender calls the share off |
| POST | `/api/shares/:id/opened` | **new**: the recipient records the first open |
| GET | `/api/activity` | **new**: the audit trail of the signed-in user |
| GET | `/api/activity/verify` | **new**: walks the hash chain of the trail and reports whether it is intact |

A share now carries `permission` (`view` or `download`), `expiresAt`, `revokedAt`, `openedAt`,
`digest` and a `state` of `live`, `expired` or `revoked`.

### The features added since the first draft

1. **A Google Drive style dashboard.** The signed-in screen has a left rail (Shared with me /
   Sent by me / Recent with counts), a search box that filters by file name, file cards carrying
   the permission badge, a live mark on a share nobody has opened yet, and a New route for the
   send panel.
2. **Google sign-in** alongside the email one-time code, verified server-side as described above.
   The button appears only when a client id is configured; the demo path stays the one-time code.
3. **A demo access code.** When `ACCESS_CODE` is set, registration requires it, and the check
   runs before any other validation so a stranger cannot learn which usernames exist.
4. **Self-destruct.** The sender chooses never, one hour, one day or seven days. When the time is
   up the server refuses to hand over the bytes (`410`) and the card says the share expired.
5. **Revocation.** The sender can call a share off before the recipient opens it; the recipient
   cannot, and an already opened share can no longer be revoked (`409`).
6. **An end-to-end integrity check.** The sender hashes the plaintext with SHA-256 in the browser
   and the fingerprint travels with the share. The recipient recomputes the hash after decryption
   and the card shows *verified* when they match. Stated honestly in the limits: the server holds
   this fingerprint, so it is a content fingerprint and leaks that much.
7. **An audit trail.** Every send, open and revoke is recorded with a timestamp. The entries are
   chained: each entry carries the SHA-256 of the one before it, so the trail is tamper-evident
   and `/api/activity/verify` reports whether the chain still holds.
8. **Upload progress and a 25 MB limit**, with drag and drop onto the file field.
9. **A visible proof for the examiner.** After a send the interface shows the sender's first 16
   bytes next to the bytes the server really holds, and names the file on disk. A script,
   `npm run show:ciphertext`, prints the same in the terminal.
10. **Hardening**: security headers on every response (a content security policy that allows only
    the site's own script and styles, `X-Content-Type-Options`, `X-Frame-Options`,
    `Referrer-Policy`), a lockout after repeated failed sign-ins, a limit on wrong one-time codes,
    a stronger password minimum, "sign out everywhere", and a cap on how many shares one account
    may create.

### The test results (use these exactly)

`npm test` runs the Node self-test and the Google verification test: **15 checks pass**.
The self-test registers three users, proves an unverified account cannot sign in and a wrong code
is rejected, encrypts a file for one of them, proves the stored blob contains no plaintext, proves
the recipient decrypts to the original bytes, proves a third user is refused with `403`, proves
the demo access code is required, proves an expired share gives up its bytes and says so, proves
the sender can revoke while the recipient cannot, proves the audit trail records the events and
hides other people's, and proves the Google path refuses a wrong audience, a wrong issuer, an
expired, a tampered, a forged and a malformed token.

`npm run test:browser` drives the real interface in headless Chrome with two separate browser
profiles, so cookies and IndexedDB are genuinely per user: **9 checks pass**. It asserts that the
stored private key is non-extractable, that the file is encrypted in the browser, that the server's
disk holds ciphertext and not the file, that the card carries the permission and the self-destruct
timer, that the sender can revoke and the activity panel records it, that the recipient sees one
share revoked and cannot open it, and that the recipient decrypts to the original bytes and the
card then reads *verified*. It captures the six screen figures used in the report.

## What to change in each file

**ch3-system-design.md**
- Extend the module list with `server/google.js` and describe what it does and why the
  verification happens on the server.
- Replace the HTTP interface table with the complete table above.
- Extend the working principle and the algorithm so they cover: hashing the plaintext, the
  self-destruct timer, revocation, the integrity check on the recipient's side, and the audit
  trail.
- Extend the software requirements and the testing procedure to cover the new endpoints, the
  security headers, the lockout, and the tamper-evident trail.
- Describe the dashboard as the interface of the system.

**ch4-results.md**
- Bring the two results sections in line with the check counts and the checks listed above.
- Keep the screen figures; the captions must describe what each screen now shows (the dashboard,
  the self-destruct picker, the activity panel, the verified badge).
- Extend the discussion to cover what the new features buy and what they cost.
- Extend the limits honestly: view-only is an interface rule rather than a cryptographic one; the
  server holds a SHA-256 fingerprint of the plaintext; revocation cannot un-download a file the
  recipient already has; the tunnel URL rotates and the deployment is single-node; there is still
  no key backup, no roles and no rate limiting on the download endpoint.

**ch5-conclusion.md**
- Update the conclusions so they cover the whole system as built now.
- Rewrite the future work list: the audit trail, revocation, expiry and integrity checking are now
  done, so they must come out of future work and be replaced by what is genuinely still missing.

## Rules

- British spelling, as the existing draft uses.
- No em dashes in body text. Use a comma, a full stop or a colon.
- Every table needs a caption line above it, in the style the file already uses.
- Do not cite any source that is not already in `references.md`.
- Do not add a bibliography, an appendix or a chapter; you are editing three chapters only.
- When you are done, reply with a short list of the sections you changed, in one paragraph.
