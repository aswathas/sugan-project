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
| `server/index.js` | created, then extended with the per-share permission, Google sign-in, the public config endpoint, the ciphertext-head endpoint, the demo access code, the self-destruct timer, revocation, the opened marker, the audit trail and the hardening | auth, users, shares, blob download, static files; the sender's view/download choice is stored with the share and returned to both parties | `npm test` asserts the permission round trip, the access code, the expiry, the revocation and the lockout; `npm run test:browser` |
| `server/google.js` | created | verifies a Google ID token on the server with the public keys from Google, using `node:crypto` alone: RS256, issuer, audience, expiry, signature | `npm test` (googletest) refuses a wrong audience, a wrong issuer, an expired, a tampered, a forged and a malformed token |
| `server/trail.js` | created | the audit trail as a hash chain: each entry carries the SHA-256 of the one before it, and a verifier that reports the first break | `npm test` asserts the chain checks out and that the verifier finds a break |
| `server/store.js` | created | JSON store plus ciphertext blobs on disk; `DATA_DIR` overridable for tests | self-test runs against a temp data dir |
| `server/crypto.js` | created | scrypt password hashing and session tokens | self-test asserts a wrong password is rejected |
| `server/mailer.js` | created | delivers the registration one-time code: console mode by default (free, offline), a free provider behind `MAIL_MODE=resend` | self-test asserts the console code is issued and that an unverified account cannot sign in |
| `public/index.html` | created, then rewritten in the Wayfind world, then rewritten again as a Google Drive style dashboard shell, then given the drop zone, the progress bar, the self-destruct picker and the activity panel | the sign-in, register and verify screens; the send route; the Drive rail, the search box and the file cards | browser test drives these elements; screenshots reviewed by eye |
| `public/app.js` | created, then extended with the permission choice, the live mark, the view-only behaviour, the Google sign-in, the evidence panel, the dashboard state, the self-destruct picker, the revocation button, the integrity check, the activity feed and the upload progress | the client crypto, IndexedDB key storage, the share and open flows, the dashboard | browser test: private key non-extractable, file encrypted, recipient decrypts, dashboard counts, unread mark, revoked share, verified badge |
| `public/style.css` | rewritten onto the Hallmark scaffold with the Wayfind tokens and the stamp, then extended with the Drive layout, the drop zone, the progress bar, the badges and the activity feed | the interface had to look designed, not generated | `sloplint` reports zero findings; `impeccable detect` reports none; screenshots reviewed by eye |
| `public/tokens.css` | added from the Hallmark Wayfind scaffold | the token layer the Floor decides | part of the sloplint sweep |
| `public/base.css` | added from the Hallmark Wayfind scaffold | the base layer the Floor decides | part of the sloplint sweep |
| `public/fonts/chivo-mono.woff2` | added | the interface font, bundled so the demo runs offline | the rendered screenshots show the mono face |
| `public/fonts/OFL.txt` | added | the SIL Open Font License for Chivo Mono | read back after commit |
| `test/selftest.js` | created, then extended with the permission, access-code, expiry, revocation, audit-trail, lockout and sign-out assertions | end-to-end server contract check | `npm test` — 14 checks pass |
| `test/browsertest.js` | created, then extended to 1280x900, six screen captures, the dashboard counts, the unread mark, the self-destruct timer, the revocation and the verified badge | drives the real interface in two separate browser profiles | `npm run test:browser` — 9 checks pass |
| `test/googletest.js` | created | a local JWKS server and a throwaway RSA key, so the Google verification path is proven without calling Google | `npm test` — 4 checks pass |
| `tools/show-ciphertext.js` | created | prints, for every share, the name of the uploaded file next to the hex of the bytes the server really holds, and the path on disk | run against the demo data; the output matches the app's evidence panel |
| `render.yaml` | created, then extended with the authorised origins | a free Render blueprint for a permanent public URL: no build step, `HOST=0.0.0.0`, health check on `/api/config`, the authorised origins including the address the service will get from its name, the client id and the access code set in the dashboard | read back after commit |
| `tools/build-report.js` | created, then rebuilt by agy with the SRM logo title page, the college running header and a real contents field | builds the report from the Markdown draft, the figures and the screenshots | rendered to PDF and read page by page |
| `tools/build-deck.js` | created, then rebuilt by agy so the title slide follows the client's reference with the SRM logo, and extended with the feature slide and the new tables | builds the 16-slide REVIEW-3 deck from the same content | `validate.py` passes; every slide rendered and inspected |
| `docs/report-draft/front-matter.md` | created by the cmdc subagent | abstract, abbreviations, list of tables, list of figures | the assembled report was read back page by page |
| `docs/report-draft/ch1-introduction.md` | created by the cmdc subagent | problem statement, objectives, scope, chapter outline | the assembled report was read back page by page |
| `docs/report-draft/ch2-literature-review.md` | created by the cmdc subagent, then corrected by hand with verified citations and two fixes | related work, comparison table, the twelve-paper survey, the mathematical background | every citation checked against Crossref, OpenAlex, DBLP and Semantic Scholar |
| `docs/report-draft/ch3-system-design.md` | created by the cmdc subagent, then rewritten by cmdc for the new features | proposed system, architecture, requirements, stages, algorithm, the full HTTP interface, the data the server holds, testing procedure | the assembled report was read back page by page |
| `docs/report-draft/ch4-results.md` | created by the cmdc subagent, then section 4.4 rewritten to match the real screenshots, then rewritten by cmdc for the new checks | results of both test layers, the screen figures, discussion and limits | the six figures were captured by the browser test and inspected |
| `docs/report-draft/ch5-conclusion.md` | created by the cmdc subagent, then rewritten by cmdc so the future work no longer lists what has been built | review, conclusions, future work | the assembled report was read back page by page |
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
| `docs/brand/srm-logo.jpeg` | added | the SRM logo, extracted from the client's own reference deck so the report and the slides carry the real mark | the logo is used on the title page and on the first slide |
| `docs/reportspec-v2.md` | added | the brief given to the writing agent: the new features, the full interface, the check counts and what may not be invented | read back before the chapters were accepted |
| `docs/deck-rebuild-task.md` | added | the brief given to the agent that rebuilt the title slide | read back after the rebuild |
| `docs/report-rebuild-task.md` | added | the brief given to the agent that rebuilt the report builder | read back after the rebuild |
| `public/keyguard.js` | added | the extra keys in one place: the signing key, the password wrapping and the recovery phrase, all Web Crypto and no dependency | the browser test covers the signature, the password and the phrase |
| `tools/build-deliverables.js` | added | builds the report in two passes so the contents page carries the real page numbers, and renders the PDF | every contents entry was checked against the page it lands on |
| `docs/reportspec-v3.md` | added | the brief for the workspace and lifecycle part of the report | read back after the chapters were accepted |
| `docs/reportspec-v4.md` | added | the brief for the three extra keys in the report | read back after the chapters were accepted |
| `test/livecheck.js` | added | a read-only smoke test against a server that is already running: the site, the assets, the security headers, the configuration, the access code gate and the session gates | `npm run test:live` — 15 checks |
| `tools/test-all.js` | added | runs every check in the project and says how many steps passed | `npm run test:all` — 10 steps |
| `server/index.js` | the trash list is scoped to the two parties of a share; the share record keeps the second wrapped key, the stored byte count and the expiry the sender signed; the referrer policy and the content security policy were corrected | an audit found that any signed-in user could read every deleted share in the store, and that the header this project set for safety was what broke Google's sign-in button | `npm test` — 20 checks |
| `public/app.js` | the password wrap became a second wrap beside the recipient key; the signature covers the permission and the expiry; the expiry is chosen by the sender; a failed load says so instead of leaving skeleton cards; the blob URL lives long enough for the new tab; a Google account gets a signing key and a phrase; the storage panel counts the stored bytes; the details panel shows the chain and the receipt can be copied; the workspace announces arrivals and shows expiry on its own | twelve defects from the audit, and the report and the interface already promised the double wrap and the signed permission | `npm run test:browser` — 23 checks |
| `public/keyguard.js` | the signed payload carries the permission and the expiry | a server that flipped view-only into download would otherwise have changed the share without breaking the signature | `npm run test:browser` — the recipient sees verified and signed |
| `public/index.html` | the sign-in page was rebuilt to the sign-up anatomy with the workspace screen, the three moments, the real code, the questions and the close; the details panel gained the fingerprint, the signature, the stored bytes, the protection and the receipt button | the page described the product without showing it, and the reviewer needs the chain of one file in one place | `npm run test:browser` — the sign-in anatomy and the details chain |
| `public/style.css` | the styles for the anatomy, the moments, the code sample, the questions and the close; the rail becomes one scrolling row below 60rem with the storage and people blocks behind a Details disclosure | a phone showed three screens of chrome before the first file | `npm run test:all` — sloplint clean |
| `public/anatomy.js` | added | the close of the sign-in page switches to the register tab and puts the cursor in the username field | `npm run test:browser` — the sign-in anatomy |
| `public/favicon.svg` | added | the browser asked for a favicon that did not exist, and the tab had no mark | `npm test` — the favicon must be served |
| `public/shots/workspace.png`, `public/shots/encrypted.png`, `public/shots/verified.png` | added | the sign-in page shows the real screens of the product rather than a drawing of them | read in the browser at 1280 and 390 pixels |
| `test/selftest.js` | the trash must not hold another user's deleted shares; the headers and the favicon must leave the Google button working | both were defects that the suite did not cover | `npm test` — 20 checks |
| `test/browsertest.js` | the sign-in assertion now checks the anatomy, the three moments, the code sample and the questions; three checks added for the details chain, the receipt and the arrival announcement | the old assertion tested a panel the anatomy replaced, and the new behaviour needed its own checks | `npm run test:browser` — 23 checks |
| `docs/report-draft/ch3-system-design.md`, `docs/report-draft/ch4-results.md`, `docs/report-draft/appendices.md` | the signed string, the sender-set expiry, the two wraps, the new test cases and the real counts | the report has to agree with the repository | the report builder and the contents check |
| `docs/agents/login-anatomy.md`, `docs/agents/appendix-rewrite.md`, `docs/agents/report-sync.md` | added | the briefs given to the agents, so the work they did can be checked | read back after the agents finished |
