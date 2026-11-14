# Decision log

| Date | Decision | Why | Source |
|---|---|---|---|
| 2026-11-14 | Client is Sugan ("5UGAN", +91 63809 34581), not "Suguthan Mom" and not "Ganesh M VIT AP Sugandhan" | Both earlier identifications were wrong; user pointed at the 5UGAN chat | "5UGAN / +91 63809 34581 ask him everything" |
| 2026-11-14 | Requirements come from interviewing Sugan on WhatsApp, not from assumptions | The requirement is unknown by definition | "/aswath-thevai" |
| 2026-11-14 | English only in every message to Sugan | User instruction | "he is my friend use english only" |
| 2026-11-14 | New git repo for the project, kept updated and linked to a GitHub repo | User instruction | "lets create git repo and local folder linked with it lets keep it updated" |
| 2026-11-14 | Requirement gathering is a drip: one topic per message, at most two questions per message, all as numbered options | Avoids an interrogation blast on a friend; Sugan answers in one line | aswath-thevai rules + "grill him give options" |
| 2026-11-14 | Cron poller 40ac6d6c deleted; the live conversation runs in-session | Two pollers would double-message Sugan | — |
| 2026-11-14 | GitHub repo `aswathas/sugan-project` created, local folder linked as `origin`, `main` pushed | User asked for a linked repo | user answer on tracker |
| 2026-11-14 | Repo made **public** | User instruction | user instruction |
| 2026-11-14 | Issue tracker = GitHub Issues via the `gh` CLI; PRs-as-request-surface left off | Section A choice; `gh` is authenticated and the remote exists | user answer |
| 2026-11-14 | Agent file = `AGENTS.md` (repo had neither `CLAUDE.md` nor `AGENTS.md`) | Setup rule: never pick for the user | user answer |
| 2026-11-14 | Triage labels = the five defaults, created on the repo | Section B default; no override given | — |
| 2026-11-14 | Domain docs = single-context (`GLOSSARY.md` + `docs/adr/`) | No monorepo signals in the repo | — |
| 2026-11-14 | ADR 0001 written: client-side key pairs, browser-side encryption, ciphertext-only server | Core architecture the client specified; worth pinning in one file | Sugan's answers |
| 2026-11-14 | `setup-matt-pocock-skills`, `triage`, `to-spec`, `to-tickets`, `grilling`, `grill-me`, `grill-with-docs` linked into `~/.claude/skills` | They existed in the agent store but were invisible to this harness, so `/grill` and the Pocock skills could not run | "use /ponytail /grill , setmatt pocock skills" |
| 2026-11-14 | `impeccable`, `hallmark`, `design-taste-frontend`, `frontend-design`, `improve-ui`, `baseline-ui` linked into `~/.claude/skills` | The same invisible-to-the-harness problem for the design skills | "use /impeecble hall mark , for the design also use all the needed skills and do a good ui" |
| 2026-11-14 | Repo slug `sugan-project` | Project subject was unknown at creation | — |
| 2026-11-14 | **Zero npm dependencies** — `node:http`, `node:crypto`, vanilla JS frontend, JSON store on disk | Sugan's hard constraint: "completely free website", "I don't wanna pay for any service". Also means nothing to install on a random laptop in the exam hall | Sugan |
| 2026-11-14 | Hybrid encryption: one AES-GCM 256 key per file, wrapped with the recipient's RSA-OAEP 2048 public key | Standard hybrid scheme; server only ever holds ciphertext; per-recipient encryption falls out of the key model the client described | ADR 0001 |
| 2026-11-14 | Private key kept in the browser as a **non-extractable** `CryptoKey` in IndexedDB | It cannot leave the device even if the page is compromised | client requirement |
| 2026-11-14 | Passwords hashed with scrypt, sessions as server-side tokens in an `HttpOnly` cookie | Never store or log a plaintext password | — |
| 2026-11-14 | Verification in two layers: a Node self-test for the server contract, plus a headless Chrome test driving the real UI with two separate browser profiles | Two profiles give genuinely separate cookies and IndexedDB, the only honest way to prove one user cannot read another's file. Chrome is driven over CDP with Node's built-in WebSocket, so no test dependency is added | ponytail "lazy code without its check is unfinished" |
| 2026-11-14 | Screenshots captured during the browser test and reviewed by eye | Visual QA, not assumption | aswath-thevai QA rule |
| 2026-11-14 | Auth narrowed to A (username + password) or C (password + keypair challenge) | "Completely free, no paid services" rules out email OTP and Google sign-in for a localhost demo | Sugan |
| 2026-11-14 | Deliverables fixed: working website, public GitHub repo, report and PPT, both following the exact formats he sent | "I need working website GitHub repo and report and ppt of format I'll send below" | Sugan |
| 2026-11-14 | Report structure = his 29-page reference; PPT = his 15-slide REVIEW deck, section for section | He sent both templates: `CCN-final review-E2EE.pptx` and the report PDF | Sugan |
| 2026-11-14 | System named **SecureShare**; deck title **REVIEW - 3** | His answers "1B" and "review 3" | Sugan |
| 2026-11-14 | Keep the zero-dependency build; the report's Tools Used table and Appendix 1 describe the real implementation, not the reference deck's React/Django stack | His answer "2A" — the deck's stack was a template, not what we build | Sugan |
| 2026-11-14 | Google sign-in added on top of the email + one-time code; the one-time code stays the demo path | His answer "3B". Google only accepts localhost redirects, so a plain LAN two-laptop demo cannot use OAuth | Sugan |
| 2026-11-14 | No role model. The sender's per-file view-or-download permission is the access model; roles are future work | His answer "4A" | Sugan |
| 2026-11-14 | Full 29-page report, not a shortened one | His answer "5A" | Sugan |
| 2026-11-14 | Deadline 8pm on 2026-11-14 | "By 8pm, review 3, secureshare" | Sugan |
| 2026-11-14 | No further building until Sugan approves the whole plan | Aswath's instruction | user instruction |
| 2026-11-14 | The three students stay on the title slide; the builder is credited in the report's acknowledgements | Aswath's decision | user instruction |
| 2026-11-14 | Per-share permission implemented as a two-cell choice (view only / view and download), stored with the share, and stated in the report as an interface rule rather than a cryptographic one | His requirement R4; the honest limit is part of the deliverable | Sugan + ADR 0001 |
| 2026-11-14 | Interface redesigned in the **Wayfind** world (paper, blue-black ink, Chivo Mono, 2 px ink borders, cobalt for what is live, amber for figures) | Hallmark theme deal; Wayfind suits a crypto tool that must also print into a report, and its departure-board grammar maps onto the transfer board | user instruction + hallmark deal |
| 2026-11-14 | Chivo Mono bundled as a local variable woff2 with its OFL licence | The demo must run offline; a hosted font link would fail with no network | — |
| 2026-11-14 | Design direction pinned from the brief and the theme deal rather than run through concept-seed's roll, with the challengers' disciplines taken as named raises | The user pinned the design skill and the theme; a pinned direction beats the roll | new-work.md |
| 2026-11-14 | `impeccable detect` and `hallmark sloplint` both run clean over the finished interface | The skills' own gates; sloplint reports zero findings and the detector reports none | hallmark + impeccable |
| 2026-11-14 | Literature survey verified against Crossref, OpenAlex, DBLP and Semantic Scholar; two of the team's own citations corrected (a truncated title, and a venue given as "Peer-Reviewed Research") and six verified client-side/E2EE papers added | The report must not cite anything unverified, and two entries in the reference were wrong | research subagent |
| 2026-11-14 | Report and deck built by scripts in `tools/` from the Markdown draft and the figures, with `docx` and `pptxgenjs` installed outside the repository | The application must stay dependency-free; the build tools are not the product | — |
| 2026-11-14 | Subagents used for the report draft (cmdc, deepseek v4.1 flash) and the five technical figures (agy, Gemini 4 Hydrogen) | Both are large, well-specified, parallelisable writing or drawing tasks that do not touch the same files as the interface work | user instruction to orchestrate |
| 2026-11-14 | The signed-in screen became a Google Drive style dashboard: a left rail (Shared with me / Sent by me / Recent with counts), a search box in the band, file cards with a permission badge, and a New route | The client asked for it in those words; a file list is what he will show to the faculty | `npm run test:browser` asserts the counts, the unread mark and the card actions; screenshots reviewed by eye |
| 2026-11-14 | Google sign-in added: the browser gets the ID token from Google Identity Services, the **server** verifies it against Google's public keys with `node:crypto` (RS256, issuer, audience, expiry, signature), and the account is linked to that subject | A client-side decode would trust the browser; the key point of the project is that nothing is trusted but the user's own browser | `npm test` (googletest) refuses a wrong audience, a wrong issuer, an expired, a tampered, a forged and a malformed token |
| 2026-11-14 | Registration is gated by `ACCESS_CODE` when the env var is set, and the check runs **before** any other validation | A public demo link must not accept registrations from strangers, and a rejected stranger must not be able to learn which usernames exist | `npm test` asserts 403 without the code, 403 with the wrong code, 201 with the right code; checked live over the tunnel |
| 2026-11-14 | Fixed a real bug in the access-code guard: it read `body.accessCode` from a name that did not exist, so every registration failed with "body is not defined" and the guard was never actually reached | The live demo would have been broken and the gate would have been a lie | `npm test` covers it; the live server returns 201 with the code and 403 without it |
| 2026-11-14 | The public tunnel forwards to `127.0.0.1:3000`, not `localhost:3000` | `localhost` resolves to `::1` first on this machine, the server listens on IPv4, and the tunnel edge answered "no tunnel" for every request | the tunnel URL was probed with `curl` until it answered `/api/config` |
| 2026-11-14 | `render.yaml` added for a permanent free URL, with the client id and the access code set in the Render dashboard rather than in the file | The tunnel URL rotates and dies with this session; a presentation needs a stable link | read back after commit |
| 2026-11-14 | The evidence panel was added to the app: after a send it shows the sender's first 16 bytes next to the bytes the server really holds, plus the path on disk | The client needs to show his faculty that the file is encrypted at the back | `npm run test:browser` asserts the two byte strings differ and that the panel names the on-disk path |
| 2026-11-14 | Four features added to the application: a self-destruct timer, revocation by the sender, an end-to-end integrity fingerprint, and an audit trail | The client asked for the scope to grow, and these are the four things a reviewer of a secure file-sharing system asks about first | `npm test` and `npm run test:browser` cover all four |
| 2026-11-14 | The audit trail is a **hash chain**: each entry carries the SHA-256 of the entry before it, and `GET /api/activity/verify` walks it | A plain log can be edited without trace; a chain turns the log into evidence | `npm test` asserts the chain checks out and that the verifier reports a break |
| 2026-11-14 | The integrity fingerprint is a SHA-256 of the plaintext, computed in the browser, and it is stored on the server | It is the only way the recipient can check the bytes that arrived against the bytes that were sent. The leak is stated plainly in the report: the server holds a fingerprint of the content | `npm test` asserts the fingerprint round trip; the browser test asserts the card reads *verified* after decryption |
| 2026-11-14 | Hardening added: security headers on every response, a lockout after five failed sign-ins or wrong codes, a password minimum of eight, sign-out everywhere, a 25 MB file limit and a cap of 200 files per account | A security project is judged on the boring parts too | `npm test` asserts the lockout, the sign-out and the chain |
| 2026-11-14 | A Google Cloud project `secureshare-e2ee-2026` was created and a web OAuth client id issued for it, with `http://localhost:3000` as the only authorised JavaScript origin | The client asked for Google OAuth and offered to authorise. The tunnel host rotates, so a rotating origin could never be authorised | the client id is published by `GET /api/config` and the button appears on the live site |
| 2026-11-14 | Only the **client id** is used. The client secret was never needed and is not stored | The server verifies the identity token with Google's published keys, so it never has to act as a confidential client | `npm test` (googletest) proves the verification path with no secret anywhere |
| 2026-11-14 | The report and the deck were rebuilt to the client's own reference: the SRM logo was extracted from his reference deck, the title page now carries it, the deck's first slide follows his layout exactly | He said the report must be exactly the reference, with the SRM logo | the deck was rendered and read page by page; `validate.py` passes |
| 2026-11-14 | The report chapters were rewritten by cmdc and the two builders by agy (Gemini 4 Hydrogen) | The writing and the layout are large, well-specified tasks that do not touch the same files as the application | the built report was rendered and read page by page |
| 2026-11-14 | agy-wsl could not be used: every tool call in that environment is refused by a pre-tool hook | The work was given to agy on Windows instead, which ran it | the deck and report builders were changed and both were rebuilt and checked |
| 2026-11-14 | The Google button only appears on an origin the OAuth client was given: the server publishes the authorised origins and the page checks its own origin against them | Google answers an unauthorised origin with `origin_mismatch`, which is an error the user cannot act on. Better to say where Google sign-in does work | the browser test asserts the button appears on the published origin; the live check asserts the origins are published |
| 2026-11-14 | One command runs every check: `npm run test:all` | A reviewer should be able to see the whole state of the build in one command | the script runs the server suite, the Google suite, the browser suite, the live check, the design gate, the detector, both builders, the deck validation and the contents check |
| 2026-11-14 | The Render blueprint names the service `secureshare`, so its address is known before it exists and the authorised origins can be written into the blueprint | The Google button only appears on an origin the OAuth client was given, and the client's address is only known after the service is created | the live check asserts the origins are published and the browser test asserts the button appears on the published origin |
| 2026-11-14 | The trash list is scoped to the two parties of a share, after the audit found it was filtered on the deletion time alone | every deleted share in the store was handed to whoever was signed in, and the client was hiding them rather than the API refusing them | `npm test` — another user's deleted shares must not appear in my trash |
| 2026-11-14 | A password protected share is really wrapped twice: the file key goes to the recipient's RSA-OAEP key and, when a password is set, to a key derived from that password | the interface and the report both said the key was wrapped twice, and the code wrapped it once. The signature and the fingerprint already proved the file was the sender's; the second lock was the missing half | `npm run test:browser` — the wrong password is refused and the right one opens the file, and both wraps must yield the same key |
| 2026-11-14 | The signature covers the permission and the expiry as well as the parties, the file and the fingerprint | the permission is what the recipient relies on when it decides whether the file may be saved, and it came from the server with nothing binding it to the sender | `npm run test:browser` — the recipient sees verified and signed |
| 2026-11-14 | The sender sets the moment the file dies and the server stores exactly that value | the expiry has to be inside the signed string, and the recipient has to be able to rebuild it from the metadata. The server refuses an expiry in the past or more than thirty days away | `npm test` — the server contract covers the expiry; the browser test signs and checks it |
| 2026-11-14 | The referrer policy is `strict-origin-when-cross-origin`, not `no-referrer` | Google's sign-in button endpoint answers 400 when the request carries no referrer, so the header the project set for safety was the reason the button was broken on the live site | a request to the button endpoint answers 200 with a referrer and 400 without one |
| 2026-11-14 | The content security policy allows the Google stylesheet, and the page links a favicon | the button rendered without its own stylesheet and the browser asked for a favicon that did not exist | `npm test` — the headers and the favicon leave the Google button working |
| 2026-11-14 | The sign-in page was rebuilt to the sign-up anatomy: the action with its terms, the workspace as a captured screen, three named moments, the real code, the questions, and the action again at the close | the page said what the product does but never showed it, and the faculty will judge the project on this screen | `npm run test:browser` — the three moments, the code sample and the questions are on the page |
| 2026-11-14 | The details panel shows the whole chain for one file and the receipt can be copied | a reviewer asks what the server holds and who vouched for the file; the answer should be on the card, not in the source | `npm run test:browser` — the details panel shows the chain and the receipt can be copied |
| 2026-11-14 | The workspace watches itself: a share that arrives is announced and a share that expires says so without a click | the expiry is decided by the clock, and a two-machine demo should show the file landing | `npm run test:browser` — a file that arrives is announced |
| 2026-11-14 | A Google account gets a signing key, a recovery phrase and a backup, like a password account | a Google account had no way back onto a second device, so files sent to it could never be opened again | `npm run test:browser` — both accounts hold a twelve word phrase and a wrapped key on the server |
| 2026-11-14 | The share password needs at least ten characters | four characters is a few GPU hours against the wrapped key the server holds | the browser test opens a password protected share with an eleven character password |
| 2026-11-14 | The agents were run through the `agy` and `cmdc` command lines directly, not through the ORCHID wrapper | the user asked to be the orchestrator and to drive the agents without the wrapper | `docs/agents/*.md` holds each brief and the agents reported what they changed |
| 2026-11-14 | The pstack skills were linked into the harness from the agent store | they lived in `~/.agents/skills` where no harness could see them | `ls ~/.claude/skills` lists pstack-tdd, pstack-teach and setup-pstack |
| 2026-11-14 | The report was brought back into step with the code: the signed string, the sender-set expiry, the two wraps, the new test cases and the real check counts | the report has to agree with the repository, and a reviewer who reads the appendix against the code will find it otherwise | the report builder and the contents check: 43 entries, none wrong |
| 2026-11-14 | The deck's feature slide was shortened to ten lines at eleven points | the tenth bullet ran off the bottom of the slide | the deck was rendered and read; the validator passes |
| 2026-11-14 | Second factor = a time-based one-time password from an authenticator app (RFC 6238), Google Authenticator compatible | The email code needs a mail service and a network; the authenticator code needs neither and is what a reviewer means by two-step | user: "FOR 2 STEP EMAIL CODE WHATS CAN WE DO ? OR CAN WE KEEP GOOGLE AUTHENTICATOR" |
| 2026-11-14 | The email one-time code stays for the first sign-in | It proves the address belongs to the person who registered; the authenticator code proves the person signing in holds the device. They answer different questions | as above |
| 2026-11-14 | The authenticator secret is shared with the server, so the factor is called a second factor and not a second key | A server that holds the secret could generate a valid code itself; true of every authenticator app, and stated in the report rather than hidden | design |
| 2026-11-14 | The password is checked first, the session is withheld, and the challenge is answered separately | A second factor that issues the session before the code is given is not a second factor | design |
| 2026-11-14 | The authenticator codes are computed with node:crypto only, with no dependency | The project has no npm dependencies and the demonstration must not fail on a missing package | project rule |
| 2026-11-14 | Turning the factor on or off both require a valid code | An open session must not be able to remove the factor that is protecting it | design |
| 2026-11-14 | The anatomy of the product is one component: the content is data, the markup is built from it, and it is mounted on the sign in page and in the how-it-works panel | One copy of the truth, two places it lives; the user asked whether the anatomy was a component | user: "is there anatomy conmponent?" |
| 2026-11-14 | The anatomy moved out of static markup into the component | Two hand-written copies of the same page drift; the component cannot | as above |
| 2026-11-14 | The live piece of the anatomy is a WebGL cipher field, not a logo or a decorative 3D scene | The page has to show the mechanism, and a wave of encryption crossing a file of bytes is the mechanism; drawn in the paper, ink, cobalt and amber of the theme it stays inside the design language | user: "what about working anatomy webgl" |
| 2026-11-14 | The bytes printed under the drawing are produced by the browser at that moment, with a fresh AES-GCM key | A picture of ciphertext proves nothing; the hex under the field is the ciphertext the same browser just produced, so the claim on the page is checkable | design |
| 2026-11-14 | The wave travels left to right and the region behind it is the ciphertext | The file is encrypted as the wave passes, so the finished state is random bytes and the start is ordered ones | design |
| 2026-11-14 | The cipher field is drawn on the sign-in page only, not in the how-it-works panel | One canvas on the page is enough, and a second one would cost a GPU context for a reader who is already signed in | design |
| 2026-11-14 | The deck grew to seventeen slides, with one for the sign-in page | The anatomy and the cipher field are the part of the product a reviewer sees first, and they were not on any slide | — |
| 2026-11-14 | The hand-built anatomy component was removed and the page carries static markup again | The user asked for the old anatomy component to go, in favour of the anatomy from the wheresryan22 repository | user: "please remove the old anatomy component please" |
| 2026-11-14 | The anatomy is the wheresryan22 skill, installed into the shared store and linked into the harnesses | The user named that repository as the anatomy they meant; the kit was already the source of the drawing system it uses | user: "i told you to add https://github.com/wheresryan22/anatomy" |
| 2026-11-14 | The kit is vendored under tools/figure/kit, and the figure is built by a script in the repository | A build that needs a skill installed elsewhere cannot be rebuilt by anyone else, and the report claims the figure is built with the code | design |
| 2026-11-14 | The figure is generated outside public/ and served from /figure/ | The kit brings its own design system and its own contrast profile, so the design gate must scan the app's own files and not the generated page | design |
| 2026-11-14 | The framing header goes from DENY to SAMEORIGIN, and the policy gains frame-ancestors self | The sign in page frames the figure, and a third party still cannot frame any page of the site | design |
| 2026-11-14 | The recovery phrase is shown when it is made, when the backup fails, and when it is asked for, and never on an ordinary sign in | The phrase panel opened over the workspace every time, which is the interruption the user reported; a phrase a person must scroll past is a phrase nobody keeps | user: "first remove that popup page opening when clicking sign in" |
| 2026-11-14 | The registration form asks for the password twice, and the server checks the pair as well | A typo must not lock a person out of their own account, and the check cannot live only in the browser | user: "also ask a confirm password in register page" |
| 2026-11-14 | The figure is a Figure, not a Hero | One mechanism of about seventy parts suits a sign in page; a Hero with several shader layers is two to four hours of work for no gain here | design |

## D9 - The evidence panel is gone; the real files are the terminal

- Prompt: "What the server actually stored ... i dont want this compoenent rather open the server backend and show the real files, so tell me how to open the backedn render or wherever th files got stored".
- Decision: the panel that showed the first sixteen bytes of the file next to the first sixteen bytes on the server was removed from the page, and the way to see the real files is the folder the server writes to, `data/blobs/<id>.bin`, or `npm run show:ciphertext`, which prints the hex of every stored blob.
- Alternatives considered: (a) keep the panel and explain it, which is what was there; (b) hide it behind a link, which leaves the code and the endpoint in place; (c) delete the panel, its script, its styles and the endpoint that only it used, and point at the disk instead.
- How: the panel was a screenshot of the proof, not the proof. `data/blobs` is the proof and can be opened in any hex viewer. The endpoint `/api/shares/:id/cipher-head` had no other caller and went with it.
- Evidence: `npm run show:ciphertext` prints the stored bytes of every share beside the name of the file the sender uploaded; the browser suite runs without the panel and the check that read it was rewritten to count the share instead.
- Consequence: the app is shorter and the demonstration is a terminal, not a screenshot of it.

## D10 - The sign-in page keeps only the sign-in

- Prompt: "the login page is cluttered i want old login page flow but anatomy component should come after the login sign hero section use /ponytail and think replace things".
- Decision: the page is hero and form, then the sealing press, then one line that opens the explanation. The workspace shot, the three moments, the code sample and the questions fold into a single disclosure.
- Alternatives considered: (a) delete the explanation, which would lose the code sample the report and the test both rely on; (b) move it to a page of its own, which is more code for the same result; (c) fold it into one disclosure, which keeps every word and one click away.
- Evidence: the page is 2,326 pixels tall now and was 5,746. The browser suite still reads the three moments, the code sample and the questions from the page, because they are in the document.
- Consequence: a visitor sees the claim, the form and the machine; the proof is one line down.

## D11 - The session survives a reload, and signing out asks for the code

- Prompts: "our login should be stored in browser cookes or for sometime becuase i cant login every single time after realoading"; "everytime we login / logout it should ask"; "also we need a qr scanner to connect authenicator".
- Decision: three changes. The page asks the server who it is on load and returns to the workspace when the cookie is still good. Signing out asks for the authenticator code when the account has a factor. The authenticator setup shows a QR code the phone camera reads.
- Alternatives considered: (a) store the session in local storage, which is readable by any script on the page and buys nothing, because the server session and its HttpOnly cookie already last seven days; (b) ask for the code only at sign-in, which leaves a borrowed machine able to end the session; (c) write the QR encoder by hand, when a small MIT encoder does the job.
- How: `restoreSession()` calls `/api/me` and rebuilds the signed-in state from the cookie and the key in IndexedDB. `POST /api/logout` and `/api/logout-all` verify the code when the account has a secret. The QR is drawn by `qrcode-generator`, vendored under `public/vendor`, so no third party is contacted and the policy needs no change.
- Evidence: the browser suite has three new checks: the setup shows a scannable code, a wrong code does not end the session, and a reload keeps the session.
- Consequence: a reload is free, a borrowed machine cannot sign you out, and the phone is enrolled by pointing a camera at the screen.

## D12 - The audit must fix findings, and the figure must move

- Prompts: "/ponytail:ponytail-audit" and the request for the anatomy figure on the sign-in page.
- Decision: the three must-fix findings from the audit were fixed: the audit trail keeps an anchor when the log is trimmed, a share without a fingerprint is refused, and the database write is atomic. The figure measures its own rectangle instead of trusting an observer, because an observer inside a lazily loaded frame reported it as out of view and the press stood still.
- Evidence: the server suite gained the trail and fingerprint checks; the browser suite watches the head of the press and the readout across a whole cycle and requires at least two states.
- Consequence: the chain survives the cut, the store refuses an unsigned share, and the machine on the sign-in page works.

## D13 - The whole trip of one file, in three dimensions

- Prompt: "i like the 3d approach but what skill we gonna use check internet find skill and tell me",
  then "continue building".
- Decision: the showcase is its own page, `figure/journey.html`, built with three.js r186 and the
  `threejs-skills` set from CloudAI-X. The scene shows two browsers and one server with a hard
  boundary between each browser and the server: a readable sheet on the sender's side is sealed
  into a capsule there, the capsule crosses the boundary as ciphertext, lands in the server's
  hopper, and comes back out as a readable sheet at the recipient's.
- Alternatives considered: (a) a 2D flow diagram, which reads well but says less in a demo; (b)
  p5.js in WEBGL mode, already installed, but 1 MB against three.js's 384 KB and weaker for lit
  solids and shadows; (c) React Three Fiber, which would need React and a bundler the project
  deliberately does not have.
- How: three.js is vendored under `public/vendor/` and served from our own origin, so the content
  policy needs no change and no third party is contacted. The scene is a module script in its own
  file, for the same reason the press figure uses one. The threejs skill set was cloned into the
  store so the API used is the API of the release that is installed, and the two library files it
  needs, `three.module.min.js` and `three.core.js`, are vendored beside each other.
- Evidence: the browser suite opens the page, waits for the scene, samples it and requires at
  least two different states, so the capsule has to travel; the design gate passes; a screenshot
  of the scene is in `docs/screenshots/07-journey.png`.
- Consequence: the project can show the whole system in one picture, and the picture is the code
  talking, not a picture of the code.

## D14 - The skills catalogue is curated, not complete

- Prompt: "i dont want you waste tokens use all the token saving skills we have unload unwatned
  shkills also compact every 32k tokens".
- Decision: the harness is given 56 skills instead of 126, and a hook asks for a compaction once
  the context passes 32,000 tokens.
- Alternatives considered: (a) promise to be careful, which saves nothing because the injected
  descriptions are paid for on every turn; (b) point the harness at the whole store, which is what
  a repair does and which would raise the count from 126 to 339; (c) curate, and write the keep
  list down so the next repair knows.
- How: the junctions in `~/.agents/skills-active` are the curated set; the 71 outside the keep
  list were unlinked, and the list itself is in `skills-active.list.json`. The new hook reads the
  last usage record from the session transcript and, past the threshold, says so once and then
  only after another 16,000 of growth.
- Evidence: the injected skill list on the next turn held 56 entries and named `p5js`, which was
  linked in by this change.
- Consequence: each turn pays for 56 descriptions instead of 126, and the session is told to
  compact at a third of the window.

## D15 - The scene is built from parts, not primitives

- Prompts: "the 3d can we make make it more good or better ... the components looks box circles not
  good i wan tmore better one", and the request that agy produce the plan.
- Decision: the scene is rebuilt on a parts library, `figure/parts.js`, and no part is a bare box.
  Every bench is a chamfered plate on four feet with a groove, corner screws, a ruler strip whose
  ticks hang from its edge, and a label plate. The press has guide posts with collars and caps,
  bushings, a beam, a head on two bearing arms, a die, a knurled key dial with radial ticks and a
  pointer, and a coil spring for the return. The key boxes have a hinged lid, a brass latch and a
  key on a ring. The hopper has a rim, a chute lip and a card slot that stands for the share
  record. The four tones are back: the base is lo, the structure mid, the subject hi, and the die
  is the one lit accent.
- Alternatives considered: (a) more lights and better materials on the same boxes, which changes
  the shading but not the shapes; (b) a different library, which costs the vendored dependency for
  nothing; (c) a parts library, which is where the craft rules point.
- The craft rules settled two points: hatching and dimension marks are blueprint furniture and do
  not belong in a drawing, so the hatched strip on the floor became a low kerb; and a good figure
  carries many small precise parts, so density comes from structure rather than from texture.
- Evidence: the browser suite still samples the scene and requires the capsule to travel; the
  design gate passes; the screenshot in `docs/screenshots/07-journey.png` is the new scene.

## D16 - Every sign-in wants the second factor

- Prompt: "add a mandatory two factor auth for login".
- Decision: the password never opens an account on its own. An account that holds a secret is
  asked for the code, as before. An account that has never held one is given a secret at that
  moment and shown the code to scan, and it can only be opened once the phone has proved it holds
  that secret.
- Alternatives considered: (a) refuse the sign-in and tell the person to set the factor up in the
  workspace, which is a dead end for a person who has just lost the session; (b) make the factor
  optional, which is what it was; (c) enrol at the sign-in, so the second factor is unavoidable
  and the phone is set up in the same place the code is asked for.
- How: the login issues a challenge that carries the enrolment, the pending secret lives with it,
  and the code that proves it moves the secret onto the account and records it in the trail.
- Evidence: the server suite now signs in through the enrolment path and refuses the account
  until the right code arrives; the browser suite plays the part of the phone and reads the
  secret from the form.

## D17 - The header carries one button

- Prompt: "also the ux looks so clumsy put all those things inside a settings popup".
- Decision: the four buttons in the header are gone. One Settings button opens a dialog that
  holds the account, the appearance, the recovery phrase, the second factor and the sessions.
- Alternatives considered: (a) a menu, which hides the same four items behind one click without
  explaining them; (b) a drawer, which covers the workspace; (c) a dialog, which is the pattern
  the app already uses for the preview and the shortcuts.
- Evidence: the browser suite opens the settings dialog and reads the phrase and the factor
  inside it, and the design gate passes.
- Consequence: the header is a wordmark, a search box, two buttons and the name of the person.

## D18 - The polish pass, looked at on the screens it ships on

- Prompt: "also /impeccable polish".
- Decision: the polish pass is done against the running app at two sizes, not against the
  source. The settings dialog was the defect: on a phone it ran off both edges and the text was
  cut, and on a desktop it was taller than the window, so the head of the dialog was above the
  fold. The panel now caps its height, its body scrolls, its rows stack on a narrow screen, the
  twelve words wrap, and the code the phone reads sits beside the key instead of under a wall of
  text. The dark theme's muted grey was short of the 4.5:1 body text mark and was raised.
- Alternatives considered: (a) the regex detector alone, which reads the files and cannot see a
  dialog that runs off the screen; (b) a separate mobile layout for the dialog, which is more
  code for the same result; (c) the incumbent rules: the dialog scrolls, the rows stack.
- Evidence: the app was captured at 1440x900 and 390x844 before and after, and the desktop and
  phone settings dialogs were read again afterwards. The mechanical detector finds nothing on the
  changed files or on the running page, and the design gate is clean.
- Consequence: the settings dialog fits the screen it ships on, and the header on a phone is
  three rows instead of five.

## D19 - The layout pass, judged on the rendered pages

- Prompt: "/impeccable layout polish", and "continue doing".
- Decision: the layout pass is done against the running app with four real files in it, not
  against an empty screen. The defects that the source could not show were found by looking:
  a long filename wrapped to nine lines and stretched its card past its neighbours, the three
  actions under a card wrapped onto two rows, the file grid and the audit log below it carried
  the same weight, the toolbar read as one strip of seven controls, the phone band took four
  rows and showed them in the opposite order to the DOM, the phone rail cut "Starred" mid
  word with no hint that it scrolled, and the phone filter row broke its group in two. The
  card name is now clamped to three lines, the card is wider, the three actions sit on one
  row, the key chip moved up beside the other facts, the audit log is a hairline, the
  toolbar's three groups are apart, the phone band is three rows in DOM order, the rail
  scrolls with a fade, the filter row scrolls as one group, and the copy-the-phrase action
  sits in the dialog's foot so it can never be scrolled away from.
- Alternatives considered: (a) the mechanical detector alone, which reads the files and
  cannot see a card stretched by a filename; (b) a sticky action bar for the recovery
  phrase, which measured as covering the last two rows of the twelve words; (c) the
  incumbent rules: the card is a card and the toolbar is a toolbar.
- Evidence: the app was captured at 1440x900 and 390x844 with four files in it, and the
  captures were read again afterwards. The card foot was measured in the browser: three
  buttons, 240px in a 257px row, one row. The phrase box was measured too: the words sit
  in the scrolling body and the action is in the foot, 72px below the scroll edge. The
  server suite, the browser suite, the live checks, the design gate and the interface
  detector on the running page all pass.
- Consequence: the file grid is even, the reading order is the DOM order, and the highest
  stakes control in the settings dialog cannot be scrolled out of reach.
