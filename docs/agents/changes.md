# What a change touches

A feature here is rarely one file. Find your kind of change below; a change is done when every line of its list is handled or doesn't apply. The usual miss is a second language, a doc, or the simulator. ARCHITECTURE.md explains each system.

## A card

- `src/content/cards.ts`, in its family's section: `family` decides which creatures offer it (`src/content/families.ts`); starter and junk cards have none.
- French name: `cards` in `src/locales/fr-content.ts`.
- A test in `tests/cards.test.ts` for anything beyond plain damage, Hold or Drain.
- The card table in CARD_REWORK.md.
- A new card **type**: its icon and frame in `src/ui/CardView.vue`, a colour in `src/ui/style.css`, `card.type.<type>` in both locales, and `TYPES` in `scripts/reward-shares.ts`.

## An effect (something a card or move does)

- `Effect` in `src/engine/types.ts`, and its case in `resolveEffect` (`src/engine/effects.ts`).
- Its text: a case in `src/engine/describe.ts`, and keys in `src/locales/en.ts` and `fr.ts`.
- Its case in `previewIntent` (`src/engine/intents.ts`), if a creature move can carry it.
- Content checks in `src/engine/data.ts`: add it to the "needs a target" list when it acts on the chosen creature.
- Nested effects (`then`/`else`/`effects`) go through `doubled()` in effects.ts.
- Its row in README's effect table, and a test.

## A status

- `StatusId` in types.ts, and `STATUS_META` in `src/engine/statuses.ts`: buff or debuff, whether it wears off each turn. A status used up by the next move goes in `nextMoveMods`.
- Name and description in both locales (`status.<id>`), and `describe.statusText.<id>` where a card's text should say what it does.
- Its icon in `src/ui/StatusList.vue`. Keyword tooltips pick up its name by themselves.
- GAME_MECHANICS.md.

## A creature or a move set

- `src/content/creatures.ts` (stats) and `src/content/behaviors.ts` (move sets, built with `move()`). Rules the tests enforce:
  - one pace move per set, at most two specials;
  - pace, special and Wind-up moves are light;
  - a Wind-up names its `followUp`, and heavy moves have no weight;
  - only predators, Pike and Red piranha gain Strength from moves.
- Move ids are per set: reuse an id to keep its French name, pick a new one when the meaning changes. French move names are `moves['<temperament>.<id>']` (or `<creature>.<id>`) in fr-content.ts.
- CREATURE_BEHAVIOUR.md (the compact reference other models read).

## A companion bonus (what a temperament gives when brought)

- `src/content/companions.ts`: `effects` scale with the temperament's stars through `byStars` (amount at 1★, 2★…, the last entry covering more); `fullSchool` is added as written at 3 species. Keep `description` in sync with the numbers.
- A new passive effect: `CompanionEffect` in `src/engine/types.ts`, where it's read (`bonusTotal`), and `companion.<type>` in both locales. A new trigger: `CompanionTrigger`, where it fires (`fireTriggers`), and `companion.when.<trigger>` in both locales.
- Content checks in `src/engine/data.ts` (`byStars` values, no `byStars` in `fullSchool`).
- A test in `tests/companions.test.ts`; GAME_MECHANICS.md (Home) and ARCHITECTURE.md (Companions) when the rules change.
- Then `npm run simulate -- --lineups` before and after (docs/agents/balance.md).

## Text

- English in `src/locales/en.ts` is the reference. `fr.ts` must have the same keys (TypeScript and `tests/i18n.test.ts` check). Templates use `{param}`, `{@grit}`-style terms, and `singular|plural`.
- Content names (creatures, cards, moves, events…) go in `fr-content.ts`.
- The in-game guide is `guide.*` in both locales.

## Saved data

Changing the shape of `RunState`, `CombatState` or the profile: bump `SAVE_VERSION` or `PROFILE_VERSION` in `src/ui/saveStore.ts` and add an upgrade step, so existing saves keep working.

## A number (constant or content value)

- Constants live in `src/engine/constants.ts`, or next to their system (`engine/bond.ts`, `engine/sizes.ts`, `BUCKET_SIZE` and `SESSION_SLOTS` in `engine/run.ts`, `BOND_BY_TIER` in `content/creatures.ts`). Search the docs for the old value (GAME_MECHANICS.md, ARCHITECTURE.md, CREATURE_BEHAVIOUR.md) and update every mention.
- Then follow docs/agents/balance.md.

## Docs, by reader

- GAME_MECHANICS.md: players, plain language, no code.
- ARCHITECTURE.md: developers, how the code is organised and why.
- CREATURE_BEHAVIOUR.md: other models, compact.
- README.md: running, releasing, adding content.

## The simulator

`scripts/simulate.ts` plays with a bot. A mechanic the bot doesn't understand skews every balance number: teach `evaluate` about it, as it does for junk cards.
