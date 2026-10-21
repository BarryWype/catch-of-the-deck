# How Catch of the Deck works

A plain-language guide to the rules. For how the code is built, see [ARCHITECTURE.md](ARCHITECTURE.md).

## The idea

You're an angler setting off from your grandparents' house on the coast. Each run, you fish your way along the shore, through fights with creatures, toward a **boss** at the lighthouse. Creatures you catch go into your **bucket**, and if you make it home, they join your **home aquarium** for good.

Before each run you pick a **fishing style**, which sets your starter deck (see Fishermen and builds), then the companions to bring.

## A fight in one minute

Each turn your **Tension** starts at 0, you can build it up to **3**, and you draw **5 cards**. Each card adds its cost to your Tension; once it's full, only free cards can be played. A few cards release Tension (never below 0), which frees room for more cards; Tension you release and don't build up again turns into Patience at the end of the turn like any other. When you're done, click **End Turn**: the creatures then act, and a new turn starts.

You win a fight by catching every creature. A creature is caught when **either**:

- its **health** reaches 0 (you've worn it out), **or**
- its **Will** bar is drained all the way down to 0 (it's given up, and you reel it in).

You lose a creature if its Will bar fills up: it gets away.

You lose the whole run if your **Grit** runs out.

## Your side

### Grit

Grit is your will to keep fishing: your health, in effect. You start with **60**. Creatures' **Strikes** wear it down. It carries over from fight to fight, so a draining fight early on makes the next ones harder. Some events, the Cafe, the Bait shop's blessings and a few companions let you recover Grit.

If Grit reaches 0, you give up: the run is over, and **everything in your bucket is lost**, including the creatures you brought from home.

### Hold

Hold is your grip on the line: your defence. You get it from Defense cards like **Hold Tight** (in every starter deck but Foraging's, which has **Brace**). It shows as a 🛟 number in your Grit globe, and fills the globe from the top: blue over your Grit, on the same scale.

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

Cards whose effect waits or wears off (Coiled, Toxic Coating, effects "at the start of your next turn"…) show a blue icon there too until it's used up, with its number or the turns left.

Attack and Drain cards count as **attacks** (for "if you haven't played an attack this turn"). Drag them onto the creature you want; the others are dragged anywhere on the battlefield, and the ones that affect a creature pick one at random. Some cards also cost **Patience** (☕) on top of Tension.

### Patience

Patience is what you earn by waiting calmly instead of rushing. You get Patience points at the end of each turn:

- **1 point per Tension you didn't build up**, and
- **1 point for every 3 Hold left over** after the creatures have acted (the Hold you didn't need).

You can have up to **5** points, and they last for the whole fight. Each point makes every creature's Will rise **10% slower**, so 5 points halve it (on top of any Slow). Some cards also cost Patience to play, on top of Tension (shown as ☕ on the card).

## The creatures' side

Hover a creature in a fight (or long-press it) to see its temperament, whether you've seen or caught one before, how many your home aquarium holds, and the fishermen's quests it counts towards.

### Health

The red bar under a creature. Your attacks bring it down; at 0, the creature is caught.

The creatures of a fight have **at least 50 Health together**. Smaller ones get more to reach it; bigger ones keep their own. That pool grows **2% for every fight you've already had this run**: by your 8th fight it's 50 × 1.14 = 57.

### Will

The other bar under a creature: its will to break free. It:

- **starts part way up** when the fight begins: the creatures of a fight start with **at least 45 Will together** (growing 2% a fight like Health). Smaller ones get a bigger bar to reach it, the top of the bar and its rise scaled alike, so they take about as long to Drain as to wear down,
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

How hard a creature hits depends on the fight, not just on the creature. Each of its moves is **light**, **normal** or **heavy** (×0.5, ×1, ×1.4), and the fight sizes them so the creature deals **5.5 per turn on average** (Strike or Pull, light turns included), growing 2% per fight like Health. For now every fight is against one creature (several stack too tall on phones); groups come back later. In a group, each creature gets its share of that plus 10%: two creatures average 5.5 ÷ 2 × 1.1 ≈ 3 each. A **mini-boss** averages 9–10 per turn and a **boss** 10–12 (rolled each fight).

So Hold always helps: against a Strike it protects you, against a Pull it keeps the creature on the line. Plan your Hold around what's coming. Some moves also do something extra, like weakening you or making the creature tougher.

The bars show what's coming. The part of your Grit a Strike will take after your Hold is greyed red in the Grit globe, and so is the Hold it will use up, and the Will a Pull will add is striped. While you drag or select a card, each bar it changes shows the result too: the Health or Will it takes (after Block, Vulnerable, Weak and every other modifier) is greyed red, and the creatures' moves update to match (drag a Hold card to see how much of the hit it will soak). Random effects only show once they're played.

### What a creature's turn can be

The icon above a creature tells you what kind of move is coming:

| Intent | What it does |
|---|---|
| **Pace** 💤 | A light move: its Will rises **half as much** that turn. A breather for you. |
| **Wind-up** ⚠️ | A light move, but its **next** move is its **heavy** one, 30% bigger on top (the intent shows the real number). Get your Hold ready. |
| **Heavy** 💥 | Its big move. It only ever comes right after a Wind-up. |
| **Special** | A light move with a trick (below). About a quarter of creatures' turns. Never two in a row. |
| **?** | Hidden by Ink: you can't see what it will do. |

**Taking the bait:** a bait card (see Your bucket) makes a creature **Pace** this turn instead of what it planned, and that move comes on its **next** turn: it's put off, not cancelled. A Wind-up put off still leads to its heavy move, and a heavy move keeps its Wind-up's bonus. The intent shows the Pace, then (→) the move that waits. Baiting a creature twice in one turn puts its move off only once.

### Specials

| Special | What it does to you |
|---|---|
| **Ink** 🦑 | Its next move is hidden ("?"). Never right before a Wind-up, so a heavy move is always announced. |
| **Pebble in the Boot** 🗑️ | A junk card in your discard pile: it can't be played. |
| **Slimy Seaweed** 🗑️ | Junk: costs 1 Tension to get rid of (for this fight). Still in your hand at the end of your turn? Lose 2 Grit. |
| **Tangled Line** 🗑️ | Junk: costs 1 Tension to get rid of. While it's in your hand, your Hold cards give 1 less. |
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
| A **boss** gets away | Your catches stay behind; your companions come home hurt |
| Your **Grit** runs out | Your catches are lost; your companions come home hurt |
| You **abandon** the run (New run while one is saved) | As when your Grit runs out |

Companions are never lost to a run ending. When a run ends badly they come home **hurt**, with the bond they had before that run, and rest away from your aquarium for as many map stops (fights, shops, events, treasures, fishermen…) as that run lasted: 20 stops before it ended, 20 stops in your next runs before they're back. Until then they can't be brought, don't count for fishermen's quests and don't bond at home. They show along the bottom of your aquarium (on the companions screen and in See aquarium), dark, filling with colour from the bottom as they rest, with the stops left. A companion wearing a life jacket comes home as usual. Selling one, or using it as bait, still gives it up for good.

Heading home is the safe choice: you stop while you're ahead and keep everything you've caught.

## Fishermen and builds

- **Fishing styles:** your fishing style sets your starter deck. You start with **Rod fishing** only (4 Tug, 4 Hold Tight, Steady Hand, Reel In), and can learn three more from fishermen you meet on the way: Foraging, Net fishing and Fly fishing. Once you have more than one, you pick before each run; with one, the choice is skipped.
- **Foraging** is the patient way, for bigger catches: you drain a creature's Will instead of wearing down its Health, and a creature caught by its Will comes out bigger. Its deck: 4 Reel In, 4 **Brace** (1 Tension: 5 Hold, and Drain 3 if the creature is about to Pull), Play the Line and Slack Line. Reel In drains 7, but only 4 if the creature is about to Strike: Hold the Strikes, Drain the Pulls.
- **Old Ned**, an experienced fisherman, teaches it. As a Kid, while you haven't learnt Foraging, he stands one step after the mini-boss (it leads straight to him). Talk to him to open his quest: he wants to see **4 different species of crustaceans, shellfish or critters in your home aquarium**. He says how many you have so far, counting your bucket, and tells you when you already have them all.
- **Net fishing** hits every creature at once, at its best in group fights. Its deck: 3 Tug, 2 Reel In, 3 Hold Tight, **Throw the Net** (1 Tension: 3 damage to every creature) and **Draw the Net** (1 Tension: Drain 3 on every creature). **Gus the Netmaker** teaches it, one step after the Adult mini-boss: he wants to see **3 different species of schooling fish in your bucket**.
- **Fly fishing** is about Patience: save it to slow the Will, then spend it on one perfect cast. Its deck: 3 Tug, 2 Reel In, 3 Hold Tight, **Wait for the Rise** (1 Tension: gain 2 Patience) and **Perfect Cast** (no Tension but 3 Patience: 6 damage and Drain 6). **Silent Silas** teaches it, one step after the Elder mini-boss: he wants to see **a trophy-size freshwater creature in your bucket**.
- **Bucket quests** (Gus and Silas) count everything in your bucket when you meet him, the companions you brought included. He tells you if you have it; once he has seen it, losing the creatures later in the run doesn't undo it. If you don't have it yet, bring it next time you pass him.
- **Learning a style:** it unlocks when a run **ends well** (heading home, ending the run after a boss, or beating the last boss) with its quest met: for Old Ned, by your home aquarium once the bucket has joined it; for Gus and Silas, by showing them your bucket during that run. Meeting a fisherman is enough to open his quest, even if that run then goes badly; a run where your Grit runs out never unlocks anything. The end screen says when you've learnt a style, and from then on its fisherman no longer appears.
- **Open quests** show on the home menu, with your progress at home for Old Ned's (e.g. "3/4").

## Between fights

- **Card rewards:** after a win, pick one of three cards (four with the Logbook's Keen eye) to add to your deck. They suit the kinds of creatures you just beat (an armored crab offers Hold cards, a predator heavy attacks), and from the first mini-boss on, each one has a 10% chance to be **rare**, rising by 2% for every card that wasn't (before it, rewards are never rare). The mini-boss's own reward always has at least one rare card. You have to take one, but you can **reroll** for other cards: you start a run with 1 reroll (2 with the Logbook's Tackle box) and get 1 more for every mini-boss and boss you beat, and unused ones carry over. Hover the crest above a card's art to see which kinds of creatures offer it. Eel companions can let you skip a few times per age, and with 3 species add a few rerolls per age (used first, since they don't carry over).
- **Temperament traits:** every kind of creature has one signature habit, shown as a badge under its name (hover it): reef fish may bluff (a "?" on their move means it could be a fake), shoals scatter when hurt, predators get stronger when you weaken, venomous creatures' Venom lingers, puffers inflate after 3 hits in a turn, ambushers hide behind Block, fighters make one last run, giants' Will surges every other turn, eels slip your first Drain, shells keep half their Block, jellyfish shrug off attacks while resting, cephalopods' Ink hides two moves, crabs pinch back when you hit their Block, and bottom dwellers regrow.
- **Affixes:** a trophy creature always has one, and as an Adult or an Elder about 1 creature in 7 does too. It shows in its name and as an orange badge: **Old and Wily** (its first move is hidden), **Hungry** (each Wind-up also gives it 1 Strength), **Skittish** (15% more Will to start with), **Hook-scarred** (its Will rises 25% slower but its Strikes hit 20% harder), **Armored** (4 Block at the start of the fight and of each of its turns), **Frenzied** (no rest for its first 3 moves).
- **Every species fights its own way:** a fight's creature is sized to how far you've come, but a big species keeps more Health, Will or bite than a small one of the same depth (up to 40% more, or 30% less, than the usual).
- **Mini-bosses and bosses** change from run to run: each age's mini-boss and boss is one of 2–3 creatures, drawn when the run reaches that age and shown on the map from the start. You never meet the same one twice in a run.
- **Long fights tighten:** from an ordinary creature's 5th move, it gets desperate (a 😤 badge): each move, its normal Pulls get 10% more likely and its rest 10% less, until it pulls twice as often and never rests. Bosses don't.
- **Boss tricks:** each age's bosses fight their own way, with a signature move. The **Giant octopus** grabs a card from your next hand with its Eight Arms: make it lose 10 Health that turn to get it back. The **Common lobster** molts, shedding every debuff you put on it. The **Catfish** digs into the mud (your attacks deal half) while it winds up its ambush. The **Giant moray** retreats into its hole: until its next turn your attacks do nothing, but Drain still works. The **Giant clam** snaps shut for 20 Block and burrows. The **Bluefin tuna** sprints: its Will rises twice as fast for 2 turns. The **Giant squid** inks and pulls until its Health drops below half, then lashes out with many-armed Strikes. The **Mako** sizes up the lure, then breaches: its hit is doubled if you have less than 10 Hold. The **Oarfish**'s Omen makes both your Attack and Drain cards cost 1 more next turn.
- **Trophy fights** (🏆 on the map, a dashed gold ring): about 1 in 6 fights of each age, at least 2, never the first step. The creature is bigger: 40% more Health and Will, hits 20% harder, and 1 Strength. Win and you get your card reward plus a choice of gear (a rare card if gear is off), and the creature is always caught at trophy size. Trophy-size catches sell for double.
- **Events** (?): something happens: a choice, a find, sometimes a surprise fight. Most choices are trade-offs: Grit or coins for a card, a creature from your bucket for a rare card or a piece of gear, a fight for a reward, a card out of your deck (or a junk card in it, which stays until you remove it). Some events only happen at one age, and an event you've met doesn't come back in the same run until you've met all the others.
- **Stores**: every shop on the map is one of three stores, each with its own front on the map. Sell creatures from your bucket to afford things. A few stand where an event might have been. Tap the keeper for a chat. **See the map** in the top bar shows the map without leaving; until you travel on, **Back to the shop** (or tapping the shop you stand on) walks you back in, with what you bought still bought.
  - **Cafe**: a cocoa cup (15 coins, +15 Grit, as many as you like) and one espresso (20 coins: +20 max Grit and +20 Grit for the next 5 fights; then max Grit drops back). The keeper knows every fisherman on the coast, and hints at where to find the next one with a build to teach.
  - **Tackle shop**: spare hooks (10 each: one more card in your next reward, they add up) and removing a card from your deck (20). Once unlocked in the Logbook (see Home), also a life jacket (20: one creature of your choice comes home even if the run is lost), a parcel (15: post one creature home now, freeing its spot) and a lucky lure (40: your next card reward has a rare card, even early on). One of each per visit, spare hooks aside.
  - **Bait shop**: a bucket extension (20: 3 more spots for the rest of the run), and two deals around the keeper's tank. **Release** a creature for the visit's blessing (+1 damage for 5 fights, +2 Drain for 4 fights, creatures start 5 fights with 2 Vulnerable, start 5 fights with 5 Hold, +30 bond for your whole bucket, or +20 Grit). The **aquarium** buys one creature of the kinds on its sign (hover it for their names) for twice its price.
- **Treasure** (T): a free find before the boss. It can be a lost tackle chest: a piece of gear, or coins.
- **Gear (relics):** beating a mini-boss, opening a tackle chest, winning a trophy fight and some events offer a choice of 3 pieces of gear; take one or leave them. Gear stays with you for the rest of the run and works in every fight: a bobber that halves the first Pull, a lure that weakens with your first attack each turn, a sonar that shows each creature's next two moves, a trap that rewards turns without an attack… Gear is common, uncommon or rare; rare pieces come more often as you get older (Kid 60/30/10%, Adult 45/35/20%, Elder 30/40/30%). Your gear shows next to your companions on the map, and among your powers in a fight; hover it for what it does. The Handline, a starting item, gives each fight a 20% chance to start with a bait card in hand.

## Your bucket

- **It holds 7 creatures,** the companions you brought included (bring 3 and there's room for 4 catches), and 1 more for each bucket page of the Logbook. The count shows on it.
- **When a fight's catches don't fit,** you choose for each one before the card reward: sell a creature from your bucket or use it as bait to keep the new catch, or sell the new catch or use it as bait. Selling a companion ends its bonus. Sales get your companions' sell bonuses, as usual. A big group can overflow by more than one: you choose for each in turn.
- **Bait:** any creature in your bucket, a companion too, can be used as bait, on the map, in a shop, during a fight (🪣 under your draw pile) or when your bucket is full (for the new catch too). It's gone for good: it won't come home, and a companion's bonus and bond go with it. You get a one-use bait card by its tier, two for a trophy. They cost no Tension and leave your deck for the rest of the run once played:
  - **Bait** (shallow-water creature): Drain 15, and the creature's next move becomes a Pace.
  - **Cut Bait** (middle tier): Drain 10 on every creature, and each one's next move becomes a Pace.
  - **Big Lure** (deep-water creature): Drain 30, and the creature's next move becomes a Pace.

  Outside a fight the cards join your deck. During one they go straight into your hand; if it's full, on top of your draw pile, drawn first next turn. You're always asked first.
- **Sizes:** every catch is small, normal, large or a trophy. On your first fight it's 30% small, 50% normal, 17% large and 3% trophy; every fight played this run makes small rarer and large and trophy more likely, until small is only 5%. Draining a creature's Will lands a bigger one than wearing its Health down (it rolls twice and keeps the bigger). Size shows in your bucket and aquarium and goes in the creature book. A trophy-size catch sells for double, and makes two bait cards.

## Home

- **Home aquarium:** creatures you bring home live here between runs.
- **Bringing companions:** before a run you can bring up to 3 creatures. Each kind of temperament gives a bonus for the run. They ride in your bucket, so they take up room in it.
- **Stars:** each companion gives stars: 1 to 3 for how deep it lives (its tier), +1 at bond level 2 and +1 more at level 3, so 1★ to 5★. The stars of companions of the same kind add up, each species once (two Clownfish count once, the one with more stars), and more stars make the bonus stronger, up to its 8★ value. The Logbook's last Creatures page adds 1★ to every companion. Bringing 3 different species of the same kind also adds its **full school** bonus. The companions screen shows each one's stars, each kind's total and bonus, and what the next stars would add.
- **Bond:** companions grow closer with every fight they share with you: 1 point a fight as a Kid, 2 as an Adult, 3 as an Elder, and double against a mini-boss or boss. A creature is fully bonded at 40 points (shallow-water creatures), 60 or 90 (the deepest); levels come at 20%, 50% and 100%. They keep that bond only if the run succeeds. Creatures resting at home bond slowly too (+2 a run, up to level 1, or level 2 with the Logbook's Cosy aquarium). A companion that reaches a new level mid-run gives its extra star from the next fight.
- **Creature book** (📖, on the menu and the map): every creature, grouped by kind (reef fish, predators…), each kind folded under its name; click a kind to open it and see the bonus it gives as a companion (at 1★ and with a full school) and its creatures. It shows every creature you've met, seen or captured, with the biggest one of each species you've ever caught: S (small), M (normal), L (large) or 🏆 (trophy).
- **Golden shells:** beating a mini-boss gives 1, beating a boss 2. They're yours the moment the fight is won, even if the run is lost afterwards. The card reward after the fight shows them, and the menu shows how many you have, next to the Logbook button.
- **Logbook** (on the menu): spend golden shells on lasting upgrades, for every run you start afterwards. Three tracks of four pages, each page opening once the one before it is bought; only the next page of a track says what it does, the later ones show "?" and their price. Buying asks first.
  - **Gear:** 1 more card reward reroll at the start of a run (10), 10 more coins at the start of a run (25), then 1 more bucket space twice (45, 70).
  - **Haggling:** the Tackle shop sells life jackets (10), then parcels (25), then every store price is 20% lower, rounded down (45), then the Tackle shop sells lucky lures (70).
  - **Creatures:** creatures sell for 20% more, added to your companions' sell bonuses (10); creatures resting at home bond up to level 2 (25); card rewards offer 4 cards instead of 3 (45); every companion counts 1 more ★ (70).
