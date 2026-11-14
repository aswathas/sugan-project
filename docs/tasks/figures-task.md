# Task: draw the five technical diagrams for the SecureShare report and slides

Create five clean, technical SVG diagrams. They are figures in an academic report and in a slide
deck, so they must read at both A4 print width and 1280 x 720 slides.

## Output

Write each file under `docs/figures/`:

| File | Size (viewBox) | What it shows |
|---|---|---|
| `01-architecture.svg` | 0 0 1200 675 | Logical architecture of the proposed secure file-sharing system |
| `02-without-e2ee.svg` | 0 0 1200 675 | The conventional model: the server can read the file |
| `03-e2ee.svg` | 0 0 1200 675 | How end-to-end encryption works for one share |
| `04-with-e2ee.svg` | 0 0 1200 675 | The proposed model: ciphertext only on the server |
| `05-working-principle.svg` | 0 0 1200 675 | The seven-step working principle as a numbered flow |

## Rules

- Plain inline SVG. No external images, no web fonts, no scripts, no CSS frameworks. Everything
  in the file.
- Text as real `<text>` elements (never outlines), `font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"`.
- Light background (white or a very pale neutral), dark text. These get printed.
- A restrained palette, defined once at the top of each file as CSS custom properties in a
  `<style>` block, and reused: one primary, one accent, one warning colour for "plaintext / attacker",
  neutrals for chrome, and semantic labels for every colour.
- Consistent geometry across all five: same title position, same box style, same arrow style,
  same corner radius, same font sizes. A title line at the top of each figure, then the diagram.
- Figures 02 and 04 must be visually comparable: the same actors in the same positions, so a
  reader can see what changed between them.
- Real arrows with arrowheads, real boxes with labels. Every box has a short label. No emoji.
  No invented metrics, no logos, no stock illustration.
- Text must not overflow its box. Keep labels short. If a box needs two lines, use two `<text>`
  or `<tspan>` lines.
- The diagrams must be truthful to this implementation:
  - The sender's browser holds the file, generates an AES-GCM key, encrypts, and wraps the AES key
    with the recipient's public key.
  - The recipient's browser holds the private key in IndexedDB, unwraps the AES key, decrypts.
  - The server stores the ciphertext, the IV, the wrapped key and public keys. It never holds a
    private key, an AES key or plaintext.
  - In the conventional model the server receives and stores the file in readable form.

## What each figure must contain

**01 — Logical architecture.** Three columns: Sender's browser, Server, Recipient's browser. The
sender's browser shows: file selected, key pair (private key stored locally in IndexedDB, public
key published), AES-GCM encryption, RSA-OAEP key wrapping. The server shows: accounts and public
keys, share metadata, ciphertext blobs. The recipient's browser shows: private key from IndexedDB,
unwrap, decrypt, download. Arrows: sender → server ("ciphertext, IV, wrapped key"), server →
recipient ("ciphertext only"), and a return arrow. Add a clear marker on the server box stating it
never holds plaintext or a private key.

**02 — Without end-to-end encryption.** Sender's browser → Server (plaintext file) → Recipient's
browser, with the server box labelled "stores the file in readable form" and an attacker arrow
reaching the server storage showing the file being read. Make the exposure visible.

**03 — End-to-end encryption explained.** A single horizontal flow for one share: plain PDF →
AES-GCM encryption (label the fresh 256-bit key and the random 96-bit IV) → ciphertext →
RSA-OAEP wrap with the recipient's public key → wrapped key → uploaded to the server → back to
the recipient's browser → unwrap with the private key → decrypt → original PDF. Put a boundary
box labelled "the server never sees the plaintext file or the AES key".

**04 — With end-to-end encryption.** Same actor positions as 02, but the arrow to the server is
labelled "ciphertext only" and the server box says "stores ciphertext, IV, wrapped key". The
attacker arrow reaches the server storage and stops there, labelled "cannot read the file".

**05 — Working principle.** Seven numbered steps as a numbered flow with clear connectors:
1 User authentication → 2 File selection and upload → 3 Client-side encryption →
4 Authorized sharing → 5 Secure transmission → 6 Recipient authentication → 7 Decryption and file
access. Show which steps happen in the sender's browser, on the server, and in the recipient's
browser — colour the steps by where they run, and include a legend.

## Constraints

- Only write inside `docs/figures/`. Do not modify any other file. Do not run git commands.
- Validate your own output: every SVG must be well-formed XML. Check by parsing each file with
  Node (`node -e "require('fs').readFileSync(...)"`) or by opening it in a browser you drive
  headlessly. Do not ship an SVG that fails to parse.
- After writing, report the file list with each file's byte size and one line on what it shows.

Do not add a "figure caption" inside the SVG; captions live in the document.
