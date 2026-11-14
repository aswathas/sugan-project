# Change inventory

| File | What changed | Why | How verified |
|---|---|---|---|
| `README.md` | created, then rewritten with run instructions, demo script and how the encryption works | a college submission needs to be runnable by someone who has never seen it | read back after commit |
| `REQUIREMENTS.md` | created, then rewritten after each client answer | the brief: confirmed facts, open holes, Aswath's choices, build status | read back after commit |
| `AGENTS.md` | created | harness-neutral agent file with the `## Agent skills` block | read back after commit |
| `GLOSSARY.md` | created | domain vocabulary agreed with the client | read back after commit |
| `package.json` | created | `npm start` and `npm test`; no dependencies field on purpose | `npm test` and `npm run test:browser` both run |
| `.gitignore` | created | keep `data/` (users, ciphertext blobs) out of git | `git status` clean after a test run |
| `server/index.js` | created | HTTP server: auth, users, shares, blob download, static files | `npm test`, `npm run test:browser` |
| `server/store.js` | created | JSON store plus ciphertext blobs on disk; `DATA_DIR` overridable for tests | self-test runs against a temp data dir |
| `server/crypto.js` | created | scrypt password hashing and session tokens | self-test asserts a wrong password is rejected |
| `public/index.html` | created | the site markup: auth tabs, share panel, inbox, sent list | browser test drives these elements |
| `public/app.js` | created | browser crypto (key pair, AES-GCM encrypt, RSA-OAEP wrap), IndexedDB key storage, share and open flows | browser test: private key non-extractable, file encrypted, recipient decrypts |
| `public/style.css` | created | dark UI, three-panel layout | screenshots reviewed by eye |
| `test/selftest.js` | created | end-to-end server contract check | `npm test` — 5 assertions pass |
| `test/browsertest.js` | created | drives the real UI in headless Chrome, two profiles, two users | `npm run test:browser` — 5 checks pass |
| `docs/adr/0001-client-side-keypairs-and-browser-side-encryption.md` | created | pins the core architecture decision | read back after commit |
| `docs/agents/issue-tracker.md` | copied from the Pocock seed template | where issues live (GitHub via `gh`) | `gh label list` succeeded against the repo |
| `docs/agents/triage-labels.md` | copied from the Pocock seed template | role-to-label mapping | the five labels exist on the repo |
| `docs/agents/domain.md` | copied from the Pocock seed template | how skills read GLOSSARY.md and ADRs | copied from template |
| `docs/screenshots/01-share-panel.png`, `docs/screenshots/02-inbox.png` | created | visual QA of the share panel and the recipient inbox | reviewed by eye after downscaling |
| `docs/reviews/decision-log.md` | created, then rewritten with each decision | standing commit-discipline rule | read back after commit |
| `docs/reviews/change-inventory.md` | created, then rewritten | standing commit-discipline rule | read back after commit |
