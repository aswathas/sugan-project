# Task: draft the SecureShare project report

You are writing the body text of a college project report. You are NOT writing the docx — the
orchestrator does that from your Markdown. Write Markdown only.

## Read these first

- `REQUIREMENTS.md` in the repo root — the confirmed brief, the agreed scope and the honest limits.
- `README.md` — how the system actually works and what the tests prove.
- `server/index.js`, `server/store.js`, `server/crypto.js`, `server/mailer.js`, `public/app.js` —
  the real implementation. **Describe what is actually there.** Do not describe React, Django,
  SQLite, TOTP authenticators, roles, revocation or audit trails: none of those exist in this
  build. The report must match the code.

## Output

Write one Markdown file per chapter under `docs/report-draft/`:

| File | Contents |
|---|---|
| `ch1-introduction.md` | Problem statement, objectives (5 bullets), chapter outline |
| `ch2-literature-review.md` | Related work, conventional-vs-E2EE comparison table, the literature survey table, mathematical background with the equations |
| `ch3-system-design.md` | Proposed system, logical architecture (text description plus the figures listed below), hardware and software requirements, stage table, the seven-step algorithm, testing procedure |
| `ch4-results.md` | Results of the functional verification, the test-case table, the screen figures, discussion, limits |
| `ch5-conclusion.md` | Review, conclusions, recommendations for future work |
| `front-matter.md` | Abstract (about 200 words), list of abbreviations, list of tables, list of figures |
| `appendices.md` | Appendix 1 — listing of the programs used, with what each one does. Appendix 2 — raw data from the test runs |

## Format (match the client's reference report)

- Course: 21ECC402P — Computer Communication and Network Security.
- Project title: **Secure File Sharing System Using End-to-End Encryption and Access Control**.
- System name in the text: **SecureShare**.
- Team: Pradeesh M (RA2311004010278), Varun P R (RA2311004010287), Sugandhan A (RA2311004010297).
- Written in third person, past tense for what was built ("the prototype was verified", not
  "we will build").
- Tables in Markdown pipe tables with the caption line above them, e.g. `Table 4.1 Test cases`.
- Figures referenced as `Figure 3.1 Logical architecture of the proposed secure file-sharing system`,
  with a one-line caption and a bracketed placeholder for the image:
  `[FIGURE: docs/figures/01-architecture.svg]`. Do not draw the figures — use these exact paths:
  - `docs/figures/01-architecture.svg` — logical architecture of the system
  - `docs/figures/02-without-e2ee.svg` — the conventional model, server can read the file
  - `docs/figures/03-e2ee.svg` — end-to-end encryption explained
  - `docs/figures/04-with-e2ee.svg` — the proposed model, ciphertext only on the server
  - `docs/figures/05-working-principle.svg` — the seven-step working principle
- Equations in plain Markdown with the numbering the reference uses, e.g. `CF = EK(F)  (2.3)`.

## Facts you must use (they are verified — do not alter them)

**Key pair.** At registration the browser generates an RSA-OAEP 2048-bit key pair through the Web
Crypto API. The private key is created non-extractable and stored in the browser's IndexedDB on
the user's own device; it is never uploaded. The public key is exported in SPKI form and published
to the server so that other users can encrypt to that account.

**Encryption of a share.** For each shared file the sender's browser generates a fresh AES-GCM
256-bit key and a random 96-bit IV, encrypts the file with AES-GCM, then wraps the AES key with
the recipient's RSA-OAEP public key. Only three values are uploaded: the ciphertext, the IV, and
the wrapped key.

**Server state.** The server stores user accounts (username, email, scrypt password hash, public
key, verification flag), the shares (sender, recipient, filename, size, IV, wrapped key, the
permission, timestamps) and the ciphertext blobs on disk. It never holds a private key, an AES key
or plaintext.

**Decryption.** The recipient's browser reads the private key from IndexedDB, unwraps the AES key
with RSA-OAEP, and decrypts the ciphertext with AES-GCM. The server is never involved.

**Access control.** When sending, the sender chooses a permission for that share: `view` or
`download`. A `view` share opens the decrypted file in the browser with no save affordance. State
the limit honestly in Chapter 4 and again in the conclusions: with end-to-end encryption the
recipient holds the plaintext once decrypted, so this is an interface-level rule and not a
cryptographic one.

**Authentication.** Registration takes a username, an email address and a password; the account is
unusable until a 6-digit one-time code is verified. The code is delivered by a pluggable mailer:
by default the server prints it in its terminal and the app shows it on screen (no external
service, works offline), and a free email provider can be switched on with one environment
variable. An unverified account gets 403 on sign-in and a wrong code gets 401. Passwords are
hashed with scrypt; sessions are server-side tokens in an HttpOnly cookie. Google sign-in is
designed as an additional method but is not part of the verified prototype.

**Stack, stated exactly.** Node.js `node:http` and `node:crypto` on the server with no npm
dependencies; a JSON store and a blob directory on disk; a vanilla JavaScript front end with
WebCrypto and IndexedDB; headless Chrome driven over the DevTools protocol for testing. Zero
packages to install and zero cost — the client asked for a completely free system.

**Verification actually performed.** Two layers. A Node self-test registers three users, proves an
unverified account cannot sign in and a wrong code is rejected, encrypts a file for one user,
proves the stored blob contains no plaintext, proves the recipient decrypts to the original bytes,
and proves a third user is refused with 403. A headless Chrome test drives the real interface in
two separate browser profiles, so cookies and IndexedDB are genuinely per user: it registers two
users, asserts the stored private key is non-extractable, sends a PDF, asserts the file on disk is
ciphertext, and asserts the recipient's browser decrypts back to the original bytes. Screenshots
of the real interface are the figures in Chapter 4.

**Objectives to state in Chapter 1.** To develop a web-based file-sharing system that supports
uploading, sharing and downloading files; to implement user authentication with a one-time code and
sender-controlled access control; to integrate end-to-end encryption so the server can never read
a file; to implement key management so that private keys never leave the user's device; to verify
the main workflows and the unauthorised-access scenario against the running prototype.

**Future work to list in Chapter 5.** Integrity verification with digital signatures beyond
AES-GCM's authentication tag; key revocation and recovery so a lost device is not a lost archive;
forward secrecy through short-lived session keys; a public HTTPS deployment so that OAuth and
multi-user demos work off the local machine; fine-grained attribute-based policies in place of the
current per-file permission; an independent audit of the stored data and the key lifecycle; and
HTTPS with a proper certificate.

**Literature survey.** Use these six papers, in this order, and keep the columns exactly: S.No,
Title of Paper, Paper Details (authors, venue, year), Methodology, Inference.

1. E. Chen, Y. Zhu, K. Liang, H. Yin, "Secure Remote Cloud File Sharing With Attribute-Based Access
   Control and Performance Optimization," IEEE Transactions on Cloud Computing, 2023 — ABAC/XACML
   with CP-ABE — fine-grained access control over encrypted files; policy processing adds
   complexity.
2. E. Chen, Y. Zhu, G. Zhu, K. Liang, R. Feng, "How to Implement Secure Cloud File Sharing Using
   Optimized Attribute-Based Access Control," Computers & Security, 2021 — ABAC/XACML with CP-ABE
   and a small policy matrix — better policy efficiency and privacy, at the cost of advanced
   cryptographic processing.
3. M. Almasian, A. Shafieinejad, "Secure cloud file sharing scheme using blockchain and
   attribute-based encryption," Computer Standards & Interfaces, 2024 — blockchain smart contract
   with ABE — fast revocation and auditable access; blockchain adds infrastructure complexity.
4. "Attribute-based cloud storage with secure provenance over encrypted data," Future Generation
   Computer Systems, 2018 — encryption with fine-grained access control and provenance — adds
   privacy, dynamic user management and traceability; provenance increases system complexity.
5. H. Kuehner, H. Hartenstein, "Decentralized secure data sharing with attribute-based encryption: a
   resource consumption analysis," ACM SCC, 2016 — ABE-based secure data sharing — confidentiality
   and integrity, but resource consumption and trusted-entity issues remain.
6. "Efficient Lattice-Based Revocable Attribute-Based Encryption Against Decryption Key Exposure
   for Cloud File Sharing," 2023 — lattice CP-ABE with revocation and multi-authority — addresses
   dynamic management and key-exposure resistance; the cryptographic cost is higher.

Leave one clearly marked empty row at the end of that table reading
`[ADDITIONAL VERIFIED PAPERS TO BE INSERTED]` — the orchestrator fills it. Do not invent other
papers, DOIs, page numbers or venues. Never claim a paper you were not given.

**Mathematical background for Chapter 2.** Use these, correctly: the RSA-OAEP key wrapping
relation `CK = E(K_RB, K)` (2.4) where `K_RB` is Bob's public key and `CK` is the wrapped AES key;
the ciphertext relation `CF = E(K, F)` (2.3) with `K` the AES key and `F` the plaintext file; the
recovery relation `F = D(K), where K = D(K_RB, CK)` (2.5); the AES-256 key space
`N = 2^256 ≈ 1.16 × 10^77`, so exhaustive search is not practical; the GCM authentication tag's
forgery probability bound of about `10^-6` per code for a 96-bit IV; and the one-time-code entropy
argument that a 6-digit code from a 10^6 space used for a short window is the second factor
against a disclosed password. Explain each in a short paragraph and connect it to the
implementation.

## Rules

- Never state a number, test result, benchmark or comparison that is not in this brief. If the
  reference report contains a figure you cannot verify, leave it out.
- Never describe features the prototype does not have (roles, revocation, audit logs, MFA apps,
  cloud deployment, React, Django, SQLite).
- No marketing language. This is an academic report for a 21ECC402P review.
- Length: aim for roughly 9,000 to 11,000 words in total across the chapters, so that with the
  front matter, tables and figures the finished document is close to the 29-page reference.
- Write plain Markdown. No YAML front matter. No code fences around prose.
- Do not modify any file outside `docs/report-draft/`. Do not run git commands.

When you are done, print a one-line summary: the files you wrote and their word counts.
