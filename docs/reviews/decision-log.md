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
| 2026-11-14 | Triage labels = the five defaults (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), created on the repo | Section B default; no override given | — |
| 2026-11-14 | Domain docs = single-context (`GLOSSARY.md` + `docs/adr/`) | No monorepo signals in the repo | — |
| 2026-11-14 | ADR 0001 written: client-side key pairs, browser-side encryption, ciphertext-only server | This is the core architecture the client specified; worth pinning in one file | Sugan's answers |
| 2026-11-14 | `setup-matt-pocock-skills`, `triage`, `to-spec`, `to-tickets`, `grilling`, `grill-me`, `grill-with-docs` linked into `~/.claude/skills` | They existed in the agent store but were invisible to this harness, so `/grill` and the Pocock skills could not run | "use /ponytail /grill , setmatt pocock skills" |
| 2026-11-14 | Repo slug `sugan-project` | Project subject was unknown at creation; name matches the folder and the GitHub repo | — |
