# How Slay the Fish works

A plain-language guide to the rules. For how the code is built, see [ARCHITECTURE.md](ARCHITECTURE.md).

## The idea

You're an angler setting off from your grandparents' house on the coast. Each run, you fish your way along the shore, through fights with creatures, toward a **boss** at the lighthouse. Creatures you catch go into your **bucket**, and if you make it home, they join your **home aquarium** for good.

## A fight in one minute

Each turn you get **3 energy** and draw **5 cards**. Cards cost energy to play. When you're done, click **End Turn**: the creatures then act, and a new turn starts.

You win a fight by catching every creature. A creature is caught when **either**:

- its **health** reaches 0 (you've worn it out), **or**
- its **escape bar** is pushed all the way down to 0 (you've calmed it and reeled it in).

You lose a creature if its escape bar fills up: it gets away.

You lose the whole run if your **Grit** runs out.

## Your side

### Grit

Grit is your will to keep fishing: your health, in effect. You start with **80**. Creatures' **Strikes** wear it down. It carries over from fight to fight, so a draining fight early on makes the next ones harder. Some events, the shop and a few companions let you recover Grit.

If Grit reaches 0, you give up: the run is over, and **everything in your bucket is lost**, including the creatures you brought from home.

### Hold

Hold is your grip on the line: your defence. You get it from cards like **Hold** (the ✊ card in every starter deck). It shows as ✊ next to your Grit bar.

Hold soaks up **both** kinds of creature moves (see Strike and Pull below), in the order the creatures act. Whatever gets past your Hold lands.

Hold lasts until the creatures have acted, then it's gone, unless it turns into Patience (below).

### Attack

Attack cards (red) deal damage to a creature's **health**. Drag an attack card onto the creature you want to hit.

Every fishing style is **strong against** some creature types (shown under the creature's name). Your style's cards deal **20% more damage** to those, and glow **Effective!** when the bonus applies.

Some cards don't hit health at all: they calm a creature down, lowering its escape bar instead. Others, like Hold, are dragged anywhere on the battlefield.

### Patience

Patience is what you earn by waiting calmly instead of rushing. You get Patience points at the end of each turn:

- **1 point per energy you didn't spend**, and
- **1 point for every 3 Hold left over** after the creatures have acted (the Hold you didn't need).

You can have up to **5** points, and they last for the whole fight. Each point makes every creature's escape bar rise **10% slower**, so 5 points halve it. Some cards also cost Patience to play, on top of energy (shown as ⏳ on the card).

## The creatures' side

### Health

The red bar under a creature. Your attacks bring it down; at 0, the creature is caught.

### The escape bar (Panic)

The other bar under a creature: how close it is to breaking free. It:

- **starts part way up** when the fight begins,
- **rises a little every turn** by itself (shown as "+N/turn", slowed by your Patience),
- **jumps up** when the creature **Pulls** and gets past your Hold.

If it fills up, the creature escapes. If you push it down to 0 with calming cards, you catch it.

### Strike and Pull

Above each creature you can see what it will do next (its **intent**), tagged **STRIKE** or **PULL**:

| | What it does | What stops it |
|---|---|---|
| **Strike** 🗡️ | Wears down your **Grit** (a tail hit, pinched fingers, a stinky squirt…) | Your Hold soaks it first; the rest comes off your Grit |
| **Pull** 🎣 | Drags on the line to get away (a run, a dive, wedging under a rock…) | Your Hold soaks it first; the rest raises its escape bar |

So Hold always helps: against a Strike it protects you, against a Pull it keeps the creature on the line. Plan your Hold around what's coming. Some moves also do something extra, like weakening you or making the creature tougher.

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

- **Card rewards:** after a win, pick one of three cards to add to your deck. You have to take one (Eel companions can let you skip or reroll a few times per age).
- **Events** (?): something happens: a choice, a find, sometimes a surprise fight.
- **Shops** ($): spend coins on a thermos of hot chocolate (recovers Grit) or on removing a card from your deck. Sell creatures from your bucket to afford them.
- **Treasure** (T): a free find before the boss.

## Home

- **Home aquarium:** creatures you bring home live here between runs.
- **Bringing companions:** before a run you can bring up to 3 creatures. Each kind of temperament gives a bonus for the run, and more species of the same kind give a bigger bonus.
- **Bond:** companions grow closer the more fights they share with you; creatures resting at home bond slowly too.
- **Eggs:** two of the same creature at home may lay an egg after a run. Click it to hatch.
