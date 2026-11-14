# Task: rebuild the project report to match the client's reference format, with the SRM logo

You are working on the **SecureShare** college project, a web app that shares one file with one
person using end-to-end encryption. The repository is at
`C:\Users\ADMIN\Projects\sugan-project` (Windows).

**Your job: edit exactly one file, `tools/build-report.js`.** Do not touch any other file. Do not
commit. The `docx` package must stay outside the project, so do not add it to `package.json` and do
not run `npm install` inside the project.

## Why

The client sent a reference report (their college template, for a different topic) and said the
report must be exactly that format and level, **with the SRM logo**, well organised, with the app
screenshots, the database, the encryption and the backend all in it. Our report has the right
chapters but the front matter and the title page do not follow the reference, and the logo is
missing.

## The reference

- The reference report PDF: `C:\Users\ADMIN\AppData\Local\Temp\ref\ref-report.pdf` (28 pages, A4).
- Rendered pages of it are in `C:/Users/ADMIN/AppData/Local/Temp/ref/pages/` as `p01.png`,
  `p02.png`, `p03.png`, `p04.png`, `p13.png`, `p19.png` (these are the ones that were rendered;
  read what is there).
- A second reference, the college's own test-paper format with the institutional header, is at
  `C:/Users/ADMIN/AppData/Local/Temp/ref/srm-test.pdf`, page 1 rendered at
  `C:/Users/ADMIN/AppData/Local/Temp/ref/pages2/srm-test_p1.png`. It shows the SRM institutional
  wording: "SRM Institute of Science and Technology", "College of Engineering and Technology",
  "Department of Electronics and Communication Engineering", "Academic Year: 2026-2027 (ODD)".
- The SRM logo is already extracted to `docs/brand/srm-logo.jpeg` (234 x 106 jpeg, white
  background). Use that file.

If you want more pages of the reference rendered, you may run:
`python -c "import pymupdf; d=pymupdf.open('C:/Users/ADMIN/AppData/Local/Temp/ref/ref-report.pdf'); [d[i].get_pixmap(dpi=80).save('C:/Users/ADMIN/AppData/Local/Temp/ref/pages/p%02d.png' % (i+1)) for i in range(len(d))]"`
but write only into that temp folder.

## What the reference report looks like, and what we must match

- A4, Times New Roman, body text justified, 1 inch margins, page numbers centred at the foot.
- It opens straight into `ABSTRACT` on page 1, then the contents, then the chapters. Our report
  currently opens with a title page, then ABSTRACT, then TABLE OF CONTENTS, LIST OF TABLES, LIST OF
  FIGURES, LIST OF ABBREVIATIONS.
- The chapter structure in the reference is:
  `1 INTRODUCTION`, `2 LITERATURE REVIEW`, `3 SYSTEM DESIGN`, `4 RESULTS AND DISCUSSION`,
  `5 CONCLUSION`, `REFERENCES`, `APPENDICES` (Appendix 1: Listing of programs, Appendix 2: Raw
  data), `PUBLICATION DETAILS`.
  Our draft already uses that structure. Keep it.

## What to change in `tools/build-report.js`

1. **A title page carrying the SRM logo.** Build it in `titlePage()`:
   - the SRM logo, centred near the top, about 2.4 inches wide;
   - the institutional line, as on the college format: "SRM Institute of Science and Technology",
     "College of Engineering and Technology", "Department of Electronics and Communication
     Engineering", "Academic Year: 2026-2027 (ODD)";
   - the course code line `21ECC402P` and `COMPUTER COMMUNICATION AND NETWORK SECURITY`;
   - the project title on two or three lines, bold, capitalised;
   - `By`, then the team list with the register numbers, exactly as the reference deck shows it;
   - the system name `SecureShare` and the date.
2. **A running header on every page after the title page**, in the college style, with the SRM
   wording and the course code, and the page number in the footer. `docx` supports headers through
   the `headers: { default: new Header({ children: [...] }) }` property of a section.
3. **Keep the front matter in this order**, each on its own page, and keep the lists of tables and
   figures because the reference has a contents list that names them:
   `ABSTRACT`, `TABLE OF CONTENTS`, `LIST OF TABLES`, `LIST OF FIGURES`, `LIST OF ABBREVIATIONS`,
   then the chapters, then `REFERENCES`, then `APPENDICES`, then `PUBLICATION DETAILS`.
   The draft already has `PUBLICATION DETAILS` inside `appendices.md`; check it is on its own
   heading and keep it.
4. **A real contents list with page numbers.** The current builder writes the headings with no
   page numbers. Use the `TableOfContents` field that `docx` provides (`TableOfContents` with
   `hyperlink: true`, `headingStyleRange: '1-3'`) so Word fills the page numbers in when the
   document is opened, and set `settings: { updateFields: true }` on the document so the fields
   refresh. Add the `TableOfContents` and `Header` imports if they are missing.
5. **The figures.** Keep the existing markdown figure blocks working, and make sure the app
   screenshots in `docs/screenshots/` are placed at the right size: the current code assumes every
   screenshot is 1280 x 900, which is no longer true now that the dashboard is wider. Measure the
   real height from the PNG header instead of assuming it, so no picture is stretched.
6. **Captions.** The reference numbers figures and tables and refers to them in the text. Keep the
   caption paragraphs centred under the figure and the bold caption line above each table, exactly
   as they are now, but make the figure and table numbers come from the markdown so they stay
   correct.
7. Keep the existing markdown parser and the rendering of the chapters. Do not hard-code chapter
   text in the builder.

## Rules

- Times New Roman throughout, justified body text, A4, 1 inch margins.
- No em dashes in any text you write.
- British spelling.
- No new dependency, no `npm install` inside the project, no change to `package.json`.
- When you are done, reply with a short paragraph describing the title page, the header, the
  contents field and how the figure sizes are now measured.
