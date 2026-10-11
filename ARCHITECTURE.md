# Architecture

How Slay the Fish is put together, and the rules the code relies on. Read this before changing game state, saving, or anything that crosses layers. The README covers how to run the game and how to add content.

## Layers

| Folder | What it is | Rules |
|---|---|---|
| `src/engine/` | The game rules: combat, map, run, events, shop, equipment. Pure TypeScript. | No DOM, no Vue, no content imports, no `Math.random` or `Date.now`. `tests/architecture.test.ts` enforces this. Every function takes state in and returns new state. |
| `src/content/` | Game data: creatures, cards, builds, equipment, events, shop items, creature types. Plain typed arrays. | Data only. `content/index.ts` passes everything through `buildGameData`, which validates it and fails at startup with a readable error. |
| `src/ui/` | Vue components plus `useGame.ts`, which holds the current states and calls the engine. | No game rules here. Components read state and emit actions. Display-only fields (sprites, icons, terrain) live in content but are only read by the UI. |
| `electron/` | The desktop shell: a window, plus a small file bridge for saving. | The page never touches the file system directly; it goes through `window.desktop` (see Persistence). |
| `scripts/` | One-off asset generators (`npm run sprites`, `npm run terrain`, `npm run eggs`). | Seeded: re-running gives the same images. |

## State model

- **`GameData`** (`engine/types.ts`): all content, indexed by id. It never changes during a game.
- **`RunState`** (`engine/run.ts`): everything that lasts between fights: build, HP, deck, coins, equipment, level, map, position, and the **bucket** (see Aquariums).
- **`CombatState`** (`engine/types.ts`): one fight: player, enemies, card piles, turn, phase, log.
- **Plain JSON only.** Both states are plain, JSON-serialisable data, which is what makes saving trivial.
- **Immutable updates.** Engine functions never mutate their input: they `clone` it and return the new state. `applyAction` returns the very same object when an action is illegal.
- **Deterministic.** The random number generator's state is a single integer stored on the state itself (`rng`). The same seed and the same actions always give the same game, so a resumed save continues exactly as it would have. `tests/determinism.test.ts` checks this.
- **UI glue.** `useGame.ts` keeps `run`, `combat`, `screen`, the pending card rewards, the open event and the shop visit in Vue refs, and swaps them for whatever the engine returns.

## Screen flow

```
menu ──New run──▶ build ──Select──▶ map ──▶ fight ──win──▶ card reward ──▶ map …
  ▲                                  │  ├─▶ event (10%: a fight instead) ─▶ map
  │                                  │  ├─▶ treasure ─▶ map
  │                                  │  └─▶ shop ─▶ map
  │                                  ├── boss beaten ─▶ card reward ─▶ next level's map (Kid → Adult → Elder)
  │                                  └── ⌂ head home (after a mini-boss) ──confirm──▶ complete
  │                                                                  └──Go back──▶ map
  └──── Menu button (any screen) ◀── complete (Elder boss beaten, headed home, or a boss fled) / defeat
```

- **Menu:** Resume (disabled without a save), New run, See aquarium, Exit (desktop app only). A small **Reset progression** button (bottom right, after a confirmation) deletes both the save and the profile (`resetProgress`). The menu's background is the home aquarium. A 📖 tab on the right edge (menu and See aquarium view) opens the creature book (`CreatureBook.vue`): a drawer listing every creature. Creatures never encountered show as **?**. The others show their image, their status (Seen or Captured), and how many are in the home aquarium.
- **Build selection:** one tile per build. The image opens a details dialog (description, strong-against types, starter deck, equipment). The home aquarium fills the bottom half of the screen, with three session slots (`SessionSlots.vue`) on its right: clicking a creature offers **Bring for the session**, and ✕ puts it back.

## A run

- **Levels** (`content/levels.ts`): a run is three acts played in order, **Kid**, **Adult** and **Elder** (`RunState.level`), on the same family coast. Each age reaches more of it.
  - **Shape:** 15 columns of nodes, a mini-boss in column 8, and the boss alone in column 16. The start (the grandparents' house) leads to every node of column 1.
  - **Hand-made:** every node is written out: its `column`, its position on the art (`x`, `y`), its `kind` and its links (`next`). Editing a level is editing that list.
  - **Node kinds:** `fight`, `event`, `shop`, `treasure`, `leave` (head home), `miniBoss` and `boss`.
  - **Head home:** the mini-boss leads to at least two nodes, one of them a `leave` node. That's a dead end that ends the run as a success.
  - **Next level:** beating a level's boss (`claimVictory`) moves the run to the next level's start (`enterNextLevel`), keeping everything else (HP, deck, bucket, coins). Beating the last boss wins the run.
  - **Checked on startup:** `validateLevels` (`engine/data.ts`) refuses broken maps with a readable message:
    - **Columns:** none missing, the boss alone in the last one, links only going forward.
    - **Mini-boss:** exactly one, and it leads to a leave node.
    - **Nodes:** every one reachable, and every fight with its creatures.
  - **The map** (`engine/map.ts`): `buildLevelMap` turns a level into the `GameMap` the run plays, with the start node added.
- **Fishing spots** (`content/spots.ts`, the legend: rock pools, jetty, reef…): a fight node's `spot` decides who it meets. `encountersFor` draws among encounters whose creatures live in the spot's `waters` (each creature's `water`) and, if the spot lists `types`, are of one of them, at the level's `tier`. When nothing fits, it widens: first any creature type from those waters, then any tier, then anything at the tier.
  - **Narrowing a fight:** a node can add `creatureType` to meet only that type at its spot, or `enemies` to meet exactly those creatures. Mini-bosses and bosses use `enemies`.
- **Fights:**
  - **On the map:** a fight node shows its fishing spot, not a specific creature (bosses show their name).
  - **On arrival:** `travelTo` draws an encounter from its spot at the level's tier (`encountersFor`). A companion gains a bond point at every fight.
- **Events:**
  - **On arrival:** `visitEvent` either starts a surprise fight against any creature of the level's tier (`EVENT_FIGHT_CHANCE`, 10%) or draws one of the events allowed at that column (`minColumn`).
  - **Treasure nodes** (`visitTreasure`) draw among the events marked `treasure` instead, which never come up as ordinary events.
  - **Choices:** each choice is a list of `EventEffect`s, applied by `applyEventChoice` (`engine/events.ts`).
- **Shop:**
  - **Visiting:** `visitShop`, then `buyShopItem` with a `ShopVisit` that tracks purchases for that visit (`engine/shop.ts`).
  - **Limits:** items can have a per-visit `limit`.
  - **Paying:** the bucket stays in view under the shop, so creatures can be sold there to afford things.
- **Head home** (the `leave` node after each mini-boss):
  - **Confirming:** clicking the ⌂ node opens a confirmation without moving (`leaveNodeId` in `useGame.ts`). **Go back** returns to the map; that prompt is never saved, so a resume lands on the map.
  - **Finish:** `visitLeave` moves onto the node and the run ends as a success, so the bucket comes home.
- **End of a fight** (`finishCombat`): carries HP over. A win also adds one to the floor counter and puts every enemy into the bucket, unless equipment sells it on the spot.

## Combat and the Panic bar

- **Turns:**
  - **Start of the turn:** block resets, energy refills and you draw 5 cards.
  - **End of the turn:** the hand is discarded and statuses tick (**Poison** deals its stacks as damage, ignoring Block, then decreases). Each enemy then acts on its shown intent and its escape bar rises.
  - **Win/lose check:** after every effect.
- **Escape bar** (shown to the player as **Panic**, name in `ESCAPE_BAR_NAME`). Each creature has:
  - **`escape`:** the bar, which starts at `escapeStart`.
  - **`escapeRate`:** how much the bar rises after the creature's turn. **Snared** stops the rise for a turn.
  - **`escapeAt`:** when the bar reaches it, the creature flees. The fight ends as `fled`, with no reward and no capture.
- **Capture:** a creature at 0 HP **or** with its bar pushed to 0 is out of the fight and captured (`isAlive`).
- **Card effects on the bar:**
  - **`changeEscape`:** moves the bar.
  - **`changeEscapeRate`:** changes the rise rate for the rest of the fight.
- **Builds use the bar differently** (see `content/cards.ts`):
  - **Rod fishing** manages tension: big hits raise Panic, skills calm and tire the fish.
  - **Spear fishing** strikes hard, and its wounds slow the rise.
  - **Foraging** barely deals damage: it snares creatures and calms them down to 0.

## Aquariums: the bucket and the home aquarium

There are two separate collections of creatures. They never share creatures, except in one moment: the end of a won run.

| | **Bucket** | **Home aquarium** |
|---|---|---|
| What | The creatures caught during the current run | The creatures brought back from won runs |
| Where in code | `RunState.bucket` (creature ids) | `Profile.homeAquarium` (`ui/saveStore.ts`): one `HomeCreature` `{ id, bond }` per creature |
| Saved in | `save.json` (with the run) | `profile.json` (lasts forever) |
| Shown | Below the map and the shop (🪣 Bucket) | Menu background, build selection (🏠 Home aquarium) |
| Interactive | Yes: click a creature to sell it for coins | On the build screen only: click a creature to bring it for the session |

**Lifecycle:**
1. **New run:** on the build screen the player can pick up to `SESSION_SLOTS` (3) home-aquarium creatures (`useGame` `brought`). When the build is chosen, `takeFromHome` removes them from the home aquarium (and the profile is written), and `createRun` starts the bucket with them. They follow the bucket's rules from then on, so they're lost if the run is.
2. **During the run:**
   - **Captures:** captured creatures go into the bucket. With **Sharp Spear** they're sold on the spot instead and never reach it.
   - **Selling:** the player can sell creatures from the bucket at any time.
   - **Events:** events can read the bucket. The Enthusiastic Passerby tips coins per creature in it.
3. **Successful run**, either the boss beaten (`claimVictory`) or the session finished at the 🚪 node (`finishSession`): `bringCatchHome` adds everything still in the bucket to the home aquarium, and the profile is written.
4. **Lost run, abandoned run (New run over a save), or the boss fleeing:** the bucket is lost. The home aquarium gets nothing from it.
5. **Breeding, after every run that ends** (won, session finished, lost, or the boss fleeing, but not an abandoned run):
   - **Laying:** `layEggs` gives each species with at least two in the home aquarium one roll at its `breedChance` (per creature in `content/creatures.ts`, 10% for all for now). After a successful run it runs once the bucket has joined the home aquarium, so new catches can breed straight away.
   - **Eggs:** each egg holds one creature id and is saved in `Profile.eggs`. `EggTray.vue` shows the eggs at the bottom of the window between runs (menu, build selection, end screen), playing the idle animation.
   - **Hatching:** clicking an egg plays the hatching animation. Then `hatchEgg` moves its creature into the home aquarium, and the creature is shown in the centre with a halo and streamers until the next click.
   - **Colours:** all eggs are beige for now. Planned rarity order: beige → white → purple → gold.

**Bond** (`engine/bond.ts`): each creature in the home aquarium has its own bond points, from 0 to its `bondToFull`. That value comes from its tier (100, 200 or 400, `BOND_BY_TIER` in `content/creatures.ts`) unless the creature sets its own.
- **Levels:** level 1 at 20%, level 2 at 50%, level 3 (fully bonded) at 100% (`BOND_LEVELS`). The aquarium shows a ♥ badge with the level (gold when fully bonded), and the full progress on hover or click.
- **Brought along:** a companion gains `BOND_PER_ENCOUNTER` (1) point every time a fight starts during the run, event fights included (`startFight`). It keeps them only if the run succeeds, since a lost run loses the bucket. This is the only way past level 1. The run keeps each companion's bond (`RunState.companions` are `HomeCreature`s), so the right individual comes back.
- **Left at home:** `restAtHome` adds `BOND_AT_HOME` (2) after every run that ends, but never past level 1, and never takes any away.
- **New arrivals:** creatures caught during a run start at 0; hatchlings start at level 1 (`hatchling`).
- **Order at a run's end** (`endRun` in `useGame.ts`): the creatures at home rest, then a successful run brings its bucket home, then eggs are laid.
- **Picking companions:** the build screen picks individuals by their index in the home aquarium (`takeFromHome`), not by species, so you choose which Clownfish to bring.
- **Effects:** none yet. Bond is only tracked and shown for now.

**Creature book** (`Profile.creatureBook`, id → `'seen' | 'captured'`): `recordEncounter` (engine, `run.ts`) updates it from the combat state. A watcher on `combat` in `useGame.ts` writes the profile whenever something new is learnt:
- **Seen:** as soon as a fight starts, whatever the outcome.
- **Captured:** once the fight is won, even if the run is lost later or the creature is sold. A captured creature never goes back to seen.

Anything meant to last between runs (score, unlocks, statistics) belongs in the **profile**, never in `RunState`.

## Companions: bonuses from brought creatures

Creatures brought from the home aquarium on the build screen (`RunState.companions`, always the first entries of the bucket) give a bonus from their **temperament** for the whole run. Creatures captured during the run are **angry** (💢 in the bucket) and give nothing. Selling a companion ends its bonus; the max HP it gave stays.

- **Content:** `content/companions.ts`, one `CompanionBonusDef` per temperament. `effects` hold the amounts for one species; `fullSchool` is the extra at 3 species.
- **Scaling** (`engine/companions.ts`, `activeBonuses`): only **different species** count, so two Clownfish are one reef fish.
  - 1 species: the amounts as written.
  - 2 species: doubled (`COMPANION_SCALE_CAP`).
  - 3 species (`FULL_SCHOOL`): still doubled, plus the `fullSchool` effects.
- **Effects** (`CompanionEffect` in `engine/types.ts`):
  - **Passive modifiers,** read with `bonusTotal`: bonus Block, kept Block, bonus damage, first-attack damage, dodged attacks, extra Panic reduction, slower escape, max HP, healing after fights, sell bonus.
  - **Triggered effects,** `{ type: 'trigger', on, effect }`: any card effect, resolved as the player by `fireTriggers` with its numbers as written (no Strength or other bonuses). The triggers are `combatStart`, `firstAttackEachTurn`, `firstAttackEachFight`, `fullBlock`, `hitByEnemy` and `firstBelowHalfHp`. For the attack and hit triggers, `target` means the enemy attacked or attacking. Block from triggers that fire during the enemies' turn lasts into the player's next turn.
- **Where they apply:**
  - `createRun` adds the max HP.
  - `startFight` passes the scaled effects to the fight, which keeps them in `CombatState.bonuses`; the once-per-turn and once-per-fight state lives in `bonusTracker`.
  - `finishCombat` heals and applies the sell bonus to on-the-spot sales; `sellCreature` applies it to bucket sales.
- **UI:** the home aquarium shows a creature's bonus before you bring it. The session slots list the combined bonuses. The map shows them next to the equipment, with a tooltip.

## Persistence

All saving lives in `ui/saveStore.ts`. There are two files, each with its own version number:

| File | Contents | Written | Deleted |
|---|---|---|---|
| `save.json` | `SavedGame`: version, seed, screen, run, combat, pending card rewards, open event, shop visit | After every state change (a watcher in `useGame.ts`) | When the run is lost or completed, or by **Reset progression** |
| `profile.json` | `Profile`: version, home aquarium, eggs, creature book | When a successful run brings its bucket home, when an egg is laid or hatched, and when a creature is first seen or captured | Only by **Reset progression** |

- **Where:** in the desktop app, in the app's data folder (`app.getPath('userData')`, e.g. `~/Library/Application Support/Slay the Fish`). In a browser, localStorage under `slay-the-fish:save` and `slay-the-fish:profile`.
- **Desktop bridge:** `electron/preload.cjs` exposes `window.desktop.readData / writeData / deleteData(name)` and `quit()`. `electron/main.js` only accepts the names in `DATA_FILES`, so the page can't touch any other file.
- **Safe writes:** a file is written to `name.json.tmp`, then renamed over the real one, so a crash mid-write can't corrupt it. Writes are queued one after another, so an older write can never land after a newer one.
- **Versions** (`SAVE_VERSION`, currently 5, and `PROFILE_VERSION`, currently 4). When a saved shape changes:
  1. Bump the version.
  2. Convert older files in `upgradeSave` (or the profile's equivalent).
  3. A file that can't be upgraded is ignored rather than crashing: no Resume, or a fresh profile.

  Examples: version 1 saves called the bucket `run.captured`, and `upgradeSave` renames it. Version 2 saves had no companions, so the upgrade adds empty ones (and empty combat bonuses). Version 1 profiles had no creature book; `upgradeProfile` marks everything in the home aquarium as captured. Version 2 profiles had no eggs. Version 3 profiles stored the home aquarium, and version 3 saves the companions, as plain ids; they're upgraded to creatures with no bond. Version 4 saves were on a generated map: they can't be resumed.
- **Resume** restores every saved field, so the player returns to the same screen. Mid-fight saves include the hand, energy and Panic.

## Desktop app and releases

- **Development:** `npm run electron:dev` opens the game in Electron against the running Vite dev server.
- **Build:** `npm run electron:build` runs the typecheck, builds the game, then packages it into `release/`. Code signing is off (`"identity": null` for macOS) until there's a certificate.
- **Artifacts** have fixed names, so the README's "latest" download links never change: `slay-the-fish-mac-arm64.dmg`, `slay-the-fish-windows.exe`, `slay-the-fish-linux.AppImage`.
- **Release:** pushing a `v*` tag runs `.github/workflows/release.yml`. It builds and tests on macOS, Windows and Linux, then publishes a GitHub Release with the three installers. The tag should match `"version"` in `package.json`.
- **Loading from disk:** `vite.config.ts` uses `base: './'` so the built page loads its assets with relative paths from disk.

## Assets

- **Sprite sheets** are registered in `ui/sprites.ts` (`SHEETS`) and referenced from content as `{ sheet, index }` (1-based).
- **Animated creature sheets** (`assets/creatures/NNN.png`, 6 frames × 4 rows: idle, attack, capture, flee) come from `scripts/generate-creature-sprites.mjs`.
- **The family coast** (`assets/coast.svg`, 1200×600) is the background of every level's map, from the map sketch. `MapView.vue` draws on top of it:
  - **Reach:** the shading outside the level's reach (`reach`).
  - **Links:** the links between nodes.
  - **Nodes:** fights in their spot's colour with its code, ? / $ / T for events, shops and treasure, ⌂ for heading home, a diamond for the mini-boss and a ring for the boss.
  - **Legend:** a **Legend** button shows it, built from the spots.
- **Map terrain patches** (`assets/terrain.png`, from `scripts/generate-map-terrain.mjs`) were drawn under fights on the old generated map. Nothing uses them now; `terrain` in `content/creatureTypes.ts` is kept for later.
- **Eggs** (`assets/eggs/<colour>.png`: idle row, then hatching row, 32×32 frames) are cut from `assets/egg.png` (art by VIERGACHT) by `scripts/extract-eggs.mjs`. They're used through `eggClip` in `ui/sprites.ts`.

## Testing

- **Running them:** `npm test` (Vitest) and `npm run typecheck`.
- **Engine tests** use `tests/fixtures.ts`, small content with fixed numbers, so rebalancing real content doesn't break them.
- **Content tests** run against the real data.
- **Levels:** `tests/map.test.ts` checks the real levels (shape, the head-home node, every fight finding creatures from its own spot at its tier) and the validation messages.
- **Not covered:** the UI layer and `saveStore.ts` have no automated tests. They were checked by hand in the browser and with an Electron smoke test.

## Tuning knobs

| Setting | Where | What it controls |
|---|---|---|
| Nodes, links, bosses, reach, tier | `content/levels.ts` | Each level's map and who you meet |
| Waters and creature types per spot | `content/spots.ts` | Which creatures each fishing spot can bring |
| `EVENT_FIGHT_CHANCE`, `CARD_REWARD_COUNT` | `engine/run.ts` | Surprise fights in events, card choices after a win |
| `STARTING_HAND_SIZE`, `BASE_ENERGY`, `VULNERABLE_MULTIPLIER`, `WEAK_MULTIPLIER` | `engine/constants.ts` | Combat basics |
| `sellValue`, `escapeAt`, `escapeStart`, `escapeRate`, `temperament`, `tier`, `water` | `content/creatures.ts` | Per-creature balance, and where it lives |
| Item prices and limits | `content/shop.ts` | Shop |
| Temperament bonuses, `COMPANION_SCALE_CAP`, `FULL_SCHOOL`, `SESSION_SLOTS` | `content/companions.ts`, `engine/companions.ts`, `engine/run.ts` | What brought creatures give, and how it scales |
| `BOND_BY_TIER`, `bondToFull`, `BOND_PER_ENCOUNTER`, `BOND_AT_HOME`, `BOND_LEVELS` | `content/creatures.ts`, `engine/bond.ts` | How fast creatures bond with the player |

Percentages in equipment and event effects are whole numbers (20 = 20%), and results are **rounded up**: the Reliable Reel's rate cut, the Sharp Spear's sale bonus, passerby bonuses.
