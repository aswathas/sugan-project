# Task: turn the SecureShare dashboard into a proper file-drive workspace

You are working in `C:\Users\ADMIN\Projects\sugan-project` (Windows). This is the **SecureShare**
college project: a web app that shares one file with one person using end-to-end encryption. The
signed-in screen is already a Google Drive style dashboard. The client now wants the *Drive
features* on it, so it reads as a real file workspace rather than a demo.

**Your job: edit exactly three files, `public/index.html`, `public/app.js` and `public/style.css`.**
Do not touch the server, the tests or anything else. Do not commit. Do not add a dependency and do
not run `npm install`.

## The server contract, which already exists

`GET /api/shares` now returns four lists, each entry shaped like:

```json
{
  "id": "...", "from": "alice", "to": "bob", "filename": "notes.pdf",
  "size": 12345, "permission": "view", "createdAt": 1700000000000,
  "expiresAt": null, "revokedAt": null, "openedAt": null,
  "deletedAt": null, "deletedBy": null, "digest": "...",
  "starred": false, "state": "live"
}
```

- `inbox`  - shares sent to me, not deleted
- `sent`   - shares I sent, not deleted
- `starred` - every share I have starred, not deleted (the same entry can appear in inbox, sent
  and starred)
- `trashed` - shares that have been deleted; the sender may restore or purge them

New endpoints, all `POST`, all needing the session cookie:

| Path | Effect | Answer |
|---|---|---|
| `/api/shares/:id/star` | toggles the star for the signed-in user | `{ id, starred }` |
| `/api/shares/:id/delete` | moves the share to the trash | `{ id, deletedAt }` |
| `/api/shares/:id/restore` | brings it back out of the trash | `{ id }` |
| `/api/shares/:id/purge` | deletes it for good, the sender only | `{ id }` |

`state` is `live`, `revoked`, `expired` or `trashed`. A share in the trash refuses to hand over its
bytes, the same as a revoked one.

Existing endpoints you already use: `/api/users`, `/api/activity`, `/api/activity/verify`,
`/api/shares/:id`, `/api/shares/:id/blob`, `/api/shares/:id/revoke`, `/api/shares/:id/opened`,
`/api/shares/:id/cipher-head`.

## What to build

The current dashboard has a left rail (Shared with me / Sent by me / Recent with counts), a search
box in the band, file cards, a New route for the send panel, an evidence panel and an activity
feed. Keep all of that. Add the following.

### 1. The rail
Add two more sections, each with its count, in this order:
**Shared with me**, **Sent by me**, **Starred**, **Recent**, **Trashed**.
- *Starred* shows the entries in `starred`.
- *Trashed* shows the entries in `trashed`.
- A section with nothing in it may be shown with the count `0`; it must still be clickable and show
  an empty state.

### 2. Sorting
A small control above the cards: a `<select>` with **Name**, **Newest**, **Oldest**, **Size**.
It sorts the current view. Put it next to the view title, not inside the card grid.

### 3. List and grid
Two small buttons that switch the card area between a grid (the current look) and a list (one row
per file, with the name on the left and the badges and actions on the right). The current view is
kept when you switch views, and the choice is remembered in `localStorage`.

### 4. Selection and bulk actions
Every card gets a checkbox. Selecting one or more shows a bar above the cards with the number
selected and the actions **Star**, **Revoke**, **Delete** and **Clear**. Each action applies to
every selected share. Revoke and Delete call the endpoints above; a revoked or trashed share cannot
be starred into the trash, so disable what does not apply to the selection.

### 5. Star
A star button on every card, in the top right of the card, that toggles the star. A starred card
shows the star filled. The star is per user: the server stores who starred it.

### 6. Trash
A card in the trash shows the badge `trashed` and two actions, **Restore** and **Purge**. Purge is
permanent, so ask for a confirmation with `window.confirm` before it is called. Cards that are not
in the trash show **Delete** instead.

### 7. Keyboard
Shortcuts, as in a file drive:
- `/` focuses the search box
- `n` opens the New share route
- `j` moves the selection down, `k` moves it up, and the selected card is highlighted
- `Enter` opens the highlighted card
- `Escape` clears the selection and the search box
Ignore the shortcuts while the user is typing in an input, a textarea or a select, and when a
dialog is open.

### 8. Storage in the rail
Under the counts, a small block that shows how much ciphertext the account is holding and how that
splits by file type: the top three extensions by size, with their share of the total. The totals
come from the sizes in the share lists.

### 9. Drag a file to a person
The cards can be dragged onto a person in a small people list in the rail (every other registered
account). Dropping a card on a person opens the New share route with that file and that person
already filled in. The card must show that it can be dragged, and the person must show that a file
is over them.

### 10. A dark theme
A theme button in the band, next to the search box, that switches between the current paper theme
and a dark one. The choice is remembered in `localStorage` and applied before the page paints, so
there is no flash of the wrong theme.

The dark theme is a **token override**, not a second stylesheet: add a block that sets the same
token names to darker values under `[data-theme="dark"]` on `html`, and make sure every rule that
hard-codes a colour uses a token. The palette to keep:
- paper `oklch(95.5% 0.006 250)` becomes `oklch(20% 0.012 262)`
- paper-2 `oklch(91% 0.009 250)` becomes `oklch(25% 0.014 262)`
- paper-3 `oklch(99.5% 0.005 250)` becomes `oklch(28% 0.014 262)`
- ink `oklch(16% 0.014 262)` becomes `oklch(93% 0.006 250)`
- ink-2 `oklch(29% 0.014 262)` becomes `oklch(78% 0.010 258)`
- muted `oklch(47% 0.016 260)` becomes `oklch(66% 0.014 260)`
- rule `oklch(80% 0.011 250)` becomes `oklch(38% 0.014 262)`
- ink-rule `oklch(34% 0.014 262)` becomes `oklch(48% 0.014 262)`
- accent `oklch(51% 0.22 264)` stays, and accent-2 `oklch(81% 0.16 82)` stays

### 11. A small preview
Clicking the name of a card, rather than the buttons, opens a small panel that shows the file's
name, size, who it is with, when it was sent, its permission, its self-destruct timer, its state
and the fingerprint of the public key it was encrypted to. It closes on `Escape` or on the close
button. It must not offer a download of the file, because the permission for that belongs to the
recipient's action.

## Rules

- No dependency, no build step, no framework. Vanilla JavaScript, as the file already is.
- Keep the existing Hallmark Wayfind look: square 2px ink borders, no rounded corners, one
  monospace face, paper and ink with cobalt for what is live and amber for figures.
- Every new control needs a label that a screen reader can read and a visible focus state.
- No em dashes in any text you write.
- British spelling.
- Keep the existing functions and their names where they still fit. The existing ids are
  `cards`, `search`, `new-share`, `new-form`, `count-inbox`, `count-sent`, `count-recent`,
  `stat-stored`, `stat-key`, `view-title`, `view-meta`, `main-status`, `activity`, `file`,
  `recipient`, `share`, `share-status`, `evidence-original`, `evidence-stored`, `evidence-foot`.
- When you are done, reply with a short paragraph: what you added, the ids of the new elements,
  and anything you could not do.
