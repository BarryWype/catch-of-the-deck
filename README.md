# Catch of the Deck

A vertical slice of a Slay the Spire–style deck-building roguelike, built with TypeScript, Vite, Vue 3 and Vitest. It uses no game framework.

## Play

**In the browser** (desktop or phone, no install): [barrywype.github.io/catch-of-the-deck](https://barrywype.github.io/catch-of-the-deck/). It's updated with every release, and progress is saved in that browser.

## Download

Desktop app, always the latest version:

- [macOS (Apple Silicon)](https://github.com/BarryWype/catch-of-the-deck/releases/latest/download/catch-of-the-deck-mac-arm64.dmg)
- [Windows](https://github.com/BarryWype/catch-of-the-deck/releases/latest/download/catch-of-the-deck-windows.exe)
- [Linux (AppImage)](https://github.com/BarryWype/catch-of-the-deck/releases/latest/download/catch-of-the-deck-linux.AppImage)

Older versions are on the [releases page](https://github.com/BarryWype/catch-of-the-deck/releases).

The app isn't code-signed yet, so the first launch shows a warning:

- **macOS**: open the app once and dismiss the warning, then go to **System Settings → Privacy & Security** and click **Open Anyway** next to "Catch of the Deck" (on older macOS, right-click the app and choose **Open** instead). If macOS says the app "is damaged" (releases up to v0.0.9), run `xattr -cr "/Applications/Catch of the Deck.app"` in Terminal, then open it again.
- **Windows**: on the SmartScreen prompt, click **More info**, then **Run anyway**.
- **Linux**: make the file executable (`chmod +x catch-of-the-deck-linux.AppImage`), then run it.

## Running it

Requires Node.js 20+ (the version is pinned in `.nvmrc`). With nvm, just run `nvm install` (or `nvm use`) in the project folder.

```bash
npm install
npm run dev        # start the dev server, then open the printed URL
npm test           # run the engine test suite
npm run build      # type-check (incl. the DOM-free engine check) + production build
npm run simulate -- --runs 300   # a bot plays 300 runs and prints balance stats
npm run simulate -- --lineups    # the same seeds with each temperament's standard companion lineups
npm run simulate -- --campaign 20   # 20 runs in a row sharing one home aquarium: bond pacing
npm run reward-shares            # share of each card type in tier-1 rewards, by fishing spot
```

Add `?seed=12345` to the URL to replay a specific run. The current seed is shown in the top bar.

**Balance simulation** (`scripts/simulate.ts`): a bot plays whole runs with the real engine and content, then prints run outcomes, survival fight by fight, win/escape/death rates and Grit lost by level and fight kind, and the creatures that escape most or cost the most Grit. Runs are seeded 1, 2, 3…, so the same command gives the same numbers until the game changes: run it before and after a change to compare. `--seed 500` starts elsewhere, every simulation is saved in `simulation/` (git-ignored) as `<date-time>-runs.csv` and `<date-time>-fights.csv`, one row per run and per fight, for a spreadsheet (`--out sim` names them `sim-runs.csv` and `sim-fights.csv`), and `--log 3` prints run 3's fight logs to see how the bot plays. The runs CSV also lists the companions brought and their stars; the fights CSV the size of each catch. When the bucket is full, the bot sells its lowest-value creature that isn't a companion.

Companions in the simulator: `--companions clownfish,blueTang --bond 2` starts every run with those creatures at that bond level (0–3). `--lineups` plays the seeds with no companions, then with four standard lineups per temperament (one tier 1 at bond 1, two tier 1s at bond 1, a full school of the lowest tiers at bond 1, one of the highest tier at bond 3), and prints a ranking by median fights with the difference from no companions (`<name>-lineups.csv`). `--campaign 20` plays 20 runs sharing one home aquarium, starting empty: the bot brings the 3 creatures giving the most stars to one temperament (a full school first), and heads home at a leave node under half Grit. It reports when a creature first reached each bond level, successful and lost runs, companions lost (sold) and injured (lost runs send them home to rest for that run's map nodes), the bucket brought home, the bond a companion gains per run (and the runs that would take to reach levels 2 and 3, by tier), and the sizes caught (`<name>-campaign.csv`). The bot plays greedily, card by card, and picks paths, rewards and events at random: it's a stand-in for a player, so read its numbers as trends rather than as what a person would get.

## Debug panel

Tick **Show debug panel** in the options: a 🛠 drawer opens on the menu's left edge. Set up a scenario (build, locked or not; age; fights already played; Grit, coins and rerolls; companions with a bond level and size; creatures already in the bucket; the deck, searchable by name or family, and an optional opening hand; the seed) and where it starts: a fight against one creature, an encounter, or the age's mini-boss or boss, or an event, one of the three stores, a treasure or a fisherman of that age. **Quick start** buttons still jump to each age's mini-boss and boss. Ticking **Use this profile** plays with its own unlocked builds, fishermen met, home aquarium, golden shells and Logbook pages (any page, on or off; a quest like "a freshwater trophy in your bucket at Silent Silas" is one scenario); otherwise it plays with a copy of yours.

A scenario plays in a **sandbox**: a red DEBUG badge shows in the top bar, nothing is written to the save or the profile, and **End scenario** (or going back to the menu) brings your real profile back untouched. In a scenario's fights, a 🛠 drawer sets Grit, Hold, Patience and Tension (or no Tension limit), each creature's Health, Will, statuses and next move, catches a creature now, adds any card to the hand, draws cards and skips to the creatures' turn.

Scenarios can be saved by name (in localStorage, on this device), copied as JSON and pasted back. The JSON is a `DebugScenario` (`src/engine/debug.ts`); only `build`, `level` and `start` are required:

```json
{
  "seed": 4821,
  "build": "fly",
  "level": 2,
  "fights": 14,
  "hp": 40,
  "coins": 50,
  "rerolls": 1,
  "companions": [{ "id": "clownfish", "bond": 2, "size": "large" }],
  "bucket": [{ "id": "progenetica", "size": "trophy" }],
  "deck": ["tug", "tug", "reelIn", "holdTight", "perfectCast"],
  "hand": ["perfectCast"],
  "start": { "type": "fisherman", "id": "silas" },
  "profile": { "unlocked": [], "fishermenMet": [], "home": [{ "id": "guppy", "bond": 1, "size": "small" }], "shells": 12, "progression": ["lifeJackets"] }
}
```

`start` is `{ "type": "creature" | "encounter" | "event" | "fisherman", "id": … }` or `{ "type": "miniBoss" | "boss" | "treasure" }`, or `{ "type": "shop", "store": "cafe" | "tackle" | "bait" }` (Tackle shop if omitted). `bond` is a bond level (0–3), `size` one of `small`, `normal`, `large`, `trophy`, and `level` the age (0 = kid). Pasting checks every id and number, and says what's wrong. In a test, `fromScenario(json)` (`tests/fixtures.ts`) gives the run and fight it starts in.

## How to play

You play a young fisherman setting off on their fishing journey from the grandparents' house on the waterfront. Before the first fight you pick a fishing style, which sets your starter deck:

| Build | Unlocked by | Starter deck |
| --- | --- | --- |
| Rod fishing | from the start | 4 Tug, 4 Hold Tight, 1 Steady Hand, 1 Reel In |
| Foraging | Old Ned (Kid) | 4 Reel In, 4 Hold Tight, 1 Play the Line, 1 Slack Line |
| Net fishing | Gus the Netmaker (Adult) | 3 Tug, 2 Reel In, 3 Hold Tight, 1 Throw the Net, 1 Draw the Net |
| Fly fishing | Silent Silas (Elder) | 3 Tug, 2 Reel In, 3 Hold Tight, 1 Wait for the Rise, 1 Perfect Cast |

Every creature has a type (shown under its name, and as the icon of map events).

- A run takes place on a map that you cross from left to right: a starting point, 20 fights and a boss at the end. Column 10 is a harbour of 3–4 nodes: 🛒 shops, plus one 🚪 "finish the session" node, a dead end where you can end the run and take your bucket home. Your position is marked **A**, and the destinations you can reach next are highlighted in yellow. Each event shows a creature type (🐠 small fish, 🦀 crustacean…); the actual creature is drawn from that type when you get there. Everything comes from the run seed. Hover over an event to see its type.
- You start each turn with 5 cards and 0 Tension, which each card raises by its cost, up to 3. Click a card to play it. With several enemies, click the card and then the enemy you want to hit.
- Each enemy shows its **intent** above its head: 🗡️ attack (with the real damage it will deal), 🛡️ block, 💢 buff, 🌀 debuff. Hover over an intent for details.
- Click **End Turn** and the enemies carry out the intents they showed.
- Every creature you beat or wear out goes into your **bucket**, shown below the map (`run.bucket`), with a size (small, normal, large or trophy). It holds 7, companions included: when a catch doesn't fit, you sell something to keep it, or sell the catch. You can sell creatures from it at any time. If you win the run, everything still in the bucket joins your **home aquarium**, which lasts between runs and is shown on the menu and build screens. See ARCHITECTURE.md.
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
- **Map** (`map.ts`, `run.ts`): `generateMap` builds 21 columns, the way Slay the Spire does. The start, the boss and any choke columns (`CHOKE_COLUMNS`) hold a single node; the harbour columns (`SHOP_COLUMNS`) hold 3–4 nodes: shops plus one dead-end "finish the session" node. In between, `MAP_PATHS` paths walk across `MAP_LANES` horizontal lanes, each step staying in its lane or moving one up or down, and never crossing a link already drawn. Nodes exist wherever a path passes and links are the paths' steps, so routes branch and merge naturally, every node is reachable, and paths never cross. Each node gets a fishing spot and its depth tier (`spot`, `tier`). `travelTo(run, nodeId, data)` moves the player, draws an encounter from that spot and tier (`encountersFor`), and starts the fight.
- `npm run typecheck` also compiles the engine with `tsconfig.engine.json`, which has **no DOM types**. A test also checks that engine files import only other engine files and never use `Math.random`.

### Content (`src/content`)

Content is plain typed arrays. `content/index.ts` passes them through `buildGameData`, which validates every reference (unknown cards or moves, untargeted cards with targeted effects, bad HP ranges, and so on) and fails at startup with a readable error.

### UI (`src/ui`)

`useGame.ts` holds the current run and combat states in Vue refs and replaces them with whatever the engine returns. Components only read state and emit actions. Card text and intent numbers come from engine helpers (`describeCard`, `previewIntent`), so the UI shows exact values, Strength and Vulnerable included.

**Hover text:** use the `v-tip` directive (`src/ui/tooltip.ts`), not the HTML `title` attribute, which shows only after a delay. `v-tip="'Coins'"` gives a one-line tooltip; `v-tip="{ title, detail, body, hint }"` gives a bold title, a muted line, a wrapped explanation and a green hint. The single `TooltipLayer` in `App.vue` draws every tooltip: it appears instantly on hover or keyboard focus, sits above the element (below when there's no room), stays inside the window, and follows moving elements. Empty values show nothing.

## Adding a card

Add an entry to `src/content/cards.ts`. You don't need to touch code:

```ts
{
  id: 'cleave',               // unique id
  name: 'Cleave',
  type: 'attack',             // 'attack' | 'defense' | 'drain' | 'support' | 'power' (Attack and Drain are "attacks"; powers last the fight)
  rarity: 'normal',           // 'normal' | 'rare'
  cost: 1,
  // patienceCost: 2,         // optional: Patience it also costs
  target: 'none',             // 'enemy' (dragged onto a creature), 'random' (a random creature), or 'none'
  effects: [
    { type: 'dealDamage', amount: 8, target: 'allEnemies' },
  ],
  family: 'hunter',           // the creature family that offers it as a reward (src/content/families.ts, internal: players see its temperaments); none for starter cards
  // tags: ['damage'],        // optional: what it's about, stored for later
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
| `applyStatus` | `status` (`strength` / `vulnerable` / `weak` / `snared` / `venom` / `slow`), `amount`, `target?` | Negative amounts remove stacks, e.g. `-2` Strength. Snared stops a creature's Will from rising; Venom hits at the start of its bearer's turn, then loses a charge; each Slow makes its Will rise 20% slower, one wearing off each turn |
| `drawCards` | `amount` | Player only |
| `gainEnergy` | `amount` | Player only: lowers Tension (never below 0); Tension left unbuilt still turns into Patience |
| `changeEscape` | `amount`, `target?` | Moves a creature's Will bar: negative is **Drain** (captured at 0), positive raises it (flees at the top) |
| `slowCap` | `amount` | For the rest of the fight, creatures' Will can be slowed by up to `amount` percent instead of 80% (never lowers it) |
| `gainPatience`, `heal` | `amount` (`target?` for `heal`) | Patience up to 5; healing never above max health |
| `multiplyStatus` | `status`, `factor`, `max?` | e.g. double the creature's Slow; `max` caps the stacks added |
| `loseHold`, `patienceToHold`, `keepHold` | `share` / `per` / — | Lose a share of your Hold; trade all Patience for Hold; keep your Hold into next turn |
| `delayed`, `echoDamage` | `turns` + `effects` / `share` | Repeat effects at the start of your next turns; deal a share of the damage dealt again next turn |
| `ifIntent`, `ifNoAttack` | `tag` + `then`/`else` / `then`/`else` | Depending on the creature's next move (Strike or Pull), or on whether you've played an attack this turn |
| `ifStatus` | `status` + `then`/`else` | Depending on whether the target has that status (e.g. it's Slowed) |
| `ifLastCard`, `ifBelow` | `cardType` + `then`/`else` / `bar` (`health` / `will`), `part` + `then`/`else` | Depending on the type of the card played just before this turn (none: `else`), or on the target's bar being under 1/`part` of its max |
| `ifTension`, `byTension` | `tension` (a number or `'full'`) + `then`/`else` / `effects` (one list per Tension, the last for any higher) | Depending on your Tension before this card's cost |
| `pickFromDraw` | `look` | Look at the top cards of the draw pile (reshuffling the discard under them if needed); the player picks one for the hand (`pickCard` action), the others stay on top |
| `flipIntent`, `rerollIntent`, `holdFromIntent` | — / — / `max` | Change the creature's next move, or gain Hold from it |
| `delayMove` | `target?` | The creature Paces this turn and plays the move it planned on its next turn (bait cards) |
| `coil`, `venomBonus`, `venomCoating` | — / `amount` / `amount` | This turn: double the next attack; +damage to Venomed creatures; Venom on every hit |
| `venomNow`, `swapHealthAndWill` | — | Venom hits now; swap health % and Will % |
| `power` | `power`, `amount?` | A Power for the rest of the fight (see `PowerId` in `src/engine/types.ts`) |

`dealDamage` and `changeEscape` take `perStatus: { status, amount }` to scale with the target's stacks (+2 damage per Slow), `fromHold: true` to deal or Drain your Hold, and `dealDamage` takes `perTension` for extra damage per Tension before the card. Statuses that change a creature's next move: `cowed`, `intimidated`, `lured`, `distracted`, `dazzled`.

`target` can be `'target'` (the default: the chosen enemy, or the player when an enemy acts), `'self'`, `'allEnemies'`, or `'randomEnemy'` (re-rolled for every hit).

To add or change a **build**, edit `src/content/builds.ts`: a name, a description, the `starterDeck` (card ids), a gear sprite, and the player's `character` art (see Player animations). To lock it behind a quest, give it an `unlock`: a fisherman's id, a quest title and a `quest` condition: species at home (`{ type: 'speciesAtHome', count: 6, temperaments: ['clawed'] }`), or species in the bucket when you meet the fisherman, with any of a `temperament`, a `water` and a minimum `size` (`{ type: 'inBucket', count: 1, water: 'fresh', size: 'trophy' }`). Fishermen live in `src/content/fishermen.ts`: a name, a map icon, a character sprite (`src/ui/assets/character/<sprite>_fish.png`), the level he stands on (one node after its mini-boss) and his greeting. French names: `builds.<id>.quest` and `fishermen` in `src/locales/fr-content.ts`.

To add a **Logbook** page, add a line to `src/content/progression.ts`: an `id`, its `track` (a column; a new track needs `logbook.track.<id>` in both language files), the node ids it `requires` (its row follows from them), a `cost` in golden shells, an `effect` (`rerollsAtStart`, `coinsAtStart`, `bucketSpace`, `shopItem`, `shopDiscount`, `sellBonus`, `restingBondLevel`, `rewardChoices` or `companionStars`), an `icon`, a `name` and a `description`. French: `progression` in `src/locales/fr-content.ts`. A store item named by a `shopItem` page isn't sold until that page is bought.

Card rewards come from the families of the creatures just beaten (see CARD_REWORK.md). Add `build: 'rod'` (or `'foraging'`, `'net'`, `'fly'`) to offer a card only to that build. Add the card's French name to `src/locales/fr-content.ts`. Run `npm test` afterwards: the content suite checks that your data is valid, and that every language names it.

## Creatures (enemies)

Enemies are the 144 creatures in `src/ui/assets/fishes.png`, plus a few with their own art (`sprite`, e.g. the Giant octopus), listed in **`src/content/creatures.ts`**, one line each:

```ts
{ no: 54, id: 'pike', name: 'Pike', scientific: 'Esox lucius', type: 'sportFish', tier: 2, hp: [40, 44], sellValue: 10, escapeAt: 135, escapeStart: 74, escapeRate: 38, temperament: 'predator' },
```

- `no` is the creature's number in `fish_names.pdf`, which is also its position in the sprite sheet (left to right, top to bottom). The sprite is picked automatically from it.
- `type` is the creature type, one of those in `src/content/creatureTypes.ts`: `smallFish`, `sportFish`, `bigFish`, `rockFish`, `deepSea`, `crustacean`, `shellfish`, `tentacled` or `critter`. Internal habitat data (fishing spots, Crab Hook), never shown.
- `tier` (1–3) sets how deep in the map it appears: the fight columns are split into three equal bands, shallow to deep.
- `hp` is a `[min, max]` range, rolled each fight.
- `strength` (optional) is Strength the creature starts every fight with. It is shown on screen and adds to every hit.
- `habitat` (optional) is how the creature moves in the aquarium: `swim` back and forth, `drift` up and down, or crawl along the `bottom`. By default jellyfish drift; armored creatures, crustaceans and bottom dwellers crawl; everything else swims.
- `sprite` (optional) is its own art, for a creature beyond `fishes.png`: numbered after 144, with a sheet added to `SHEETS` in `src/ui/sprites.ts` (single-strip art also goes in `STRIP_SHEETS`).
- `sellValue` is how many coins it sells for from the aquarium.
- `escapeStart`, `escapeRate` and `escapeAt` drive the tug of war (the "Will" bar): it starts at `escapeStart`, rises by `escapeRate` after each enemy turn, and the creature flees with no reward once it reaches `escapeAt`. Pushed down to 0, the creature is captured.
- `temperament` picks a shared move set from **`src/content/behaviors.ts`**: `reefFish`, `schooling`, `predator`, `venomous`, `puffer`, `ambusher`, `fighter`, `giant`, `eel`, `armored`, `jellyfish`, `cephalopod`, `clawed` or `bottomDweller`. Change one to rebalance every creature with that temperament.

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

Every creature is automatically a one-on-one encounter at its tier. For fights with several creatures, add a group in `src/content/encounters.ts` (only offered once `MAX_CREATURES_PER_FIGHT` in `src/engine/constants.ts` allows its size; it's 1 for now), e.g. `{ id: 'pilchardShoal', name: 'Pilchard shoal', tier: 2, enemies: ['europeanPilchard', 'europeanPilchard', 'europeanPilchard'] }`.

The intent icons come from the move's effects. Damage shows as 🗡️, block as 🛡️, a status the creature applies to itself as 💢, and a status it applies to you as 🌀.

## Creature animations

Each creature has its own animated sheet in `src/ui/assets/creatures/NNN.png` (NNN = its `no`). A sheet has 4 rows of 6 frames, each frame 48×48 px:

| Row | Animation | When it plays |
| --- | --- | --- |
| 1 | Idle: gentle bob | loops during the fight |
| 2 | Attack: wind-up, lunge towards the player, impact flash | when the creature uses a damaging move |
| 3 | Capture: a net drops over it and lifts it out | when it's defeated (holds the last frame) |
| 4 | Flee: turns around and swims away | when its Will bar fills, or when you lose the fight |

The sheets are generated from `fishes.png` by a script:

```bash
npm run sprites
```

By default it only creates **missing** sheets, so any sheet you've edited by hand is kept. Pass `--force` (`npm run sprites -- --force`) to regenerate all of them. The frame motions (offsets, squash, net position) are listed at the top of `scripts/generate-creature-sprites.mjs` if you want to tweak them for every creature at once.

## Player animations

The player uses three strips of 48×48 frames in `src/ui/assets/character/`, named after the build's `character` (`Fisherman` by default; Foraging plays as `SteamMan`). They are registered in `PLAYER_STRIPS` in `src/ui/sprites.ts`, where you can change the frame count and speed:

| File | Frames | When it plays |
| --- | --- | --- |
| `<character>_fish.png` | 4 | idle, loops during the fight |
| `<character>_hurt.png` | 2 | when an attack costs HP (shortly after the creature's lunge), then back to idle |
| `<character>_hook.png` | 6 | when the fight is won or the creature gets away; holds the last frame |

`SteamMan`, `GraveRobber` and `Woodcutter` came without a hurt strip: `npm run hurt-sprites` makes one from each idle strip (a red flash, then the rod swung back over the shoulder as in `Fisherman_hurt.png`). It overwrites them, so skip it once one has been drawn by hand.

## Store art

The three stores' scenes (`src/ui/assets/stores/`: `cafe.png`, `tackle-shop.png`, `bait-shop.png`, 240×160 each), their keepers (`<store>-keeper.png`, laid over the scene so they can be tapped), the map nodes (`<store>-node.png`, 40×40) and the life jacket, parcel and scissors icons are generated by a script:

```bash
npm run store-art
```

It prints the layout the UI relies on: the shelf boards and item slots, the counter top the keeper stands on, and the Bait shop's tank and sign. `SLOTS`, `COUNTER` (a store with two items or fewer sells from its counter), `KEEPER`, `TANK` and `SIGN` at the top of `src/ui/ShopScreen.vue` repeat them in the same art pixels: keep both in step.

## Gear

`src/content/gear.ts` lists the 36 items in `fishing_gear.png`, with `no` matching `gear_names.pdf`. What gear does in the game isn't designed yet, so each entry has a free-text `description` for now.

# TODO

- add 7 bosses and mini bosses so we get 151 creatures ... ;)
- add randomness on the map. Keep starting creek, river and estuary at fixed spot, but move pond(s), lake, add stream(s), rocks, beach, jetty, cliffs, ...
- rework the spear build: add blood mechanic per fish on the stringer
- rework cards per build
- add concept of using bait, using fish in the aquarium/bucket to create bait
- rework difficulty: life, stamina bar, damage
- re-use the blood mechanic with other builds
- add "fish tag" to protect a companion (purchased)