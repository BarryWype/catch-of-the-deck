# AGENTS.md

Slay the Fish: a deck-building fishing roguelike. A pure TypeScript rules engine (`src/engine`), game data (`src/content`), a Vue 3 UI (`src/ui`), English and French text (`src/locales`), Vitest tests, an Electron desktop build and a GitHub Pages web build. How it fits together: ARCHITECTURE.md. The rules as a player sees them: GAME_MECHANICS.md.

## Hard rules

- **Do git command that do changes on a repo only if specifically asked.** Do not take initiative regarding git command that do changes on a repo, ask the user validation, and ask the user if they prefer a pull request instead of a straigh push. Do tag, push, commit, merge, only if asked specifically by the user.
- **The dev server is the user's.** It runs on port 5190 when they start it. Verify with one-shot commands (`npm run typecheck`, `npm test`, `npm run simulate`); when a check needs the running app and the server is down, ask the user to start it.
- **Ask first** before anything destructive or hard to undo: deleting files, `git reset --hard`, changing save formats in a way that drops players' saves, changing settings.
- **Hands off** `.env` files and lockfiles (`npm install` may update the lockfile; editing it by hand is out).
- **Balance numbers are the user's.** Change a constant or a content value only when the request names it; otherwise report the result and suggest the change.

## Writing code

- Make the smallest change that does the task, in the style of the code around it.
- Add a helper only when it removes real duplication (three or more uses).
- Comments explain how the code works, briefly. Leave history to git.
- The engine stays pure: it imports only engine files, and all randomness goes through the seeded RNG (`nextInt` / `nextFloat` on the state). `tests/architecture.test.ts` checks it.

## Every task

1. **Read before writing.** Read the code the change touches and the doc that describes it. For a spec, follow docs/agents/specs.md.
2. **Change everything the feature touches.** docs/agents/changes.md lists, per kind of change, every file that must follow (engine, data checks, content, both languages, UI, saves, tests, docs, simulator).
3. Verify in proportion to the change:
   - Small (text, one number, one card, a doc): `npm run typecheck` and only the test file it touches (`npx vitest run tests/cards.test.ts`). No simulation unless I ask.
   - Medium (a mechanic, several cards, a creature): typecheck + `npm test`; a balance change gets `npm run simulate -- --runs 100`.
   - Large (a rework, a spec): everything, 300-run simulations before and after.
   UI: one screenshot at the size it affects; check the other sizes with JavaScript (positions, overflow), not screenshots.
4. **Report** in a few bullets: what changed, every decision you made where the request was open, what you didn't verify and why, and anything the user must do. Lead with the outcome.

## Disclosed guides

- docs/agents/specs.md: when a request is a spec, a rework, or anything with open choices.
- docs/agents/changes.md: when adding or changing a mechanic, card, creature, status, effect, text or saved data.
- docs/agents/balance.md: when a change can move difficulty: numbers, cards, moves, rewards.
- docs/agents/ui.md: when changing anything on screen.
