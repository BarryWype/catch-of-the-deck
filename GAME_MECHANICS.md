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
| **Power** (gold) | Lasts the rest of the fight once played. |

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

How hard a creature hits depends on the fight, not just on the creature. Its moves keep their differences, but they **average 7.2** (Strike or Pull), growing 2% per fight like Health. In a group, each creature gets its share of that plus 10%: two creatures average 7.2 ÷ 2 × 1.1 ≈ 4 each. A **mini-boss** averages 9–10 and a **boss** 10–12 (rolled each fight).

So Hold always helps: against a Strike it protects you, against a Pull it keeps the creature on the line. Plan your Hold around what's coming. Some moves also do something extra, like weakening you or making the creature tougher.

Not every turn is a Strike or a Pull. Creatures also have **quiet turns**, a chance to attack freely:

| Intent | What it does |
|---|---|
| **Rest** 💤 | Nothing. Its Will doesn't rise this turn. |
| **Feed** 🍤 | It heals 8% of its Health. Its Will doesn't rise this turn. |
| **Wind-up** ⚠️ | Nothing now, but its **next** move is 50% bigger (the intent shows the bigger number). Get your Hold ready. |
| **Guard** 🛡 | It gains Block only. |

Quiet turns don't count when a fight's damage is set, so they're real breathing room: the other moves don't get bigger to make up for them.

**Strength** (+1 damage per hit, for the whole fight) is rare: only predators (Pike, Red piranha and the like) and mini-bosses and bosses gain it from their moves. Mini-bosses and bosses gain 1 with every Wind-up. A creature can gain **3 at most** in a fight, on top of the Strength some big creatures start with.

## Aging: Kid, Adult and Elder

A run has three acts, and you grow older from one to the next:

1. **Kid** fishes the shore: rock pools, beaches, creeks, ponds.
2. **Adult** goes further: kayaking in the harbour, the kelp and the reef near the shore.
3. **Elder** takes the boat out to sea: underwater cliffs, shipwrecks and the deep.

The same coast is used for all three ages of a run, but the creatures get bigger and tougher each age. The same rocks hold small fry as a kid and much bigger catches as an elder.

Each age's map runs from the house to a **mini-boss** halfway, then on to the **boss**. Beat the boss and you move on to the next age, keeping your Grit, deck, bucket and coins. Bosses and mini-bosses are always let go after the fight (too big, too fierce or protected), so they never go in your bucket.

The coast changes every run: beaches, ponds, harbours and rocks land in different places, and they decide which creatures you meet where.

## Retiring: how a run ends

| How it ends | What happens to your bucket |
|---|---|
| You beat the Elder's boss: a full fishing life | Everything comes home to your aquarium |
| You **head home** (⌂): the dead-end node right after each mini-boss | Everything comes home: a safe, early retirement |
| A **boss** gets away | Your bucket stays behind |
| Your **Grit** runs out | Your bucket is lost, including the creatures you brought |

Heading home is the safe choice: you stop while you're ahead and keep everything you've caught.

## Between fights

- **Card rewards:** after a win, pick one of three cards to add to your deck. They come from the **families** of the creatures you just beat (Venom, Shell, Hunter…), and from the first mini-boss on, each one has a 10% chance to be **rare**, rising by 2% for every card that wasn't (before it, rewards are never rare). You have to take one (Eel companions can let you skip or reroll a few times per age).
- **Events** (?): something happens: a choice, a find, sometimes a surprise fight.
- **Shops** ($): spend coins on a thermos of hot chocolate (recovers Grit) or on removing a card from your deck. Sell creatures from your bucket to afford them.
- **Treasure** (T): a free find before the boss.

## Home

- **Home aquarium:** creatures you bring home live here between runs.
- **Bringing companions:** before a run you can bring up to 3 creatures. Each kind of temperament gives a bonus for the run, and more species of the same kind give a bigger bonus.
- **Bond:** companions grow closer the more fights they share with you; creatures resting at home bond slowly too.
- **Eggs:** two of the same creature at home may lay an egg after a run. Click it to hatch.
