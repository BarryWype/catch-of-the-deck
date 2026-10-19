# Stores

Tracker for the stores rework: the single shop becomes three stores (Cafe, Tackle shop, Bait shop), each with its own scene, keeper, items and map icon. Decisions marked **(user)** were the user's call; the others are defaults taken while building.

## How a store works

- **On the map.** Shop nodes stay where map generation puts them today (two fixed ones per level, and the 10% of events that turn into a shop). Each shop node is given a store kind when the map is built, at random among the three, from the run's seeded RNG. The kind is saved on the node, so the map shows its icon before the player gets there.
- **On entering.** The visit is set up once, from the run's RNG: the Bait shop draws its blessing for the visit and the family its aquarium buys. Re-entering a save restores the same visit.
- **Items.** Each item has a price, an optional limit per visit, and an effect. Items marked "always there" are on every store of that kind. Items that act on a creature ask the player to pick one from the bucket, as "Remove a card" asks for a card.
- **The keeper.** Tapping the keeper shows a line of chit-chat. The Cafe keeper sometimes hints at the next build to unlock: the first locked build, its fisherman and where to find him.
- **Lasting effects.** Several items last for "the next N fights". They are kept on the run as a list of boons, each with its fights left. Every fight started (won, fled or lost) uses one up, as `RunState.fights` counts fights. Combat boons go to the fight as extra bonuses, the same way companion bonuses do.

## Items

| Store | Item | Price | Limit | Effect |
|---|---|---|---|---|
| Cafe | Cocoa cup | 15 | none | +15 Grit (not above max) |
| Cafe | Espresso | 20 | 1 | +20 max Grit for 5 fights **(user)** |
| Tackle | Life jacket | 20 | 1 | One chosen bucket creature joins the home aquarium even if the run is lost; it stays in the bucket meanwhile **(user)** |
| Tackle | Parcel | 15 | 1 | One chosen bucket creature goes straight to the home aquarium |
| Tackle | Remove a card | 20 | 1 | Remove a chosen card from the deck (kept from the old shop) **(user)** |
| Tackle | Lucky lure | 40 | 1 | The next card reward has at least one rare card |
| Tackle | Spare hook | 10 | none, they stack **(user)** | The next card reward offers one more card |
| Bait | Bucket extension | 20 | 1 | +3 bucket spots for the rest of the run |
| Bait | Blessing release | free | 1 | Release a chosen creature: get the visit's blessing |
| Bait | Keeper's aquarium | — | 1 | Sell one creature of the visit's family for twice its price |

Blessings (one drawn per Bait shop visit, shown before the player chooses):

| Blessing | How it's built |
|---|---|
| +1 damage for the next 5 fights | `bonusDamage` 1, as a companion bonus |
| +2 Drain for the next 4 fights | `bonusEscapeReduction` 2 |
| Creatures start the next 5 fights with 2 Vulnerable | `combatStart` trigger: Vulnerable 2 on every creature |
| Start the next 5 fights with 5 Hold | `combatStart` trigger: gain 5 Hold |
| +30 bond to every creature in the bucket | companions now; caught creatures carry it home |
| +20 Grit | at once, not above max |

## Decisions

- **Old shop.** The Thermos is dropped (the Cocoa cup replaces it); Remove a card moves to the Tackle shop **(user)**.

- **Parcel.** The creature leaves the bucket (its spot frees up) and is kept on the run's "sent home" list. It joins the home aquarium when the run ends, however it ends. A companion sent home stops giving its bonus.
- **Lucky lure.** It works even before the first mini-boss, when rares aren't offered yet. It's used up by the next card reward, whether or not that reward would have had a rare anyway; rerolls of that reward are normal.
- **Blessing release.** It costs nothing but the creature, which is gone (no coins). It can be used once per visit. Companions can be released.
- **Keeper's aquarium.** The family is drawn among all families, so some visits have nothing to sell. A creature counts if any of its families matches. The price is the creature's sale value, companion sell bonus included, times two. The empty tank fills with the sold creature's sprite.
- **Bond for caught creatures.** A bucket creature that isn't a companion keeps the bond it was given, and arrives home with it (on top of any `bondOnCapture` equipment, capped at full bond).
- **Store kinds.** Each of the three is equally likely, drawn independently per shop node: two shops on one map can be the same kind.
- **Simulator.** The bot buys Cocoa cups when under half Grit, as it bought the Thermos. It ignores the other items.

## Checklist

- [x] Engine: `StoreKind` on shop nodes, drawn at map generation
- [x] Engine: store items with per-store lists, visit state (bought, blessing, aquarium family, aquarium sold)
- [x] Engine: boons on the run (fights left), fed into `startFight`, ticked per fight
- [x] Engine: espresso max Grit, life jacket, parcel, lucky lure, spare hook, bucket size, blessing release, aquarium sale
- [x] Engine: keeper lines, and the Cafe hint for the next locked build
- [x] Content: the three stores' items, in place of `content/shop.ts`
- [x] Content checks in `data.ts`
- [x] Locales: item names and descriptions, blessings, keeper lines (en + fr)
- [x] Saves: bump `SAVE_VERSION`, upgrade old runs (shop nodes get a kind, new run fields)
- [x] UI: store screen with the scene art, items on the shelves, keeper bubble, creature picker
- [x] UI: Bait shop's aquarium and its sign (family icon and ×2)
- [x] UI: three map node icons and the legend
- [x] Profile: parcel and life jacket creatures reach the home aquarium at run end
- [x] Debug: start in each kind of store
- [x] Simulator: Cocoa cup
- [x] Tests: map kinds, every item, boons, saves
- [x] Docs: GAME_MECHANICS.md (stores), ARCHITECTURE.md (stores, boons), README if items are content
- [x] Simulation before and after (300 runs)
- [x] UI checked in the browser: Cafe (keeper chat), Bait shop (sign, tank, release picker) at desktop, phone portrait and landscape

## Simulation (300 runs, the bot buys only Cocoa cups)

| | Before (one shop, Thermos +30 for 10) | After (stores) |
|---|---|---|
| Died | 80% | 82% |
| Died at the kid age | 129 | 165 |
| Reached the elder age | 5 | 0 |
| Fights per run (average) | 13.7 | 12.4 |
| Grit lost, normal fights | 3.1 | 3.1 |

Runs are harder: the bot healed at every shop, 30 Grit for 10 coins, and now only at the Cafe (a third of shops), 15 Grit for 15. It ignores the new items, so a player using the espresso, the blessings and the lure fares better than the bot. If that's too harsh, the Cocoa cup's price or amount in `content/shop.ts` is the number to move.
