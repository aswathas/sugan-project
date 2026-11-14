# Report update: the file drive workspace and the new share lifecycle

You are updating the project report draft of **SecureShare** in
`C:\Users\ADMIN\Projects\sugan-project\docs\report-draft\`. The system grew again since the last
pass and the report must match the code.

Work only on these files: `ch3-system-design.md`, `ch4-results.md`, `ch5-conclusion.md`.
Keep the existing voice, section numbering, heading style, table style and level of formality.
Extend what is there; do not rewrite chapters that are still correct. Do not touch any other file.
Do not invent numbers, papers, citations or results.

## What is new

### The interface is now a file drive workspace

The signed-in screen is no longer a list of shares with a send panel beside it. It is a workspace
in the shape of a file drive:

- **A left rail** with five sections and their counts: Shared with me, Sent by me, Starred,
  Recent, and Trashed.
- **A search box** in the band that filters the current view by file name.
- **Sorting** of the current view by name, newest, oldest or size.
- **A grid view and a list view**, and the choice is remembered.
- **Selection**: every card has a checkbox, and selecting one or more files shows a bar with the
  count and the actions Star, Revoke, Delete and Clear.
- **Starring**, which is per user: the server records who starred a share, so the sender and the
  recipient can star the same share differently.
- **The trash**: deleting a share takes it out of the ordinary views and puts it in the trash,
  where it can be restored or purged for good. While a share is in the trash it refuses to hand
  over its bytes, exactly as a revoked or expired share does.
- **Keyboard shortcuts**, as in a file drive: `/` focuses the search box, `n` opens the new share
  route, `j` and `k` move the highlighted card, `Enter` opens it, and `Escape` clears the
  selection.
- **Drag a file onto a person**: a card can be dragged onto a recipient in the people list, which
  opens the send route with that file and that person already filled in.
- **A dark theme**, chosen with a button in the band and remembered, built as one override of the
  colour tokens rather than a second stylesheet.
- **A storage breakdown** in the rail: how much ciphertext the account holds and how it splits by
  file type.
- **Presence**: the server notes when an account was last active, so the people list can say when
  someone was last seen. This is deliberately not a websocket: the project stays free and
  dependency-free, so the client asks the server who was seen when.

### The share lifecycle on the server

| Method and path | Purpose |
|---|---|
| `POST /api/shares/:id/star` | toggles the star for the signed-in user |
| `POST /api/shares/:id/delete` | moves the share to the trash |
| `POST /api/shares/:id/restore` | brings it back out of the trash |
| `POST /api/shares/:id/purge` | deletes it for good, the sender only, record and ciphertext file |

`GET /api/shares` now returns four lists, `inbox`, `sent`, `starred` and `trashed`, and every
entry carries `starred`, `deletedAt`, `deletedBy` and a `state` of `live`, `revoked`, `expired` or
`trashed`. `GET /api/users` now also returns `lastSeen` for each account.

## What to change

**ch3-system-design.md**
- Extend the HTTP interface table with the four new endpoints, and note the four lists the shares
  endpoint returns.
- Describe the workspace interface in the section that describes the interface: the rail, the
  search, the sorting, the two view modes, the selection and the bulk actions, the keyboard
  shortcuts, the drag to share, the theme and the storage breakdown.
- Explain the presence design and why it is a last-seen note rather than a live connection.
- Extend the working principle to cover the lifecycle: a share moves from live to revoked, to
  expired, or to trashed, and the bytes are refused in each of those states while the metadata
  stays visible so the card can say why.

**ch4-results.md**
- Bring the two results sections in line with the new check counts (see below).
- Add the new areas to the functional verification: starring, the trash, the restore and the
  purge, the bulk actions, the keyboard shortcuts, the drag to share, the theme and the storage
  breakdown. The browser test now asserts that the rail shows the starred and trashed sections
  with their counts, that selecting a card shows the bulk bar, that starring a share puts it in
  the starred list, that deleting a share moves it to the trash and that the recipient cannot
  open it, and that restoring brings it back.
- Update the screen figures section so the captions describe what the dashboard now shows.
- Extend the discussion and the limits. The limits that are now false must go: there is an audit
  trail, there is revocation, there is expiry and there is an integrity check. What remains true
  must stay: view-only is an interface rule unless a share is protected with a password, the
  server holds a SHA-256 fingerprint of the plaintext, revocation and the trash cannot
  un-download a file the recipient already has, there is no key backup or recovery yet, there are
  no roles, the presence note is not a live connection, and the deployment is a single node.

**ch5-conclusion.md**
- Extend the conclusions to cover the workspace and the lifecycle.
- Keep the future work list honest. Remove anything the system now does, and keep the items that
  are genuinely missing: digital signatures over a share, key backup and recovery, forward
  secrecy, attribute-based policies, a public deployment that survives the loss of the node, and
  a live presence channel.

## The check counts, to be exact

`npm test` reports **19 checks** at the moment of writing and will grow again; write the counts
as they are given in this brief and do not invent a larger number.

`npm run test:browser` reports **10 checks** at the moment of writing.

## Rules

- British spelling, as the existing draft uses.
- No em dashes in body text. Use a comma, a full stop or a colon.
- Every table needs a caption line above it, in the style the file already uses.
- Do not cite any source that is not already in `references.md`.
- Do not add a bibliography, an appendix or a chapter; you are editing three chapters only.
- When you are done, reply with a short list of the sections you changed, in one paragraph.
