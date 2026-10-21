# Architecture

How Catch of the Deck is put together, and the rules the code relies on. Read this before changing game state, saving, or anything that crosses layers. The README covers how to run the game and how to add content.

## Layers

| Folder | What it is | Rules |
|---|---|---|
| `src/engine/` | The game rules: combat, map, run, events, shop, equipment. Pure TypeScript. | No DOM, no Vue, no content imports, no `Math.random` or `Date.now`. `tests/architecture.test.ts` enforces this. Every function takes state in and returns new state. |
| `src/content/` | Game data: creatures, cards, builds, equipment, events, shop items, creature types. Plain typed arrays. | Data only. `content/index.ts` passes everything through `buildGameData`, which validates it and fails at startup with a readable error. |
| `src/ui/` | Vue components plus `useGame.ts`, which holds the current states and calls the engine. | No game rules here. Components read state and emit actions. Display-only fields (sprites, icons) live in content but are only read by the UI. |
| `src/locales/` | The languages: every word the player reads, one file per language. | Plain data. See Languages. |
| `electron/` | The desktop shell: a window, plus a small file bridge for saving. | The page never touches the file system directly; it goes through `window.desktop` (see Persistence). |
| `scripts/` | One-off asset generators (`npm run sprites`, `npm run sea`, `npm run shore`). | Seeded: re-running gives the same images. |

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
menu ──New run──▶ build ──▶ companions ──Set off──▶ map ──▶ fight ──win──▶ (bucket full) ──▶ card reward ──▶ map …
  ▲                                  │  ├─▶ event (10%: a fight instead) ─▶ map
  │                                  │  ├─▶ treasure ─▶ map
  │                                  │  └─▶ shop ─▶ map
  │                                  ├── boss beaten ─▶ card reward ─▶ next level's map (Kid → Adult → Elder)
  │                                  └── ⌂ head home (after a mini-boss) ──confirm──▶ complete
  │                                                                  └──Go back──▶ map
  └──── Menu button (any screen) ◀── complete (Elder boss beaten, headed home, or a boss fled) / defeat
```

- **Menu:** Resume (disabled without a save), New run, See aquarium, Transfer save (see Persistence → Transfer), Options, Exit (desktop app only). **When ticked in Options** ("Show debug panel", remembered per device in localStorage): a 🛠 Debug drawer on the left edge sets up and plays any scenario (see README → Debug panel). Above it, a 📘 tab opens **How to play**, a short bullet-point guide to the rules (the full one is GAME_MECHANICS.md). A small **Reset progression** button (bottom right, after a confirmation) deletes both the save and the profile (`resetProgress`). The menu's background is the home aquarium. A 📖 tab on the right edge (menu, See aquarium view and the map) opens the creature book (`CreatureBook.vue`): a drawer listing every creature, grouped by temperament (in `content/companions.ts` order, sprite order within). Each group is a collapsible (`<details>`, closed by default) headed by its temperament, bonus name and how many are discovered; opening it shows the bonus at 1★ (`bonusEffects`) and its full school, then its creatures. All three drawers use `SideDrawer.vue` (an edge tab, a sliding panel, Esc or the backdrop to close). Creatures never encountered show as **?**. The others show their image, their status (Seen or Captured), how many are in the home aquarium, and the biggest size caught (S, M, L or 🏆, from `Profile.biggestCatch`).
- **Build** (screen `build`, `BuildSelect.vue`): **New run** opens it when more than one build is unlocked (`unlockedBuilds`: those that can start a run, from `startingBuilds`, without an `unlock` or unlocked in the profile); with one, it's skipped. It shows each build's types, starter deck and starting items. Picking one (`chooseBuild`) goes on to the companions screen, or straight into the run with an empty home aquarium; **← Back** returns to the menu. The menu lists open quests under its buttons (`openQuests`, `questProgress`).
- **Fisherman** (screen `fisherman`, `FishermanScreen.vue`): a fisherman node on the map (see Build unlocks). He greets the player, and shows his quest, its progress (home aquarium plus bucket, or the bucket alone for a bucket quest) and when it unlocks; **Back to the map** returns there.
- **Companions** (screen `companions`): the home aquarium with three session slots (`SessionSlots.vue`) on its right. Clicking a creature shows its size, stars, bond and bonus, and offers **Bring for the session**; ✕ puts it back. The slots show each companion's stars, and below them each temperament's stars, bonus and what more stars would change. The big green **Start fishing** button under the slots starts the run (`startRun`), and **← Back** at the top left returns to the build screen (the menu when it was skipped). With an empty home aquarium this step is skipped.

## A run

- **Levels** (`content/levels.ts`): a run is three acts played in order, **Kid**, **Adult** and **Elder** (`RunState.level`), on the same family coast. Each age fishes further out to sea (`height`: how much of the art it shows).
  - **The coast** (`content/coast.ts`): one static map, the same every run, with about 85 places on it where a fight may be: ponds, lakes, streams and a river inland; beaches, jetties, harbours, rocks and lagoons on the shoreline; tide pools, sand flats and rocks in the shallows; kelp, reefs, buoys, cliffs, wrecks and trenches at sea. Each place says what each age does there (`visits`: spot and name, or null).
  - **What each age does there:** a feature's `visits` give, for kid, adult and elder, its fishing spot and the node's name (the harbour: fishing from the wharf, kayaking in the harbour, a boat out to sea). Sea features have no kid visit. The level's tier sets the creatures' tier.
  - **Shape** (`generateLevelMap`): 7 columns from the house to the mini-boss (column 8), 7 more to the boss (column 16), both at fixed places. Each column takes 2–4 of the places within its stretch of the map that this age visits, at least `NODE_GAP` (30) art pixels apart, above each other or side by side; only a column with fewer than 2 gets events to fill it. So the coast stays the same, and which places light up changes from run to run. Links go to the next column without crossing, sometimes branching.
  - **Shops and treasure:** one shop in columns 3–7, one right after the mini-boss, and a treasure in columns 12–15. Every other column (`EVENT_COLUMNS`: 2, 4, 6, 10, 12, 14) turns one of its fights into an event, and each other fight has a 25% chance (`SURPRISE_EVENT_CHANCE`) to become a surprise event, never right before or after another event; each event has a 10% chance (`EVENT_SHOP_CHANCE`) to come out a shop instead.
  - **Hand-made levels:** a level can instead list its `nodes` (column, position, kind, links). The test levels do.
  - **Node kinds:** `fight`, `event`, `shop`, `treasure`, `leave` (head home), `miniBoss` and `boss`.
  - **Head home:** the mini-boss leads to the next column and to a `leave` node (`escape`). That's a dead end that ends the run as a success.
  - **Next level:** beating a level's boss (`claimVictory`) moves the run to the next level's start (`enterNextLevel`), keeping everything else (HP, deck, bucket, coins). Beating the last boss wins the run.
  - **After a boss** (`justBeatBoss`: past the first level, still at its start): its card reward also offers a free card removal (`RunState.bossRemoval`, `removeCardAfterBoss`; gone once used or once the player moves on) and ending the run (`endRunAfterBoss` in `useGame.ts`, a success like the leave node).
  - **Checked on startup:** `validateLevels` (`engine/data.ts`) refuses broken content with a readable message:
    - **Generated levels:** a mini-boss, a boss and an escape, with known creatures; coast places with known spots.
    - **Hand-made levels:** no column missing, the boss alone in the last one, links only going forward, one mini-boss leading to a leave node, every node reachable, every fight with its creatures.
  - **The map** (`engine/map.ts`): `buildLevelMap` turns a level into the `GameMap` the run plays, with the start node added.
- **Fishing spots** (`content/spots.ts`, the legend: rock pools, jetty, reef…): a fight node's `spot` decides who it meets. `encountersFor` draws among encounters whose creatures live in the spot's `waters` (each creature's `water`) and, if the spot lists `types`, are of one of them, at the level's `tier`. When nothing fits, it widens: first any creature type from those waters, then any tier, then anything at the tier.
  - **Fixed fights:** a node can add `enemies` to meet exactly those creatures. Mini-bosses and bosses use it.
- **Fights:**
  - **On the map:** a fight node shows its fishing spot, not a specific creature (bosses show their name).
  - **On arrival:** `travelTo` draws an encounter from its spot at the level's tier (`encountersFor`). A companion gains bond at every fight (`bondPerFight`).
  - **Card reward:** after a win, one of 3 cards must be taken. They come from the families of the creatures of that fight (`fightFamilies`, `rollCardRewards`), topped up from every family; an event's card reward draws from every family. Each slot is rare with `RunState.rarePity` percent (`RARE_CHANCE` 10, +`RARE_PITY_STEP` 2 per slot that wasn't, back to 10 on a rare), but only from the run's first mini-boss on, its own reward included (`raresUnlocked`): before it, rewards are normal cards and the pity doesn't grow. The mini-boss's own reward always has a rare: its last slot is rare when the others weren't. The card set and its rules are in CARD_REWORK.md. A reroll offers 3 other cards (`rerollReward`): the run has its own (`RunState.rewardRerolls`: `REWARD_REROLLS_AT_START` 1, +`REWARD_REROLLS_PER_BOSS` 1 for each mini-boss and boss won, in `finishCombat`), kept across levels. Eel companions (`rewardSkips`, `rewardRerolls`) add skips and rerolls a few times per level (`rewardOptions`; their counts reset on each level), and a reroll uses theirs first. Families are never shown: a card's crest tooltip lists the temperaments that offer it (`temperamentList`).
- **Events:**
  - **On arrival:** `visitEvent` either starts a surprise fight against any creature of the level's tier (`EVENT_FIGHT_CHANCE`, 10%) or draws one of the events allowed at that column (`minColumn`), on that level (`levels`), with its `feature` on. With `moreEvents`, the events drawn go in `RunState.seenEvents` and aren't drawn again while unseen ones remain.
  - **Treasure nodes** (`visitTreasure`) draw among the events marked `treasure` instead, which never come up as ordinary events.
  - **Choices:** each choice is a list of `EventEffect`s, applied by `applyEventChoice` (`engine/events.ts`). A choice with `removeCard`, `tradeCatch` or `freeNextFight` without a card needs a deck card or a bucket slot first (`eventChoicePick`, the `pick` argument; `EventScreen` asks). `fight` starts a fight at the event's node (`startEventFight`): what winning gives on top waits in `RunState.eventFight` until `finishCombat`. A `rareCard` reward sets `luckyLure` for the card reward that follows; a `relic` one offers relics (`grantReward`). `addJunk` puts a junk card in the run's deck for good. `freeNextFight` keeps the card in `RunState.freeCard`; the next `startFight` passes it as `CombatConfig.freeCard`, a copy in hand (`free0`) that `cardCost` makes free (`CombatState.freeCards`).
- **Stores** (STORES.md has the design and the item list):
  - **Which store:** `buildLevelMap` gives every shop node a `MapNode.store` (`cafe`, `tackle` or `bait`, `STORE_KINDS`), each as likely, drawn after the rest of the map so the layout doesn't depend on it.
  - **Visiting:** `visitShop` moves there and opens a `ShopVisit`: the store, the purchases so far and, for the Bait shop, the blessing a release gives and the family its aquarium buys (its sign shows that family's temperaments), both drawn on arrival from the run's RNG. `storeItems` lists what the store sells; `buyShopItem` buys one (`engine/shop.ts`).
  - **Items:** each `ShopItemDef` has a `store`, a price, an optional per-visit `limit` and a `ShopEffect`. Effects that act on a bucket creature (`needsCreature`) take its slot; `creatureBlocked` says which creatures can be picked. `removeCard` takes a deck index.
  - **Lasting effects:** `RunState.boons` holds what lasts a few fights: a combat `bonus` (a `CompanionEffect`, added to the fight's bonuses in `startFight`, so blessings reuse companion bonuses and triggers) or `maxHp` (the espresso). `finishCombat` wears one fight off each and takes an expired `maxHp` back off the cap.
  - **Other run state:** `bucketSize` (the bucket extension), `luckyLure` and `spareHooks` (used up by the next `rollCardRewards`; a reroll keeps the reward's size), `sentHome` (parcels) and `Catch.lifeJacket` / `Catch.bond` on bucket entries. `bringCatchHome(home, run, data, success)` brings the whole bucket on a success, only life-jacketed creatures otherwise, and the parcels either way.
  - **Keepers:** tapping one cycles `store.chat.<store>.*`; the Cafe keeper's every other line is `store.hint.<fisherman>` for `RunState.fishermen[0]`, the next locked build's fisherman (or `none`).
  - **Showing them:** `storeEffectChips` (`ui/storeEffects.ts`) turns boons, the lucky lure and spare hooks into green chips, with fights left or the hook count as a badge: beside the equipment on the map, and with the powers in a fight (`PowerList`'s `run`). A creature with a life jacket wears Hold's buoy in the bucket.
  - **Paying:** the bucket stays in view under the store, so creatures can be sold there to afford things.
- **Head home** (the `leave` node after each mini-boss):
  - **Confirming:** clicking the ⌂ node opens a confirmation without moving (`leaveNodeId` in `useGame.ts`). **Go back** returns to the map; that prompt is never saved, so a resume lands on the map.
  - **Finish:** `visitLeave` moves onto the node and the run ends as a success, so the bucket comes home.
- **End of a fight** (`finishCombat`): carries HP over. A win also adds one to the floor counter. Every creature caught (`catchesOf`, with its size) goes into the bucket, unless equipment sells it on the spot. That includes creatures caught before another one got away.
- **Bucket full** (screen `bucketFull`, `BucketFull.vue`): catches that don't fit in the bucket (`BUCKET_SIZE`) wait in `RunState.waiting`, and the run stops on this screen before the card reward (or before the map, after a fight a creature fled). For the first waiting catch the player sells a bucket creature or uses it as bait to keep it (`keepCatch`), or sells the catch (`sellCatch`) or uses it as bait (`baitCatch`), until none waits.
- **Bait** (`useAsBait`, `useAsBaitInFight` in `engine/run.ts`): a bucket creature leaves for good (`withoutCreature`, as a sale) for its tier's bait card (`CardDef.bait`, `baitCards`), two for a trophy. Between fights the cards join the deck; in a fight they join the deck too, as fight cards `c<deck index>`, and go into the hand (on top of the draw pile once it's full), and a companion's bonuses are worked out again. A bait card played goes to the exhaust pile, and `finishCombat` takes it out of the deck. Its `delayMove` swaps the creature's intent for its pace and keeps the planned move in `EnemyState.delayedIntent` for `chooseIntent` to restore; the stand-in pace uses no statuses and isn't pushed to `moveHistory`. In a fight the bucket opens from the 🪣 button under the draw pile (`CombatView`), in bait-only mode (`Aquarium`'s `action="bait"`); `BaitConfirm` asks first everywhere. The waiting catches are saved with the run, so a reload comes back to the same choice.
- **Caught mid-fight:** in a fight with several creatures, one caught before the others leaves the battlefield once its capture animation has played (`CombatView.vue`), with a "🪣 … caught!" note. The engine keeps it in the fight state until the end, and `finishCombat` puts it in the bucket.
- **Mini-bosses and bosses are let go** (`isReleaseFight`: the run stands on one):
  - **No catch:** a win never adds them to the bucket or sells them, and the creature book only marks them seen (`recordEncounter`'s `released`).
  - **On screen:** they swim away (the flee animation) instead of the capture net.
  - **Why:** the victory text gives the node's `releaseReason`, e.g. "Blue crab is too feisty to keep, so you let it go."

## Fight-variety features

Ten features meant to make fights and runs less alike, each behind its own flag in `Features` (`engine/constants.ts`), so they can be tried one by one. The engine reads them from `GameData.features` with `hasFeature(data, id)`; game data built without `features` (`buildGameData(contentSource)`, the content's `gameData`, every existing test) has them all off and plays as before them. The UI builds its game data with `FEATURES` plus this device's changes from the debug panel's **Features** section (`ui/featureStore.ts`, localStorage; a change reloads the page). The simulator plays with `FEATURES` unless told `--features none` or a list. Their numbers and what each one did to the simulations are in docs/fight-variety-log.md.

- **`moreEvents`:** the events marked `feature: 'moreEvents'` in `content/events.ts`, and no event twice a run while unseen ones remain (see Events above).
- **`gearRelics`:** relics are equipment with a `rarity` (`content/equipment.ts`, ids and art from the gear catalogue, `content/gear.ts`). Most are one `{ type: 'bonus', bonus: CompanionEffect }` effect: `runBonuses` adds them to a fight's bonuses with the companions' and the boons', so they're read and triggered exactly like companion bonuses. New for them: the `firstPullPercent` and `foresight` bonuses, the `quietTurnEnd` trigger (end of a turn without an attack, before the creatures act) and the `baitChance` equipment effect (the Handline; a bait card in hand for that fight, uid `x<i>`, `CombatConfig.extraCards`). `rollRelicChoices` (`engine/relics.ts`) puts 3 relics the run doesn't carry in `RunState.relicChoices`, each slot's rarity at `RELIC_ODDS` for the level; `takeRelic` / `skipRelics` answer it, and `RelicChoice.vue` shows it over the map. They're offered by `finishCombat` after a mini-boss win, by a `relic` event reward (`grantReward`), by the `tackleChest` treasure and after trophy fights. Foresight: `chooseIntent` keeps the move after next in `EnemyState.foresight` (decided from the pattern as if the next move had been played) and plays it next; `previewForesight` shows it. With the flag off, `bonus` and `baitChance` effects do nothing.

## Combat and the Will bar

- **Turns:**
  - **Start of the turn:** **Venom** hits (its charges as damage, ignoring Block, then one charge less; `tickVenom`), block resets, energy refills (the UI shows it inverted, as **Tension**, empty at the start of the turn and filled by the cards' costs) and you draw 5 cards.
  - **End of the turn:** the hand is discarded and durations tick down. Each creature then takes its Venom (if that wears it out, it's caught before acting), acts on its shown intent, and its escape bar rises.
  - **Win/lose check:** after every effect.
- **Grit** (`terms.grit`): the player's HP is shown as **Grit**, the will to keep fishing, in its own orange bar. It works like HP (`hp`, `maxHp` in the code): creatures' Strikes wear it down, and the fight is lost when it runs out.
- **Hold** (`terms.hold`): the player's Block is shown as **Hold**, their hold on the line (the starter defence card is called Hold). It soaks both kinds of creature move; creatures' own Block is still called Block.
- **Fight scaling** (`startFight` in `run.ts`): each fight is tougher by `ENCOUNTER_GROWTH_PERCENT` (2%) per fight already started this run (`RunState.fights`). `createCombat` raises the creatures' rolled Health in proportion when it adds up to less than `hpPool` (`ENCOUNTER_HP_POOL`, 50), raises their escape bars (`escape`, `escapeAt` and `escapeRate` alike) in proportion when their starting `escape` adds up to less than `willPool` (`ENCOUNTER_WILL_POOL`, 45), so small creatures take about as long to Drain as to wear down, and gives each a `damageScale` so its Strike and Pull moves average `damage`: `ENCOUNTER_TURN_AVERAGE` (5.5 per turn), or a roll of `MINI_BOSS_DAMAGE` / `BOSS_DAMAGE` with no growth; in a group, each gets its share × `GROUP_DAMAGE_PERCENT` (110%). `MAX_CREATURES_PER_FIGHT` (1 for now, as several creatures stack too tall on phones) keeps larger encounters out of `encountersFor`; the debug panel can still start one. `damageScale` multiplies the move's `moveScale`, so statuses and the intent preview use it too.
- **Creature moves** (`content/behaviors.ts`) each have a `tag`, checked against their effects on startup:
  - **Strike:** deals damage. What gets past the Hold wears down Grit.
  - **Pull:** has a `pull` effect (creature moves only). What gets past the Hold raises the creature's own escape bar.
  - **Intensity and roles** (`content/behaviors.ts`, `move()`): every move is light, normal or heavy (`MOVE_INTENSITY`), written as Strike or Pull points (12 for normal). `createCombat` scales them so the creature's `turnAverage` (its moves as often as its pattern plays them, the heavy turn after each Wind-up included) matches the fight's damage (`damageScale`), applied before Strength and statuses. Roles: one `pace` per set (its Will rises `PACE_WILL_PERCENT`, half, in `endTurn`); up to two `special`s (never twice in a row in `chooseIntent`); a `windUp` whose `followUp` comes next, played heavy and `WIND_UP_PERCENT` (30%) bigger through the `windUp` status (`nextMoveMods`); `heavy` moves only after their Wind-up (checked on startup).
  - **Specials** are effects: `ink` (the next intent is hidden, `EnemyState.intentHidden`; no Wind-up after it; cards still read the real move), `addJunk` (a junk card into the discard pile, `MAX_JUNK_CARDS` at most; junk cards are `type: 'junk'` with `unplayable` or `inHand` rules, and only live in the fight's piles), `stealPatience`, statuses on the player (`tangled`, `numbFingers` → `cardCost`; `pinchedHand` and Tangled Lines in hand → `holdTax`; `skittish` → `playCard`; `spines` → each attack hit; `baitGrabbed` → `startPlayerTurn`; `venom`), `burrowed` on itself (player damage −`BURROW_PERCENT`), and a Pull's `heavyIfNoHold`. The intent preview names each one (`IntentPreview.special`) for its icon and tooltip.
  - **Mini-bosses and bosses** (`CombatConfig.bosses`): they follow their temperament's `bossPattern` (a fixed sequence), their Wind-ups also give 1 Strength (`EnemyState.boss`), and `telegraphSecondWind` shows a Second Wind once, when Health or Will drops below `SECOND_WIND_PERCENT`: `SECOND_WIND_POINTS` (× `fightScale`) move from the fuller bar into the low one.
  - **Strength from moves** is capped at `MAX_MOVE_STRENGTH` (3) per creature per fight (`EnemyState.strengthGained`, in the `applyStatus` effect); starting Strength doesn't count. Only the predator move set, Pike and Red piranha have Strength moves (a test checks it).
  - The intent shows the tag, its role and special icons with tooltips, and the damage or pull to expect, Wind-up included ("?" when inked).
  - **Bar previews** (`engine/preview.ts`): `previewCard` plays the dragged or selected card on a copy of the fight (`applyAction`), so the numbers carry every modifier; a play that moves the RNG keeps the creatures as they were, so random targets and hits aren't revealed. `previewIntents` plays each visible intent on a copy (`executeIntent`), only the moves (no Venom, no Will rise). CombatView feeds the first into the second, and `BarPreview.vue` draws each step down as a grey-red piece and each step up as stripes, on the Grit, Health and Will bars.
- **Escape bar** (shown to the player as **Will**, `terms.will`). Each creature has:
  - **`escape`:** the bar, which starts at `escapeStart`.
  - **`escapeRate`:** how much the bar rises after the creature's turn. **Snared** stops the rise for a turn.
  - **`escapeAt`:** when the bar reaches it, the creature flees. The fight ends as `fled`, with no reward and no capture.
- **Patience** (`PlayerState.patience`), kept for the whole fight, up to `MAX_PATIENCE` (5):
  - **Energy:** each energy point left unused at the end of a turn gives one, slowing that same turn's rise.
  - **Hold:** after the creatures act, every `HOLD_PER_PATIENCE` (3) Hold left over (beyond what companion bonuses keep for next turn) is spent for one.
  - **Effect:** each point slows every creature's rise by `PATIENCE_ESCAPE_PERCENT` (10%) of its `escapeRate`, rounded up (`escapeRise`), so at most by half. A card's `patienceCost` must be paid in Patience on top of its energy cost, and spends it.
- **Picking a card** (`pickFromDraw`, Check the Bait): the shown cards stay on top of the draw pile and their uids go in `CombatState.pick`; until a `pickCard` action puts one in hand, every other action is refused (`validateAction`), and CombatView shows them in a pick overlay.
- **Capture:** a creature at 0 HP **or** with its bar pushed to 0 is out of the fight and captured (`isAlive`).
- **Card effects on the bar** (keywords in card text):
  - **Drain** (`changeEscape` with a negative amount): lowers the bar by a flat amount. Positive amounts raise it.
  - **Slow** (status `slow`, applied with `applyStatus`): each stack makes the bar rise `SLOW_PERCENT` (20%) slower, and one wears off at the end of the creature's turn. In `escapeRise` it adds up with Patience (10% a point), capped at `MAX_SLOW_PERCENT` (80%), then cuts the rise (rounded up, at least 1). A `slowCap` card effect raises that cap for the rest of the fight (`CombatState.slowCap`, never lowered). The Reliable Reel and the Giant companions instead lower `escapeRate` itself when the fight starts.
- **Builds use the bar differently** (see `content/cards.ts`):
  - **Rod fishing** manages tension: big hits raise its Will, skills Drain and tire the fish.
  - **Net fishing** hits and Drains every creature at once (`target: 'allEnemies'`).
  - **Fly fishing** banks Patience (`gainPatience`) to slow the rise, then spends it on Perfect Cast's `patienceCost`.
  - **Foraging** barely deals damage: it snares creatures and Drains them down to 0. Its cards read the intent (`ifIntent`): Reel In drains less before a Strike, Brace adds Drain before a Pull, so Hold matters on both kinds of turn.

## Aquariums: the bucket and the home aquarium

There are two separate collections of creatures. They never share creatures, except in one moment: the end of a won run.

| | **Bucket** | **Home aquarium** |
|---|---|---|
| What | The creatures caught during the current run | The creatures brought back from won runs |
| Where in code | `RunState.bucket`: one `Catch` `{ id, size }` per creature, at most `BUCKET_SIZE` (7), companions included | `Profile.homeAquarium` (`ui/saveStore.ts`): one `HomeCreature` `{ id, size, bond }` per creature |
| Saved in | `save.json` (with the run) | `profile.json` (lasts forever) |
| Shown | Below the map and the shop, and on the bucket-full screen (🪣 Bucket, with an "n/7" count, more with a bucket extension) | Menu background, companions screen (🏠 Home aquarium) |
| Interactive | Yes: click a creature to see its size and sell it for coins (on the bucket-full screen: sell it to keep the waiting catch) | On the companions screen only: click a creature to bring it for the session |

**Lifecycle:**
1. **New run:** on the companions screen the player can pick up to `SESSION_SLOTS` (3) home-aquarium creatures (`useGame` `brought`). When the run starts, `takeFromHome` removes them from the home aquarium (and the profile is written), and `createRun` starts the bucket with them. They follow the bucket's rules from then on, except that a run ending badly never loses them (step 4).
2. **During the run:**
   - **Captures:** captured creatures go into the bucket. With **Sharp Spear** they're sold on the spot instead and never reach it. When the bucket is full they wait for the bucket-full choice (see the run flow). A save from before the limit may hold more: it keeps them, but every new catch waits.
   - **Sizes** (`engine/sizes.ts`): every catch rolls `small`, `normal`, `large` or `trophy` (`rollSize`) at `SIZE_ODDS` (30/50/17/3%). Each fight played before it this run moves `SIZE_SHIFT_LARGE` (1) point of the small chance to large and `SIZE_SHIFT_TROPHY` (0.5) to trophy, until small is down to `SMALL_FLOOR` (5%); a creature caught by draining its Will rolls twice and keeps the bigger. The rolls use a copy of the fight's RNG (`catchesOf`), so the UI can read the same sizes before `finishCombat` and the run's own rolls don't move. The size stays with the creature at home; hatchlings are small. Nothing reads it yet.
   - **Selling:** the player can sell creatures from the bucket at any time.
   - **Events:** events can read the bucket. The Enthusiastic Passerby tips coins per creature in it.
3. **Successful run**, either the boss beaten (`claimVictory`), the session finished at the 🚪 node (`finishSession`) or ended on a boss's card reward (`endRunAfterBoss`): `bringCatchHome` adds everything still in the bucket to the home aquarium, and the profile is written.
4. **Lost run, abandoned run (New run over a save), or the boss fleeing:** the catches are lost (bar life jackets). The companions come back injured (`injuredCompanions`): with the bond they started the run with (`RunState.companionBondsAtStart`, filtered with the bucket by `withoutCreature`), resting for `RunState.nodesDone` map nodes (every node `moveTo` steps on, every level). They wait in `Profile.recovering` (`RecoveringCreature`: `nodesLeft` of `nodes`), apart from the home aquarium, so they can't be brought and don't count for quests, eggs or the resting bond. `useGame` takes one node off each with every node the player steps on (`restInjured`, in `travel` and `finishSession`, via `recoverCompanions`) and moves those done back into the home aquarium; a run that did no node sends them straight back. Abandoning goes through `newRun`, which injures the saved run's companions before dropping it. The Aquarium draws them along the tank's bottom (`recovering` prop): the sprite in shadow, with the same sprite on top clipped to the share rested (`clip-path`, bottom up).

**Bond** (`engine/bond.ts`): each creature in the home aquarium has its own bond points, from 0 to its `bondToFull`. That value comes from its tier (40, 60 or 90, `BOND_BY_TIER` in `content/creatures.ts`) unless the creature sets its own.
- **Levels:** level 1 at 20%, level 2 at 50%, level 3 (fully bonded) at 100% (`BOND_LEVELS`). The aquarium shows a ♥ badge with the level (gold when fully bonded), and the full progress on hover or click.
- **Brought along:** a companion gains `bondPerFight` every time a fight starts during the run, event fights included (`startFight`): the level's tier (Kid 1, Adult 2, Elder 3), doubled at a mini-boss or boss. It keeps them only if the run succeeds: an injured companion comes back with its bond from before the run. This is the only way past level 1. The run keeps each companion's bond (`RunState.companions` are `HomeCreature`s), so the right individual comes back.
- **Left at home:** `restAtHome` adds `BOND_AT_HOME` (2) after every run that ends, but never past level 1, and never takes any away.
- **New arrivals:** creatures caught during a run start at 0, or at the Soft Net's share of full bond (`bondOnCapture`, a percentage).
- **Order at a run's end** (`endRun` in `useGame.ts`): the creatures at home rest, then a successful run brings its bucket home (a lost one sends its companions back injured).
- **Picking companions:** the companions screen picks individuals by their index in the home aquarium (`takeFromHome`), not by species, so you choose which Clownfish to bring.
- **Effects:** bond levels 2 and 3 each add a star to a companion (see Companions).

**Creature book** (`Profile.creatureBook`, id → `'seen' | 'captured'`): `recordEncounter` (engine, `run.ts`) updates it from the combat state. A watcher on `combat` in `useGame.ts` writes the profile whenever something new is learnt:
- **Seen:** as soon as a fight starts, whatever the outcome. Mini-bosses and bosses stay seen, since they're let go.
- **Captured:** once the fight is won, even if the run is lost later or the creature is sold. A captured creature never goes back to seen.
- **Biggest catch** (`Profile.biggestCatch`, id → size): `recordSizes` keeps the biggest size caught of each species, sold on the spot or not. `finishFight` in `useGame.ts` updates it from `catchesOf` before `finishCombat`.

Anything meant to last between runs (score, unlocks, statistics) belongs in the **profile**, never in `RunState`.

## Build unlocks

Builds can be locked behind a fisherman's quest, as data only (`content/builds.ts` and `content/fishermen.ts`); the rules are in `engine/unlocks.ts`.
- **Data:** `BuildDef.unlock` names the fisherman (`FishermanDef`: name, map icon, character `sprite`, the `level` he stands on, his `greeting`), the quest's title, and a `QuestCondition`. A build without `unlock` is available from the start. `QuestCondition` is a typed union: `speciesAtHome` (`count` different species of these temperaments in the home aquarium) and `inBucket` (`count` different species in the bucket, companions included, matching an optional `temperament`, `water` and minimum `size`). A new kind is a new case in `counts` (unlocks.ts), `describeQuest` and the content checks.
- **Profile:** `Profile.unlockedBuilds` (builds unlocked by quests) and `Profile.fishermenMet`. A fisherman counts as met as soon as the player steps on his node (the profile is written then), so his quest stays open even if that run is lost.
- **On the map:** `createRun` takes the fishermen to place (`fishermenToMeet`: those teaching a build still locked) and keeps them in `RunState.fishermen`, so later levels get theirs too. `buildLevelMap` puts each on his level's generated map, in the column right after the mini-boss (every node there is reachable from it), in place of an event, or a fight if there's none, or one of two shops; never the last shop nor the leave node. It uses no RNG, so the rest of the map is the same. Hand-made levels never get one. The node is `kind: 'fisherman'` with `MapNode.fisherman`; `visitFisherman` moves there.
- **Bucket quests** are checked when the player steps on the fisherman: `visitFisherman` adds the builds whose `inBucket` quest the bucket meets (`questsShownTo`) to `RunState.questsShown`, so the creatures can be sold or lost afterwards. A run that doesn't end well loses that with the rest of the run.
- **Unlocking:** `endRun` in `useGame.ts`, on a successful run only, once the bucket has joined the home aquarium: `newUnlocks` returns the open quests (fisherman met, build locked) that the home aquarium now meets, or, for bucket quests, that are in the run's `questsShown`. They're added to the profile and shown on the end screen (`newlyUnlocked`). A lost run, or a boss fleeing, unlocks nothing.

## The Logbook (progression)

Lasting upgrades bought with golden shells between runs: data in `content/progression.ts`, rules in `engine/progression.ts`, the screen in `ui/LogbookScreen.vue` (opened from the menu).
- **Data:** `ProgressionNodeDef`: `id`, `track`, `requires` (node ids), `cost` in shells, an `effect`, an `icon` (emoji or icon file), `name` and `description` (French in `fr-content.ts` → `progression`; track names are `logbook.track.<track>` in the language files). `ProgressionEffect` is a typed union: `rerollsAtStart`, `coinsAtStart`, `bucketSpace`, `shopItem` (an item id), `shopDiscount` and `sellBonus` (percent), `restingBondLevel`, `rewardChoices` and `companionStars`. A node with an existing effect is one line of data; a new effect is a new case in the union, read where its number is used, and checked in `validateContent`.
- **Layout:** nothing is placed by hand. `progressionLayout` gives each track a column (in order of first appearance) and each node a row, one below the deepest node it requires. The screen draws the lines between nodes as an SVG over the grid, in cell units.
- **Shells:** `shellsEarned(run, combat)` is `GOLDEN_SHELLS` (1 for a won mini-boss, 2 for a boss, next to the system in progression.ts). `claimVictory` in `useGame.ts` adds them to the profile and writes it at once, so a run lost later keeps them; `shellsWon` shows them on the reward screen (or the end screen after the last boss). `buyNode` checks `requires`, the cost and that it isn't bought (`nodeBlocked` says why not).
- **Into the run:** like the fishermen, `createRun` takes the profile's bought nodes and keeps them in `RunState.progression`, so the engine stays pure and a resumed run keeps the nodes it started with. Each effect is read where its number is used: `createRun` (start rerolls, coins, `bucketSize`), `storeItems` (an item some node unlocks with `shopItem` is hidden until it's bought; prices after `discountedPrice`, rounded down, and every store purchase goes through it), `runSellBonus` (the Logbook's percent **added** to the companions' or the fight's `sellBonus`, then `saleValue` rounds up once, as every sale does), `rollCardRewards` (`count`), `runCompanionEffects` (the extra stars, passed to `companionStars` / `activeBonuses` / `companionEffects` as `extraStars`, so every star-scaled amount follows), and `restAtHome` (its `upTo` level, from `restingBondLevel`, in `endRun`).
- **Profile:** `Profile.goldenShells` and `Profile.logbook` (node ids). The debug panel's sandbox profile sets both (`DebugProfile.shells`, `progression`), any node on or off, requires or not.
- **Simulator:** normal runs have no node, so they stay comparable; `--campaign` earns shells and buys the cheapest affordable node after each run.

## Creature families

Families (`content/families.ts`, `FamilyDef`) group temperaments by a shared identity: Venom, Shell, Swift, Hunter, Endurance, Patient, Trickster, Flashy, Camo and Slimy. A temperament can be in several (clawed creatures are Shell and Camo). It's an internal grouping only, never shown to the player, who only ever sees temperaments; the debug panel searches cards by family name. A lookup (`engine/families.ts`):

- **`familiesOf(temperament)`** and **`creatureFamilies(enemyId)`** give a creature's families, through its temperament.
- **`cardsOfferedBy(enemyId)`**: the cards whose `family` is one of them. That's what each creature can offer; nothing uses it in the game yet.
- **Checked on startup:** every family's temperaments exist, every creature's temperament is in at least one family, and every card's `family` exists.
- **`temperamentList(ids)`** names temperaments the player's way ("🐚 Armored or 🦀 Clawed"): how a card's crest, the aquarium's sign and Ned's quest show a family or a set of temperaments.
- `identity` and `focus` are design notes, translated but never shown.

Creature types (`content/creatureTypes.ts`, a creature's `type`) are internal habitat data too: fishing spots' `types` (`encountersFor`) and the Crab Hook's `extraCatch` read them, and they're never shown.

## Companions: bonuses from brought creatures

Creatures brought from the home aquarium on the companions screen (`RunState.companions`, always the first entries of the bucket) give a bonus from their **temperament** for the whole run. Creatures captured during the run are **angry** (💢 in the bucket) and give nothing. Selling a companion ends its bonus; the max HP it gave stays.

- **Content:** `content/companions.ts`, one `CompanionBonusDef` per temperament. An effect's `byStars` lists its amount at 1★, 2★… (a trigger's: its effect's `amount`); the last entry covers more stars, and an effect without it keeps its `amount`. `fullSchool` is the extra at 3 species, never scaled.
- **Stars** (`engine/companions.ts`):
  - **A companion's** (`companionStars`): its tier, +1 at bond level 2, +1 more at level 3, so 1★ to 5★.
  - **A temperament's** (`activeBonuses`): the sum over its companions, each species once (the one with more stars), so two Clownfish count as one reef fish.
  - **Amounts:** each effect reads its `byStars` at the temperament's stars (`bonusEffects`), and 3 species (`FULL_SCHOOL`) add `fullSchool`. `nextStars` finds the fewest extra stars that change an amount, for the companions screen's preview.
  - **During a run:** stars follow the companions' bond, which grows each fight, so each fight's bonuses are worked out when it starts. The max HP bonus is the one given when the run started.
- **Effects** (`CompanionEffect` in `engine/types.ts`):
  - **Passive modifiers,** read with `bonusTotal`: bonus Block, kept Block, bonus damage, first-attack damage, dodged attacks, extra Drain, a slower Will, max HP, healing after fights, sell bonus.
  - **Triggered effects,** `{ type: 'trigger', on, effect }`: any card effect, resolved as the player by `fireTriggers` with its numbers as written (no Strength or other bonuses). The triggers are `combatStart`, `secondTurnStart` (after the second turn's draw), `firstAttackEachTurn`, `firstAttackEachFight`, `fullBlock`, `hitByEnemy`, `firstBelowHalfHp` and `quietTurnEnd`. For the attack and hit triggers, `target` means the enemy attacked or attacking. Block from triggers that fire during the enemies' turn lasts into the player's next turn.
- **Where they apply:**
  - `createRun` adds the max HP.
  - `startFight` passes the scaled effects to the fight, which keeps them in `CombatState.bonuses`; the once-per-turn and once-per-fight state lives in `bonusTracker`.
  - `finishCombat` heals and applies the sell bonus to on-the-spot sales; `sellCreature` applies it to bucket sales.
- **UI:** the home aquarium shows a creature's bonus and stars before you bring it. The session slots show each companion's stars, and each temperament's stars, bonus, and what the next stars would change. The map shows the bonuses next to the equipment, with their stars and a tooltip.

## Persistence

**Debug code** lives in `engine/debug.ts` (the `DebugScenario` type, starting one, the in-fight setters, JSON validation: pure, like the rest of the engine), `ui/DebugPanel.vue` and `ui/DebugCombatTools.vue` (forms that only call those functions) and `ui/debugStore.ts` (the panel option and saved scenarios, in localStorage). A scenario plays in a **sandbox**: while `useGame`'s `debugScenario` is set, neither file below is written, and ending it puts the real profile back (`tests/sandbox.test.ts`).

All saving lives in `ui/saveStore.ts`. There are two files, each with its own version number:

| File | Contents | Written | Deleted |
|---|---|---|---|
| `save.json` | `SavedGame`: version, seed, screen, run, combat, pending card rewards, open event, shop visit | After every state change (a watcher in `useGame.ts`) | When the run is lost or completed, or by **Reset progression** |
| `profile.json` | `Profile`: version, home aquarium, creature book, biggest catches, unlocked builds, fishermen met, golden shells, Logbook nodes bought, injured companions resting, tutorials shown | When a successful run brings its bucket home, when an egg is laid or hatched, when a creature is first seen or captured, when a fisherman is met, when a mini-boss or boss is beaten, when a Logbook node is bought, when a run ends badly or is abandoned, on each map node while companions rest, and when a tutorial ends or is replayed | Only by **Reset progression** |

- **Where:** in the desktop app, in the app's data folder (`app.getPath('userData')`, e.g. `~/Library/Application Support/Catch of the Deck`). In a browser, localStorage under `catch-of-the-deck:save` and `catch-of-the-deck:profile`.
- **Desktop bridge:** `electron/preload.cjs` exposes `window.desktop.readData / writeData / deleteData(name)` and `quit()`. `electron/main.js` only accepts the names in `DATA_FILES`, so the page can't touch any other file.
- **Safe writes:** a file is written to `name.json.tmp`, then renamed over the real one, so a crash mid-write can't corrupt it. Writes are queued one after another, so an older write can never land after a newer one.
- **Versions** (`SAVE_VERSION`, currently 22, and `PROFILE_VERSION`, currently 10). When a saved shape changes:
  1. Bump the version.
  2. Convert older files in `upgradeSave` (or the profile's equivalent).
  3. A file that can't be upgraded is ignored rather than crashing: no Resume, or a fresh profile.

  Examples: version 1 saves called the bucket `run.captured`, and `upgradeSave` renames it. Version 2 saves had no companions, so the upgrade adds empty ones (and empty combat bonuses). Version 1 profiles had no creature book; `upgradeProfile` marks everything in the home aquarium as captured. Version 9 profiles had no tutorials: one that has met any creature counts both as shown. Version 8 profiles had eggs: each waiting egg hatches into the home aquarium (small, bond level 1) and the list is dropped, since breeding was removed. Version 3 profiles stored the home aquarium, and version 3 saves the companions, as plain ids; they're upgraded to creatures with no bond. Version 4 saves were on a generated map: they can't be resumed. Version 13 saves and version 4 profiles had bond points on the old scale (full at 100/200/400) and no sizes: `rescaleBond` keeps each creature's share of full bond (never a lower level), every creature is normal-sized, and every species already captured gets a normal biggest catch. Version 5 profiles had no build unlocks (every run used the first build): they get none unlocked and no fisherman met. Version 16 saves had no fishermen on their maps.
- **Resume** restores every saved field, so the player returns to the same screen. Mid-fight saves include the hand, energy and Will.
- **Transfer** (`TransferScreen.vue`, opened from the menu): moves both files to another device (web, desktop or phone) with no server.
  - **Code:** `STF1:` + base64url(deflate(JSON of `{ save, profile }`)), with `CompressionStream`; `save` is null with no run in progress. `exportTransferCode` reads both files; `importTransferCode` checks the prefix, inflates, parses and runs each part through `upgradeSave` / `upgradeProfile`, so a code from an older build loads. A malformed, truncated or newer-version code throws a `TransferError` (its `reason` picks the message) and nothing is written; a run too old to resume is dropped, as it would be on this device. Neither file's shape or version changes.
  - **Size:** a late-game profile with a mid-fight save is about 6,000 characters (the run's map is most of it; the profile alone about 2,800). That's too much for one QR a webcam reads reliably, so `splitTransferCode` cuts anything over `TRANSFER_PART_LENGTH` (800) into parts, `STF1:<n>/<total>:<slice>`, which Send shows in turn every 400 ms (error correction L, one canvas pixel per module, scaled up with `image-rendering: pixelated`). The scanner gathers them in any order (`collectTransferPart`) and shows how many it has. **Copy code**, **Share code** and the paste box always use the whole code. Share code (only where `navigator.share` exists, mostly phones) opens the system share sheet: a phone sends its code to a computer with no camera that way (AirDrop, Messages, Mail), to be pasted there.
  - **Libraries:** `qrcode-generator` draws the QR, and the scanner uses `BarcodeDetector` where the browser reads QRs with it, `jsQR` otherwise. The screen and both libraries load with a dynamic import when the screen opens, so they stay out of the main bundle.
  - **Camera:** `getUserMedia({ video: { facingMode: 'environment' } })`; every track stops when scanning stops, the tab changes or the screen closes. A refused or missing camera points to the paste box.
  - **Applying:** Receive lists what's coming in (home aquarium, creatures discovered, the run and its floor) and asks first. `useGame.importTransfer` then writes both files (`applyTransfer`, which deletes the save when the code has none) and reloads the refs, so the menu shows the new progress at once. It's refused while a debug scenario plays (the sandbox never writes the files).
  - **Desktop:** `electron/main.js` (`allowCameraOnly`) grants the page the camera (`media`, video only) and clipboard writes, and refuses every other permission. On macOS it asks the system for the camera (`systemPreferences.askForMediaAccess`), whose prompt shows `NSCameraUsageDescription` from `build.mac.extendInfo` in package.json. A `file://` page is a secure context in Chromium, so `getUserMedia` works from the packaged build.

## Desktop app and releases

- **Development:** `npm run electron:dev` opens the game in Electron against the running Vite dev server.
- **Build:** `npm run electron:build` runs the typecheck, builds the game, then packages it into `release/`. macOS builds are ad-hoc signed (`"identity": "-"`, hardened runtime off) until there's a certificate: unsigned, a downloaded app is reported as "damaged" and can't be opened at all; ad-hoc signed, macOS only warns about an unidentified developer.
- **Artifacts** have fixed names, so the README's "latest" download links never change: `catch-of-the-deck-mac-arm64.dmg`, `catch-of-the-deck-windows.exe`, `catch-of-the-deck-linux.AppImage`.
- **Release:** pushing a `v*` tag runs `.github/workflows/release.yml`. It builds and tests on macOS, Windows and Linux, then publishes a GitHub Release with the three installers. The tag should match `"version"` in `package.json`.
- **Web version:** the same tag also runs `.github/workflows/pages.yml`, which tests, builds (`npm run build`, relative paths so it works under `/catch-of-the-deck/`) and publishes `dist/` to GitHub Pages. It can be run by hand from the Actions tab. In the browser, saves live in localStorage, per browser.
- **Loading from disk:** `vite.config.ts` uses `base: './'` so the built page loads its assets with relative paths from disk.

## Languages

Every word the player reads comes from a language file in `src/locales/`, so the game can be played in English or French (Options → Language), and other languages can be added.

- **`en.ts`** is the reference: the game's own words (`terms`: Grit, Hold, Will, Patience), the text written by the rules (`engine`: card text, the fight log, companion bonuses, events, shop) and the screens' text (`ui`).
- **`<code>.ts`** (e.g. `fr.ts`) has exactly the same keys, which TypeScript checks.
- **`<code>-content.ts`** names the content by id: creatures, cards, moves, builds, equipment, companions, events, shop items, fishing spots, levels, and the map's place names and release reasons (keyed by their English text). English content is the content files themselves; `localizeContent` (`content/localize.ts`) swaps in a language's words, and anything missing stays English.
- **Templates:** `{name}` is filled in by the game, `{@grit}` is one of the language's terms, and `singular|plural` picks a form from `{n}` by the language's plural rules (`formatMessage`, `engine/text.ts`).
- **The engine** stays pure: it only knows message keys (`text('log.plays', …)`); the UI hands it the language's messages at startup (`setText`).
- **The UI** uses `t('menu.newRun')` (`ui/i18n.ts`, with typed keys) and builds the game data in the chosen language once at startup. The choice is kept per device (else the system's language, else English); changing it reloads the page, so every name is rebuilt. Fight log lines already written stay in the language they were written in.
- **Adding a language:** copy `en.ts` to `<code>.ts` and translate it, write `<code>-content.ts` (copy `fr-content.ts`), and list the language in `locales/index.ts`. `tests/i18n.test.ts` checks that it has every message, names all the content, and writes every rule without leaving a key or a blank.
- **Keywords** (`ui/keywords.ts`, shown by `KeywordText.vue`): the terms, `ui.keywords.*` (Drain, Strike, Pull, Exhaust, Block, attack; their `forms` are the spellings to find, per language) and status names are found in game text and get a tooltip. Those with an icon (`ICONS`: Hold, Grit, Will, Patience, Strike, Pull, Drain, Block, attack, Venom, Strength, Weak, Slow) show as the icon alone, hoverable and focusable, with the word as its accessible label; the others are underlined words. Cards, the fight log, the guide, companion bonuses, the creature book, shop items and event choices go through it; tooltips (`v-tip`) are plain text.
- **Reading cards:** on touch, holding a finger on any card shows it full screen, scaled to the window, until the next tap (`ui/cardZoom.ts`, `CardZoom.vue`).
- **Not translated:** content validation errors (for whoever edits the content), the docs, and the game's title.

## Animation and performance

- **Transform and opacity only:** UI animations and transitions only change `transform` (or `translate`, `scale`, `rotate`) and `opacity`, which the browser can run without re-laying out or repainting the page.
  - **Bars:** they scale (`scaleX`); the Will bar's next-turn preview slides between two clipping windows.
  - **Hover and target glows:** these sit on their own pseudo-element and fade in.
  - **Shadows and filters:** drop shadows or filters around something that animates are replaced by still shadows.
- **Sprites** (`AnimatedSprite.vue`): the sheet slides behind a one-frame window with a CSS `steps()` animation. There are no timers or re-renders per frame, and the end of a one-shot clip is its `animationend`.
- **Tutorial** (`TutorialOverlay.vue`, steps in `App.vue`'s `TUTORIALS`): a modal `<dialog>` over the screen, with a lit cut-out (a giant `box-shadow` around the step's elements, found by CSS selector and scrolled into view) and a short text beside it, fading in step by step. The map's plays on the first map screen, the fight's on the first turn of a fight; each once per profile (`Profile.tutorials`), never in a debug scenario; Options → Tutorial → Replay shows them again.
- **Creatures' moves** (`moveMotion` in CombatView, keyframes in CombatantView): when a turn ends, each creature that played a move gets a 0.8s transform on its body (Strike lunges at the fisherman, Pull turns away, guard sinks, heal bobs up, buff swells, anything else wiggles), 250ms apart. End Turn is off until they're done (1s at least), so a double click can't skip a turn. Reduced motion keeps the bodies still.
- **Aquarium fish:** each fish's lane spans the tank minus one fish and slides by its own width. A single element both flips the sprite and bobs it, using the separate `scale` and `translate` properties.
- **No layout reads mid-animation:** dragging a card measures the battlefield and creatures once when the drag starts, then hit-tests against those boxes, applying pointer moves at most once per frame.

## Assets

- **Sprite sheets** are registered in `ui/sprites.ts` (`SHEETS`) and referenced from content as `{ sheet, index }` (1-based).
- **Animated creature sheets** (`assets/creatures/NNN.png`, 6 frames × 4 rows: idle, attack, capture, flee) come from `scripts/generate-creature-sprites.mjs`.
- **The coast map** (`assets/coast/map.png`, 1300×450: land, then a shoreline around y 196 with bays, two headlands, a tidal island and a lagoon behind a sand spit, the shallows, then the open sea from about y 300) is the background of every level's map, each age showing it down to its `height`. `scripts/draw-coast.mjs` (`npm run coast`) draws it with every place on it, and prints the places for `content/coast.ts`. The older hand-drawn art in `assets/map` (and `scripts/draw-sea.mjs`) is no longer used. `MapView.vue` draws on top of it:
  - **Links:** the links between nodes.
  - **Nodes:** fights in their spot's colour with its code, ? / T for events and treasure, each store's front (`assets/stores/<store>-node.png`) for shops, ⌂ for heading home, a diamond for the mini-boss and a ring for the boss.
  - **Legend:** a **Legend** button shows it, built from the spots.
  - **Zoom:** the map shows the whole width and the level's `height`. It takes 60% of the screen's height under the top bar (the bucket gets the rest), at least 300px, and scrolls sideways when wider than the screen, so Kid is zoomed in on the shore and the map zooms out as the ages go out to sea. Node markers keep their size on screen.
- `assets/coast.svg` was the hand-made levels' background. Nothing uses it now.
- **Eggs** (`assets/egg-<colour>.png`: idle row, then hatching row, 32×32 frames, cut from `assets/egg.png`, art by VIERGACHT) are kept unused since breeding was removed. The script that cut them, `scripts/extract-eggs.mjs`, is in git history.

## Testing

- **Running them:** `npm test` (Vitest) and `npm run typecheck`.
- **Engine tests** use `tests/fixtures.ts`, small content with fixed numbers, so rebalancing real content doesn't break them.
- **Content tests** run against the real data.
- **Levels:** `tests/map.test.ts` checks the coast's places (on the art, known spots) and the real levels over many seeds (shape, lanes, shop and head-home after the mini-boss, links, every fight finding creatures), plus the validation messages.
- **Not covered:** the UI layer and `saveStore.ts` have no automated tests. They were checked by hand in the browser and with an Electron smoke test.

## Tuning knobs

| Setting | Where | What it controls |
|---|---|---|
| Bosses, escape, height, tier | `content/levels.ts` | Each level's fixed points and who you meet |
| Places and their visits | `content/coast.ts` | Where fights can be on the map, and what each age does there |
| `COLUMNS_PER_HALF`, lanes, `NODE_GAP` | `engine/map.ts` | The shape of the generated maps |
| `EVENT_COLUMNS`, `SURPRISE_EVENT_CHANCE` | `engine/map.ts` | How many events break up the fights |
| Waters and creature types per spot | `content/spots.ts` | Which creatures each fishing spot can bring |
| `EVENT_FIGHT_CHANCE`, `CARD_REWARD_COUNT` | `engine/run.ts` | Surprise fights in events, card choices after a win |
| `STARTING_HAND_SIZE`, `BASE_ENERGY`, `VULNERABLE_MULTIPLIER`, `WEAK_MULTIPLIER` | `engine/constants.ts` | Combat basics |
| `sellValue`, `escapeAt`, `escapeStart`, `escapeRate`, `temperament`, `tier`, `water` | `content/creatures.ts` | Per-creature balance, and where it lives |
| Item prices, limits and effects; blessings | `content/shop.ts` | Stores |
| `startingItems`, `level` per build; item effects | `content/builds.ts`, `content/equipment.ts` | Which builds start a run, and the items to pick from (none for now) |
| Temperament bonuses (`byStars`), `FULL_SCHOOL`, `SESSION_SLOTS` | `content/companions.ts`, `engine/companions.ts`, `engine/run.ts` | What brought creatures give, and how it scales with stars |
| `BOND_BY_TIER`, `bondToFull`, `bondPerFight`, `BOND_AT_HOME`, `BOND_LEVELS` | `content/creatures.ts`, `engine/bond.ts` | How fast creatures bond with the player |
| `BUCKET_SIZE` | `engine/run.ts` | How many creatures the bucket holds, companions included |
| Logbook nodes (costs, effects, order); `GOLDEN_SHELLS` | `content/progression.ts`, `engine/progression.ts` | What lasting upgrades cost, and the shells a mini-boss and a boss give |
| `SIZE_ODDS`, `SIZE_SHIFT_LARGE`, `SIZE_SHIFT_TROPHY`, `SMALL_FLOOR` | `engine/sizes.ts` | How big catches are |

Percentages in equipment and event effects are whole numbers (20 = 20%), and results are **rounded up**: the Reliable Reel's rate cut, the Strong Rod's extra pull, the Sharp Spear's sale bonus (with the companions' and the Logbook's, added), passerby bonuses. The Logbook's store discount is the exception: prices round **down**.

**Equipment effects** (`EquipmentEffect`, applied by the engine):
- **`slowEscape`:** the Reliable Reel.
- **`strongerPull`:** the Strong Rod. The player's Drain drains a share more (`CombatState.pullPercent`).
- **`sellOnCapture`:** the Sharp Spear.
- **`passerbyBonus`:** the Rubber Duck.
- **`bondOnCapture`:** the Soft Net. Catches come home with that share of their full bond, in percent (`bringCatchHome`).
- **`extraCatch`:** the Crab Hook. An ordinary fight at one of its `spots` (rock pools, estuary, stream, beach, cliff rocks) sometimes drags in one more creature of the listed types at the same tier, from the spot's waters when possible (`startFight`). Never on a mini-boss or a boss, and never beyond `MAX_CREATURES_PER_FIGHT` (1 for now, so it does nothing).
- **`baitChance`:** the Handline (with `gearRelics`).
- **`bonus`:** a combat bonus as a companion's (relics, with `gearRelics`).
