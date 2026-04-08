- [x] Add `storyData` object to `public/app.js` for controlled randomness.
- [x] Add reusable `pick(arr)` helper in `public/app.js`.
- [x] Add `generateTonightStory()` in `public/app.js` with calm 300–400 word structure.
- [x] Integrate offline tonight flow into `handleGenerate(mode)` with early return for `mode === "tonight"`.
- [x] Add safe button wiring supporting both `#generateTonightBtn` and `#tonightStoryBtn` without duplicating generation logic.
- [x] Keep hero flow untouched and verify no server/Firebase dependency for tonight flow.

- [x] Add hidden Hero customisation section in `public/index.html` with IDs: `heroName`, `heroAge`, `heroIdea`, `heroLength`.
- [x] Add “Create My Child’s Story” CTA in hero section to call `handleGenerate('hero')`.
- [x] Add `mainActions` and `heroSection` flow-control wrappers in `public/index.html` without renaming existing IDs.
- [x] Wire explicit `generateHeroBtn` click listener in `public/app.js` to show hero customisation and hide main actions only.
- [x] Add temporary debug logs for hero click and hero payload values in `public/app.js`.
- [x] Ensure hero generation validates only truly empty fields and still reaches `openReadingMode("Hero Story", heroStory);`.
- [x] Adjust `public/style.css` for hero section visibility and ensure no full-page white override/background regression.

- [x] Enhance `handleGenerate("tonight")` with random `themes`, `characters`, `tones` selections and debug log.
- [x] Feed random selections into quick story output generation while keeping instant/non-blocking flow.
- [x] Update `#generateTonightBtn` label to exactly “Create a Quick Story” (ID unchanged).

- [x] Add `#saveProgressBtn` inside reading mode in `public/index.html`.
- [x] Enhance `openReadingMode()` in `public/app.js` to restore saved `readingScroll` from localStorage.
- [x] Save `readingMode.scrollTop` on Back button in `public/app.js`.
- [x] Add null-safe manual save handler for `#saveProgressBtn` in `public/app.js`.
- [x] Add `.save-btn` styling in `public/style.css`.

- [x] Add `formatStory(text)` helper in `public/app.js` for safe paragraph rendering.
- [x] Update `openReadingMode()` to render formatted story text and use safe scroll restore check.
- [x] Make `setupReadingModeEvents()` bindings null-safe per control and ensure back-save uses `scrollTop || 0`.
- [x] Upgrade `.reading-text` typography in `public/style.css` for book-like readability.
- [x] Upgrade `.reading-content` width/padding in `public/style.css` for centered comfortable reading.

- [x] Remove Quick Story meta intro lines so story starts directly with “Once upon a time…”.
- [x] Improve Quick Story consistency by locking one coherent theme/world and preventing mixed unrelated elements.
- [x] Improve character/pronoun consistency and reduce templated sentence feel in story generation logic.
- [x] Ensure simple goal + gentle resolution remain in bedtime-safe tone without random unrelated insertions.
- [x] Hide `#saveProgressBtn` for Quick Story and show it for Hero Story within reading mode logic.
