# Fight variety: log

What each phase of the fight-variety work did, measured with the simulator (`npm run simulate -- --runs 100`, seeds 1–100, the Rod build, no companions), and the decisions made where the brief was open. Each phase adds a feature flag (`Features` in `src/engine/constants.ts`, toggled in the debug panel's **Features**); every "after" row is played with every feature built so far on (`--features all`), so the rows add up phase by phase. The bot plays greedily and picks paths, rewards and event choices at random: read the numbers as trends.

## Simulation

| Phase | Win | Avg floor | Avg fight (turns) | Ordinary fight (turns) | Notes |
|---|---|---|---|---|---|
| Before (`--features none`) | 0% | 10.8 | 8.0 | 7.9 | kid ordinary 1–24 turns, adult 1–19 |
| 1. More events | 0% | 10.2 | 8.0 | 8.0 | |
| 2. Gear relics | 0% | 11.0 | 7.9 | 7.9 | relics after each mini-boss (the bot takes one at random) |
| 3. Trophy fights | 0% | 9.3 | 8.0 | 7.9 | trophy fights cost Grit before the mini-boss |
| 4. Boss pools | 0% | 9.1 | 8.3 | 8.1 | kid mini-boss won 44% (59% before): Pike and the pufferfish hit harder than the Blue crab |
| 5. Own stats | 0% | 8.9 | 8.4 | 8.4 | ordinary fights spread wider: see below |
| 6. Traits | 0% | 7.8 | 8.5 | 8.6 | traits mostly favour the creatures: the biggest drop so far |
| 7. Affixes | 0% | 8 | 8.7 | 8.7 | trophies now get an affix instead of +1 Strength |

### Phase 5: shortest and longest ordinary fights per level

| | Kid turns (p10–p90) | Kid Health pools | Adult turns (p10–p90) | Adult Health pools |
|---|---|---|---|---|
| Before (no features) | 1–24 (6–11) | 50–62 | 1–19 (4–11) | 59–71 |
| After phase 4 | 1–27 (6–12) | 50–88 (trophies) | 1–24 (4–11) | 59–97 |
| After phase 5 | 1–36 (5–13) | 35–115 | 1–24 (4–13) | 46–113 |

The 1-turn fights are creatures that flee or are caught at once (bait, a lucky Drain); the middle 80% of fights went from 6–11 to 5–13 turns as a Kid.

## Decisions

- **Flags off by default in tests, on in the game.** `buildGameData` without `features` (the content's `gameData`, every existing test) has every feature off, so the old tests check the old game unchanged. The game itself (`ui/i18n.ts`) and the simulator play with `FEATURES` (all on), changed per device from the debug panel.
- **New events carry `feature: 'moreEvents'`** rather than the engine knowing which events are new: with the flag off they're never drawn and the RNG is drawn exactly as before.
- **"Lose a card"** (the gull) is a new `loseCard` effect: a random deck card is lost. Betting coins needed a `loseCoins` effect; it blocks the choice without the coins.
- **`fight` without `enemies`** fights a creature of the level's tier, as surprise fights do; `trophy: true` asks for a trophy fight (phase 3). Its reward waits in `RunState.eventFight` until the fight ends; fleeing or losing gives nothing.
- **A `rareCard` reward** is the next card reward with a rare in it (it sets the lucky lure's `luckyLure`). **A `relic` reward** offers a relic choice once relics exist (phase 2), and a rare card while `gearRelics` is off.
- **`freeNextFight`** gives a *copy* of the card for the next fight only (uid `free0`, free all that fight); without `cardId` the player picks which deck card to copy.
- **`addJunk`** puts the junk card in the run deck itself: it's a curse until a card removal takes it out. No new card kind was needed.
- **The rival angler's bet** is paid up front (`loseCoins` 10) and the fight pays 25 on a win, nothing otherwise.
- **Save version 22:** v21 runs get `seenEvents: []`; every other new run field is optional and read as absent.
- **Relics are equipment with a `rarity`**, in `content/equipment.ts` under the gear catalogue's ids; `gear.ts` stays as the art catalogue (a test checks every relic is a piece of it). They carry companion bonuses through a new `{ type: 'bonus', bonus }` equipment effect, gated by `gearRelics`.
- **Relic choices wait in `RunState.relicChoices`** and show over the map (`RelicChoice.vue`), so a mini-boss's card reward comes first, then the gear. They can be left.
- **Rarity odds:** Kid 60/30/10 as asked; Adult 45/35/20 and Elder 30/40/30 (`RELIC_ODDS`), my guess at "shift toward rarer ones".
- **New hooks for the relics:** `firstPullPercent` (Cork bobber), `foresight` (Fishing sonar), the `quietTurnEnd` trigger (Crab trap, Fish trap). Harpoon's "+3 on the first attack each fight" is a 3-damage trigger after that attack, not damage added to it (Strength and Weak don't touch it).
- **Fishing sonar** decides each creature's move after next ahead of time (from its pattern, as if the next one had been played) and shows it as "→ move" beside the intent; a card that changes the next move doesn't change the one after. Ink hides both.
- **Handline:** 20% per fight to start with a bait card of the level's tier in hand, for that fight only (it isn't added to the deck). Only with `gearRelics` on; its description changed for both settings.
- **A treasure chest choice** is a new treasure event, `tackleChest` (gear or 20 coins), drawn alongside the Sunken Chest while `gearRelics` is on.
- **A `relic` reward with no relic left** (all carried) falls back to a rare card.
- **Trophy scaling applies after the pools:** today's pools are floors (a creature below them is raised to them), so multiplying the pools alone would often change nothing. A trophy creature's Health and Will bars are raised by `TROPHY_POOL_PERCENT` after the pools, and its damage by `TROPHY_DAMAGE_PERCENT` on top of the fight's.
- **Trophy markers are drawn last** on the map (after the stores), so turning `trophyElites` off or on changes nothing else on a seed's map.
- **"Sells for 200%"** applies to every trophy-size catch while `trophyElites` is on (sizes had no other use), not only to trophy fights' catches.
- **One relic offer at a time:** a trophy fight from an event that also promises a relic (the bottle with a map) offers one choice, not two.
- **Candidates carry their own reason:** `candidates` is a list of `{ enemies, releaseReason }` rather than `string[][]`, since each one needs its `releaseReason`. `enemies` and `releaseReason` stay as they were, for when `bossPools` is off. The draw happens when each level's map is built (the run's start, then each `enterNextLevel`), after the trophies.
- **"All unique across the run"** is guaranteed by the content: a creature may be a candidate of one slot only (checked on startup), so no draw can repeat one.
- **Boss patterns:** predator, venomous, puffer, ambusher, fighter and armored had none; each got a `bossPattern` sequence in `behaviors.ts`, and the Pike one for its own moves. They only matter for creatures fought as mini-bosses or bosses.
- **The map names the drawn creature** on the mini-boss and boss labels when `bossPools` is on (the place name otherwise).
- **Own stats, read literally:** each creature is scaled by (its share of the pool) ÷ (its tier's average), Health from the middle of its range, Will from its starting Will (its top and rise follow, as the Will pool already did), damage from its pattern's `turnAverage`; then clamped to 70–140% of its share. The tier's averages come from every creature of the tier, met at that level or not.
- **Fourteen temperaments, not thirteen:** the ambusher had no trait in the brief; it got **Camouflage** (3 Block at the start of each of its turns), reusing the `turnStart` rule.
- **Traits are rules, not code per temperament:** a `TraitRule` union (afterHits, keepBlock, slowWill, firstDrain, belowHealth, inkMoves, playerBelow, lastRun, lingeringVenom, bluff, paceGuard, turnStart, counter), each implemented once at its hook, with its numbers in `behaviors.ts`.
- **Inflate** "gains 2 Spines": Spines is a status on the player in this game (each attack hit costs Grit), so the puffer gives the player 2 Spines.
- **Second Run** replaces the pace by the set's normal-intensity Pull without a role (the fighter's Leap Out).
- **Dazzle** shows a random move of its set (heavy moves aside) every third move; it can be the real one, so the "?" means "maybe". Cards that read the intent still read the real move; the bar preview leaves it out so it doesn't give the bluff away.
- **Bloodlust** watches creature hits only (not Venom or Spines).
- **Affix names in French** are written per affix (`title`, e.g. "{name} vorace"), since an adjective in front doesn't work in French.
- **Affixes per creature:** in a group fight each creature rolls its own (at most one each).
- **"Armored (scaled)"** scales its 4 Block by the fight's damage scale (`fightScale`), as Skittish and Second Wind do; it also has that Block on the fight's first turn.
- **The affix roll** happens in `startFight` with the run's RNG, only while `affixes` is on, so with it off the RNG is drawn as before.

## Handoff: phases 8–10 still to do

Phases 1–7 are done and committed on `fight-variety`. The last commit, "WIP phase 8", is unfinished and **does not compile**: finish it (or rework it) before anything else. The original brief is the prompt this work started from (ten phases: phase 8 boss gimmicks, phase 9 escalating intents, phase 10 two-creature fights, then the final report). Keep following what phases 1–7 did:

- Every feature behind its flag in `Features` (`src/engine/constants.ts`), read with `hasFeature(data, id)`. Content built without features (the tests' `gameData`) plays as before, so existing tests must pass unchanged; new tests build `buildGameData({ ...contentSource, features: … })`.
- New numbers in `constants.ts` or the content file, each with a one-line comment. Every player-facing text in `en.ts`, `fr.ts` and `fr-content.ts`.
- Per phase: `npm run typecheck`, `npm test`, `npm run simulate -- --runs 100 --out fv-phaseN > simulation/fv-phaseN.txt` (read its "Summary" line), a row in the table above, decisions in "Decisions", docs (GAME_MECHANICS.md, ARCHITECTURE.md → Fight-variety features, CREATURE_BEHAVIOUR.md), then one commit per phase. No push.
- Run-state fields stay optional (save version 22 needs no new bump for optional fields).

### Phase 8: boss gimmicks (`bossGimmicks`), in progress

Decided, and already in the WIP commit's `src/engine/types.ts` and `statuses.ts`:
- **A boss's own move set lives in `EnemyDef.bossMoves`** (`{ moves, pattern }`), never in `moves`, so the flag off changes nothing (the behaviours test reads `moves`). Content: a `bossMoves?: Behavior` on the creature in `creatures.ts`, copied by `toEnemy` (`content/enemies.ts`).
- `createCombat` should set `EnemyState.gimmick` for a boss (`config.bosses`) whose def has `bossMoves`, with the flag on. Then a `movesOf(enemy, data)` helper (intents.ts) must replace every `data.enemies[x].moves` read: `combat.ts` (turnAverage call), `intents.ts` (getIntentMove, nextMove, chooseIntent), `effects.ts` (flip/reroll intent, delayMove, intentMove), `debug.ts`, `DebugCombatTools.vue`, `CombatView.vue` (~line 356), `scripts/simulate.ts` (creatureTurns). `patternOf` returns `bossMoves.pattern` for a gimmick creature.
- New: statuses `hiding` (moray's Retreat into the Hole: the player's damage to it is 0, Drain works; removed at its turn start like `burrowed`) and `sprinting` (tuna's Sprint, decays: its Will rises double in `endTurn`); effects `grabCard { returnAt }` (octopus's Eight Arms: sets `EnemyState.grabbing`; after the player's next draw it takes a random hand card into `held`; `damageThisTurn` ≥ `returnAt` gives the cards back) and `shedDebuffs` (lobster's Molting); `dealDamage.doubleIfHoldBelow` (mako's Breach, after a Wind-up); the pattern `{ type: 'phased', below, first, then }` (giant squid: Ink and Pulls above 50% Health, multi-hit Strikes below; `EnemyState.phaseFrom`).
- `src/engine/data.ts` move checks were refactored into `checkMoveSet` (handles phased patterns and `bossMoves`).

Still to do: `turnAverage` for phased patterns (`combat.ts` ~line 278 doesn't compile yet: average both phases); `nextMove` for phased; implement the effects and statuses above (and in `previewIntent`, `specialOf`, `describe.ts`, `StatusList.vue` icons, both locales: `status.hiding`, `status.sprinting`, `intent.special.*`, log lines); the nine `bossMoves` (Giant octopus, Common lobster, Catfish, Giant moray, Giant clam, Bluefin tuna, Giant squid, Mako, Oarfish; the last three examples aren't in the brief: proposed Catfish burrows then Ambushes, Giant clam snaps shut for 20 Block and Burrow, Oarfish's Omen puts both Tangled and Numb Fingers on the player), French move names (`moves['<creature>.<id>']`), a test per mechanic, README's effect table. Second Wind stays as it is. Lighter mini-boss versions are optional.

### Phase 9: escalating intents (`escalation`)

From turn `ESCALATION_TURN = 5`, an ordinary creature's weighted pattern shifts each turn: Pull weights +`ESCALATION_PULL_PERCENT = 10`%, pace weights −10%, capped at double (and at zero). In `nextMove` (intents.ts), weighted branch only; never bosses. A "tiring / desperate" indicator from that turn: a badge through `badgesOf` in `CombatView.vue` (tone `warn`). Small.

### Phase 10: two-creature fights (`groupFights`)

`MAX_CREATURES_PER_FIGHT` 2 under the flag (`encountersFor` in map.ts, `extraCatch` in run.ts); 8–10 pairs in `content/encounters.ts` for adult and elder; `encountersFor` picks one at `GROUP_FIGHT_CHANCE_PERCENT = 20` of ordinary adult and elder nodes. `CombatView.vue`: side by side on desktop, compact stacked on phones (docs/agents/ui.md: needs the dev server on 5190, one screenshot per affected size, JavaScript checks at the others). Check targeting, `random` target cards, Net fishing and card reward families with two creatures.

### At the end

Fill in "every new constant with its starting value" and "left unfinished or unverified" below, and the final report (what's in, each flag, the debug panel's Features section, the three things to tune first). From phases 1–7 so far, the tuning candidates are: traits mostly help the creatures (floor 8.9 → 7.8 at phase 6); trophy fights cost a lot of Grit before the mini-boss (11.0 → 9.3); the Crab trap's +1 Hold (as briefed) is nearly worthless.

### Constants so far

`FEATURES`, `RELIC_CHOICES` 3, `RELIC_ODDS` 60/30/10 · 45/35/20 · 30/40/30, `TROPHY_NODE_SHARE` 6, `TROPHY_MIN_NODES` 2, `TROPHY_POOL_PERCENT` 140, `TROPHY_DAMAGE_PERCENT` 120, `TROPHY_SELL_PERCENT` 200, `OWN_STATS_MIN_PERCENT` 70, `OWN_STATS_MAX_PERCENT` 140, `AFFIX_CHANCE_PERCENT` 15. Relic, trait and affix numbers are in `content/equipment.ts`, `behaviors.ts` and `affixes.ts`.

### Not verified yet

The UI added in phases 1–7 (event pickers, relic choice overlay, map trophy marks and boss names, creature badges, the sonar's "→ move", the Features section) passes typecheck but hasn't been checked in the browser.
