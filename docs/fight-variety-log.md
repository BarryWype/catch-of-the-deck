# Fight variety: log

What each phase of the fight-variety work did, measured with the simulator (`npm run simulate -- --runs 100`, seeds 1–100, the Rod build, no companions), and the decisions made where the brief was open. Each phase adds a feature flag (`Features` in `src/engine/constants.ts`, toggled in the debug panel's **Features**); every "after" row is played with every feature built so far on (`--features all`), so the rows add up phase by phase. The bot plays greedily and picks paths, rewards and event choices at random: read the numbers as trends.

## Simulation

| Phase | Win | Avg floor | Avg fight (turns) | Ordinary fight (turns) | Notes |
|---|---|---|---|---|---|
| Before (`--features none`) | 0% | 10.8 | 8.0 | 7.9 | kid ordinary 1–24 turns, adult 1–19 |
| 1. More events | 0% | 10.2 | 8.0 | 8.0 | |

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
