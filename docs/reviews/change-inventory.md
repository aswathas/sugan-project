# Change inventory

| File | What changed | Why | How verified |
|---|---|---|---|
| `README.md` | created, then rewritten with run instructions, the demo script, the security design, the stated limits and links to the report and slides | the front door of a public repository | read back after commit |
| `REQUIREMENTS.md` | created, then rewritten after each client answer and again for the final agreed scope | the brief: confirmed facts, open holes, the agreed technical shape | read back after commit |
| `AGENTS.md` | created | harness-neutral agent file with the `## Agent skills` block | read back after commit |
| `PRODUCT.md` | created | durable product truth for the design skills: users, purpose, positioning, operating context, capabilities, brand commitments, evidence, principles, accessibility | read back after commit |
| `GLOSSARY.md` | created | domain vocabulary agreed with the client | read back after commit |
| `.impeccable/config.json` | created | records the code-first build path for app screens | read back after commit |
| `.impeccable/surface-brief-app.md` | created | the direction contract for the interface: thesis, own-world, story, first viewport, form, seed reference | read back after commit |
| `.hallmark/salt` | created | the seed of the Wayfind theme deal, kept so the theme can be reproduced | read back after commit |
| `package.json` | created | `npm start` and the two test scripts; no dependencies field on purpose | `npm test` and `npm run test:browser` both run |
| `.gitignore` | created | keep `data/` (users, ciphertext blobs) out of git | `git status` clean after a test run |
| `server/index.js` | created, then extended with the per-share permission | auth, users, shares, blob download, static files; the sender's view/download choice is stored with the share and returned to both parties | `npm test` asserts the permission round trip; `npm run test:browser` |
| `server/store.js` | created | JSON store plus ciphertext blobs on disk; `DATA_DIR` overridable for tests | self-test runs against a temp data dir |
| `server/crypto.js` | created | scrypt password hashing and session tokens | self-test asserts a wrong password is rejected |
| `server/mailer.js` | created | delivers the registration one-time code: console mode by default (free, offline), a free provider behind `MAIL_MODE=resend` | self-test asserts the console code is issued and that an unverified account cannot sign in |
| `public/index.html` | created, then rewritten in the Wayfind world | the sign-in, register and verify screens; the send route; the two boards | browser test drives these elements; screenshots reviewed by eye |
| `public/app.js` | created, then extended with the permission choice, the transfer board, the live mark and the view-only behaviour | the client crypto, IndexedDB key storage, the share and open flows | browser test: private key non-extractable, file encrypted, recipient decrypts |
| `public/style.css` | rewritten onto the Hallmark scaffold with the Wayfind tokens and the stamp | the interface had to look designed, not generated | `sloplint` reports zero findings; `impeccable detect` reports none; screenshots reviewed by eye |
| `public/tokens.css` | added from the Hallmark Wayfind scaffold | the token layer the Floor decides | part of the sloplint sweep |
| `public/base.css` | added from the Hallmark Wayfind scaffold | the base layer the Floor decides | part of the sloplint sweep |
| `public/fonts/chivo-mono.woff2` | added | the interface font, bundled so the demo runs offline | the rendered screenshots show the mono face |
| `public/fonts/OFL.txt` | added | the SIL Open Font License for Chivo Mono | read back after commit |
| `test/selftest.js` | created, then extended with the permission assertion | end-to-end server contract check | `npm test` — 7 checks pass |
| `test/browsertest.js` | created, then extended to 1280x900 and six screen captures | drives the real interface in two separate browser profiles | `npm run test:browser` — 5 checks pass |
| `tools/build-report.js` | created | builds the 43-page report from the Markdown draft, the figures and the screenshots | rendered to PDF and read page by page |
| `tools/build-deck.js` | created | builds the 15-slide REVIEW-3 deck from the same content | `validate.py` passes; every slide rendered and inspected |
| `docs/report-draft/front-matter.md` | created by the cmdc subagent | abstract, abbreviations, list of tables, list of figures | the assembled report was read back page by page |
| `docs/report-draft/ch1-introduction.md` | created by the cmdc subagent | problem statement, objectives, scope, chapter outline | the assembled report was read back page by page |
| `docs/report-draft/ch2-literature-review.md` | created by the cmdc subagent, then corrected by hand with verified citations and two fixes | related work, comparison table, the twelve-paper survey, the mathematical background | every citation checked against Crossref, OpenAlex, DBLP and Semantic Scholar |
| `docs/report-draft/ch3-system-design.md` | created by the cmdc subagent | proposed system, architecture, requirements, stages, algorithm, interface, testing procedure | the assembled report was read back page by page |
| `docs/report-draft/ch4-results.md` | created by the cmdc subagent, then section 4.4 rewritten to match the real screenshots | results of both test layers, the screen figures, discussion and limits | the six figures were captured by the browser test and inspected |
| `docs/report-draft/ch5-conclusion.md` | created by the cmdc subagent | review, conclusions, future work | the assembled report was read back page by page |
| `docs/report-draft/references.md` | created by hand from the verified survey | fifteen references with DOIs | every entry checked against Crossref |
| `docs/report-draft/appendices.md` | created by the cmdc subagent | program listing, raw test data, environment | the assembled report was read back page by page |
| `docs/figures/01-architecture.svg` | created by the agy subagent | logical architecture of the system | rasterised and inspected |
| `docs/figures/02-without-e2ee.svg` | created by the agy subagent | the conventional model | rasterised and inspected |
| `docs/figures/03-e2ee.svg` | created by the agy subagent | how one share is encrypted, wrapped and delivered | rasterised and inspected |
| `docs/figures/04-with-e2ee.svg` | created by the agy subagent | the proposed model | rasterised and inspected |
| `docs/figures/05-working-principle.svg` | created by the agy subagent | the seven steps coloured by where they run | rasterised and inspected |
| `docs/figures/png/01-architecture.png` | generated | the report and slide copy of the architecture figure | used in the report, inspected in the rendered pages |
| `docs/figures/png/02-without-e2ee.png` | generated | the report and slide copy of the conventional model | used in the report, inspected in the rendered pages |
| `docs/figures/png/03-e2ee.png` | generated | the report and slide copy of the encryption explanation | used in the report, inspected in the rendered pages |
| `docs/figures/png/04-with-e2ee.png` | generated | the report and slide copy of the proposed model | used in the report, inspected in the rendered pages |
| `docs/figures/png/05-working-principle.png` | generated | the report and slide copy of the working principle | used in the report, inspected in the rendered pages |
| `docs/screenshots/00-register.png` | captured by the browser test | the registration form with the key-generation note | inspected by eye |
| `docs/screenshots/01-verify.png` | captured by the browser test | the one-time code step | inspected by eye |
| `docs/screenshots/02-share-panel.png` | captured by the browser test | the send route with the recipient and the access-control choice | inspected by eye |
| `docs/screenshots/03-sent.png` | captured by the browser test | the sender's sent list | inspected by eye |
| `docs/screenshots/04-inbox.png` | captured by the browser test | the recipient's board with the live mark | inspected by eye |
| `docs/screenshots/05-decrypted.png` | captured by the browser test | the board after decryption, the mark retired | inspected by eye |
| `docs/tasks/report-draft-task.md` | created | the brief given to the cmdc subagent, kept so the work can be repeated | read back after commit |
| `docs/tasks/figures-task.md` | created | the brief given to the agy subagent, kept so the work can be repeated | read back after commit |
| `report/SecureShare-Project-Report.docx` | generated | the report deliverable | 43 pages, zero missing figures, all images embedded, pages inspected |
| `report/SecureShare-Project-Report.pdf` | generated | the report deliverable in PDF | 43 pages, inspected page by page |
| `report/SecureShare-REVIEW-3.pptx` | generated | the slides deliverable | `validate.py` passed; every slide inspected |
| `report/SecureShare-REVIEW-3.pdf` | generated | the slides deliverable in PDF | 15 slides, every slide inspected |
| `docs/adr/0001-client-side-keypairs-and-browser-side-encryption.md` | created | pins the core architecture decision | read back after commit |
| `docs/agents/issue-tracker.md` | copied from the Pocock seed template | where issues live (GitHub via `gh`) | `gh label list` succeeded against the repo |
| `docs/agents/triage-labels.md` | copied from the Pocock seed template | role-to-label mapping | the five labels exist on the repo |
| `docs/agents/domain.md` | copied from the Pocock seed template | how skills read GLOSSARY.md and ADRs | copied from template |
| `docs/reviews/decision-log.md` | created, then rewritten with each decision | standing commit-discipline rule | read back after commit |
| `docs/reviews/change-inventory.md` | created, then rewritten with one row per file | standing commit-discipline rule | read back after commit |
