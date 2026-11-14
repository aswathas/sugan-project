# Task: rebuild the REVIEW-3 deck title slide to match the client's reference, with the SRM logo

You are working in the repository `C:\Users\ADMIN\Projects\sugan-project` (Windows, so
`/c/Users/ADMIN/Projects/sugan-project` in Git Bash). This is the **SecureShare** college project:
a web app that shares a file with one person with end-to-end encryption.

**Your job: edit exactly one file, `tools/build-deck.js`.** Do not touch any other file. Do not
commit. Do not run the builder if the `pptxgenjs` module is missing; just make the edit and report
what you changed.

## Why

The client sent a reference deck (their own college template, REVIEW - 3, for a different topic)
and said the presentation must follow that reference exactly, **including the SRM logo**. Our
current deck title slide is a dark ink slide with a different layout. It has to become the
reference's title slide, with our project on it.

## The reference

- The reference deck PDF: `C:\Users\ADMIN\AppData\Local\Temp\ref\ref-deck.pdf`
  - Page 1 is the title slide. A rendered PNG of it is at
    `C:\Users\ADMIN\AppData\Local\Temp\ref\pages2\ref-deck_p1.png`.
- The SRM logo image has already been extracted to `docs/brand/srm-logo.jpeg` (234 x 106 jpeg, with
  a white background). Use that file.

Read the reference page 1 image first so you copy the layout exactly. Its structure, from the top:

1. A light background (plain white, not our paper grey).
2. Top left: the course code line, in bold, centred over two lines:
   `21ECC402P – COMPUTER COMMUNICATION AND NETWORK SECURITY`
   (in the reference it wraps after "NETWORK", with "SECURITY" on the second line).
3. Top right: the SRM logo, about 1.7 inches wide, sitting in the top right corner.
4. Middle: `REVIEW - 3`, bold, underlined, centred.
5. Below it: the project title in bold, underlined, centred, on two lines:
   `SECURE FILE SHARING SYSTEM USING END-TO-END`
   `ENCRYPTION AND ACCESS CONTROL`
6. Then an italic `By`.
7. Then the team list, one member per line, with the register number right-aligned in a column:
   ```
   1. PRADEESH M          -RA2311004010278
   2. VARUN P R           -RA2311004010287
   3. SUGANDHAN A         -RA2311004010297
   ```
8. Bottom right: the page number `1`.

The reference uses a Times-like serif face for this slide. Our deck uses `Consolas` throughout
(the constant `FONT` in the file). For **this slide only**, use `Times New Roman` so it matches the
reference; leave every other slide in the deck exactly as it is.

## What to change in `tools/build-deck.js`

- Replace the current title-slide block (the one that starts with `/* ---------------- 1. title
  ---------------- */`) with a new one that draws the reference layout above, with our content.
- Keep the existing constants (`PAPER`, `INK`, `ACCENT`, `AMBER`, `MUTED`, `RULE`, `FONT`, `W`, `H`)
  and every helper function. Add a local serif constant if you need one, for example
  `const SERIF = 'Times New Roman';`.
- The title slide background must be white (`FFFFFF`), not our paper colour.
- Put the logo with `slide.addImage({ path: path.join(ROOT, 'docs', 'brand', 'srm-logo.jpeg'), x, y, w, h })`.
  The logo is 234 x 106, so keep the aspect ratio: if the width is 1.7 inches the height is
  0.77 inches.
- Underlining: pptxgenjs takes `underline: true` on a text run option. Use it for `REVIEW - 3` and
  for the project title.
- The team list: use one text box per line, or one text box with a tab stop. The register number
  should sit in a neat column to the right of the name, as in the reference.
- The page number `1` goes bottom right.
- Keep `pptx.author`, `pptx.company` and `pptx.title` as they are.

## Rules

- Do not restyle the other fourteen slides. Only the title slide changes.
- Do not add or remove slides. The deck stays at fifteen.
- Do not add a dependency. `pptxgenjs` is already used by the file.
- No em dashes in any text you write.
- British spelling.
- When you are done, reply with a short paragraph: what the title slide now contains and the
  exact positions and sizes you used for the logo.
