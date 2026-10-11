# Spire Slice

A vertical slice of a Slay the Spire–style deck-building roguelike, built with TypeScript, Vite, Vue 3 and Vitest. It uses no game framework.

## Download

Desktop app, always the latest version:

- [macOS (Apple Silicon)](https://github.com/BarryWype/slay-the-fish/releases/latest/download/slay-the-fish-mac-arm64.dmg)
- [Windows](https://github.com/BarryWype/slay-the-fish/releases/latest/download/slay-the-fish-windows.exe)
- [Linux (AppImage)](https://github.com/BarryWype/slay-the-fish/releases/latest/download/slay-the-fish-linux.AppImage)

Older versions are on the [releases page](https://github.com/BarryWype/slay-the-fish/releases).

The app isn't code-signed yet, so the first launch shows a warning:

- **macOS**: right-click the app and choose **Open**, then **Open** again.
- **Windows**: on the SmartScreen prompt, click **More info**, then **Run anyway**.
- **Linux**: make the file executable (`chmod +x slay-the-fish-linux.AppImage`), then run it.

## Running it

Requires Node.js 20+ (the version is pinned in `.nvmrc`). With nvm, just run `nvm install` (or `nvm use`) in the project folder.

```bash
npm install
npm run dev        # start the dev server, then open the printed URL
npm test           # run the engine test suite
npm run build      # type-check (incl. the DOM-free engine check) + production build
```

Add `?seed=12345` to the URL to replay a specific run. The current seed is shown in the top bar.

## How to play

You play a young fisherman setting off on their fishing journey from the grandparents' house on the waterfront. Before the first fight you pick a fishing style, which sets your starter deck:

| Build | Strong against | Starter deck |
| --- | --- | --- |
| Rod fishing | Sport fish, Small fish, Deep sea | 5 Cast, 4 Bucket, 1 Set the Hook |
| Spear fishing | Rock fish, Big fish, Tentacled | 5 Sharp Stick, 4 Bucket, 1 Harpoon |
| Foraging | Crustacean, Shellfish, Critter | 5 Small Net, 4 Bucket, 1 Crab Net |

Every creature has a type (shown under its name, and as the icon of map events). Build cards deal bonus damage to their types and glow **Effective!** when the bonus applies.

- A run takes place on a map that you cross from left to right: a starting point, 20 fights and a boss at the end. Column 10 is a harbour of 3–4 nodes: 🛒 shops, plus one 🚪 "finish the session" node, a dead end where you can end the run and take your bucket home. Your position is marked **A**, and the destinations you can reach next are highlighted in yellow. Each event shows a creature type (🐠 small fish, 🦀 crustacean…), tinted green when your build is strong against it; the actual creature is drawn from that type when you get there. Everything comes from the run seed. Hover over an event to see its type.
- You start each turn with 5 cards and 3 energy. Click a card to play it. With several enemies, click the card and then the enemy you want to hit.
- Each enemy shows its **intent** above its head: 🗡️ attack (with the real damage it will deal), 🛡️ block, 💢 buff, 🌀 debuff. Hover over an intent for details.
- Click **End Turn** and the enemies carry out the intents they showed.
- Every creature you beat or wear out goes into your **bucket**, shown below the map (`run.bucket`). You can sell creatures from it at any time. If you win the run, everything still in the bucket joins your **home aquarium**, which lasts between runs and is shown on the menu and build screens. See ARCHITECTURE.md.
- After a win you pick 1 of 3 cards to add to your deck, then you return to the map. Your HP carries over between fights. Winning the fight in the last column completes the run.

## Architecture

```
src/
  engine/     Pure game logic. No DOM, no Vue, no content imports.
  content/    Game data only: character (+ home), builds, cards, creatures + types + behaviors, encounters, gear.
  ui/         Vue components. They render state and dispatch actions.
tests/        Vitest suites for the engine (plus content validation).
```

### Engine (`src/engine`)

- **Reducer-style state.** All state is plain JSON data. `applyAction(state, action, data)` returns a **new** state and never mutates its input. Actions are `{ type: 'playCard', cardUid, targetId? }` and `{ type: 'endTurn' }`. Illegal actions return the same object; `validateAction` tells you why one is illegal.
- **Deterministic.** The seeded RNG (mulberry32) stores its cursor *in the state* (`state.rng`). Shuffles, enemy HP rolls, intent choices and random targets all draw from it. `replayCombat(config, actions, data)` rebuilds any fight exactly.
- **Combat loop.** On the player's turn, block resets, energy refills and you draw 5 cards. When you end the turn, your hand is discarded and your statuses tick. Each enemy then clears its block, performs its shown intent, and has its statuses tick before it rolls its next intent. The win/lose check runs after every effect.
- **Piles.** There are draw, hand, discard and exhaust piles. When the draw pile is empty, the discard pile is shuffled into it. A card that is being played is in no pile until its effects finish, so its own draw effect can't reshuffle it. The hand is capped at 10 cards.
- **Effect primitives** (`effects.ts`): `dealDamage`, `gainBlock`, `applyStatus`, `drawCards`, `gainEnergy`. Cards and enemy moves are both just lists of these primitives.
- **Damage math** (`damage.ts`): `floor((base + Strength) × 0.75 if Weak × 1.5 if Vulnerable)`, never below 0. Block absorbs damage before HP.
- **Statuses** (`statuses.ts`): Strength is permanent and can be negative. Vulnerable, Weak and Snared lose 1 stack at the end of their owner's turn.
- **Map** (`map.ts`, `run.ts`): `generateMap` builds 21 columns, the way Slay the Spire does. The start, the boss and any choke columns (`CHOKE_COLUMNS`) hold a single node; the harbour columns (`SHOP_COLUMNS`) hold 3–4 nodes: shops plus one dead-end "finish the session" node. In between, `MAP_PATHS` paths walk across `MAP_LANES` horizontal lanes, each step staying in its lane or moving one up or down, and never crossing a link already drawn. Nodes exist wherever a path passes and links are the paths' steps, so routes branch and merge naturally, every node is reachable, and paths never cross. Each node gets a creature type found at its depth tier (`creatureType`, `tier`). `travelTo(run, nodeId, data)` moves the player, draws an encounter of that type and tier (`encountersFor`), and starts the fight.
- `npm run typecheck` also compiles the engine with `tsconfig.engine.json`, which has **no DOM types**. A test also checks that engine files import only other engine files and never use `Math.random`.

### Content (`src/content`)

Content is plain typed arrays. `content/index.ts` passes them through `buildGameData`, which validates every reference (unknown cards or moves, untargeted cards with targeted effects, bad HP ranges, and so on) and fails at startup with a readable error.

### UI (`src/ui`)

`useGame.ts` holds the current run and combat states in Vue refs and replaces them with whatever the engine returns. Components only read state and emit actions. Card text and intent numbers come from engine helpers (`describeCard`, `previewIntent`), so the UI shows exact values, Strength and Vulnerable included.

## Adding a card

Add an entry to `src/content/cards.ts`. You don't need to touch code:

```ts
{
  id: 'cleave',               // unique id
  name: 'Cleave',
  type: 'attack',             // 'attack' | 'skill' | 'power'  (powers exhaust when played)
  rarity: 'common',           // 'starter' cards are never offered as rewards
  cost: 1,
  target: 'none',             // 'enemy' if any effect uses the chosen target
  effects: [
    { type: 'dealDamage', amount: 8, target: 'allEnemies' },
  ],
  // art: '🎣',               // optional: placeholder emoji shown on the card
  // exhaust: true,           // optional: remove from the fight after playing
  // description: '...',      // optional: override the generated text
},
```

Effect reference:

| Effect | Fields | Notes |
| --- | --- | --- |
| `dealDamage` | `amount`, `hits?`, `target?` | Strength, Weak and Vulnerable apply to every hit |
| `gainBlock` | `amount` | Always applies to the user |
| `applyStatus` | `status` (`strength` / `vulnerable` / `weak` / `snared`), `amount`, `target?` | Negative amounts remove stacks, e.g. `-2` Strength. Snared stops a creature's Panic from rising |
| `drawCards` | `amount` | Player only |
| `gainEnergy` | `amount` | Player only |
| `changeEscape` | `amount`, `target?` | Moves a creature's Panic bar: negative calms it (captured at 0), positive panics it (flees at the top) |
| `changeEscapeRate` | `amount`, `target?` | Permanently changes how much its Panic rises each turn, never below 0 |

`target` can be `'target'` (the default: the chosen enemy, or the player when an enemy acts), `'self'`, `'allEnemies'`, or `'randomEnemy'` (re-rolled for every hit).

To make a card stronger against some creature types, add a `bonus` to its damage: `{ type: 'dealDamage', amount: 5, bonus: { against: ['crustacean', 'shellfish'], amount: 4 } }`. The bonus is added to every hit before Strength and Vulnerable. `src/content/builds.ts` exports each build's type list (`ROD_TARGETS`, `SPEAR_TARGETS`, `FORAGING_TARGETS`) for reuse.

To add or change a **build**, edit `src/content/builds.ts`: a name, a description, the `starterDeck` (card ids), the types it's `strongAgainst` (shown on the selection screen), and a gear sprite.

Every non-starter card is automatically added to the reward pool. Add `build: 'rod'` (or `'spear'`, `'foraging'`) to offer a card only to that build. Run `npm test` afterwards: the content suite checks that your data is valid.

## Creatures (enemies)

Enemies are the 144 creatures in `src/ui/assets/fishes.png`, listed in **`src/content/creatures.ts`**, one line each:

```ts
{ no: 54, id: 'pike', name: 'Pike', scientific: 'Esox lucius', type: 'sportFish', tier: 2, hp: [40, 44], sellValue: 10, escapeAt: 135, escapeStart: 74, escapeRate: 38, temperament: 'predator' },
```

- `no` is the creature's number in `fish_names.pdf`, which is also its position in the sprite sheet (left to right, top to bottom). The sprite is picked automatically from it.
- `type` is the creature type, one of those in `src/content/creatureTypes.ts`: `smallFish`, `sportFish`, `bigFish`, `rockFish`, `deepSea`, `crustacean`, `shellfish`, `tentacled` or `critter`. Build cards get bonus damage against some types.
- `tier` (1–3) sets how deep in the map it appears: the fight columns are split into three equal bands, shallow to deep.
- `hp` is a `[min, max]` range, rolled each fight.
- `strength` (optional) is Strength the creature starts every fight with. It is shown on screen and adds to every hit.
- `habitat` (optional) is how the creature moves in the aquarium: `swim` back and forth, `drift` up and down, or crawl along the `bottom`. By default jellyfish drift; armored creatures, crustaceans and bottom dwellers crawl; everything else swims.
- `sellValue` is how many coins it sells for from the aquarium.
- `escapeStart`, `escapeRate` and `escapeAt` drive the tug of war (the "Panic" bar): it starts at `escapeStart`, rises by `escapeRate` after each enemy turn, and the creature flees with no reward once it reaches `escapeAt`. Pushed down to 0, the creature is captured.
- `temperament` picks a shared move set from **`src/content/behaviors.ts`**: `reefFish`, `schooling`, `predator`, `venomous`, `puffer`, `ambusher`, `fighter`, `giant`, `eel`, `armored`, `jellyfish`, `cephalopod`, `crustacean` or `bottomDweller`. Change one to rebalance every creature with that temperament.

To give one creature its own moves, add a `moves` object; it is used instead of the temperament's move set. Moves use the same effect primitives as cards:

```ts
{
  no: 18, id: 'redPiranha', name: 'Red piranha', /* … */ tier: 2, hp: [28, 32],
  temperament: 'predator',
  moves: {
    moves: [
      { id: 'frenzy', name: 'Frenzy', effects: [{ type: 'dealDamage', amount: 3, hits: 3 }] },
      { id: 'smellBlood', name: 'Smell Blood', effects: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] },
    ],
    // Either a fixed sequence (loopFrom = where to restart after the end)...
    pattern: { type: 'sequence', moves: ['frenzy', 'frenzy', 'smellBlood'] },
    // ...or a weighted random choice:
    //   pattern: { type: 'weighted', weights: { frenzy: 70, smellBlood: 30 }, firstMove: 'frenzy', maxConsecutive: 2 },
  },
},
```

Every creature is automatically a one-on-one encounter at its tier. For fights with several creatures, add a group in `src/content/encounters.ts`, e.g. `{ id: 'pilchardShoal', name: 'Pilchard shoal', tier: 2, enemies: ['europeanPilchard', 'europeanPilchard', 'europeanPilchard'] }`.

The intent icons come from the move's effects. Damage shows as 🗡️, block as 🛡️, a status the creature applies to itself as 💢, and a status it applies to you as 🌀.

## Creature animations

Each creature has its own animated sheet in `src/ui/assets/creatures/NNN.png` (NNN = its `no`). A sheet has 4 rows of 6 frames, each frame 48×48 px:

| Row | Animation | When it plays |
| --- | --- | --- |
| 1 | Idle: gentle bob | loops during the fight |
| 2 | Attack: wind-up, lunge towards the player, impact flash | when the creature uses a damaging move |
| 3 | Capture: a net drops over it and lifts it out | when it's defeated (holds the last frame) |
| 4 | Flee: turns around and swims away | when its Panic bar fills, or when you lose the fight |

The sheets are generated from `fishes.png` by a script:

```bash
npm run sprites
```

By default it only creates **missing** sheets, so any sheet you've edited by hand is kept. Pass `--force` (`npm run sprites -- --force`) to regenerate all of them. The frame motions (offsets, squash, net position) are listed at the top of `scripts/generate-creature-sprites.mjs` if you want to tweak them for every creature at once.

## Player animations

The fisherman uses three strips of 48×48 frames in `src/ui/assets/`. They are registered in `PLAYER_CLIPS` in `src/ui/sprites.ts`, where you can change the frame count and speed:

| File | Frames | When it plays |
| --- | --- | --- |
| `Fisherman_fish.png` | 4 | idle, loops during the fight |
| `Fisherman_hurt.png` | 2 | when an attack costs HP (shortly after the creature's lunge), then back to idle |
| `Fisherman_hook.png` | 6 | when the fight is won or the creature gets away; holds the last frame |

## Gear

`src/content/gear.ts` lists the 36 items in `fishing_gear.png`, with `no` matching `gear_names.pdf`. What gear does in the game isn't designed yet, so each entry has a free-text `description` for now.

# TODO

- mini boss level 9
- add 7 boss and mini boss so we get 151 creature ... ;)
- add animation to cards when played (drag and drop)
- rework the spear build: add blood mechanic per fish on the stringer
- rework cards per build
- add concept of using bait, using fish in the aquarium/bucket to create bait
- rework difficulty: life, stamina bar, damage
- re-use the blood mechanic with other builds
- add "fish tag" to protect a companion (purchased)
- increase the companion bonus depending on the bond level