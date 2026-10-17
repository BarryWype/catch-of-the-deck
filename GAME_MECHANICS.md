# How Slay the Fish works

A plain-language guide to the rules. For how the code is built, see [ARCHITECTURE.md](ARCHITECTURE.md).

## The idea

You're an angler setting off from your grandparents' house on the coast. Each run, you fish your way along the shore, through fights with creatures, toward a **boss** at the lighthouse. Creatures you catch go into your **bucket**, and if you make it home, they join your **home aquarium** for good.

## A fight in one minute

Each turn you get **3 energy** and draw **5 cards**. Cards cost energy to play. When you're done, click **End Turn**: the creatures then act, and a new turn starts.

You win a fight by catching every creature. A creature is caught when **either**:

- its **health** reaches 0 (you've worn it out), **or**
- its **Will** bar is drained all the way down to 0 (it's given up, and you reel it in).

You lose a creature if its Will bar fills up: it gets away.

You lose the whole run if your **Grit** runs out.

## Your side

### Grit

Grit is your will to keep fishing: your health, in effect. You start with **60**. Creatures' **Strikes** wear it down. It carries over from fight to fight, so a draining fight early on makes the next ones harder. Some events, the shop and a few companions let you recover Grit.

If Grit reaches 0, you give up: the run is over, and **everything in your bucket is lost**, including the creatures you brought from home.

### Hold

Hold is your grip on the line: your defence. You get it from Defense cards like **Hold Tight** (in every starter deck). It shows as ✊ next to your Grit bar.

Hold soaks up **both** kinds of creature moves (see Strike and Pull below), in the order the creatures act. Whatever gets past your Hold lands.

Hold lasts until the creatures have acted, then it's gone, unless it turns into Patience (below).

### Cards

There are five kinds of card:

| Kind | What it does |
|---|---|
| **Attack** (red) | Damages a creature's **health**. |
| **Drain** (teal) | Drains a creature's **Will**. |
| **Defense** (blue) | Gives you **Hold**. |
| **Support** (purple) | Slows, weakens or tricks creatures, or helps you. |
| **Power** (gold) | Lasts the rest of the fight once played; an icon under your Grit bar shows it. |

Attack and Drain cards count as **attacks** (for "if you haven't played an attack this turn"). Drag them onto the creature you want; the others are dragged anywhere on the battlefield, and the ones that affect a creature pick one at random. Some cards also cost **Patience** (⏳) on top of energy.

### Patience

Patience is what you earn by waiting calmly instead of rushing. You get Patience points at the end of each turn:

- **1 point per energy you didn't spend**, and
- **1 point for every 3 Hold left over** after the creatures have acted (the Hold you didn't need).

You can have up to **5** points, and they last for the whole fight. Each point makes every creature's Will rise **10% slower**, so 5 points halve it (on top of any Slow). Some cards also cost Patience to play, on top of energy (shown as ⏳ on the card).

## The creatures' side

### Health

The red bar under a creature. Your attacks bring it down; at 0, the creature is caught.

The creatures of a fight have **at least 50 Health together**. Smaller ones get more to reach it; bigger ones keep their own. That pool grows **2% for every fight you've already had this run**: by your 8th fight it's 50 × 1.14 = 57.

### Will

The other bar under a creature: its will to break free. It:

- **starts part way up** when the fight begins,
- **rises a little every turn** by itself (shown as "+N/turn", slowed by your Patience),
- **jumps up** when the creature **Pulls** and gets past your Hold.

If it fills up, the creature escapes. If you Drain it down to 0, you catch it.

### Keywords

| Keyword | What it does |
|---|---|
| **Drain** | Lowers a creature's Will by a flat amount. "Drain 10" takes 10 off its Will bar. |
| **Slow** | A creature's stacks of Slow make its Will rise **20% slower each**, and one stack wears off at the end of each of its turns. With 2 Slow, a +10 a turn becomes +6, then +8 the turn after. It adds up with your Patience, but a creature's Will can only be slowed **80%** at most (some cards raise that to 90% for the fight). |
| **Venom** | At the start of its bearer's turn, it deals as much damage as it has charges (Hold doesn't stop it), then loses one charge. 3 Venom deals 3, then 2, then 1. |

### Strike and Pull

Above each creature you can see what it will do next (its **intent**), tagged **STRIKE** or **PULL**:

| | What it does | What stops it |
|---|---|---|
| **Strike** 🗡️ | Wears down your **Grit** (a tail hit, pinched fingers, a stinky squirt…) | Your Hold soaks it first; the rest comes off your Grit |
| **Pull** 🎣 | Drags on the line to get away (a run, a dive, wedging under a rock…) | Your Hold soaks it first; the rest raises its Will |

How hard a creature hits depends on the fight, not just on the creature. Each of its moves is **light**, **normal** or **heavy** (×0.5, ×1, ×1.4), and the fight sizes them so the creature deals **5.5 per turn on average** (Strike or Pull, light turns included), growing 2% per fight like Health. In a group, each creature gets its share of that plus 10%: two creatures average 5.5 ÷ 2 × 1.1 ≈ 3 each. A **mini-boss** averages 9–10 per turn and a **boss** 10–12 (rolled each fight).

So Hold always helps: against a Strike it protects you, against a Pull it keeps the creature on the line. Plan your Hold around what's coming. Some moves also do something extra, like weakening you or making the creature tougher.

The bars show what's coming. The part of your Grit a Strike will take after your Hold is greyed red, and the Will a Pull will add is striped. While you drag or select a card, each bar it changes shows the result too: the Health or Will it takes (after Block, Vulnerable, Weak and every other modifier) is greyed red, and the creatures' moves update to match (drag a Hold card to see how much of the hit it will soak). Random effects only show once they're played.

### What a creature's turn can be

The icon above a creature tells you what kind of move is coming:

| Intent | What it does |
|---|---|
| **Pace** 💤 | A light move: its Will rises **half as much** that turn. A breather for you. |
| **Wind-up** ⚠️ | A light move, but its **next** move is its **heavy** one, 30% bigger on top (the intent shows the real number). Get your Hold ready. |
| **Heavy** 💥 | Its big move. It only ever comes right after a Wind-up. |
| **Special** | A light move with a trick (below). About a quarter of creatures' turns. Never two in a row. |
| **?** | Hidden by Ink: you can't see what it will do. |

### Specials

| Special | What it does to you |
|---|---|
| **Ink** 🦑 | Its next move is hidden ("?"). Never right before a Wind-up, so a heavy move is always announced. |
| **Pebble in the Boot** 🗑️ | A junk card in your discard pile: it can't be played. |
| **Slimy Seaweed** 🗑️ | Junk: costs 1 energy to get rid of (for this fight). Still in your hand at the end of your turn? Lose 2 Grit. |
| **Tangled Line** 🗑️ | Junk: costs 1 energy to get rid of. While it's in your hand, your Hold cards give 1 less. |
| **Tangled** 🪢 | Next turn, your Drain cards cost 1 more. |
| **Numb Fingers** 🥶 | Next turn, your Attack cards cost 1 more. |
| **Pinched Hand** 🤏 | Next turn, your Hold cards give 2 less. |
| **Venom** ☠️ | Same as on creatures: at the start of your turn, lose Grit equal to your Venom, then 1 Venom wears off. |
| **Steal the Bait** 🫳 | You lose 1 Patience. |
| **Skittish** 😬 | Next turn, if you play 3 cards or more, its Will rises by 6. |
| **Spines** 🦔 | For 2 turns, each hit of your attacks costs you 1 Grit. |
| **Burrow** 🕳️ | Until its next turn, your attacks deal 50% less (Drain works normally). |
| **Grab the Bait** 🎣 | Next turn, after you draw, you drop a random card. |
| **Shake the Hook** 🪝 | A light Pull, but heavy if you have no Hold when it lands. |

A creature can't put more than 3 junk cards in your deck at once, and they're all gone when the fight ends.

**Second Wind** 🌬️: mini-bosses and bosses only, once per fight. When their Health or Will drops below 25%, they show Second Wind as their next move, then move 15 points from their fuller bar into the low one (more in tougher fights).

**Strength** (+1 damage per hit, for the whole fight) is rare: only predators (Pike, Red piranha and the like) and mini-bosses and bosses gain it from their moves. Mini-bosses and bosses gain 1 with every Wind-up. A creature can gain **3 at most** in a fight, on top of the Strength some big creatures start with.

## Aging: Kid, Adult and Elder

A run has three acts, and you grow older from one to the next:

1. **Kid** fishes the shore: rock pools, beaches, creeks, ponds.
2. **Adult** goes further: kayaking in the harbour, the kelp and the reef near the shore.
3. **Elder** takes the boat out to sea: underwater cliffs, shipwrecks and the deep.

The same coast is used for all three ages of a run, but the creatures get bigger and tougher each age. The same rocks hold small fry as a kid and much bigger catches as an elder.

Each age's map runs from the house to a **mini-boss** halfway, then on to the **boss**. Beat the boss and you move on to the next age, keeping your Grit, deck, bucket and coins. On top of its card reward, a boss lets you **remove a card** from your deck for free, or **end the run** there and head home. Bosses and mini-bosses are always let go after the fight (too big, too fierce or protected), so they never go in your bucket.

The coast changes every run: beaches, ponds, harbours and rocks land in different places, and they decide which creatures you meet where.

## Retiring: how a run ends

| How it ends | What happens to your bucket |
|---|---|
| You beat the Elder's boss: a full fishing life | Everything comes home to your aquarium |
| You **head home** (⌂): the dead-end node right after each mini-boss | Everything comes home: a safe, early retirement |
| You **end the run** on the card reward after a Kid or Adult boss | Everything comes home, as when you head home |
| A **boss** gets away | Your bucket stays behind |
| Your **Grit** runs out | Your bucket is lost, including the creatures you brought |

Heading home is the safe choice: you stop while you're ahead and keep everything you've caught.

## Between fights

- **Card rewards:** after a win, pick one of three cards to add to your deck. They come from the **families** of the creatures you just beat (Venom, Shell, Hunter…), and from the first mini-boss on, each one has a 10% chance to be **rare**, rising by 2% for every card that wasn't (before it, rewards are never rare). The mini-boss's own reward always has at least one rare card. You have to take one, but you can **reroll** for three other cards: you start a run with 1 reroll and get 1 more for every mini-boss and boss you beat, and unused ones carry over. The screen shows which families the cards come from, and each card's family above it. Eel companions can let you skip a few times per age, and with 3 species add a few rerolls per age (used first, since they don't carry over).
- **Events** (?): something happens: a choice, a find, sometimes a surprise fight.
- **Shops** ($): spend coins on a thermos of hot chocolate (recovers Grit) or on removing a card from your deck. Sell creatures from your bucket to afford them. A few of them stand where an event might have been on the map.
- **Treasure** (T): a free find before the boss.

## Your bucket

- **It holds 7 creatures,** the companions you brought included (bring 3 and there's room for 4 catches). The count shows on it.
- **When a fight's catches don't fit,** you choose for each one before the card reward: sell a creature from your bucket to keep the new catch, or sell the new catch. Selling a companion ends its bonus. Sales get your companions' sell bonuses, as usual. A big group can overflow by more than one: you choose for each in turn.
- **Sizes:** every catch is small, normal, large or a trophy. On your first fight it's 30% small, 50% normal, 17% large and 3% trophy; every fight played this run makes small rarer and large and trophy more likely, until small is only 5%. Draining a creature's Will lands a bigger one than wearing its Health down (it rolls twice and keeps the bigger). Size shows in your bucket and aquarium and goes in the creature book; it does nothing else yet.

## Home

- **Home aquarium:** creatures you bring home live here between runs.
- **Bringing companions:** before a run you can bring up to 3 creatures. Each kind of temperament gives a bonus for the run. They ride in your bucket, so they take up room in it.
- **Stars:** each companion gives stars: 1 to 3 for how deep it lives (its tier), +1 at bond level 2 and +1 more at level 3, so 1★ to 5★. The stars of companions of the same kind add up, each species once (two Clownfish count once, the one with more stars), and more stars make the bonus stronger, up to its 8★ value. Bringing 3 different species of the same kind also adds its **full school** bonus. The companions screen shows each one's stars, each kind's total and bonus, and what the next stars would add.
- **Bond:** companions grow closer with every fight they share with you: 1 point a fight as a Kid, 2 as an Adult, 3 as an Elder, and double against a mini-boss or boss. A creature is fully bonded at 40 points (shallow-water creatures), 60 or 90 (the deepest); levels come at 20%, 50% and 100%. They keep that bond only if the run succeeds. Creatures resting at home bond slowly too (+2 a run, up to level 1), and hatchlings start at level 1. A companion that reaches a new level mid-run gives its extra star from the next fight.
- **Creature book** (📖): every creature, grouped by kind (reef fish, predators…), each kind folded under its name; click a kind to open it and see the bonus it gives as a companion (at 1★ and with a full school) and its creatures. It shows every creature you've met, seen or captured, with the biggest one of each species you've ever caught: S (small), M (normal), L (large) or 🏆 (trophy).
- **Eggs:** two of the same creature at home may lay an egg after a run. Click it to hatch.
