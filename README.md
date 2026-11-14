# SecureShare — end-to-end encrypted file sharing

A website for sharing a file with one person, so that the file stays unreadable to everyone else
including the server that stores it. Each user gets a key pair generated in their own browser; a
file is encrypted before it leaves the sender's device using the recipient's public key; only that
recipient can decrypt it. The sender also decides, per file, whether the recipient may only view
it or may also download it.

Course project: **21ECC402P — Computer Communication and Network Security**.

| | |
|---|---|
| Working site | `npm start`, then <http://127.0.0.1:3000> |
| Report | [`report/SecureShare-Project-Report.pdf`](report/SecureShare-Project-Report.pdf) (43 pages) and [`.docx`](report/SecureShare-Project-Report.docx) |
| Slides | [`report/SecureShare-REVIEW-3.pdf`](report/SecureShare-REVIEW-3.pdf) (15 slides) and [`.pptx`](report/SecureShare-REVIEW-3.pptx) |
| Brief | [`REQUIREMENTS.md`](REQUIREMENTS.md) — the requirements agreed with the client |
| Design | [`PRODUCT.md`](PRODUCT.md), [`docs/agents/`](docs/agents), [`docs/adr/`](docs/adr) |

## Run it

```
npm start
```

There is nothing to install: no dependencies, no build step, no database to provision, no paid
service. Node 18 or later is enough (tested on Node 23).

For a two-machine demonstration, start the server on one laptop and open
`http://<that-laptop's-LAN-IP>:3000` on the other. Both browsers must be on the same network.

### Environment

| Variable | Effect |
|---|---|
| `HOST`, `PORT` | where the server listens. Defaults to `127.0.0.1:3000` |
| `DATA_DIR` | where the JSON store and the ciphertext blobs live. Defaults to `data/` |
| `GOOGLE_CLIENT_ID` | turns on the *Continue with Google* button. Without it the button stays hidden |
| `ACCESS_CODE` | when set, registration requires this code. Use it on any public deployment |
| `MAIL_MODE`, `RESEND_API_KEY`, `MAIL_FROM` | send the one-time code by email instead of printing it in the terminal |

### A public URL

`render.yaml` is a blueprint for a free Render deployment: no build step, `HOST=0.0.0.0`, health
check on `/api/config`, and the client id and access code set in the Render dashboard rather than
in the file. For a throwaway link, a reverse tunnel works too:

```
ssh -R 80:127.0.0.1:3000 nokey@localhost.run
```

The tunnel URL rotates and lives only while the machine is on.

## Demo script

1. **Laptop 1**: `npm start`, open the site, register. The browser generates your key pair; the
   private key is stored on that device and never uploaded.
2. **Laptop 2**: register as the second user.
3. **Laptop 1**: click *New*, pick a PDF, choose the recipient, choose view-only or view-and-download,
   choose when the file should self-destruct, and press *Encrypt and send*. The interface shows the
   fingerprint of the recipient's public key that the file is encrypted to.
4. **Laptop 2**: the file appears under *Shared with me* with a live mark. Press *Decrypt* and it
   opens; the card then reads *verified*, because the file's SHA-256 fingerprint is recomputed after
   decryption and matches the one the sender put on it.
5. The evidence for the exam: the server's disk holds ciphertext only, and an unrelated user is
   refused with `403`.

## What the interface does

- A **dashboard in the shape of a file drive**: *Shared with me*, *Sent by me* and *Recent* in a
  left rail with counts, a search box, and a card per file carrying its permission badge, its
  self-destruct timer and its state.
- **Google sign-in**, with the identity token verified on the server against Google's published
  keys. The email one-time code is the offline path and needs no internet.
- **Self-destruct**: never, one hour, one day or seven days. When the time is up the server gives
  up the bytes and the card says so.
- **Revocation**: the sender can call a share off before the recipient opens it.
- **An end-to-end integrity check**: the sender hashes the plaintext in the browser, and the
  recipient recomputes that hash after decryption.
- **An audit trail** whose entries are chained by hash, so an edited entry breaks the chain. The
  dashboard reports whether the chain still checks out.
- **Hardening**: a content security policy and the other standard headers on every response, a
  lockout after repeated failed sign-ins or wrong codes, a password minimum of eight characters,
  *sign out everywhere*, a 25 MB limit on a file, and a cap on how many files one account holds.
- **A visible proof**: after a send the interface puts your file's first 16 bytes next to the bytes
  the server really holds.

## Showing that the server really holds ciphertext

Three places, all showing the same thing:

1. **In the app.** After a send, the panel *What the server actually stored* puts your file's first
   16 bytes next to the bytes the server holds, and names the file on disk.
2. **On disk.** The stored file is `data/blobs/<share-id>.bin`. Open it in any hex viewer.
3. **In the terminal.**

   ```
   npm run show:ciphertext
   ```

   It prints the name of the uploaded file next to the hex of the bytes actually stored, and the
   path on disk.

`data/db.json` holds no file content at all: only the id, the wrapped key, the IV and the size.

## How the encryption works

Per share, in the sender's browser:

1. A fresh AES-GCM 256-bit key is generated for that one file.
2. The file is encrypted with AES-GCM under a random 96-bit IV.
3. The AES key is wrapped with the recipient's RSA-OAEP 2048-bit public key.
4. Only the ciphertext, the IV and the wrapped key are uploaded.

On the recipient's side, the private key — a non-extractable `CryptoKey` in IndexedDB — unwraps the
AES key, which decrypts the file. The server is never involved in either step.

Other security choices: passwords are hashed with scrypt, sessions are server-side tokens in an
`HttpOnly` cookie, and a new account cannot be used until a six-digit one-time code is verified.

## Stated limits

- *View only* is enforced in the interface. With end-to-end encryption the recipient holds the
  plaintext once decrypted, so it is not a cryptographic lock.
- There is no role model, no key revocation, no audit trail and no key backup yet.
- A lost device means a lost private key and unreadable files.
- Storage is a JSON file and a directory of ciphertext blobs: a single node, not a service.

## Check it

```
npm test            # the server contract, end to end
npm run test:browser  # the real interface in headless Chrome, two profiles
```

The self-test registers three users, proves an unverified account cannot sign in and a wrong code
is rejected, encrypts a file for one of them, proves the stored blob contains no plaintext, proves
the recipient decrypts to the original bytes, proves a third user is refused with `403`, proves the
demo access code is required, proves an expired share gives up its bytes, proves the sender can
revoke while the recipient cannot, proves the audit trail is a hash chain that checks out, proves
repeated failed sign-ins are locked out, and proves signing out everywhere ends every session. The
Google test runs a local key server and proves a wrong audience, a wrong issuer, an expired, a
tampered, a forged and a malformed token are all refused.

The browser test drives the actual interface in two separate Chrome profiles, so cookies and
IndexedDB are genuinely per user. It asserts that the stored private key is non-extractable, that
the server's disk holds ciphertext, that the card carries the permission and the self-destruct
timer, that a revoked share cannot be opened, and that the recipient's browser decrypts back to
the original bytes and the card then reads *verified*. It also captures the screen figures used in
the report.

## Layout

```
server/index.js   HTTP server, API, static files, security headers
server/store.js   JSON store and ciphertext blobs (data/, gitignored)
server/crypto.js  password hashing and session tokens
server/mailer.js  delivery of the one-time code: console by default, free provider optional
server/google.js  verification of a Google ID token, with node:crypto alone
server/trail.js   the audit trail as a hash chain
public/           the site: index.html, app.js, style.css, tokens.css, base.css, fonts/
test/             self-test, Google verification test and headless browser test
tools/            build-report.js and build-deck.js, which build the deliverables
docs/             the brief, the figures, the report draft, the agent skills config, the ADRs
report/           the generated report and slides
```

The report and the deck are built from the Markdown in `docs/report-draft/` and the figures in
`docs/figures/` by `tools/build-report.js` and `tools/build-deck.js`. Those two scripts need the
`docx` and `pptxgenjs` packages, which are deliberately not project dependencies: the application
itself installs nothing.

## Licence

The interface uses [Chivo Mono](public/fonts/OFL.txt), licensed under the SIL Open Font License.
