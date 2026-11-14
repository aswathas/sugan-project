# Brief for agy (Gemini 4 Hydrogen) — the 3D scene of SecureShare

Given to agy on 2026-11-15. The brief below is the contract; the report at the end is what the
agent came back with.

# Brief for agy (Gemini 4 Hydrogen) — improve the 3D scene of SecureShare

You are working in the repo `C:\Users\ADMIN\Projects\sugan-project` (SecureShare, a course
project: a file-sharing website with end-to-end encryption).

## What exists today

- `figure/journey.js` — the 3D scene (three.js r186, imported from `/vendor/three.module.min.js`,
  served from our own origin). Two browsers and one server, a hard boundary between each browser
  and the server, a file that starts as a readable sheet, is sealed into a capsule, crosses the
  line as ciphertext, lands in the server's hopper and comes back out as a readable sheet.
- `figure/parts.js` — the parts library (benches, press, key boxes, hopper, boundary, outlines).
- `figure/journey.html` — the page: paper palette, HTML label layer, readout plate, step marks,
  a back button, a grain overlay.
- `figure/sealing-press.html` — a separate static isometric SVG drawing. **Not your task.**

The scene is the "Watch one file travel through the machine" page linked from the sign-in page.

## The job

Make the scene better. It is the picture the client shows his professor, so it must look drawn
and intentional, not like primitives on a plane.

Priorities, in order:

1. **Ground it.** Right now the parts sit on one flat plane with little sense of contact. Give the
   world a floor that reads as a surface: contact shadows, a plinth or slab under each bench, a
   horizon that does not simply end, and anything else that makes the objects sit *on* something
   rather than hover above it.
2. **Frame it.** The camera orbits at radius 158 with a 36° lens. Cut dead space: the subject
   should fill the frame at the default viewport and still read at 1280x800 and on a phone.
3. **One new element, only if it earns its place.** Something the story needs and the scene does
   not yet have — for example a receiver tray where the readable sheet lands at the end, or a
   share card that visibly enters the hopper so the server side shows what it holds. Add it only
   if you can name what it explains. Do not add decoration.

Keep the change as small as it can be while doing the job. Do not rewrite the file for the sake of
it; extend the parts library and the scene rather than replacing what works.

## The style rules (this project is strict about them)

- It is a **drawing in pencil on paper**, not a lit render. Pale graphite fills, ink outlines.
- **One blue pencil**, and it belongs to the route line and its arrowhead only. Nothing else blue.
- Every surface is matte and carries the **same pencil hatching** (`hatchTexture()` in
  `figure/journey.js`).
- Every part is drawn over with **its own edges** in graphite (`outline()`), and every vertex is
  nudged first so the lines are not machine straight (`roughen()`).
- The light is soft and even. A drawing is described by its lines, not by one hard lamp shadow.
- **No blueprint furniture**: no grids, no dimension lines, no callout arrows, no measurement
  labels, no HUD, no wireframes, no glowing edges, no sci-fi glow.
- No emoji. No new dependencies. No build step: plain ES modules, the page must still run by
  opening it from the static server.
- House code style: `const`/`let`, semicolons, 2-space indent, and comments in the file's own
  voice — lowercase, one short line, saying **why** and not what.

## Do not break these

- The six-step story and its exact text in `STEPS`. The readout and the step marks depend on them.
- The sequence: readable sheet → sealed capsule → wrapped key → hopper → back out → unwrapped.
- `window.__journey` — the browser suite reads `step()`, `capsuleX()`, `capsuleVisible()` and
  `labels()`. The suite requires at least 8 labels, that the capsule travels, and that the step
  changes.
- The `prefers-reduced-motion` path (`still`), which must still draw the whole story.
- The back button and the label layer in `figure/journey.html` must keep working, and the labels
  must stay legible and not overlap each other.

## Files you may change

`figure/journey.js`, `figure/journey.html`, `figure/parts.js` — and nothing else.
Do not touch `docs/`, `public/`, `test/`, `server/`, `tools/`. Do not add new files. Do not run
`git commit`.

## Verify before you finish

Run `node tools/test-all.js`? No — run this:

```
npm run test:browser
```

It drives the real site in headless Chrome (Chrome is installed on this machine) and fails if the
scene does not draw, does not label the parts, or the capsule does not travel. It must pass.

If you can, also take a headless screenshot of `figure/journey.html` and read it back yourself to
confirm the picture is better and the labels do not collide.

## Report back

A short plain list: what you changed, file by file, and why. Then the exact command you ran and
its result.

---

## What the agent reported

Running `npm run test:browser` now; waiting for the headless Chrome suite to finish.
Updated the 3D journey scene across the three allowed files:

- [figure/parts.js](file:///C:/Users/ADMIN/Projects/sugan-project/figure/parts.js)
  - Fixed `slabGeometry()` so extruded slabs sit flush on `y = 0` (`-geo.boundingBox.min.y`) instead of offsetting past `h - bevel`, and aligned `rulerStrip()` ticks and `labelPlate()` rules to sit cleanly on top of their plates.
  - Added `plinth()` to give each bench a two-step foundation slab on the floor, and adjusted `benchPlate()` feet so they rest on top of the plinth instead of passing through the ground plane.
  - Fixed `hopper()` so its floor and walls start at `y = 0` with a chamfered top rim (removing the hidden dummy torus and grounding the share card onto the back rim).
  - Wrapped `bushing()` and `guidePost()` parts in `THREE.Group` containers so positioning them moves collars, caps, and inner bores together.
  - Added `receiverTray()` (sloped intake lip, guide rails, recessed paper bed, backstop, and verification stamp block) so the recipient bench shows where the capsule is unwrapped and the verified readable sheet lands.

- [figure/journey.js](file:///C:/Users/ADMIN/Projects/sugan-project/figure/journey.js)
  - **Grounding & horizon:** Replaced the small cut-off ground strip with a wide `CircleGeometry(900, 72)` floor carrying subtle pencil-tooth strokes (`floorTexture()`), a drafted station runner underneath the benches, stepped plinths and boundary sills resting at `y = 0`, and soft charcoal `contactShadow()` planes under every plinth, bench foot, kerb, machine part, and moving token so the horizon blends smoothly into `--paper` fog.
  - **Framing & layout:** Compacted the three stations (`-47`, `0`, `+47`) with clean floor channels for the trust boundaries (`±21`) so the entire machine fills the `1280x800` frame at orbit radius `158` (`36°` lens) with no clipped edges; added `fitRadius()` and fog scaling so narrow/portrait phone viewports (`390x844`) keep all three stations in frame without fogging out.
  - **Mechanical & pencil polish:** Fixed `makePress()` so the guide posts reach the beam and the head's bearing arms and bushings ride directly on the posts; brightened `PALETTE.hi` (`#52525a`) so hatching and graphite outlines read clearly; fixed `roughen()` to hash vertices by quantized 3D position and scale nudges by part size so flat faces stay watertight without diagonal triangulation scribbles; colored the smooth hand-drawn `route` stroke in `PALETTE.lit` (the single blue pencil, matching `arrowhead`).
  - **Receiver tray & `prefers-reduced-motion`:** Added `receiverTray` on `Their browser` (`(49, BENCH_TOP, -4)`), routed the unwrapped `sheet` onto its paper bed, and fixed `sheet.visible = isSending || isOpen` so the `still` path (`t = 11.4`) keeps the final readable sheet visible across frames.
  - **Labels:** Moved zone labels below the plinths, boundary labels above the fences, `the public key` to the front lip of its plate, and added viewport clamping plus vertical overlap resolution in `placeLabels()`.

- [figure/journey.html](file:///C:/Users/ADMIN/Projects/sugan-project/figure/journey.html)
  - Added a `--paper` text-shadow halo on `.label` so ink stays legible over graphite lines without adding boxes, and added `@media (max-width: 640px)` sizing for labels, the back button, and the bottom readout plate on phone viewports.

### Verification

- Ran `npm run test:browser` (`node test/browsertest.js`) — exited with code `0`, `ALL BROWSER CHECKS PASSED`, including `PASS  the 3D scene draws, labels the parts and moves the file across the boundary`.
- Also inspected headless Chrome screenshots of `figure/journey.html` at `1280x800`, `1440x900`, `390x844`, and `prefers-reduced-motion: reduce` (`still`): all reported `10` labels and `0` label overlaps.
