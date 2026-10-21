# UI work

The game runs on desktop (Electron and browser), tablets and phones, with a mouse or a finger. A UI change is done when it has been seen working at each size it can affect.

## Sizes and input

- **Compact screens** are 700px wide or less, or 500px tall or less: `COMPACT_QUERY` in `src/ui/useScreen.ts`, and the same `@media (max-width: 700px), (max-height: 500px)` in CSS. Use `useMedia(COMPACT_QUERY)` when a component needs it in code (sprite sizes).
- **Touch** is `TOUCH_QUERY` (`(pointer: coarse)`): bigger tap targets.
- Hover effects (lifts, highlights) go inside `@media (hover: hover)`, so a tap doesn't leave them stuck.
- The app fills the screen (`#app`, 100dvh) and each screen scrolls inside `main`. Size things from their container, never from `100vh` minus a guessed top bar.
- Content that hides off an edge (the side drawers) sits in a container that never scrolls; let the panel inside scroll instead.

## Interaction

- Everything playable by drag is also playable by tap: a tap selects, a second tap (or a tap on the target) acts.
- Explanations go in `v-tip`, which works with hover, keyboard focus, a long press, and a tap on information that isn't a button. Wrap game text in `<KeywordText>` so its keywords explain themselves; a keyword with an icon (`ICONS` in `src/ui/keywords.ts`) shows as that icon instead of the word.
- Holding a finger on a card (`CardView`) shows it full screen until the next tap (`ui/cardZoom.ts`, drawn by `CardZoom.vue`); the hold zooms the card instead of opening the tips inside it, and a fight's hand stops its drag when the zoom opens. Pass `:zoomable="false"` to a card that mustn't zoom.
- New text goes in both locales (docs/agents/changes.md → Text).

## Verifying

1. Ask the user to start the dev server if `curl localhost:5190` doesn't answer.
2. Open http://localhost:5190 in the browser pane and, before any click, run `localStorage.setItem('catch-of-the-deck:music-on', 'false')` so the music stays silent (the first click would start it). Don't touch the music toggle unless the task is about music. Then check at least phone portrait (375×812), phone landscape (812×375) and desktop; add tablet (768×1024) for layout changes. Done when, at each size:
   - nothing overflows sideways;
   - the screen fits or scrolls where it should (compare `scrollHeight` with `clientHeight` of `main`);
   - the console shows no errors;
   - the changed interaction works when you exercise it.
3. The pane's screenshots can lag behind the page: confirm state with JavaScript (element positions, text) rather than trusting one screenshot.
4. Reset the viewport to desktop when done.
