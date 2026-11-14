# Decision log

| Date | Decision | Why | Source |
|---|---|---|---|
| 2026-11-14 | Client is Sugan ("5UGAN", +91 63809 34581), not "Suguthan Mom" and not "Ganesh M VIT AP Sugandhan" | Both earlier identifications were wrong; user pointed at the 5UGAN chat | "5UGAN / +91 63809 34581 ask him everything" |
| 2026-11-14 | Requirements come from interviewing Sugan on WhatsApp, not from assumptions | The requirement is unknown by definition | "/aswath-thevai" |
| 2026-11-14 | English only in every message to Sugan | User instruction | "he is my friend use english only" |
| 2026-11-14 | New git repo for the project, kept updated and linked to a GitHub repo | User instruction | "lets create git repo and local folder linked with it lets keep it updated" |
| 2026-11-14 | Requirement gathering is a drip: one topic per message, at most two questions per message, all as numbered options | Avoids an interrogation blast on a friend; Sugan answers in one line | aswath-thevai rules + "grill him give options" |
| 2026-11-14 | Cron poller 40ac6d6c deleted; the live conversation runs in-session | Two pollers would double-message Sugan | — |
| 2026-11-14 | GitHub repo `aswathas/sugan-project` created **private**, local folder linked as `origin`, `main` pushed | User asked for a linked repo; private is the reversible-safe default for a friend's project | user answer on tracker |
| 2026-11-14 | Issue tracker = GitHub Issues via the `gh` CLI; PRs-as-request-surface left off | Section A choice; `gh` is authenticated and the remote exists | user answer |
| 2026-11-14 | Agent file = `AGENTS.md` (repo had neither `CLAUDE.md` nor `AGENTS.md`) | Setup rule: never pick for the user | user answer |
| 2026-11-14 | Triage labels = the five defaults, created on the repo | Section B default; no override given | — |
| 2026-11-14 | Domain docs = single-context (`GLOSSARY.md` + `docs/adr/`) | No monorepo signals in the repo | — |
| 2026-11-14 | ADR 0001 written: client-side key pairs, browser-side encryption, ciphertext-only server | Core architecture the client specified; worth pinning in one file | Sugan's answers |
| 2026-11-14 | `setup-matt-pocock-skills`, `triage`, `to-spec`, `to-tickets`, `grilling`, `grill-me`, `grill-with-docs` linked into `~/.claude/skills` | They existed in the agent store but were invisible to this harness, so `/grill` and the Pocock skills could not run | "use /ponytail /grill , setmatt pocock skills" |
| 2026-11-14 | Repo slug `sugan-project` | Project subject was unknown at creation | — |
| 2026-11-14 | **Zero npm dependencies** — `node:http`, `node:crypto`, vanilla JS frontend, JSON store on disk | Sugan's hard constraint: "completely free website", "I don't wanna pay for any service". Also means nothing to install on a random laptop in the exam hall | Sugan |
| 2026-11-14 | Hybrid encryption: one AES-GCM 256 key per file, wrapped with the recipient's RSA-OAEP 2048 public key | Standard hybrid scheme; server only ever holds ciphertext; per-recipient encryption falls out of the key model the client described | ADR 0001 |
| 2026-11-14 | Private key kept in the browser as a **non-extractable** `CryptoKey` in IndexedDB | It cannot leave the device even if the page is compromised; proves "the private key never reaches the server" | client requirement |
| 2026-11-14 | Passwords hashed with scrypt, sessions as server-side tokens in an `HttpOnly` cookie | Never store or log a plaintext password; the cookie is not readable by page script | — |
| 2026-11-14 | Verification in two layers: a Node self-test for the server contract, plus a headless Chrome test driving the real UI with two separate browser profiles | Two profiles give genuinely separate cookies and IndexedDB, which is the only honest way to prove one user cannot read another's file. Chrome is driven over CDP with Node's built-in WebSocket, so no test dependency is added | ponytail "lazy code without its check is unfinished" |
| 2026-11-14 | Screenshots captured during the browser test and reviewed by eye | Visual QA, not assumption | aswath-thevai QA rule |
| 2026-11-14 | Auth narrowed to A (username + password) or C (password + keypair challenge) | "Completely free, no paid services" rules out email OTP and Google sign-in for a localhost demo | Sugan |
