# Card rework

Replacing every card with the new set (66 cards). This file keeps the decisions taken and tracks the
work, step by step: each step is checked (tests, typecheck, and in the game where it shows) before the
next one starts.

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Starter deck | Same for every fishing style: 4 Tug, 4 Hold Tight, 1 Steady Hand, 1 Reel In. |
| 2 | "Strong against" / Effective | Ignored for now (no new card has a type bonus); to be re-added later. |
| 3 | Card rewards | The 3 choices come from the families of the creatures in the fight just won, topped up from all families if there aren't enough. Each slot is rare with a 10% chance, +2% for every slot that wasn't rare, back to 10% when a rare appears (kept for the run). |
| 4 | Tags | Stored on the cards for later; not shown. |
| 5 | Slow | Stacks; each stack slows the Will's own rise by 20% (80% at most). It wears off by 1 each turn. |
| 6 | Shell Up | Its Hold doesn't vanish at the start of your next turn. |
| 7 | "Attack" in rules | Attack and Drain cards (e.g. "if you haven't played an attack this turn", companion "first attack" bonuses). |
| 8 | Rounding | Round down. |
| 9 | Unclear targets | Random creature, worded to say so: Old as the River, Bait Ball, Perfect Disguise, Dead Weight, Pain Comes with the Tide, and Defense/Support cards that affect a creature (Sticky Slime, Lie Low, Shadow the Fish, Bare Teeth, Numbing Sting…). Attack and Drain cards are dragged onto their target. |
| 10 | Coiled | The next Attack or Drain card this turn has its numbers doubled. |
| 11 | Toxic Dread +3, Toxic Coating Venom 2 | Per hit. |
| 12 | Envenomed Hooks | A Drain counts as a hit. Damage over time (Venom) isn't a hit. Effects never re-trigger themselves (no loops). |
| 13 | Old as the River | Paying a card's Patience cost is spending; losing Patience (Be Prepared) isn't. |
| 14 | Tire Out | Snared for 2 turns (stops the Will's own rise; Pulls still count). |
| 15 | Dazzle | Only the Will's own rise is 50% faster, not Pulls; applied after Slow and Patience. |
| 16 | Glitter Burst | The next move becomes a random move of the other tag (Strike → one of its Pulls, Pull → one of its Strikes). |
| 17 | Shadow the Fish | Gain Hold equal to the next move's Strike damage or Pull amount, 12 at most; 0 for any other move. |
| 18 | Colour Shift | A different move when the creature has one. |
| 19 | Turn the Tables | A creature at full health ends at full Will and flees: intended. |
| 20 | Venom | Always loses a charge after dealing its damage each turn, unless a card says otherwise. Stings and Spines: same. |
| 21 | Severe Bite | Half the health actually lost (after the creature's Block); nothing if it's already caught. |
| 22 | Next-move effects | Menacing Presence, Bare Teeth, Spinner Lure, Flash of Colour affect the next move once; a multi-hit Strike is reduced in total. |
| — | Powers | Once played, out for the rest of the fight, their effect lasting the whole fight. No other card exhausts. |
| — | Healing, Will | Healing never goes above max health. Gaining Will can make a creature flee. |
| — | Art, French | Placeholder emoji art, and French names drafted for review. |

## Steps

- [x] 1. Card model: types (Attack, Defense, Drain, Support, Power), rarities (starter, normal, rare), `tags`, `family`. The cards the engine can already play, the starter deck, the old cards removed. *(Done: 26 cards; a `random` card target; tested in the engine. In-game check pending: the dev server wasn't running.)*
- [x] 2. Slow wears off by 1 each turn. *(Done: at the end of the creature's turn, after slowing that turn's rise; tested.)*
- [x] 3. Card rewards by family, with the rare pity. *(Done: `fightFamilies` + `rollCardRewards({ families })`; the pity and the families are kept in the run (saves upgraded); an event's card reward draws from every family; tested.)*
- [x] 4. Patience and healing effects: Still as a Stone, Dangling Lure, Tickle (Let It Run comes with step 8). *(Done: `gainPatience` and `heal` effects; tested in tests/cards.test.ts.)*
- [x] 5. Scaling with statuses: Seize the Lull, Wear Them Out, Bogged Down (Toxic Dread's doubling comes with the card, step 9). *(Done: `perStatus` on damage and Drain, `multiplyStatus`; tested.)*
- [x] 6. Hold effects: From Nowhere, Be Prepared, Shell Up. *(Done: `fromHold`, `loseHold`, `patienceToHold`, `keepHold`; tested.)*
- [x] 7. Delayed effects: Mussel Bait, Thick Shell, Call a Mate, Weather the Storm, Severe Bite. *(Done: `delayed` and `echoDamage`, run at the start of your turn after the Hold reset, on the same target; tested.)*
- [x] 8. Intent conditions and next-move effects: Duck and Jab, Let It Run, Adaptation, Menacing Presence, Bare Teeth, Spinner Lure, Flash of Colour, Dazzle, Glitter Burst, Colour Shift, Shadow the Fish. *(Done: `ifIntent`, `flipIntent`, `rerollIntent`, `holdFromIntent`; next-move statuses Cowed, Intimidated, Lured, Distracted, Dazzled, used up by the move they change (`nextMoveMods`), shown in the intent preview; tested.)*
- [x] 9. This-turn effects and "no attack this turn": Coiled, Toxic Dread (+3), Toxic Coating, Lie Low, Unseen Approach. *(Done: `coil`, `venomBonus`, `venomCoating`, `ifNoAttack` (counts attacks before the card); this-turn effects cleared at the start of your turn; tested.)*
- [x] 10. Venom and Will effects: Pain Comes with the Tide, Turn the Tables. *(Done: `venomNow`, `swapHealthAndWill`; tested.)*
- [x] 11. Powers: Hard Shell, Stings and Spines, Envenomed Hooks, Push the Limits, Old as the River, Bait Ball, Dead Weight, Gooey Mess, Perfect Disguise. *(Done: `power` effect, `CombatState.powers` (copies add up); Powers' own damage and Drains (Old as the River, Bait Ball) don't count as card hits, so nothing triggers itself; tested.)*
- [ ] 12. French names, docs (GAME_MECHANICS.md, ARCHITECTURE.md, README), final check in the game. *(French names and docs done. The in-game check is pending: the dev server isn't running.)*

## The cards

| Name | Type | Energy | Patience | Effect | Family | Tags | Rarity |
|---|---|---|---|---|---|---|---|
| Tug | Attack | 1 | 0 | Deal 5 damage. | starter | damage | normal |
| Hold Tight | Defense | 1 | 0 | Gain 5 Hold. | starter | hold | normal |
| Steady Hand | Attack | 1 | 2 | Deal 10 damage. | starter | damage, patience | normal |
| Reel In | Drain | 1 | 0 | Drain 7. | starter | drain | normal |
| Shell Up | Defense | 1 | 0 | Gain 6 Hold. It stays until your next turn. | Shell | hold | normal |
| Mussel Bait | Drain | 2 | 0 | Drain 6 at the start of each of your next 3 turns. | Endurance | drain, delayed | normal |
| Thick Shell | Defense | 1 | 1 | Gain 4 Hold now and at the start of your next 2 turns. | Shell | hold, patience, delayed | normal |
| Sticky Slime | Defense | 1 | 0 | Gain 4 Hold. Apply Slow 3. | Slimy | hold, slow | normal |
| Hard Shell | Power | 2 | 0 | Hold no longer disappears between turns. Leftover Hold no longer turns into Patience. | Shell | hold | rare |
| Sting | Attack | 1 | 0 | Deal 2 damage. Apply Venom 3. | Venom | damage, venom | normal |
| Stings and Spines | Power | 2 | 0 | Venom drains twice its value from Will instead of dealing damage. | Venom | venom, drain | rare |
| Pain Comes with the Tide | Support | 1 | 1 | Venom deals its damage now, without going down. | Venom | venom, patience | normal |
| Numbing Sting | Support | 1 | 0 | Apply Venom 2 and Slow 2. | Venom | venom, slow | normal |
| Envenomed Hooks | Power | 1 | 0 | Whenever a card deals damage or drains, apply 1 Venom per hit. | Venom | venom | rare |
| Toxic Dread | Support | 2 | 0 | Double the creature's Venom (+10 at most). Your attacks deal +3 to Venomed creatures this turn. | Venom | venom | rare |
| Coiled | Support | 1 | 0 | Your next attack or Drain card this turn has double effect. | Hunter | damage, drain | normal |
| Right Timing | Attack | 1 | 2 | Deal 7 damage. Drain 7. | Hunter | damage, drain, patience | normal |
| Seize the Lull | Attack | 1 | 0 | Deal 6 damage, +2 for each Slow on the creature. | Hunter | damage, slow | normal |
| Menacing Presence | Support | 0 | 2 | The next Strike or Pull of every creature is halved. | Trickster | intent, patience | normal |
| Severe Bite | Attack | 2 | 0 | Deal 8 damage. At the start of your next turn, deal half the damage dealt again. | Hunter | damage, delayed | rare |
| Darting Nips | Attack | 1 | 0 | Deal 2 damage 4 times to random creatures. | Swift | damage, multihit | normal |
| Mirror Image | Defense | 1 | 0 | Gain 5 Hold. Draw 1 card. | Swift | hold, draw | normal |
| Call a Mate | Defense | 0 | 2 | Next turn, gain 8 Hold. | Swift | hold, patience, delayed | normal |
| Push the Limits | Power | 1 | 0 | Slow on creatures no longer goes down. | Slimy | slow | rare |
| Tire Out | Support | 2 | 0 | Will doesn't rise on its own for 2 turns (Pulls still count). | Endurance | slow | rare |
| Wear Down | Drain | 2 | 0 | Drain 15. | Endurance | drain | normal |
| Weather the Storm | Defense | 0 | 4 | Gain 10 Hold now and 10 next turn. | Shell | hold, patience, delayed | normal |
| Wear Them Out | Drain | 1 | 0 | Drain 3 for each Slow on the creature. | Endurance | drain, slow | normal |
| Heavy Line | Drain | 1 | 0 | Drain 5. Apply Slow 2. | Endurance | drain, slow | normal |
| Be Prepared | Defense | 1 | 0 | Lose all your Patience. Gain 4 Hold per Patience lost. | Patient | hold, patience | normal |
| Cheap Shot | Attack | 0 | 0 | Deal 5 damage. The creature gains 5 Will. | Trickster | damage, tradeoff | normal |
| Tickle | Drain | 0 | 0 | Drain 10. The creature heals 6. | Trickster | drain, tradeoff | normal |
| Duck and Jab | Attack | 1 | 0 | If the creature is about to Strike, deal 12 damage and it gains 6 Will. Otherwise, deal 4 damage. | Trickster | damage, tradeoff, intent, conditional | normal |
| Bogged Down | Support | 0 | 0 | Double the creature's Slow. It gains 5 Will. | Trickster | slow, tradeoff | normal |
| Let It Run | Drain | 1 | 0 | If the creature is about to Pull, Drain 14 and it heals 6. Otherwise, Drain 5. | Trickster | drain, tradeoff, intent, conditional | normal |
| Turn the Tables | Support | 2 | 0 | Swap the creature's health % and Will %. | Trickster | tradeoff | rare |
| Dazzle | Support | 1 | 0 | For 2 turns, the creature's Strikes deal 50% less, but its Will rises 50% faster. | Flashy | intent, tradeoff | normal |
| Spinner Lure | Drain | 1 | 0 | Drain 6. If the creature's next move is a Pull, it's halved. | Flashy | drain, intent | normal |
| Flash of Colour | Support | 0 | 0 | The creature's next Strike deals 4 less. Draw 1 card. | Flashy | intent, draw | normal |
| Glitter Burst | Support | 1 | 0 | Change the creature's next move from a Strike to a Pull, or the other way round. | Flashy | intent | rare |
| Adaptation | Attack | 1 | 0 | Strike coming: deal 10 damage, +10 Will. Pull coming: Drain 10, heal 10. | Flashy | damage, drain, tradeoff, intent, conditional | rare |
| Still as a Stone | Defense | 1 | 0 | Gain 6 Hold. Gain 1 Patience. | Patient | hold, patience | normal |
| Dangling Lure | Support | 1 | 0 | Apply Slow 4. Gain 1 Patience. | Patient | slow, patience | normal |
| Sudden Gulp | Attack | 1 | 2 | Deal 14 damage. | Patient | damage, patience | normal |
| Old as the River | Power | 2 | 0 | Whenever you spend Patience, deal 3 damage per point spent. | Patient | damage, patience | rare |
| Colour Shift | Support | 0 | 0 | Reroll the creature's next move. | Flashy | intent | normal |
| Lie Low | Defense | 1 | 0 | Gain 6 Hold. If you haven't played an attack this turn, apply Slow 2. | Camo | hold, slow, conditional | normal |
| From Nowhere | Attack | 1 | 1 | Deal damage equal to your Hold, then lose half your Hold. | Camo | damage, hold, patience | normal |
| Unseen Approach | Drain | 0 | 0 | Drain 5. If you haven't played an attack this turn, Drain 10 instead. | Camo | drain, conditional | normal |
| Shadow the Fish | Defense | 1 | 0 | Gain Hold equal to the value of the creature's next move (up to 12). | Camo | hold, intent | normal |
| Perfect Disguise | Power | 2 | 0 | At the end of your turn, if you didn't play an attack, gain 6 Hold and apply Slow 1. | Camo | hold, slow, conditional | rare |
| Darting Bites | Attack | 1 | 0 | Deal 2 damage 3 times. Draw 1 card. | Swift | damage, multihit, draw | normal |
| Quick Flick | Attack | 0 | 0 | Deal 3 damage. Draw 1 card. | Swift | damage, draw | normal |
| Safety in Numbers | Defense | 1 | 0 | Gain 4 Hold. Draw 2 cards. | Swift | hold, draw | normal |
| Bait Ball | Power | 1 | 0 | Whenever you play a 0-cost card, Drain 3. | Swift | drain | rare |
| Slime Coat | Support | 1 | 0 | Apply Slow 5. | Slimy | slow | normal |
| Sticky Snare | Attack | 1 | 0 | Deal 4 damage. Drain 5. | Slimy | damage, drain | normal |
| Dead Weight | Power | 1 | 0 | At the start of each creature turn, apply Slow 1. | Slimy | slow | rare |
| Slow Squeeze | Drain | 1 | 1 | Drain 12. | Endurance | drain, patience | normal |
| Gooey Mess | Power | 2 | 0 | Every Pull against you loses 3 before it reaches your Hold. | Slimy | hold, intent | rare |
| Venom Barb | Attack | 1 | 0 | Deal 6 damage. Apply Venom 2. | Venom | damage, venom | normal |
| Bare Teeth | Defense | 1 | 0 | The creature's next Strike deals 50% less. Gain 3 Hold. | Shell | hold, intent | normal |
| Savage Bite | Attack | 1 | 0 | Deal 10 damage. The creature gains 6 Will. | Hunter | damage, tradeoff | normal |
| Lunge | Attack | 1 | 2 | Deal 8 damage. Apply Venom 3. | Venom | damage, venom, patience | normal |
| Toxic Coating | Support | 1 | 0 | For the rest of this turn, your attacks also apply Venom 2. | Venom | venom | rare |
