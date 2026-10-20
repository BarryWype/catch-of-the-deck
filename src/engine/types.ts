import type { CatchSize } from './sizes';

// ---------------------------------------------------------------------------
// Content definitions: the shapes designers fill in under /src/content.
// ---------------------------------------------------------------------------

export type StatusId =
  | 'strength'
  | 'vulnerable'
  | 'weak'
  | 'snared'
  | 'venom'
  | 'slow'
  // A creature's next move, changed by the player (`nextMoveMods`):
  | 'cowed'
  | 'intimidated'
  | 'lured'
  | 'distracted'
  | 'dazzled'
  // A creature's own Wind-up: its next move is its heavy move, and bigger (`nextMoveMods`).
  | 'windUp'
  // A creature dug in until its next turn: the player's attacks deal less (Burrow).
  | 'burrowed'
  // On the player, from creatures' special moves, for their next turn:
  | 'tangled'
  | 'numbFingers'
  | 'pinchedHand'
  | 'skittish'
  | 'spines'
  | 'baitGrabbed';
export type Statuses = Partial<Record<StatusId, number>>;

/**
 * Who an effect lands on, from the point of view of whoever is acting.
 * - `target`: the chosen enemy (for the player) or the player (for an enemy)
 * - `self`: the acting combatant
 * - `allEnemies`: every living opponent of the actor
 * - `randomEnemy`: one random living opponent, re-rolled per hit
 */
export type EffectTarget = 'target' | 'self' | 'allEnemies' | 'randomEnemy';

/**
 * What a Power does for the rest of the fight (with its `amount`, added up over copies):
 * - `hardShell`: Hold no longer disappears between turns, nor turns into Patience.
 * - `stingsAndSpines`: creatures' Venom drains `amount` × its charges from their escape bar instead of dealing damage.
 * - `envenomedHooks`: every hit of a card's damage or Drain applies `amount` Venom.
 * - `pushTheLimits`: Slow on creatures no longer wears off.
 * - `oldAsTheRiver`: paying a card's Patience cost deals `amount` damage per point to a random creature.
 * - `baitBall`: playing a 0-cost card Drains `amount` from a random creature.
 * - `deadWeight`: each creature gains `amount` Slow at the start of the player's turn.
 * - `gooeyMess`: every Pull against the player loses `amount` before it reaches their Hold.
 * - `perfectDisguise`: at the end of the player's turn, if no attack was played: `amount` Hold, and 1 Slow on a random creature (per copy) at the start of the next turn.
 */
export type PowerId =
  | 'hardShell'
  | 'stingsAndSpines'
  | 'envenomedHooks'
  | 'pushTheLimits'
  | 'oldAsTheRiver'
  | 'baitBall'
  | 'deadWeight'
  | 'gooeyMess'
  | 'perfectDisguise';

/** Adds `amount` to an effect's amount for every stack of `status` on its target (e.g. +2 damage per Slow). */
export interface PerStatus {
  status: StatusId;
  amount: number;
}

/** The reusable building blocks that every card and enemy move is made of. */
export type Effect =
  /** `fromHold`: the amount is the player's current Hold instead. `perTension`: plus this much per Tension before the card. */
  | { type: 'dealDamage'; amount: number; hits?: number; target?: EffectTarget; perStatus?: PerStatus; fromHold?: boolean; perTension?: number }
  /** The player loses this share of their Hold (0.5 = half, rounded down). */
  | { type: 'loseHold'; share: number }
  /** The player loses all their Patience (it isn't spent) and gains `per` Hold for each point lost. */
  | { type: 'patienceToHold'; per: number }
  /** The player's Hold doesn't vanish at the start of their next turn. */
  | { type: 'keepHold' }
  /** `then` if no attack (Attack or Drain card) was played earlier this turn, `else` otherwise. */
  | { type: 'ifNoAttack'; then: Effect[]; else?: Effect[] }
  /** A Power: lasts the whole fight (`CombatState.powers`); `amount` is its number (see `PowerId`). */
  | { type: 'power'; power: PowerId; amount?: number }
  /** The target's Venom deals its damage now, without losing a charge. */
  | { type: 'venomNow'; target?: EffectTarget }
  /** Swap the target's health % and escape bar % (rounded down): it can be caught, or flee. */
  | { type: 'swapHealthAndWill'; target?: EffectTarget }
  /** The next Attack or Drain card played this turn has its numbers doubled. */
  | { type: 'coil' }
  /** For the rest of the turn, the player's attacks deal `amount` more per hit to creatures with Venom. */
  | { type: 'venomBonus'; amount: number }
  /** For the rest of the turn, every hit of the player's attacks (a Drain is a hit) also applies `amount` Venom. */
  | { type: 'venomCoating'; amount: number }
  /** `then` if the target's next move has this tag, `else` otherwise. */
  | { type: 'ifIntent'; tag: MoveTag; then: Effect[]; else?: Effect[] }
  /** `then` if the target has any `status` (e.g. it's Slowed), `else` otherwise. */
  | { type: 'ifStatus'; status: StatusId; then: Effect[]; else?: Effect[] }
  /** `then` if the card played just before this one, this turn, was of this type, `else` otherwise (also when none was). */
  | { type: 'ifLastCard'; cardType: CardType; then: Effect[]; else?: Effect[] }
  /** `then` if the target's health (or Will bar) is under 1/`part` of its max (2: half), `else` otherwise. */
  | { type: 'ifBelow'; bar: 'health' | 'will'; part: number; then: Effect[]; else?: Effect[] }
  /** `then` if the player's Tension before this card (its own cost aside) is `tension`, or is full, `else` otherwise. */
  | { type: 'ifTension'; tension: number | 'full'; then: Effect[]; else?: Effect[] }
  /** The effects at the index of the player's Tension before this card; the last entry covers any higher Tension. */
  | { type: 'byTension'; effects: Effect[][] }
  /** Look at the top `look` cards of the draw pile; the player puts one in hand (`CombatState.pick`), the others stay on top in order. */
  | { type: 'pickFromDraw'; look: number }
  /** The target's next move becomes a random move of the other tag (Strike ↔ Pull), if it has one. */
  | { type: 'flipIntent'; target?: EffectTarget }
  /** The target's next move becomes another of its moves, picked at random. */
  | { type: 'rerollIntent'; target?: EffectTarget }
  /** The target plays its Pace on its next turn, and the move it had planned on the turn after (`EnemyState.delayedIntent`). */
  | { type: 'delayMove'; target?: EffectTarget }
  /** Gain Hold equal to the target's next Strike damage or Pull amount, up to `max` (0 for other moves). */
  | { type: 'holdFromIntent'; max: number; target?: EffectTarget }
  /** `effects` happen again at the start of each of the player's next `turns` turns, on the same target. */
  | { type: 'delayed'; turns: number; effects: Effect[] }
  /** At the start of the player's next turn, the card's target takes `share` of the health its earlier effects took (rounded down) again. */
  | { type: 'echoDamage'; share: number }
  | { type: 'gainBlock'; amount: number }
  | { type: 'applyStatus'; status: StatusId; amount: number; target?: EffectTarget }
  | { type: 'drawCards'; amount: number }
  /** Releases Tension (shown as Tension going down), never past its turn start. */
  | { type: 'gainEnergy'; amount: number }
  /** Move a creature's escape bar (its Will): negative Drains it toward capture (0), positive raises it toward fleeing. */
  /** `fromHold`: Drains as much as the player's current Hold instead. */
  | { type: 'changeEscape'; amount: number; target?: EffectTarget; perStatus?: PerStatus; fromHold?: boolean }
  /** Multiply the target's stacks of a status by `factor` (adding at most `max` stacks). */
  | { type: 'multiplyStatus'; status: StatusId; factor: number; max?: number; target?: EffectTarget }
  /** The player gains this much Patience (up to `MAX_PATIENCE`). */
  | { type: 'gainPatience'; amount: number }
  /** The target heals this much, never above its max health. */
  | { type: 'heal'; amount: number; target?: EffectTarget }
  /** Heal `percent` of max Health (rounded up). Creature moves (Graze). */
  | { type: 'healPercent'; percent: number; target?: EffectTarget }
  /** The creature's next move is hidden from the player (Ink). */
  | { type: 'ink' }
  /** A junk card (`card` id) goes into the player's discard pile, if the deck holds fewer than `MAX_JUNK_CARDS`. */
  | { type: 'addJunk'; card: string }
  /** The player loses Patience (none below 0). */
  | { type: 'stealPatience'; amount: number }
  /** A mini-boss's or boss's Second Wind: points move from its higher bar into the low one. */
  | { type: 'secondWind' }
  /** For the rest of the fight, escape bars can be slowed by up to `amount` percent (instead of `MAX_SLOW_PERCENT`); it never lowers it. */
  | { type: 'slowCap'; amount: number }
  /** Creature moves only: it pulls on the line. The player's Hold takes it first; the rest raises its escape bar. */
  /** `heavyIfNoHold`: a heavy Pull instead when the player has no Hold (Shake the Hook). */
  | { type: 'pull'; amount: number; heavyIfNoHold?: boolean };

/** `junk`: dropped into the deck by creatures' special moves for the fight (`addJunk`), never offered. */
export type CardType = 'attack' | 'defense' | 'drain' | 'support' | 'power' | 'junk';
/** Attack and Drain cards are "attacks" for every rule that counts them (`isAttackCard`). */
export type CardRarity = 'normal' | 'rare';

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  /** Patience points it also costs (see `PlayerState.patience`). */
  patienceCost?: number;
  /**
   * `enemy`: the player drags it onto the creature it's played on. `random`: it's played on a random
   * creature (picked when it's played), for every effect aimed at "the target". `none`: no creature.
   */
  target: 'enemy' | 'random' | 'none';
  effects: Effect[];
  /** Removed from the fight after being played. Powers always exhaust. */
  exhaust?: boolean;
  /** Only offered as a reward to this build. Offered to every build if omitted. */
  build?: string;
  /** The creature family it belongs to (`FamilyDef`): creatures of that family can offer it. Starter cards have none. */
  family?: string;
  /** What it's about (damage, hold, delayed…). Stored for later; not shown. */
  tags?: string[];
  /** Optional text override. Normally generated from `effects`. */
  description?: string;
  /** It can't be played (Pebble in the Boot). */
  unplayable?: boolean;
  /** What a junk card does while it sits in the hand: Grit lost if it's still there at the end of the turn, Hold taken off every Hold card. */
  inHand?: { gritAtEndOfTurn?: number; holdLess?: number };
  /**
   * A bait card, made from a bucket creature of this tier (`useAsBait`): never offered as a reward,
   * and gone from the deck for the rest of the run once played.
   */
  bait?: number;
  /** Placeholder art (emoji). Display-only; ignored by the engine. */
  art?: string;
}

/** The player character and where their journey starts. */
export interface CharacterDef {
  name: string;
  maxHp: number;
  /** Placeholder art (emoji). Display-only. */
  portrait?: string;
  /** The map's starting point. Display-only. */
  home: { name: string; icon?: string };
}

/** A starting build: chosen before the first fight, it sets the starter deck. */
export interface BuildDef {
  id: string;
  name: string;
  description: string;
  /** Card ids the run starts with. */
  starterDeck: string[];
  /** Display-only art. */
  sprite?: SpriteRef;
  /** Display-only: the player's art in fights, `ui/assets/character/<character>_fish/_hook/_hurt.png`; the Fisherman if omitted. */
  character?: string;
  /** Equipment the player picks one of to start the run with (the first if none is picked). */
  startingItems?: string[];
  /** Id of the level from which the build can be picked; the first level if omitted. */
  level?: string;
  /** Locked until this fisherman's quest is done (see unlocks.ts); available from the start if omitted. */
  unlock?: BuildUnlock;
}

/** How a build is unlocked: meet `fisherman` on the map, then meet `quest` by the end of a successful run. */
export interface BuildUnlock {
  fisherman: string;
  /** The quest's title, e.g. "Shells and claws". Display-only. */
  name: string;
  quest: QuestCondition;
}

/**
 * What a fisherman wants to see:
 * - `speciesAtHome`: `count` different species of these temperaments in the home aquarium.
 * - `inBucket`: `count` different species in the bucket (companions included) when the player
 *   meets him, matching every filter given: a `temperament`, a `water`, a `size` or bigger.
 */
export type QuestCondition =
  | { type: 'speciesAtHome'; count: number; temperaments: string[] }
  | { type: 'inBucket'; count: number; temperament?: string; water?: string; size?: CatchSize };

/** An experienced fisherman, met on the map while a build he teaches is still locked. */
export interface FishermanDef {
  id: string;
  name: string;
  /** The map node's symbol: an icon file name or an emoji. Display-only. */
  icon: string;
  /** Display-only: the character art, `ui/assets/character/<sprite>_fish.png`. */
  sprite?: string;
  /** Id of the level he stands on, one node after its mini-boss (generated maps only: a hand-made one has no room kept for him). */
  level: string;
  /** What he says when met: who he is and the build he teaches. */
  greeting: string;
}

/** What a piece of equipment does. Percentages are whole numbers (20 = 20%). */
export type EquipmentEffect =
  /** Every creature's escape rate drops by this share (at least 1, rounded up) at the start of each fight. */
  | { type: 'slowEscape'; percent: number }
  /** Captured creatures are sold on the spot, for this much more, instead of going into the bucket. */
  | { type: 'sellOnCapture'; bonusPercent: number }
  /** Enthusiastic passersby pay this much more per fish. */
  | { type: 'passerbyBonus'; bonusPercent: number }
  /** The player's Drain drains this much more, in percent (rounded up). */
  | { type: 'strongerPull'; percent: number }
  /** Creatures caught during the run come home with this share of their full bond, in percent (rounded). */
  | { type: 'bondOnCapture'; percent: number }
  /**
   * Each ordinary fight (at one of `spots`, if given) has this chance to bring one more creature of
   * one of `types`, from the same tier.
   */
  | { type: 'extraCatch'; percent: number; types: string[]; spots?: string[] };

/** An object carried for the whole run, with passive effects. */
export interface EquipmentDef {
  id: string;
  name: string;
  /** Player-facing rules text. */
  description: string;
  /** Placeholder art (emoji). Display-only. */
  icon?: string;
  effects: EquipmentEffect[];
}

/** When a triggered companion bonus fires, always from the player's side. */
export type CompanionTrigger =
  /** Once the first turn has started (after the opening draw). */
  | 'combatStart'
  /** Once the second turn has started (after its draw). */
  | 'secondTurnStart'
  /** After the first attack card of each turn / each fight resolves; `target` is the enemy it was played on. */
  | 'firstAttackEachTurn'
  | 'firstAttackEachFight'
  /** An enemy's attack hit dealt damage that Block soaked completely; `target` is the attacker. */
  | 'fullBlock'
  /** Any enemy attack hit on the player, blocked or not; `target` is the attacker. */
  | 'hitByEnemy'
  /** The first time the player's HP drops below half in a fight. */
  | 'firstBelowHalfHp';

/**
 * What a creature brought from the home aquarium does for the run (see companions.ts).
 * `byStars` gives the amount (a trigger's effect's `amount`) at 1, 2, 3… stars of the
 * temperament, its last entry covering more stars; without it the amount is fixed.
 * Percentages are whole numbers (10 = 10%).
 */
export type CompanionEffect = (
  /** Whenever the player gains Block, they gain this much more. */
  | { type: 'bonusBlock'; amount: number }
  /** Up to this much Block carries over to the next turn. */
  | { type: 'keepBlock'; amount: number }
  /** Extra damage on every hit the player deals. */
  | { type: 'bonusDamage'; amount: number }
  /** The first attack card of each fight deals this percentage more damage. */
  | { type: 'firstAttackDamage'; amount: number }
  /** The first this-many enemy attack hits of each fight deal 0 damage. */
  | { type: 'dodgeAttacks'; amount: number }
  /** The player's Drain drains this much more. */
  | { type: 'bonusEscapeReduction'; amount: number }
  /** Every creature's escape rate drops by this percentage at the start of each fight (like the Reliable Reel). */
  | { type: 'slowEscape'; amount: number }
  /** Extra max HP for the run, given when it starts. */
  | { type: 'bonusMaxHp'; amount: number }
  /** Heal this much after each fight that isn't lost. */
  | { type: 'healAfterFight'; amount: number }
  /** Creatures sell for this percentage more during the run (bucket and on-the-spot sales). */
  | { type: 'sellBonus'; amount: number }
  /** Card rewards the player may skip, and reroll (new cards offered), on each level. */
  | { type: 'rewardSkips'; amount: number }
  | { type: 'rewardRerolls'; amount: number }
  /** Resolve `effect` as the player whenever `on` happens. Its numbers ignore Strength and other modifiers. */
  | { type: 'trigger'; on: CompanionTrigger; effect: Effect }
) & { byStars?: number[] };

/**
 * A creature family: temperaments grouped by a shared identity (Venom, Shell, Hunter…). A temperament
 * can belong to several families. Cards name their family, and a creature offers the cards of all
 * its temperament's families (`cardsOfferedBy`). Internal only: the player sees temperaments.
 */
export interface FamilyDef {
  id: string;
  name: string;
  /** The creature (an enemy id of this family) shown on its cards' crest. Display-only. */
  emblem: string;
  /** Temperament ids (content/behaviors.ts) in this family. */
  temperaments: string[];
  /** What its cards are about, e.g. "Damage over time (Venom)". Design note; not shown yet. */
  identity: string;
  /** What it plays around, e.g. "health bar", "Will bar". Design note; not shown yet. */
  focus: string;
}

/** The bonus a temperament gives when creatures of it are brought along. */
export interface CompanionBonusDef {
  /** The temperament id (content/behaviors.ts). */
  id: string;
  name: string;
  /** How the temperament is shown to the player, e.g. "Reef fish". Display-only. */
  temperamentName: string;
  /** Placeholder art (emoji). Display-only. */
  icon?: string;
  /** What the bonus does, for developers. Not shown: the game generates its text from `effects`. */
  description?: string;
  /** Scaled by the temperament's stars (`byStars`, see companions.ts). */
  effects: CompanionEffect[];
  /** Added, as written, once `FULL_SCHOOL` species of this temperament are brought. */
  fullSchool: CompanionEffect[];
}

/** What a map event's choice does. Percentages are whole numbers (30 = 30%). */
export type EventEffect =
  | { type: 'heal'; percent: number }
  | { type: 'loseHp'; amount: number }
  | { type: 'gainCoins'; amount: number }
  /** Coins for each creature in the bucket (raised by passerby equipment bonuses). The creatures stay. */
  | { type: 'coinsPerCreature'; amount: number }
  /** Offer the usual pick-1-of-3 card reward afterwards. */
  | { type: 'cardReward' };

export interface EventChoice {
  label: string;
  effects: EventEffect[];
}

/** Something that happens on a map event instead of a fight. */
export interface EventDef {
  id: string;
  name: string;
  description: string;
  /** Placeholder art (emoji). Display-only. */
  icon?: string;
  /** Only drawn on map columns from this one on. Anywhere events can be if omitted. */
  minColumn?: number;
  /** Only met on treasure nodes, never as an ordinary event. */
  treasure?: boolean;
  choices: EventChoice[];
}

/** The three kinds of store a shop node can be (`MapNode.store`). */
export type StoreKind = 'cafe' | 'tackle' | 'bait';

/**
 * What a store item does. `lifeJacket`, `sendHome`, `release` and `aquariumSale` act on a bucket
 * creature the player picks, `removeCard` on a deck card (see shop.ts).
 */
export type ShopEffect =
  /** Grit back, never above max. */
  | { type: 'heal'; amount: number }
  | { type: 'removeCard' }
  /** Max Grit and Grit both rise by `amount` now; after `fights` fights, max Grit drops back (a `Boon`). */
  | { type: 'maxHpForFights'; amount: number; fights: number }
  /** The creature reaches the home aquarium even if the run is lost. */
  | { type: 'lifeJacket' }
  /** The creature leaves the bucket for the home aquarium, which it joins when the run ends, however it ends. */
  | { type: 'sendHome' }
  /** The next card reward has at least one rare card, even before rares are unlocked. */
  | { type: 'rareReward' }
  /** The next card reward offers one more card. */
  | { type: 'extraRewardCard' }
  /** The bucket holds this many more creatures for the rest of the run. */
  | { type: 'bucketSpace'; amount: number }
  /** The creature is let go (no coins) for the visit's blessing (`ShopVisit.blessing`). */
  | { type: 'release' }
  /** The creature, of the visit's family (`ShopVisit.family`), sells for `percent` of its sale value. */
  | { type: 'aquariumSale'; percent: number };

/** Something for sale in a store. */
export interface ShopItemDef {
  id: string;
  name: string;
  /** Which store sells it, on every visit. */
  store: StoreKind;
  /** Placeholder art (emoji or an icon name). Display-only. */
  icon?: string;
  price: number;
  effect: ShopEffect;
  /** How many times it can be bought per shop visit. Unlimited if omitted. */
  limit?: number;
}

/** What releasing a creature at the Bait shop gives: one is drawn per visit. Its text is `store.blessing.<id>`. */
export interface BlessingDef {
  id: string;
  /** An icon file name (ui/assets/icons), shown while it lasts. Display-only. */
  icon?: string;
  effect:
    /** A combat bonus, as a companion's, for the next `fights` fights (a `Boon`). */
    | { type: 'bonus'; bonus: CompanionEffect; fights: number }
    | { type: 'heal'; amount: number }
    /** Bond points for every creature in the bucket: companions now, caught ones when they reach home. */
    | { type: 'bond'; amount: number };
}

/** A creature type, used as an enemy tag (e.g. 'crustacean'): internal habitat data, never shown. */
export interface CreatureTypeDef {
  id: string;
  name: string;
}

/**
 * What a creature's move does to the angler: a `strike` wears down their Grit (it deals damage),
 * a `pull` drags on the line to escape (it has a `pull` effect). The player's Hold soaks both.
 */
/** What a creature's move does: Strike (damage to Grit) or Pull (raises its Will). */
export type MoveTag = 'strike' | 'pull';

/** A move's size before the fight scales it: light ×0.5, normal ×1, heavy ×1.4 (`MOVE_INTENSITY`). */
export type MoveIntensity = 'light' | 'normal' | 'heavy';

/**
 * A move's part in its set. `pace`: its Will rises half as much that turn. `special`: a trick
 * (Ink, junk cards, taxes…). `windUp`: its next move is `followUp`, played heavy and bigger.
 * `heavy`: only ever played right after a Wind-up. Normal moves have none.
 */
export type MoveRole = 'pace' | 'special' | 'windUp' | 'heavy';

export interface EnemyMove {
  id: string;
  name: string;
  tag: MoveTag;
  intensity: MoveIntensity;
  role?: MoveRole;
  /** A Wind-up's heavy move, played right after it. */
  followUp?: string;
  effects: Effect[];
}

/** A cell in a sprite sheet. `index` is 1-based, counted left to right, top to bottom. Display-only. */
export interface SpriteRef {
  sheet: string;
  index: number;
}

export type IntentPattern =
  /** Play `moves` in order; after the last one, loop back to index `loopFrom` (default 0). */
  | { type: 'sequence'; moves: string[]; loopFrom?: number }
  /** Pick by weight. `maxConsecutive` caps how often the same move can repeat in a row. A special never follows a special, and a Wind-up never follows Ink. */
  | { type: 'weighted'; weights: Record<string, number>; firstMove?: string; maxConsecutive?: number };

export interface EnemyDef {
  id: string;
  name: string;
  /** How deep it lives (1 = shallow, 3 = the deep end): sizes its sprite on screen. Display-only. */
  tier?: number;
  /** Inclusive [min, max] HP range, rolled with the combat seed. */
  hp: [number, number];
  /** Coins it sells for once captured. Defaults to 0. */
  sellValue?: number;
  /** 0–1: after each run, chance that two or more of it in the home aquarium lay an egg. Defaults to 0. */
  breedChance?: number;
  /** The tug of war: the escape bar flees at `escapeAt`, captures at 0. */
  escapeAt: number;
  /** Escape bar value at the start of combat. */
  escapeStart: number;
  /** How much the escape bar rises each enemy turn. */
  escapeRate: number;
  moves: EnemyMove[];
  pattern: IntentPattern;
  /** Its pattern as a mini-boss or boss (a fixed `sequence`); `pattern` otherwise. */
  bossPattern?: IntentPattern;
  /** Statuses the enemy starts every fight with, e.g. `{ strength: 2 }`. */
  startingStatuses?: Statuses;
  /** Creature type ids, matched by card damage bonuses. */
  tags?: string[];
  /** Placeholder art (emoji), used when there is no sprite. Display-only. */
  portrait?: string;
  sprite?: SpriteRef;
  /** How it moves around in the aquarium. Display-only. */
  habitat?: Habitat;
  /** Picks its companion bonus (`GameData.companionBonuses`) when brought from the home aquarium. */
  temperament?: string;
  /** Bond points to be fully bonded once it lives in the home aquarium (see bond.ts). Defaults to 100. */
  bondToFull?: number;
  /** 'fresh', 'salt' or 'brackish': which fishing spots it can be met at (`SpotDef.waters`). */
  water?: string;
}

/** A kind of fishing spot on the map (the legend: rock pools, jetty, reef…). It decides who a fight there meets. */
export interface SpotDef {
  /** Short code shown on the map node, e.g. 'RP'. */
  id: string;
  name: string;
  /** Node colour. Display-only. */
  color: string;
  /** Creatures living in these waters (`EnemyDef.water`) can be met here… */
  waters: string[];
  /** …if they're one of these creature types. Any type if omitted. */
  types?: string[];
}

export type LevelNodeKind = 'fight' | 'event' | 'shop' | 'treasure' | 'leave' | 'miniBoss' | 'boss';

/** One node of a hand-made level map. */
export interface LevelNodeDef {
  /** Unique across every level. */
  id: string;
  /** 1 = the first step from home. Links (`next`) always go to a later column. */
  column: number;
  /** Position on the map art. Display-only. */
  x: number;
  y: number;
  kind: LevelNodeKind;
  /** Fights: the fishing spot, which picks the creatures (see `encountersFor`). */
  spot?: string;
  /** Fights: exactly these creatures, instead of drawing them. Mini-bosses and bosses use it. */
  enemies?: string[];
  /** Name shown on the map, e.g. "Lighthouse Point" for a boss. Display-only. */
  label?: string;
  /**
   * Mini-bosses and bosses are let go after the fight; this says why, e.g. "a protected species"
   * (shown as "<creature> is <reason>, so you let it go."). Display-only.
   */
  releaseReason?: string;
  /** Ids of the nodes this one leads to. Empty for the boss and for leave nodes, which end the level or the run. */
  next: string[];
}

/** A mini-boss or boss of a generated level: always at the same place. */
export interface FixedFightDef {
  x: number;
  y: number;
  label: string;
  enemies: string[];
  /** Why it's let go after the fight (see `LevelNodeDef.releaseReason`). */
  releaseReason: string;
}

/** A fight node of a generated level that's always there, e.g. on the base map's own rocks. */
export interface FixedStopDef {
  x: number;
  y: number;
  spot: string;
  label: string;
}

/**
 * One act of a run. Its map is either hand-made (`nodes`) or generated each run on the coast
 * (`generateLevelMap`): from the start to the fixed mini-boss and on to the fixed boss, through
 * some of the coast's places.
 */
export interface LevelDef {
  id: string;
  name: string;
  /** Creature tier its fights draw from (1 = shallow, 3 = deep). */
  tier: number;
  /** Where the run starts on the art (the grandparents' house). Display-only. */
  start: { x: number; y: number };
  /** How much of the map art this age sees, from the top: older ages fish further out at sea. */
  height: number;
  /** A hand-made map. */
  nodes?: LevelNodeDef[];
  /** Generated maps: the mini-boss, the boss, and the leave node offered after the mini-boss. */
  miniBoss?: FixedFightDef;
  boss?: FixedFightDef;
  escape?: { x: number; y: number };
  /** Generated maps: fights making up column 1 every run, instead of drawing it from the coast. */
  firstColumn?: FixedStopDef[];
  /** Generated maps: the band of the art (top, bottom) where filler events may go. */
  eventBand?: [number, number];
}

/** What a level does at a place on the coast: its fishing spot, and the node's name. */
export interface CoastVisitDef {
  spot: string;
  label: string;
  /** Where the node sits for this age, when not at the place itself (a boat out from the harbour). */
  at?: { x: number; y: number };
}

/** A place on the coast map (a pond, a beach, a wreck…) where a fight may be: where its node sits. */
export interface CoastPlaceDef {
  id: string;
  x: number;
  y: number;
  /** What each level (by index: kid, adult, elder) does there; null when that age doesn't stop there. */
  visits: (CoastVisitDef | null)[];
}

export interface CoastDef {
  places: CoastPlaceDef[];
}

/** `swim` back and forth, `drift` slowly up and down, or crawl along the `bottom`. */
export type Habitat = 'swim' | 'drift' | 'bottom';

export interface EncounterDef {
  id: string;
  name: string;
  enemies: string[];
  /** Map depth band (1 = near the start). Defaults to 1. */
  tier?: number;
}

/** All content, indexed by id. Built from the content arrays by `buildGameData`. */
export interface GameData {
  character: CharacterDef;
  cards: Record<string, CardDef>;
  enemies: Record<string, EnemyDef>;
  encounters: EncounterDef[];
  builds: Record<string, BuildDef>;
  fishermen: Record<string, FishermanDef>;
  creatureTypes: Record<string, CreatureTypeDef>;
  equipment: Record<string, EquipmentDef>;
  events: Record<string, EventDef>;
  shop: ShopItemDef[];
  blessings: BlessingDef[];
  /** Keyed by temperament id. */
  companionBonuses: Record<string, CompanionBonusDef>;
  families: Record<string, FamilyDef>;
  spots: Record<string, SpotDef>;
  /** Played in order, one per act of a run. */
  levels: LevelDef[];
  coast: CoastDef;
}

// ---------------------------------------------------------------------------
// Runtime state. Plain, JSON-serialisable data only.
// ---------------------------------------------------------------------------

export interface Combatant {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: Statuses;
}

export interface PlayerState extends Combatant {
  energy: number;
  maxEnergy: number;
  /**
   * Patience: one point per energy left unused at the end of a turn, kept for the whole fight.
   * It slows every creature's escape bar (`escapeRise`) and pays for cards' `patienceCost`.
   */
  patience: number;
}

export interface EnemyState extends Combatant {
  defId: string;
  tags: string[];
  /** The move this enemy will perform on its next turn (shown to the player). */
  intent: string | null;
  /** The move it had planned before bait (`delayMove`) made `intent` its Pace: it plays it on the turn after. */
  delayedIntent?: string;
  moveHistory: string[];
  /** The escape bar, 0..escapeAt: it flees at `escapeAt` and is captured at 0. */
  escape: number;
  escapeAt: number;
  escapeRate: number;
  /** Its moves' Strike and Pull are multiplied by this (the fight's damage, see `createCombat`), before Strength and statuses. */
  damageScale?: number;
  /** How much tougher this fight is than the base one (its damage ÷ `ENCOUNTER_TURN_AVERAGE`): scales Skittish and Second Wind. */
  fightScale?: number;
  /** A mini-boss or boss: it follows its `bossPattern`, its Wind-ups also give Strength, and it has a Second Wind. */
  boss?: boolean;
  /** Its next move is hidden from the player (`ink`); `inked` is set by the Ink move until that next move is picked. */
  inked?: boolean;
  intentHidden?: boolean;
  /** Its Second Wind has been telegraphed (once per fight). */
  secondWindUsed?: boolean;
  /** Strength its moves gave it this fight (at most `MAX_MOVE_STRENGTH`; starting Strength aside). */
  strengthGained?: number;
}

export interface CardInstance {
  uid: string;
  defId: string;
}

export interface Piles {
  /** The top of the draw pile is the END of the array. */
  draw: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  exhaust: CardInstance[];
}

/** `fled`: a creature escaped, ending the fight with no reward. */
export type CombatPhase = 'playerTurn' | 'won' | 'lost' | 'fled';

export interface CombatState {
  seed: number;
  /** Current RNG cursor. Advancing it is the only source of randomness. */
  rng: number;
  turn: number;
  phase: CombatPhase;
  player: PlayerState;
  enemies: EnemyState[];
  piles: Piles;
  log: string[];
  /** Companion bonuses active in this fight, already scaled (see companions.ts). */
  bonuses: CompanionEffect[];
  /** What the once-per-turn / once-per-fight bonuses need to remember. */
  bonusTracker: BonusTracker;
  /** Extra share, in percent, of every Drain from the player (`strongerPull` equipment). */
  pullPercent?: number;
  /** Effects waiting for the start of the player's next turns (`delayed`, `echoDamage`). */
  delayed?: DelayedEffect[];
  /** Powers played this fight, in order (`power` effects). */
  powers?: { power: PowerId; amount: number }[];
  /** What lasts until the end of the player's turn (`coil`, `venomBonus`, `venomCoating`). */
  thisTurn?: { coiled?: boolean; venomBonus?: number; venomCoating?: number; cardsPlayed?: number; lastCard?: CardType };
  /** Cards on top of the draw pile shown by `pickFromDraw`, top first: the player must put one in hand (`pickCard`) before anything else. */
  pick?: string[];
  /** Creatures whose Skittish is on the player this turn: playing `SKITTISH_CARDS` cards raises their Will. */
  skittishFrom?: string[];
  /** Junk cards added this fight, for their ids. */
  junkAdded?: number;
  /** Set by `keepHold`: the player's Hold stays at the start of their next turn. */
  keepHold?: boolean;
  /** How much escape bars can be slowed this fight, in percent, when a card raised it (`slowCap`). `MAX_SLOW_PERCENT` otherwise. */
  slowCap?: number;
}

/** Effects that happen at the start of the player's next turns, on the target they were played on. */
export interface DelayedEffect {
  turnsLeft: number;
  effects: Effect[];
  targetId?: string;
  /** Numbers as written (no Strength, Weak or bonuses): `echoDamage`'s are already worked out. */
  raw?: boolean;
}

export interface BonusTracker {
  attacksThisTurn: number;
  attacksThisFight: number;
  /** Enemy attack hits dodged so far (`dodgeAttacks`). */
  dodged: number;
  /** `firstBelowHalfHp` has fired. */
  belowHalf: boolean;
  /** Block gained from bonuses triggered by enemy attacks; it survives into the next turn. */
  carriedBlock: number;
}

export type CombatAction =
  | { type: 'playCard'; cardUid: string; targetId?: string }
  /** Puts one of the cards shown by `pickFromDraw` in hand. */
  | { type: 'pickCard'; cardUid: string }
  | { type: 'endTurn' };
