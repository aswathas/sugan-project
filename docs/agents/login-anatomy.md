# Brief: rebuild the SecureShare sign-in page to the "sign up" anatomy

Work in `C:\Users\ADMIN\Projects\sugan-project`.

**Touch only these files:** `public/index.html`, `public/style.css`, and the new
file `public/anatomy.js`. **Do not touch** `public/app.js`, `public/keyguard.js`,
anything in `server/`, anything in `test/`, or anything under `docs/`. Another
agent is editing the JavaScript at the same time. If you need a change in
`public/app.js`, write it in your final report instead of making it.

## What this page is

SecureShare shares one file with one person, encrypted in the sender's own
browser, so the server only ever holds ciphertext. The sign-in page is the
first screen anyone sees, and it is also the page a faculty member or a
reviewer looks at when they ask "how does this actually work?".

Right now the page is a heading, one claim, a three-step explainer and a
sign-in form. It says what the product does but never shows it.

## The shape to build

The page's job is **sign up** — a visitor here wants to create an account and
send a file. Build the page to that job's anatomy, in this order:

1. **The hero and the action.** The heading, one line of claim, and the
   action. The action is the existing form panel (sign in / register tabs,
   the three forms, the Google block, `#auth-error`). Put the terms in one
   line directly under the action: free, no card, and the server never sees
   the file. Keep the existing element ids exactly as they are — the
   JavaScript looks them up by id.

2. **The product at work.** A real screenshot of the signed-in workspace,
   `shots/workspace.png` (already copied into `public/shots/`). Give it a
   caption that says what it is: the workspace with shared-with-me,
   sent-by-me and the audit trail.

3. **What it does, as named moments.** Three moments, each with its own
   screen, not icon tiles:
   - *Encrypted in your browser* — `shots/encrypted.png`, the share panel with
     the cipher strip.
   - *The server holds only ciphertext* — the same panel's cipher strip; you
     may reuse `shots/encrypted.png` cropped, or use `shots/verified.png`.
   - *Proved afterwards* — `shots/verified.png`, the card that reads verified
     after the recipient decrypted it and checked the fingerprint.
   Each moment is a name, one sentence, and the image. The sentences must be
   true of this implementation. Do not claim anything the code does not do.

4. **The code that does it.** A short, real code sample of the encryption
   flow, taken from the actual implementation (the AES-GCM encrypt, the
   RSA-OAEP wrap, the digest). Copy it from `public/app.js`; do not invent
   pseudocode. Mark it as a sample, with the file and the line range it came
   from.

5. **Questions.** Four or five short question-and-answer pairs that a visitor
   would actually ask: does the server ever see my file, what happens if I
   lose my device, can the sender read the file after sending it, what does
   it cost. Use `<details>` and `<summary>` so no JavaScript is needed.
   The answers must be true of this implementation.

6. **The close.** The hero's action again in a short band: a "Create an
   account" button that switches the form panel to the register tab and puts
   the cursor in the username field. Never a newsletter.

## The new file `public/anatomy.js`

It holds only the wiring the close needs: switching to the register tab and
focusing `#register-username`. The tab switching lives in `public/app.js` as
`setTab(which)` — but you must not edit that file, so in `anatomy.js` do it
directly: remove `hidden` from `#register-form`, add it to `#login-form`, set
`aria-pressed` on `#tab-register` and `#tab-login`, and focus the field. Load
it with `<script src="anatomy.js"></script>` at the end of `public/index.html`.

## The design language

This is "Wayfind" (hallmark): paper and ink, one cobalt accent for what is
live, amber for figures, Chivo Mono throughout, 2px ink borders, square
corners, no gradients, no rounded corners, no drop shadows, no emoji, no
stock photography. Read `public/style.css` and `public/tokens.css` first and
use the tokens that are already there — do not introduce a new colour, a new
radius or a new shadow. The stylesheet is split: `style.css` holds the app's
rules and imports `tokens.css` and `base.css`.

The page must read as one system with the signed-in workspace, not as a
marketing page bolted onto an app. The screenshots are of a paper-coloured
interface; the page around them is paper-coloured too.

## Also in this pass

3. **Announce the status messages.** `#main-status` and `#share-status` get
   `role="status"`. `#auth-error` gets `role="alert"`. One attribute each,
   no JavaScript.

2. **The narrow viewport.** Below 60rem the rail becomes a full-width block
   above the files, so on a phone the user scrolls past five nav buttons,
   the storage panel and the people list before seeing a file. Turn the rail
   into one horizontal row of nav buttons that scrolls sideways
   (`.rail__list` as a flex row with `overflow-x: auto`, the count badges
   inline with their labels). Move the storage panel and the people block
   into one `<details>` titled `Details` after the nav row, so both are still
   reachable in one tap. The wide layout must not change at all.

4. **The share password label.** The password field in the send panel must
   say the password needs **at least 10 characters**. Change only that
   wording, in the markup only.

## The bar

- The desktop sign-in page must be looked at and judged by eye, not just
  written. Take a screenshot at 1280px wide and one at 390px wide, and look
  at both.
- The wide signed-in layout must be byte-for-byte unchanged in appearance.
  Screenshot it before and after.
- Run `node C:/Users/ADMIN/.claude/skills/hallmark/scripts/sloplint.mjs public --scope app --genre modern-minimal`
  and leave it clean.
- Prove with `git diff --stat` that you touched only the three files named
  above.
- Every claim on the page must be true of this code. If you are unsure,
  read the code.

## Report back

- What you changed, file by file, with line numbers.
- The screenshot paths.
- The sloplint output.
- The `git diff --stat` output.
- Anything you would have changed in `public/app.js`, as a list, without
  changing it.
