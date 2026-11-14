# Surface brief — SecureShare app screens

## Scope and mode

Scope: the SecureShare web application (sign-in / register / verify screens, the send screen, the
inbox and sent lists). Mode: **Operate** — the visitor came to send or open one file.

## Audience, job, action

Audience: a college student sending a confidential PDF to one named person, and that person
opening it. Job: hand over a file that nobody else can read. The one action the surface drives:
choose a file, choose a recipient, choose the permission, send — then, on the other side, open it.
Constraints: must run offline on a lecture-hall laptop, must work at 1280 x 800, no packages, no
external services.

## Direction

Wayfind (public signage as a page), pinned by the brief through the hallmark theme deal, and
committed whole: cool grey paper, blue-black ink, Chivo Mono throughout, square 2 px ink borders,
cobalt for what is live, amber for figures on ink. The pinned world is not a colour scheme — it
is the whole system, so its rules travel with the build.

The raised lines, named for their donors:

- **Raise from the timetable slide rack (rw-timetable-slide-rack):** state is a mark in a fixed
  cell — filled holds, hollow does not. The send screen's permission choice is two square cells
  sharing a 2 px border, the chosen one filled ink with paper text. The permission is never a
  dropdown.
- **Raise from the Japanese high-density site (japanese-high-density-web):** a mosaic of ruled
  modules, each with its own small header tab, packing more onto one screen than a Western grid
  would dare. The inbox and the sent list are dense ruled rows under a small header tab, not
  spaced cards.
- **Raise from the airport sign system (wayfinding-cartography-signage-terminal):** one message
  per band line, and the followed destination stays highlighted band to band. A share that has
  not been opened yet keeps a cobalt live mark; opening it retires the mark in place.

## Signature move

The transfer board. Every share is a row in a departure-board rhythm: destination in the file
name, the line as a small square in the transfer's own colour, the size in amber 800 on an ink
plate when the row is selected, and the state at the right edge. One cobalt live dot on the row
that just changed; it blinks once and never loops. The send screen is the same grammar read as a
route: file, recipient, permission, send — four plates joined by a 2 px ink rule, the way a
corridor sign joins its directions.

## First viewport

At 1280 x 800 without scrolling: a 2 px ink-bordered shell with the wordmark and the signed-in
account on an ink band across the top; below it two work areas side by side on paper. Left, the
send panel: file field, recipient choice, the two-cell permission choice, and the cobalt primary
button "Encrypt and send". Right, the transfer board: a small header tab reading "Shared with
me", then ruled rows, each with the file name, the counterparty, the size and the state at the
right edge. The live mark on an unread share is the first thing the eye finds, because that is
the only thing that changes on this screen.

## Form

The pinned world (Wayfind), with the layout, navigation and controls kept standard for the web:
top bar, labelled form fields, a native select for the recipient, square cells for the
permission, a native file input, and a list for the transfer board. No costume: no terminal bar,
no bezel, no ledger paper standing in for a table. FORM: seed: e32ebe3f06f6d1e.

## Unresolved decisions

- Google sign-in is designed but off until a client id exists; the one-time code is the live
  path, so the sign-in screen leads with it.
- The system name in the interface is SecureShare. The report and deck use the longer course
  title, which is a document concern, not an interface one.
