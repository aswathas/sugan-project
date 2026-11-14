# Task: the UI and UX polish pass on the SecureShare workspace

You are working in `C:\Users\ADMIN\Projects\sugan-project` (Windows). **SecureShare** is a
college project: a web app that shares a file with one person using end-to-end encryption. The
signed-in screen is already a Google Drive style file workspace: a left rail with counts, a
search box, sorting, a grid and a list view, checkboxes with bulk actions, starring, a trash,
keyboard shortcuts, drag to share, a dark theme, a storage breakdown and an activity feed.

**Your job: edit only `public/index.html`, `public/app.js` and `public/style.css`.** Do not touch
the server, the tests or any other file. Do not commit. Do not add a dependency and do not run
`npm install`.

Read the existing files first. They are large. Keep the house style: square 2px ink borders, no
rounded corners, one monospace face, paper and ink with cobalt for what is live and amber for
figures on ink. Every new control needs a visible focus state and a label a screen reader can
read. No em dashes in any text you write. British spelling.

Build these nine things, in this order. Stop and report when you run out of time.

## 1. Toasts

A toast area, id `toasts`, in the bottom right of the window, outside the scrolling area.

Every action now gives a toast: starred, unstarred, deleted, restored, purged, revoked, copied,
sent, verified, decrypted, signed. The toast is a small ink-bordered plate with the message, and
it goes away after four seconds.

The two destructive ones carry an **Undo**: after a delete the toast reads *File moved to the
trash* with an **Undo** button that calls `POST /api/shares/:id/restore` for that share; after a
revoke the toast reads *Share revoked* with an **Undo** that calls
`POST /api/shares/:id/revoke` again is not possible, so instead say *The file stays revoked* and
offer nothing. Keep it honest: only the delete can be undone.

The existing `setMainStatus` stays for the long messages that belong on the page.

New: `toast(message, options)` where options may carry `{ action: 'Undo', onAction: fn }`.

## 2. A file type chip on every card

Each card shows a small square chip with the extension of the file, in the way a file drive shows
a file type. The chip is a square with a 2px ink border, the letter of the extension in caps, and
a colour that says the type:

- `PDF` - ink plate, paper letter
- `TXT`, `MD`, `CSV` - cobalt plate, paper letter
- `JPG`, `PNG`, `GIF` - amber plate, ink letter
- anything else - paper plate, ink letter, and the extension's first three letters

The chip sits at the top left of the card, before the file name. The existing `fileExtension()`
helper already computes the extension; use it.

## 3. Filter chips next to the sort control

A row of square cells, id `filter-chips`, beside the sort control: **All**, **Unread**,
**Starred**, **Expiring soon**, **View only**. One is active at a time, shown the way the
permission cells are shown: the active one filled ink with paper text.

- **All** - every file in the view
- **Unread** - only the shares nobody has opened
- **Starred** - only the starred ones
- **Expiring soon** - only the shares with an expiry inside the next 24 hours
- **View only** - only the shares the sender marked view only

The filter applies to the current view and combines with the search. It resets when the view
changes.

## 4. Empty states that offer the next step

Every empty view currently says only that it is empty. Each one now also has a button:

- an empty **Shared with me**, **Sent by me**, **Starred** or **Recent**: *Share a file*, which
  opens the New route
- an empty **Trashed**: *Nothing to restore*
- an empty **search**: *No file matches that search*, with a **Clear the search** button that
  clears the search box and the filter

## 5. Select all in the bulk bar

The bulk bar gets a *Select all* control at its left, which selects every file in the current
view, and the count reads *N selected*.

## 6. A loading state for the cards

While the shares are being fetched, the card area shows four skeleton rows: ruled lines in the
paper-2 colour where the file name, the meta and the badges will be, so the layout does not jump
when the files arrive. The skeleton is gone as soon as the cards are drawn.

## 7. A context menu on a card

Right clicking a card opens a small menu, id `card-menu`, positioned at the pointer, with the
actions for that card: **Open** (or **Details** for a file you sent), **Star** or **Unstar**,
**Revoke**, **Delete**, and **Copy the key fingerprint**. The same actions the card buttons do,
so call the same functions.

It closes on `Escape`, on a click outside it, and after an action is chosen. It never opens for a
card that is in the trash; there the menu holds **Restore** and **Purge** instead.

## 8. How it works, on the sign in screen

Above the sign in and register forms, a small panel, id `explainer`, with three ruled lines, each
one a step:

1. *Your key pair is made in this browser. The private key never leaves it.*
2. *The file is encrypted before it leaves your device.*
3. *The server stores ciphertext. It cannot read the file.*

This is the first thing a professor sees when the site is opened, so it must be plain and short.

## 9. The keyboard shortcut list

A small button in the band, id `shortcuts-button`, that opens a panel, id `shortcuts-panel`, with
the shortcut list: `/` search, `n` new share, `j` and `k` move, `Enter` open, `Escape` clear,
`Ctrl` and `K` command, and the mouse actions. It closes on `Escape` and on the close button.

While the panel is open, the keyboard shortcuts must not fire.

## Notes

- The existing ids must keep working: `cards`, `search`, `new-share`, `new-form`, `count-inbox`,
  `count-sent`, `count-recent`, `count-starred`, `count-trashed`, `stat-stored`, `stat-key`,
  `view-title`, `view-meta`, `main-status`, `activity`, `file`, `recipient`, `share`,
  `share-status`, `evidence-original`, `evidence-stored`, `evidence-foot`, `bulk-bar`,
  `bulk-count`, `bulk-star`, `bulk-revoke`, `bulk-delete`, `bulk-clear`, `sort-select`,
  `layout-grid`, `layout-list`, `theme-toggle`, `preview-dialog`.
- The dark theme must work for everything you add: use the tokens, never a hard coded colour.
- `npm run test:browser` must still pass. It drives the real interface in two Chrome profiles.
- When you are done, reply with a short paragraph: what you added, the ids of the new elements,
  and anything you did not get to.
