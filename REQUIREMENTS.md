# SecureStream — requirements brief and build plan

Course: **21ECC402P — Computer Communication and Network Security**
Client: Sugan (WhatsApp "5UGAN", +91 63809 34581) — team: Pradeesh M (RA2311004010278), Varun P R
(RA2311004010287), Sugandhan A (RA2311004010297).
Owner: Aswath. Status: **awaiting Sugan's approval of this plan** — nothing further is built until
he approves.

## 1. What we are building

**SecureStream** — a web-based file-sharing system that protects files with end-to-end encryption
and lets the sender decide, per file, whether the recipient may only view it or may also download
it. Every user gets a key pair generated in their own browser; a file is encrypted before it
leaves the sender's device using the recipient's public key; the server stores ciphertext and
public keys only. Sign-in is Google OAuth with an email + one-time-code fallback. It runs
completely free: no paid service, no package to install.

## 2. Confirmed requirements

| # | Requirement | Source |
|---|---|---|
| R1 | Website to share files securely with end-to-end file encryption, mainly PDFs | Sugan |
| R2 | Users register; on registration each user gets a private key and a public key | Sugan |
| R3 | The file is encrypted before it leaves the website and shared to the selected user | Sugan |
| R4 | Access control set by the sender per file: the receiver may only **view** or may also **download** | Sugan |
| R5 | Authentication at registration — OAuth (Google sign-in), email + one-time code as the fallback | Sugan: "B", "3B" |
| R6 | Completely free — no paid services at any point | Sugan |
| R7 | Runs on localhost first; a second laptop on the LAN for the live demo; public deployment later | Sugan, Aswath |
| R8 | College submission, wanted today, 2026-11-14 | Sugan |
| R9 | Deliverables: working website, GitHub repo, report, PPT — PPT and report follow the formats he sent | Sugan |
| R10 | System name **SafeStream** | Sugan: "1A" |
| R11 | Keep the zero-dependency build; the report's Tools Used and Appendices describe what is really there | Sugan: "2A" |
| R12 | No role model. The sender's view/download permission is the access model; roles are future work | Sugan: "4A" |
| R13 | GitHub repo public | Aswath |
| R14 | The brief goes to Sugan as a WhatsApp message, with the same text committed here | Aswath |
| R15 | Deck title, report length, and the time it is needed today | **open** |

## 3. Build plan

### Phase 1 — Access control per share
Each share carries a permission chosen by the sender: `view` or `download`. The server stores it
with the share and returns it to the sender and the recipient only. In the interface, a `view`
share opens the decrypted file in the browser with no save affordance; a `download` share saves it.
**Stated honestly in the report:** with end-to-end encryption the recipient holds the plaintext
once decrypted, so this is an interface-level rule, not a cryptographic one.

### Phase 2 — Google sign-in alongside the one-time code
The Google Identity button returns an ID token; the server verifies it against Google's published
keys using Node's built-in crypto (no package added) and signs the user in. The browser still
generates the E2EE key pair for that account and keeps the private key in IndexedDB. The email +
one-time code path stays exactly as it is and is what the demo runs on. Activated by
`GOOGLE_CLIENT_ID`; without it the app behaves as it does today.

### Phase 3 — SafeStream and the demo
Rename the system, and ship a pre-seeded demo account pair with one file already shared, so a
grader sees the whole flow in a single browser. Real registration still works normally.

### Phase 4 — Real screenshots
Extend the headless Chrome test to capture every screen for the report's figures: home, register,
one-time code, share panel, inbox, view-only view, download, sent list.

### Phase 5 — The report
Following the format he sent (29-page reference): front matter (title, abstract, contents, list of
tables and figures, abbreviations), Chapter 1 Introduction (problem statement, objectives, chapter
outline), Chapter 2 Literature Review (related work, conventional-vs-E2EE comparison table, the
six-paper survey table with the verified citations, mathematical background with the key equations
and the AES key-space argument), Chapter 3 System Design and Methodology (logical architecture
figure, hardware and software requirements, stage table, the seven-step algorithm, testing
procedure), Chapter 4 Results and Discussion (the real screenshots, the test-case table, discussion
and limits), Chapter 5 Conclusion (review, conclusions, future work), References, Appendices
(program listing and raw data), Publication details. Delivered as docx and pdf.

### Phase 6 — The PPT
15 slides matching his reference section for section: title slide with the team and course code,
outline, introduction, abstract, literature survey across three slides, objectives, the three model
slides (without E2EE, end-to-end encryption, with E2EE) as clean diagrams, working principle,
tools used, conclusions, timeline.

### Phase 7 — Repo
Public, README with the run instructions and the demo script, decision log and change inventory
kept current, every phase committed and pushed.

## 4. What the demo looks like

1. Laptop 1: `npm start`, open the site, register — the key pair is generated in the browser.
2. Laptop 2 on the same LAN: register as the second user.
3. Laptop 1: pick a PDF, choose the recipient, choose view-only or download, send.
4. Laptop 2: the file appears under "Shared with me"; decrypt and open (or download) it.
5. The evidence for the exam: the server's disk holds ciphertext only, and a third user gets
   `403` on the file.

## 5. Limits, stated plainly

- View-only is enforced in the interface, not by cryptography.
- Google sign-in needs his client id and internet. The demo path (email + one-time code) needs
  neither and is what the two-laptop demo uses.
- No roles, no revocation, no audit trail, no integrity verification of the ciphertext beyond
  AES-GCM's own authentication tag.
- A lost device means a lost private key and unreadable files. No key backup yet.
- Single-node storage (a JSON file and a blob directory). Fine for a prototype, not a service.

## 6. Decisions I am taking without asking

- Stack stays as built: Node `node:http` + `node:crypto`, vanilla JS frontend, no npm
  dependencies — this is what makes R6 and R7 true.
- The report's Tools Used table and Appendix 1 describe the real implementation, not the reference
  deck's React/Django stack.
- The name placeholder "SecureShare" becomes **SafeStream** everywhere.
- The literature survey keeps his six ABAC/CP-ABE papers (verified) and adds four to six real
  client-side/end-to-end encrypted file-sharing papers, each verified against a source.
- His three names stay on the title slide; the build is credited in the report's acknowledgements.

## 7. Open items for Sugan

- Report length: full 29-page equivalent, or about 12-15 pages with the same chapters and
  figures (my recommendation), or one page.
- The time today it is needed by.
- Deck title: "REVIEW - 3" as in his deck, or "REVIEW - 4".
- The Google Cloud OAuth client id (five minutes, free). Without it the app and demo run on the
  one-time code.

## 8. Notes

- Sugan answers in one line and prefers options: every question goes as a numbered list, he
  replies with letters.
- Messages sent 2026-11-14: open ask, deliverable options, recipients + encryption location,
  deadline + deployment, demo scope + submission artifacts, auth options, free-only confirmation,
  build status + three questions, OAuth reality check, access-control acknowledgement, format
  requests, five-decision round, confirmation of 1A/2A/3B/4A.
- Last inbound ts from Sugan: 1794644783.
- Poll target: chat id `916380934581@s.whatsapp.net` (+91 63809 34581). English only. Never write
  an answer he did not give.
