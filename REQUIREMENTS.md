# SecureShare — requirements brief and build plan

Course: **21ECC402P — Computer Communication and Network Security**
Client: Sugan (WhatsApp "5UGAN", +91 63809 34581) — team: Pradeesh M (RA2311004010278), Varun P R
(RA2311004010287), Sugandhan A (RA2311004010297).
Owner: Aswath. Status: **the brief is approved and the build is delivered.** Two items still need
him: a Google Cloud client id, and his go-ahead on the public URL for the presentation.

## 1. What we are building

**SecureShare** — a web-based file-sharing system that protects files with end-to-end encryption
and lets the sender decide, per file, whether the recipient may only view it or may also download
it. Every user gets a key pair generated in their own browser; a file is encrypted before it
leaves the sender's device using the recipient's public key; the server stores ciphertext and
public keys only. Sign-in is Google OAuth with an email + one-time-code fallback. It runs
completely free: no paid service, no package to install.

## 2. Confirmed requirements

| # | Requirement | Source | State |
|---|---|---|---|
| R1 | Website to share files securely with end-to-end file encryption, mainly PDFs | Sugan | built |
| R2 | Users register; on registration each user gets a private key and a public key | Sugan | built |
| R3 | The file is encrypted before it leaves the website and shared to the selected user | Sugan | built |
| R4 | Access control set by the sender per file: the receiver may only **view** or may also **download** | Sugan | built |
| R5 | Authentication at registration — OAuth (Google sign-in), email + one-time code as the fallback | Sugan: "D let's go with ouauth", "3B" | built, Google button waits on a client id |
| R6 | Completely free — no paid services at any point | Sugan | held |
| R7 | Runs on localhost first; a second laptop on the LAN for the live demo; a public deployment as well | Sugan, Aswath | held, plus a public tunnel and `render.yaml` |
| R8 | College submission, wanted by 8pm on 2026-11-14 | Sugan: "By 8pm" | met |
| R9 | Deliverables: working website, GitHub repo, report, PPT — PPT and report follow the formats he sent | Sugan | delivered |
| R10 | System name **SecureShare**, deck title **REVIEW - 3** | Sugan: "review 3, secureshare" | used everywhere |
| R11 | Keep the zero-dependency build; the report's Tools Used and Appendices describe what is really there | Sugan: "2A" | held |
| R12 | No role model. The sender's view/download permission is the access model; roles are future work | Sugan: "4A" | held |
| R13 | GitHub repo public | Aswath | done |
| R14 | The brief goes to Sugan as a WhatsApp message, with the same text committed here | Aswath | held |
| R15 | Report follows the format of the PDF he sent; the deck follows the format of the PPT he sent | Sugan, with both files | delivered |
| R16 | He must be able to show his faculty that the file is stored as ciphertext, not plain text | Sugan, ts 1794647373 | built: the in-app evidence panel, `data/blobs/<id>.bin`, `npm run show:ciphertext` |
| R17 | A Google Drive style dashboard for the signed-in screen | Aswath's instruction | built |
| R18 | A live public link for the demo | Aswath's instruction, on Sugan's "show demo using the site deployed" | live over a tunnel, plus `render.yaml` for a permanent URL |
| R19 | More features in the app: more scope, planned and added | Aswath's instruction | built: self-destruct timer, revocation, end-to-end integrity check, tamper-evident audit trail, upload progress, drag and drop, a file-size limit, security headers, lockouts, sign-out everywhere |
| R20 | Google OAuth set up for real, not only designed | Aswath's instruction, and Sugan offering to authorise | done: project `secureshare-e2ee-2026`, client id issued, the button is live on the site |
| R21 | The report and the slides must be exactly the format he sent, with the SRM logo | Sugan | done: the logo was extracted from his own reference deck and the title page and the first slide now carry it |

## 3. What was built

### Phase 1 — Access control per share (done)
Each share carries a permission chosen by the sender: `view` or `download`. The server stores it
with the share and returns it to the sender and the recipient only. In the interface, a `view`
share opens the decrypted file in the browser with no save affordance; a `download` share saves it.
**Stated honestly in the report:** with end-to-end encryption the recipient holds the plaintext
once decrypted, so this is an interface-level rule, not a cryptographic one.

### Phase 2 — Google sign-in alongside the one-time code (done)
The Google Identity button returns an ID token; the server verifies it against Google's published
keys using Node's built-in crypto (no package added) and signs the user in. The browser still
generates the E2EE key pair for that account and keeps the private key in IndexedDB. The email +
one-time code path stays exactly as it is and is what the demo runs on. Activated by
`GOOGLE_CLIENT_ID`; without it the app behaves as it does today.

### Phase 3 — The dashboard (done)
The signed-in screen is a Google Drive style dashboard: a left rail with **Shared with me**,
**Sent by me** and **Recent** and their counts, a search box in the band, file cards carrying the
permission badge, a live cobalt mark on a share nobody has opened yet, and a **New** route for the
send panel.

### Phase 4 — Real screenshots (done)
The headless Chrome test captures every screen for the report's figures: register, one-time code,
share panel, sent, inbox and decrypted.

### Phase 5 — The report (done)
Following the format he sent (29-page reference): front matter (title, abstract, contents, list of
tables and figures, abbreviations), Chapter 1 Introduction, Chapter 2 Literature Review (with the
verified twelve-paper survey), Chapter 3 System Design and Methodology, Chapter 4 Results and
Discussion, Chapter 5 Conclusion, References (fifteen verified entries), Appendices. Delivered as
docx and pdf.

### Phase 6 — The PPT (done)
15 slides matching his reference section for section, titled **REVIEW - 3**.

### Phase 7 — The repo and the demo (done)
Public, README with the run instructions and the demo script, decision log and change inventory
kept current, every phase committed and pushed. `render.yaml` holds a free permanent deployment
blueprint for the public link.

### Phase 8 — The faculty proof (done)
After a send, the app shows the sender's first 16 bytes next to the bytes the server really holds,
and names the file on disk. `npm run show:ciphertext` prints the same thing in the terminal.

### Phase 9 — The scope grew (done)
Asked to widen the scope, four features went into the application that a reviewer of a secure file
sharing system asks about first, plus the hardening to go with them:

1. **Self-destruct.** The sender picks never, one hour, one day or seven days. When the time is up
   the server refuses to hand over the bytes and the card says the share expired.
2. **Revocation.** The sender can call a share off before the recipient opens it. The recipient
   cannot, and an already opened share can no longer be revoked.
3. **An end-to-end integrity check.** The sender hashes the plaintext with SHA-256 in the browser;
   the recipient recomputes it after decryption and the card reads *verified*.
4. **An audit trail that is tamper-evident.** Each entry carries the hash of the entry before it,
   and the interface reports whether the chain still checks out.
5. **Hardening.** Security headers on every response, a lockout after repeated failed sign-ins or
   wrong codes, a password minimum of eight, sign-out everywhere, a 25 MB file limit and a cap on
   how many files an account may hold.

### Phase 10 — The Google client id (done)
Google Cloud project `secureshare-e2ee-2026`, one web OAuth client, `http://localhost:3000` as the
authorised JavaScript origin. The server uses only the client id: the identity token is verified
with Google's published keys, so the client secret is never needed and is not stored anywhere.

## 4. What the demo looks like

1. Laptop 1: `npm start`, open the site, register — the key pair is generated in the browser.
2. Laptop 2 on the same LAN: register as the second user.
3. Laptop 1: click **New**, pick a PDF, choose the recipient, choose view-only or download, send.
4. The evidence panel under the dashboard shows the two byte strings side by side.
5. Laptop 2: the file appears under **Shared with me** with a live mark; open it, it decrypts in
   the browser.
6. The evidence for the exam: the server's disk holds ciphertext only, and a third user gets
   `403` on the file.

## 5. Limits, stated plainly

- View-only is enforced in the interface, not by cryptography.
- Google sign-in needs his client id and internet. The demo path (email + one-time code) needs
  neither and is what the two-laptop demo uses.
- No roles, no revocation, no audit trail, no integrity verification of the ciphertext beyond
  AES-GCM's own authentication tag.
- A lost device means a lost private key and unreadable files. No key backup yet.
- Single-node storage (a JSON file and a blob directory). Fine for a prototype, not a service.
- The public tunnel URL rotates and only lives while this machine is on. `render.yaml` is the
  permanent version and needs one Render account.

## 6. Decisions I am taking without asking

- Stack stays as built: Node `node:http` + `node:crypto`, vanilla JS frontend, no npm
  dependencies — this is what makes R6 and R7 true.
- The report's Tools Used table and Appendix 1 describe the real implementation, not the reference
  deck's React/Django stack.
- The name is **SecureShare** and the deck title is **REVIEW - 3**, exactly as he wrote them.
- The literature survey keeps his six ABAC/CP-ABE papers (verified) and adds six real
  client-side/end-to-end encrypted file-sharing papers, each verified against a source.
- His three names stay on the title slide; the build is credited in the report's acknowledgements.
- The public deployment is gated by an access code so strangers cannot register on the demo link.

## 7. Open items for Sugan

- The Google Cloud OAuth client id (five minutes, free, needs a Google account). Without it the
  Google button stays hidden and the app runs on the one-time code.
- Which URL he will present from: the tunnel, or a permanent Render deployment.

## 8. Notes

- Sugan answers in one line and prefers options: every question goes as a numbered list, he
  replies with letters.
- Messages from Sugan, in order: "B"; "D let's go with ouauth"; the access-control requirement;
  the reference PPT and reference PDF; "1A 2A 3B 4A"; "1B 2A 3B 4A 5A"; "By 8pm, review 3,
  secureshare"; "Lemme Also know how exactly this encryption works, what tech is used detail
  explanation"; "Open the local demo in aswath pc"; "Go with this tech make complete working
  site"; "Heyy, I wanna present this project to my faculty, so I would need to show how the file
  looks in the database as a encrypted cypher test and all, I wanna show that".
- Last inbound ts from Sugan: 1794664499 ("Thankyou"), answered with the rebuilt report, the
  rebuilt slides and the permanent link.
- Poll target: chat id `916380934581@s.whatsapp.net` (+91 63809 34581). English only. Never write
  an answer he did not give.
