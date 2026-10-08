# AGENTS.md

## What this is
Static p5.js sketch (a moon bouncing off all four screen edges over a starfield, cycling through lunar phases). Two source files only:

- `index.html` — loads p5 **1.11.13**, then the p5.sound addon, then `sketch.js`; also holds the CSS reset.
- `sketch.js` — the whole sketch, using p5 **global mode** (`setup()` / `draw()`), not instance mode. Draws the page title inside the canvas too, plus the shooting-star particle system.

No `package.json`, build step, test suite, linter, or codegen. Do not add one unless asked.

## Running it
Open `index.html` directly in a browser, or serve the folder with any static server. No install step.

## p5 version is pinned on purpose
`p5.sound` (used for the bounce sound) is **only published under p5 1.x**: `lib/addons/p5.sound.min.js`. p5 2.x has no `addons/` folder. If you bump the p5 CDN version, verify the addon URL still resolves (`https://cdn.jsdelivr.net/npm/p5@<version>/lib/addons/p5.sound.min.js`) or sound will silently break. Keep script order: `p5.min.js` → `p5.sound.min.js` → `sketch.js`.

## Conventions
- Comments and UI text are in Spanish; keep new comments/names consistent with that.
- `sketch.js` relies on p5 globals (`createCanvas`, `circle`, `mouseX`, `userStartAudio`, etc.); do not wrap it in an IIFE or switch to instance mode without rewriting the rest.

## Behavior notes (easy to break)
- Motion is **constant-speed drift, not gravity physics**: each frame adds gentle Perlin-noise steering (`noise(t)`), then renormalizes and clamps speed to `6..10` px/frame; edges reflect the velocity. This is what keeps it "alive but harmonious" — raising the noise strength (currently `±0.15`) makes it curve so much it stops reaching the walls, and raising/decreasing the speed range changes the whole feel. Tune all three together.
- Hovering the moon grows it while the cursor is over it (`escala += 0.007` per frame) up to `escalaMax`, set in `setup()` so the moon's **diameter tops out at half the smaller canvas side**: `escalaMax = (min(width, height) / 2) / (2 * radio)`. It simultaneously cross-fades its lunar phase: `faseActual()` maps `(escala - 1) * 1.2` into the `fases` array (`floor` picks the phase, the fraction is the mix), so every `~0.83` of `escala` advances through llena → media → menguante. Each phase is an illuminated fraction `f` (1 / 0.5 / 0.2) drawn by `trazarFase()` (a right half-disk plus a terminator ellipse of half-width `r * |2f - 1|`). `dibujarLuna()` layers an outer halo, a bright lit fill, ~24 randomly placed craters with shadow+highlight, and a specular highlight.
- `mover()` clamps the radius used for edge bounces to `min(r, min(width, height) / 2)` so an oversized moon does not get stuck snapping against the edges.
- The background is **not** drawn by p5 except the stars: `draw()` calls `clear()`, the gradient lives in `body`'s CSS in `index.html`, and `estrellas` (200 twinkling dots generated in `setup()`) are drawn each frame. Calling `background()` would cover the gradient and the stars.
- `rebotar()` is called on every edge hit and plays an oscillator "blip"; pitch/volume scale with impact force. Audio stays silent until the user first clicks (browser autoplay policy) — hence `userStartAudio()` in `mousePressed()`/`touchStarted()`.
- The particle system is a **shooting-star shower**: on click/tap, `iniciarLluvia()` emits from the cursor for `DURACION_LLUVIA = 8000` ms. Each particle is a fast downward streak (a `drawingContext` gradient tail plus a glowing head) that fades out; `MAX_PARTICULAS` caps the count and `lluviaActiva` flips to false when the window ends.
- The moon pauses (and grows) while the cursor is within `radio * escala` of its center; when the cursor leaves it resumes moving at its new size.
- `<link rel="icon" href="data:,">` in `index.html` suppresses the browser's automatic `GET /favicon.ico`. Without it a static server logs a harmless-but-noisy `404 (Not Found)`.
- The title "Luna que rebota" is drawn in `draw()` at `height * 0.25` (upper half), not as an HTML heading, using the Google Font **Fredoka** via `textFont('Fredoka')` (loaded by a `<link>` in `index.html`; falls back to a system font offline). `index.html` carries a CSS reset (`margin: 0`, `overflow: hidden`, `canvas { display: block }`) so the canvas fills the viewport with no white margin or scrollbars.
- Canvas is sized once in `setup()`; there is no `windowResized()` handler, so resizing the window does not reposition the moon or the stars.
