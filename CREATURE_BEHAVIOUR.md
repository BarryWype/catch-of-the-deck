# Creature behaviour (Slay the Fish)

Source: `src/content/behaviors.ts` (move sets), `src/content/creatures.ts` (creatures, Pike/Red piranha own moves). Snapshot 2026-10-15.

## Rules
- Creature turn (after player's): its Block resets → Venom hits it → plays shown move (intent) → Will rises by `escapeRate` (−20%/Slow stack, −10%/Patience point, max −80%; Snared or a `skipWillRise` move = no rise). Then statuses tick, next move is picked and shown.
- Move kinds (`tag`): Strike = damage to player's Grit. Pull = raises its own Will; at `escapeAt` it escapes and the fight ends. Player's Hold soaks both, whichever comes first. Quiet kinds (never scaled): Rest 💤 (nothing, `skipWillRise`), Feed 🍤 (heals 8% max HP, `skipWillRise`), Wind-up ⚠️ (gains `windUp` status: next move's Strike/Pull ×1.5, after all scaling, rounded down, used up by that move), Guard 🛡 (Block only), Buff 💪 (Strength only).
- Extras: Block (soaks player's attack damage until its next turn), Strength (+1 dmg per hit, whole fight), Weak on player (player deals −25%), Vulnerable on player (takes +50% Strike).
- Strength from moves: only predators, Pike, Red piranha, and mini-bosses/bosses (each of their Wind-ups also gives +1). Max +3 per creature per fight (`MAX_MOVE_STRENGTH`), on top of starting Strength.
- Scaling: written numbers are relative. Each creature's Strike/Pull moves (quiet ones excluded) are scaled so they average 7.2 × (1 + 2% per fight already played). Group: total ÷ count × 1.1 each. Mini-boss: roll 9–10, boss: 10–12 (no growth). Applied after Strength/Weak/Vulnerable, rounded down, multi-hit scaled in total.
- Picking: `seq` = fixed order, loops. `w` = random by weight; `first` = forced opening; `max N` = never more than N in a row (`maxRepeat` per move).
- Player statuses on its next move (used up): Cowed ½ next move; Intimidated ½ next Strike; Lured ½ next Pull; Distracted N −N next Strike; Dazzled Strikes −50% but Will +50% (timed); Weak Strikes −25%.

## Move sets
Format: Move (kind written→1st-fight value; extras). S=Strike, P=Pull, Rest/Feed/Wind/Guard/Buff = quiet, Str=Strength on self, Blk=Block. "wound N" = value after a Wind-up.

- **reefFish** — Steal the Bait (S 5→7); Dart for Cover (P 6→8; 4 Blk); Flashy Zigzag (P 4→5; 1 Weak); Catch Breath (Rest). `w first Steal: Steal 35, Dart 25, Zigzag 15, Breath 25; max 2; Breath max 1`. T1: Clownfish, tangs, angelfish, Goldfish, gobies, barbs, Blue discus, Seahorse and other small reef fish.
- **schooling** — Nibble Frenzy (S 2×3→7); Scatter (P 6→7; 3 Blk); Regroup (Rest; 3 Blk). `seq Frenzy, Scatter, Regroup`. T1: Progenetica, Flying fish, Guppy, tetras, Zebrafish, Pilchard, Herring, Anchovy, Shrimp. Pilchard shoal (T2) = 3 Pilchards.
- **predator** — Jolt the Rod (S 7→5; 1 Vuln); Size Up the Lure (Wind); Head Shake (S 11→8, wound 13); Screaming Run (P 9→7; +1 Str). `seq Jolt, Size Up, Head Shake, Run`. T1 Fighting fish, Perch, Garfish, Senegal bichir, Trumpetfish, Oscar; T2 Mahi mahi, Hake, Longnose gar, Saddled bichir, Seabass, Arowana; T3 Taimen, Barracuda+1, Striped marlin+1, Swordfish+2, Mako+2.
- **venomous** — Spiny Flick (S 5→5; 1 Weak); Lie Still (Rest); Dive for the Rocks (P 6→6; 6 Blk); Bristle (Guard; 6 Blk); Prickly Thrash (S 9→9; 1 Vuln). `seq Flick, Lie Still, Dive, Bristle, Thrash, Lie Still`. T1 Weever, Sea urchin, Blue sea dragon, Fireworm; T2 Lionfish, Red scorpionfish, Cone snail; T3 Stonefish+1, Stingray.
- **puffer** — Puff Up (P 5→6; 8 Blk); Grumpy Spines (S 7→9); Deflate (Rest); Water Splash (S 4→5; 1 Weak). `seq Puff Up, Spines, Deflate, Splash`. T1 Spotted pufferfish, Cowfish; T2 Porcupinefish, Lumpfish.
- **ambusher** — Into the Weed (P 8→5; 4 Blk); Lie in Wait (Wind); Ambush the Lure (S 14→9, wound 13). `seq Weed, Lie in Wait, Ambush`. T2 Catfish, Frogfish, Turbot; T3 European angler, Humpback anglerfish.
- **fighter** — Tail Hit (S 8→7); Leap Out (P 8→7; 4 Blk); Water Splash (S 4×2→7); Catch Breath (Rest). `w Tail 30, Leap 25, Splash 20, Breath 25; max 1`. T1 Tench, Koi, Seabreams, Barbel, Hogfish; T2 Salmons, Masu, Carp, Cod, Trout.
- **giant** — Sound Deep (P 12→7; 6 Blk); Drift (Rest); Heave (Wind); Dead Weight (S 15→8, wound 13); Boring Fight (S 10→5; 1 Weak). `seq Sound Deep, Drift, Heave, Dead Weight, Boring Fight, Drift`. T3 Sunfish, Sturgeons, Bluefin tuna+1, Opah, Oarfish, Coelacanth, Humphead wrasse, Arapaima.
- **eel** — Slimy Wriggle (S 4×2→8, wound 12); Hide in the Rocks (P 6→6; 4 Blk); Coil (Wind). `seq Wriggle, Hide, Coil, Wriggle`. T1 Ribbon eel, Lamprey, Leech; T2 Conger, Snake eel; T3 Giant moray+1.
- **armored** — Bury in the Sand (P 5→7; 10 Blk); Rest on the Rocks (Rest); Clamp the Fingers (S 6→9); Squirt (S 3→4; 1 Weak). `seq Bury, Rest, Clamp, Squirt`. T1 Oyster, Clam, Mussel, Scallop, Cockle, Barnacle; T2 Pearl oyster, Sea turtle, Conch; T3 Giant clam+2.
- **jellyfish** — Stinging Tendrils (S 4→6; 1 Vuln); Drift Away (P 6→9; 3 Blk); Tangle the Line (P 4→6; 1 Weak); Pulse (Rest). `w first Tendrils: Tendrils 35, Drift 20, Tangle 15, Pulse 30; max 1`. T1 Med. jelly, Common jellyfish, Sea butterfly; T2 Nomad, Flame jellyfish; T3 Man o' war+1.
- **cephalopod** — Ink Cloud (P 5→4; 2 Weak, 3 Blk); Suction Grip (S 3×3→8); Change Colour (Wind); Rock Anchor (P 9→8, wound 12). `seq Ink, Grip, Change Colour, Anchor`. T1 Flapjack octopus; T2 Octopus, Squid, Nautilus, Cuttlefish; T3 Giant squid+2.
- **clawed** — Pinch the Fingers (S 7→8, wound 12); Wedge Under a Rock (P 6→7; 6 Blk); Raise the Claws (Wind); Scuttle Backwards (P 5→6); Catch Breath (Rest). `seq Pinch, Wedge, Raise the Claws, Pinch, Scuttle, Breath`. T1 Hermit crab, Crayfish; T2 Blue crab, Yeti crab, Horseshoe crab, Lobsters, Giant isopod; T3 Red king crab+1. Crab pair (T2) = Hermit crab + Crayfish.
- **bottomDweller** — Slimy Ooze (S 2→3; 1 Weak); Stinky Squirt (S 5→8); Stick to the Bottom (P 6→9; 5 Blk); Graze (Feed). `w Squirt 30, Stick 25, Ooze 15, Graze 30; max 1`. T1 loaches, starfish, Sponge, Axolotl, Sea cucumber, sea slugs, Spoon worm, Planaria.
- **Red piranha** (own, T2) — Shred the Bait (S 3×3→7); Circle (Rest); Smell Blood (Buff; +1 Str). `seq Shred, Circle, Smell Blood, Shred`.
- **Pike** (own, T2) — Snap the Lure (S 11→8, wound 13); Tail Hit (S 7→5, wound 8; 5 Blk); Lurk in the Reeds (Wind; +1 Str, 4 Blk). `w first Snap: Lurk 40, Tail 30, Snap 30; max 1`.

(+N after a name = starting Strength.)

## Bosses
Kid: Blue crab (mini), Common lobster (boss), both clawed. Adult: Common octopus (cephalopod), Giant moray eel (eel). Elder: Starry sturgeon (giant), Atlantic giant squid (cephalopod). Released after the fight; a boss escaping ends the run. Their Wind-ups also give +1 Str (max +3). E.g. a lobster rolling 11: scale 11/6 ≈ 1.83, so Pinch 12, Wedge 11, Scuttle 9; Raise the Claws gives +1 Str, so the next Pinch is (7+1) × 1.83 × 1.5 = 22.

## Tuning
Temperament → `behaviors.ts`; one creature → its own `moves` in `creatures.ts`; Will/HP/Strength → `creatures.ts`; global damage → `ENCOUNTER_DAMAGE`, `ENCOUNTER_GROWTH_PERCENT`, `GROUP_DAMAGE_PERCENT`, `MINI_BOSS_DAMAGE`, `BOSS_DAMAGE`, `WIND_UP_PERCENT`, `MAX_MOVE_STRENGTH` in `src/engine/constants.ts`. Since Strikes and Pulls are scaled to an average, only ratios between them, quiet turns, extras, order and Will numbers change a creature. Check with `npm run simulate`.
