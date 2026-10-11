// ---------------------------------------------------------------------------
// Content definitions: the shapes designers fill in under /src/content.
// ---------------------------------------------------------------------------

export type StatusId = 'strength' | 'vulnerable' | 'weak' | 'snared' | 'poison';
export type Statuses = Partial<Record<StatusId, number>>;

/**
 * Who an effect lands on, from the point of view of whoever is acting.
 * - `target`: the chosen enemy (for the player) or the player (for an enemy)
 * - `self`: the acting combatant
 * - `allEnemies`: every living opponent of the actor
 * - `randomEnemy`: one random living opponent, re-rolled per hit
 */
export type EffectTarget = 'target' | 'self' | 'allEnemies' | 'randomEnemy';

/** Hits deal `STRONG_BONUS_PERCENT` more damage against enemies carrying any of the `against` tags (creature types). */
export interface DamageBonus {
  against: string[];
}

/** The reusable building blocks that every card and enemy move is made of. */
export type Effect =
  | { type: 'dealDamage'; amount: number; hits?: number; target?: EffectTarget; bonus?: DamageBonus }
  | { type: 'gainBlock'; amount: number }
  | { type: 'applyStatus'; status: StatusId; amount: number; target?: EffectTarget }
  | { type: 'drawCards'; amount: number }
  | { type: 'gainEnergy'; amount: number }
  /** Move a creature's escape bar: negative calms it toward capture (0), positive panics it toward fleeing. */
  | { type: 'changeEscape'; amount: number; target?: EffectTarget }
  /** Permanently change how fast a creature's escape bar rises each turn (never below 0). */
  | { type: 'changeEscapeRate'; amount: number; target?: EffectTarget };

export type CardType = 'attack' | 'skill' | 'power';
export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare';

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  /** `enemy` = the player must pick an enemy to play it on. */
  target: 'enemy' | 'none';
  effects: Effect[];
  /** Removed from the fight after being played. Powers always exhaust. */
  exhaust?: boolean;
  /** Only offered as a reward to this build. Offered to every build if omitted. */
  build?: string;
  /** Optional text override. Normally generated from `effects`. */
  description?: string;
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
  /** Tags (creature types) this build's cards are strong against. Display-only. */
  strongAgainst: string[];
  /** Display-only art. */
  sprite?: SpriteRef;
  /** Equipment the player picks one of to start the run with (the first if none is picked). */
  startingItems?: string[];
  /** Id of the level from which the build can be picked; the first level if omitted. */
  level?: string;
}

/** What a piece of equipment does. Percentages are whole numbers (20 = 20%). */
export type EquipmentEffect =
  /** Every creature's escape rate drops by this share (at least 1, rounded up) at the start of each fight. */
  | { type: 'slowEscape'; percent: number }
  /** Captured creatures are sold on the spot, for this much more, instead of going into the bucket. */
  | { type: 'sellOnCapture'; bonusPercent: number }
  /** Enthusiastic passersby pay this much more per fish. */
  | { type: 'passerbyBonus'; bonusPercent: number }
  /** Player effects that lower a creature's Panic lower it by this much more (rounded up). */
  | { type: 'strongerPull'; percent: number }
  /** Creatures caught during the run come home with this many bond points. */
  | { type: 'bondOnCapture'; amount: number }
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
 * Every `amount` is for one species; more species of the same temperament scale it.
 * Percentages are whole numbers (10 = 10%).
 */
export type CompanionEffect =
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
  /** Player effects that lower Panic lower it by this much more. */
  | { type: 'bonusEscapeReduction'; amount: number }
  /** Every creature's escape rate drops by this percentage at the start of each fight (like the Reliable Reel). */
  | { type: 'slowEscape'; amount: number }
  /** Extra max HP for the run, given when it starts. */
  | { type: 'bonusMaxHp'; amount: number }
  /** Heal this much after each fight that isn't lost. */
  | { type: 'healAfterFight'; amount: number }
  /** Creatures sell for this percentage more during the run (bucket and on-the-spot sales). */
  | { type: 'sellBonus'; amount: number }
  /** Resolve `effect` as the player whenever `on` happens. Its numbers ignore Strength and other modifiers. */
  | { type: 'trigger'; on: CompanionTrigger; effect: Effect };

/** The bonus a temperament gives when creatures of it are brought along. */
export interface CompanionBonusDef {
  /** The temperament id (content/behaviors.ts). */
  id: string;
  name: string;
  /** How the temperament is shown to the player, e.g. "Reef fish". Display-only. */
  temperamentName: string;
  /** Placeholder art (emoji). Display-only. */
  icon?: string;
  /** What the one-species bonus does, for developers. Not shown: the game generates its text from `effects`. */
  description?: string;
  /** Which playstyle it suits (a build id, or e.g. 'any', 'defensive', 'economy'), for future help guides. Unused for now. */
  bestBuild?: string;
  /** For one species; scaled by the number of species (see `COMPANION_SCALE_CAP`). */
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

/** Something for sale in a shop. */
export interface ShopItemDef {
  id: string;
  name: string;
  /** Placeholder art (emoji). Display-only. */
  icon?: string;
  price: number;
  effect: { type: 'heal'; amount: number } | { type: 'removeCard' };
  /** How many times it can be bought per shop visit. Unlimited if omitted. */
  limit?: number;
}

/** A creature type, used as an enemy tag (e.g. 'crustacean'). */
export interface CreatureTypeDef {
  id: string;
  name: string;
  /** Placeholder art (emoji) for map events of this type. Display-only. */
  icon?: string;
  /** Terrain patch drawn under map fights of this type. Display-only. */
  terrain?: SpriteRef;
}

export interface EnemyMove {
  id: string;
  name: string;
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
  /** Pick by weight. `maxConsecutive` caps how often the same move can repeat in a row. */
  | { type: 'weighted'; weights: Record<string, number>; firstMove?: string; maxConsecutive?: number };

export interface EnemyDef {
  id: string;
  name: string;
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
  /** Position on the coast art (1200×600). Display-only. */
  x: number;
  y: number;
  kind: LevelNodeKind;
  /** Fights: the fishing spot, which picks the creatures (see `encountersFor`). */
  spot?: string;
  /** Fights: only creatures of this type. */
  creatureType?: string;
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

/** One act of a run, played on its own hand-made map. */
export interface LevelDef {
  id: string;
  name: string;
  /** Creature tier its fights draw from (1 = shallow, 3 = deep). */
  tier: number;
  /** Where the run starts on the art (the grandparents' house). Display-only. */
  start: { x: number; y: number };
  /** The area in reach this level, as an SVG path on the art; outside is shaded. Everything if omitted. Display-only. */
  reach?: string;
  nodes: LevelNodeDef[];
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
  creatureTypes: Record<string, CreatureTypeDef>;
  equipment: Record<string, EquipmentDef>;
  events: Record<string, EventDef>;
  shop: ShopItemDef[];
  /** Keyed by temperament id. */
  companionBonuses: Record<string, CompanionBonusDef>;
  spots: Record<string, SpotDef>;
  /** Played in order, one per act of a run. */
  levels: LevelDef[];
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
}

export interface EnemyState extends Combatant {
  defId: string;
  tags: string[];
  /** The move this enemy will perform on its next turn (shown to the player). */
  intent: string | null;
  moveHistory: string[];
  /** The escape bar, 0..escapeAt: it flees at `escapeAt` and is captured at 0. */
  escape: number;
  escapeAt: number;
  escapeRate: number;
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
  /** Extra share, in percent, of every Panic reduction from the player (`strongerPull` equipment). */
  pullPercent?: number;
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
  | { type: 'endTurn' };
