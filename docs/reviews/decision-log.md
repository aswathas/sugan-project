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
