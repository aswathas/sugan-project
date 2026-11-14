# Brief: the markup and stylesheet pass for SecureShare

Work in `C:\Users\ADMIN\Projects\sugan-project`.

**Touch only these two files:** `public/index.html` and `public/style.css`.
**Do not touch** `public/app.js`, `public/keyguard.js`, any file in `server/`, any
file in `test/`, or anything under `docs/`. Another agent is editing the
JavaScript at the same time. If you need a change in a JavaScript file, write
it in your final report instead of making it.

The design language is "Wayfind" (hallmark): paper and ink, one cobalt accent
for what is live, amber for figures, Chivo Mono throughout, 2px ink borders,
square corners, no gradients, no rounded corners, no drop shadows. Read
`public/style.css` and `public/tokens.css` before you write anything, and
keep every new value inside the tokens that are already there. The stylesheet
is split: `style.css` holds the app's own rules and imports `tokens.css` and
`base.css`.

There are four jobs.

## 1. Announce the status messages

`#main-status`, `#share-status` and `#auth-error` are the only way the app
reports what happened, and a screen reader hears nothing today.

- `#main-status` and `#share-status` get `role="status"`.
- `#auth-error` gets `role="alert"`.
- Leave their text and their ids alone. Do not add any JavaScript.

## 2. The narrow viewport

Below 60rem the rail becomes a full-width block above the files, so on a
phone the user scrolls through five nav buttons, the storage panel and the
people list before seeing a single file.

Turn the rail into one horizontal row of nav buttons that scrolls sideways:

- `.rail__list` becomes a flex row with `overflow-x: auto` and the buttons
  keep their current shape. The count badges stay inline with their label.
- The storage panel and the people block move into one `<details>` element
  titled `Details`, placed after the nav row, so both are still reachable in
  one tap. Give the `<details>` a `<summary>` that reads `Details`.
- The nav row must be the first thing in the rail and must not wrap.
- The rail must not be taller than one row plus the collapsed `Details`.

Keep the wide layout exactly as it is. This is a narrow-viewport change only.

## 3. The share password label

In the send panel, the password field's label and its hint must say that the
password needs **at least 10 characters**. Find the exact wording in
`public/index.html` and change only that wording. Do not add validation
markup; the JavaScript handles it.

## 4. The favicon

`public/favicon.svg` now exists and `public/index.html` links it. Nothing to
do unless the link is missing.

## The bar

- The wide layout must look exactly as it does now. Take a screenshot of the
  desktop view before you start and one after, and confirm nothing moved.
- The narrow view must fit the rail into the rule above. Take a screenshot at
  390px wide.
- Run `node C:/Users/ADMIN/.claude/skills/hallmark/scripts/sloplint.mjs public --scope app --genre modern-minimal`
  and leave it clean.
- Use `grep` to prove you did not touch `public/app.js`.

## Report back

- The exact markup you changed, with the line numbers.
- The screenshot paths.
- The sloplint output.
- Anything you wanted to change in the JavaScript, as a list, without making
  the change.
