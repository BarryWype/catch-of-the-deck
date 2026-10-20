# Balance work

Difficulty is the user's call, so the deliverable is measurement: what a change did to the numbers, against their targets.

Redirect the report to a file and read only the ‘All ages together’ table. When tests fail, rerun just the failing file.

## The tools

- `npm run simulate -- --runs 300 --out <name>`: a bot plays 300 seeded runs (seeds 1–300, so the same code gives the same numbers). Each run saves `simulation/<name>-runs.csv` and `<name>-fights.csv`. The printed report has an "All ages together" table: turns, Grit lost, escape rate and Patience for normal fights, mini-bosses and bosses, plus the share of each move role.
- `npm run simulate -- --runs 300 --lineups --out <name>`: for companion changes. The same seeds with no companions, then each temperament's standard lineups, ranked by median fights (`<name>-lineups.csv`; about 9 minutes at 300 runs, so run it in the background). `--companions <id,id> --bond <0-3>` runs the normal report with chosen companions.
- `npm run simulate -- --campaign 20 --out <name>`: for bond and home-aquarium changes. 20 runs sharing one home aquarium; reports bond pacing, companions lost and catch sizes (`<name>-campaign.csv`).
- `npm run simulate -- --runs 300 --trace --out <name>`: also writes `<name>-trace.csv`, one row per map node once resolved (level, column, node kind, enemies, then Grit, coins, deck, bucket and the fights so far). A run's rows stop where it ends. Forecasting runs from it with Timestral: docs/timestral.md.
- `npm run reward-shares -- --out <name>`: the share of each card type in tier-1 rewards, by fishing spot.
- `simulation/` is git-ignored: keep before/after files there, named for the change.

## Steps

1. **Before:** run the simulator (and reward-shares if cards or rewards change) and save the printed report: `npm run simulate -- --runs 300 --out before-<topic> > simulation/before-<topic>.txt`.
2. Make the change.
3. **After:** the same commands with `after-<topic>`.
4. **Report** a before/after table for every number the request targets, marked met or missed. When one is missed, name the constant or value and roughly how much to change it, and leave the change to the user.

## Reading the numbers

- The bot plays greedily and takes random paths and rewards, so treat its numbers as trends; compare runs of the same seeds, never against a person's play.
- Fight damage and HP are scaled at fight start (`startFight` in `src/engine/run.ts`, `createCombat` and `turnAverage` in `src/engine/combat.ts`). Written move numbers are only ratios: changing a creature means changing its intensities, weights, extras or order. ARCHITECTURE.md → "Fight scaling" has the details.
- Scale with integer percents (as the growth formula does): a floating-point factor such as 1.14 makes 50 × 1.14 = 56.99…, and rounding that later lands on the wrong whole number.