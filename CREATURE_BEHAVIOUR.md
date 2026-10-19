# Creature behaviour (Slay the Fish)

Source: `src/content/behaviors.ts` (move sets, `move()` helper), `src/content/creatures.ts` (Pike/Red piranha own moves). Snapshot 2026-10-15.

## Rules
- Turn (after player's): its Block and Burrow end → Venom hits it → plays shown move → Will rises by `escapeRate` (−20%/Slow, −10%/Patience, max −80%; Snared = none; pace = half). Then statuses tick, next move picked and shown.
- Every move is S (Strike: damage to Grit) or P (Pull: raises its Will; full = escape, fight ends), Hold soaks both. Intensity: light ×0.5, normal ×1, heavy ×1.4 (written as 6/12/16.8 points).
- Scaling: per creature, moves scaled so the weighted average per turn (all moves as often as the pattern plays them, the heavy turn after each Wind-up included) = 5.5 × (1 + 2% per fight played) (`ENCOUNTER_TURN_AVERAGE`). Group: ÷ count × 1.1. Mini-boss 9–10, boss 10–12 (no growth). Scaling first, then Strength (+1/hit), Weak/Vulnerable, statuses; rounded down; multi-hit split in total. 1st fight, alone: light ≈3, normal ≈6–7, heavy ≈10–14.
- Roles: pace (1 per set, light, Will rise ×0.5) · special (≤2 per set, light, never twice in a row) · wind-up (light; next move = its `followUp`, played heavy ×1.3) · heavy (only right after its Wind-up).
- Weighted (`w`) patterns for ordinary creatures; mini-bosses/bosses use the set's `bossPattern` (`seq`, loops) + Second Wind.
- Strength from moves: only predators, Pike, Red piranha, and mini-boss/boss Wind-ups (+1). Max +3 per fight, on top of starting Strength.
- Player statuses on its next move (used up): Cowed ½ move; Intimidated ½ Strike; Lured ½ Pull; Distracted N −N Strike; Dazzled Strikes −50%, Will +50% (timed); Weak Strikes −25%.

## Specials
Ink 🦑: next move hidden ("?"); no Wind-up right after it; cards still read the real move. · Junk 🗑️ (to discard pile, max 3 in deck, gone after the fight): Pebble in the Boot (unplayable); Slimy Seaweed (1 Tension to clear; in hand at end of turn: −2 Grit); Tangled Line (1 Tension to clear; in hand: Hold cards −1). · Taxes (player's next turn): Tangled (Drain cards +1 cost), Numb Fingers (Attack cards +1), Pinched Hand (Hold cards −2). · Venom N on player (start of turn −N Grit, then −1). · Steal (−1 Patience). · Skittish (3+ cards next turn: its Will +6 × fight scale). · Spines (2 turns: each attack hit −1 Grit). · Burrow (until its next turn: player attacks −50%, Drain normal). · Grab the Bait (next turn, after draw, drop a random card). · Shake the Hook (light Pull, heavy if player has 0 Hold). · Second Wind 🌬️ (mini-boss/boss, once: Health or Will < 25% → telegraphed, then 15 × fight scale points from its fuller bar into the low one).

## Move sets
Format: Move (S/P intensity; extras) [role]. L/N/H = light/normal/heavy, Blk = Block, Str = Strength. `w` weights in move order.

- **reefFish** — Nip at the Lure (S N); Dart for Cover (P N; 4 Blk); Steal the Bait (S L; Steal) [special]; Flashy Zigzag (P L) [pace]. `w 35/25/20/20`. T1 reef fish: Clownfish, tangs, angelfish, gobies, barbs, Seahorse…
- **schooling** — Nibble Frenzy (S N, 3 hits); Scatter (P N; 3 Blk); Regroup (P L) [pace]; Startle the School (P L; Skittish) [special]; Weave Through the Line (P L; Tangled Line) [special]. `w 30/25/20/12/13`. T1: Guppy, tetras, Pilchard, Herring, Anchovy, Shrimp… Pilchard shoal (T2) = 3 Pilchards.
- **predator** — Jolt the Rod (S N; 1 Vuln); Screaming Run (P N; +1 Str); Size Up the Lure (P L) [wind-up] → Head Shake (S H) [heavy]; Grab the Bait (S L) [special]; Circle the Lure (P L) [pace]. `w 30/20/15/15/20` (no Head Shake). T1 Perch, Garfish, bichirs…; T2 Mahi mahi, Hake, Seabass…; T3 Taimen, Barracuda+1, Marlin+1, Swordfish+2, Mako+2.
- **venomous** — Prickly Thrash (S N; 1 Vuln); Dive for the Rocks (P N; 6 Blk); Spiny Flick (S L; Venom 2) [special]; Raise Spines (P L; Spines) [special]; Lie Still (P L) [pace]. `w 25/25/15/15/20`. T1 Weever, Sea urchin, Fireworm…; T2 Lionfish, Scorpionfish, Cone snail; T3 Stonefish+1, Stingray.
- **puffer** — Grumpy Spines (S N); Paddle Away (P N); Puff Up (P L; 6 Blk, Spines) [special]; Water Splash (S L; 1 Weak); Deflate (P L) [pace]. `w 30/25/20/10/15`. T1 Spotted pufferfish, Cowfish; T2 Porcupinefish, Lumpfish.
- **ambusher** — Snap at the Lure (S N); Into the Weed (P N; 4 Blk); Stir the Silt (P L; Ink) [special]; Lie in Wait (P L) [wind-up] → Ambush the Lure (S H) [heavy]; Settle in the Sand (P L) [pace]. `w 25/25/15/15/20`. T2 Catfish, Frogfish, Turbot; T3 anglers.
- **fighter** — Tail Hit (S N); Leap Out (P N; 4 Blk); Water Splash (S L, 2 hits); Shake the Hook (P L) [special]; Catch Breath (P L) [pace]. `w 30/25/10/15/20`. T1 Tench, Koi, Seabreams, Barbel; T2 Salmons, Carp, Cod, Trout.
- **giant** — Dead Weight (S N; heavy after Heave); Long Run (P N); Sound Deep (P L; Burrow) [special]; Heave (S L) [wind-up → Dead Weight]; Drift (P L) [pace]. `w 25/25/15/15/20`. Boss `seq`: Dead Weight, Long Run, Sound Deep, Heave, Dead Weight, Drift. T3 Sunfish, Sturgeons, Tuna+1, Opah…
- **eel** — Slimy Wriggle (S N, 4 hits; heavy after Coil); Hide in the Rocks (P N; 4 Blk); Coil (P L) [wind-up → Wriggle]; Slime the Line (S L; Slimy Seaweed) [special]; Rest in the Crevice (P L) [pace]. `w 30/25/15/15/15`. Boss `seq`: Wriggle, Slime, Hide, Coil, Wriggle, Crevice. T1 Ribbon eel, Lamprey, Leech; T2 Conger, Snake eel; T3 Giant moray+1.
- **armored** — Squirt (S N; 1 Weak); Bury in the Sand (P N; 8 Blk); Clamp Shut (P L; Burrow) [special]; Clamp the Fingers (S L; Pinched Hand) [special]; Rest on the Rocks (P L) [pace]. `w 25/25/15/15/20`. T1 Oyster, Clam, Mussel, Scallop…; T2 Pearl oyster, Turtle, Conch; T3 Giant clam+2.
- **jellyfish** — Wrap Around (S N); Drift Away (P N; 3 Blk); Stinging Tendrils (S L; Venom 2) [special]; Tangle the Line (P L; Tangled) [special]; Pulse (P L) [pace]. `w 25/25/15/15/20`. T1/T2 jellyfish; T3 Man o' war+1.
- **cephalopod** — Suction Grip (S N, 3 hits; heavy after Change Colour); Rock Anchor (P N); Ink Cloud (P L; 3 Blk, Ink) [special]; Venomous Bite (S L; Numb Fingers) [special]; Change Colour (P L) [wind-up → Grip]; Hover (P L) [pace]. `w 25/20/15/10/15/15`. Boss `seq`: Grip, Ink Cloud, Anchor, Bite, Change Colour, Grip, Hover. T1 Flapjack octopus; T2 Octopus, Giant octopus, Squid, Nautilus, Cuttlefish; T3 Giant squid+2.
- **clawed** — Pinch the Fingers (S N); Wedge Under a Rock (P N; 6 Blk); Raise the Claws (S L) [wind-up] → Crushing Pinch (S H) [heavy]; Kick Up Sand (P L; Pebble in the Boot) [special]; Scuttle Backwards (P L) [pace]. `w 30/25/15/15/15`. Boss `seq`: Pinch, Wedge, Kick Up Sand, Raise the Claws, Crushing Pinch, Scuttle. T1 Hermit crab, Crayfish; T2 Blue crab, Lobsters, Yeti crab…; T3 Red king crab+1. Crab pair (T2).
- **bottomDweller** — Stinky Squirt (S N); Stick to the Bottom (P N; 5 Blk); Slimy Ooze (S L; Slimy Seaweed) [special]; Stir the Silt (P L; Ink) [special]; Graze (P L; heals 5%) [pace]. `w 30/25/15/10/20`. T1 loaches, starfish, sea slugs, worms…
- **Red piranha** (own, T2) — Shred the Bait (S N, 3 hits); Strip the Hook (S L; Steal) [special]; Smell Blood (P L; +1 Str); Circle (P L) [pace]. `w 40/20/15/25`.
- **Pike** (own, T2) — Snap the Lure (S N; heavy after Lurk); Tail Hit (S L; 5 Blk); Lurk in the Reeds (P L; +1 Str, 4 Blk) [wind-up → Snap]; Grab the Bait (S L) [special]; Hold Still (P L) [pace]. `w 30/20/20/15/15`.

(+N after a name = starting Strength.)

## Bosses
Kid: Blue crab (mini, clawed), Giant octopus (boss, cephalopod). Adult: Common octopus (cephalopod), Giant moray eel (eel). Elder: Starry sturgeon (giant), Atlantic giant squid (cephalopod). Released after the fight; a boss escaping ends the run. A boss rolling 10 hits about 11 with a normal move and gains +1 Str per Wind-up.

## Tuning
Move sets → `behaviors.ts`; one creature → its own `moves` in `creatures.ts`; Will/HP/Strength → `creatures.ts`; global → `ENCOUNTER_TURN_AVERAGE`, `ENCOUNTER_GROWTH_PERCENT`, `GROUP_DAMAGE_PERCENT`, `MINI_BOSS_DAMAGE`, `BOSS_DAMAGE`, `MOVE_INTENSITY`, `WIND_UP_PERCENT`, `PACE_WILL_PERCENT`, `MAX_MOVE_STRENGTH` and the special constants in `src/engine/constants.ts`. Since moves are scaled to an average, intensities, weights, extras and order shape a creature; the constants set how hard fights are. Check with `npm run simulate`.
