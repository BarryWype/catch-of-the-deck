export const PLAYER_ID = 'player';
export const STARTING_HAND_SIZE = 5;
export const BASE_ENERGY = 3;
export const MAX_HAND_SIZE = 10;
export const MAX_LOG_ENTRIES = 100;
export const VULNERABLE_MULTIPLIER = 1.5;
export const WEAK_MULTIPLIER = 0.75;
/** How much each Patience point slows every creature's escape bar, in percent of its `escapeRate`. */
export const PATIENCE_ESCAPE_PERCENT = 10;
/** How much each stack of Slow slows a creature's escape bar, in percent of its `escapeRate`. */
export const SLOW_PERCENT = 20;
/** The most a creature's escape bar can be slowed, in percent (Slow and Patience together). */
export const MAX_SLOW_PERCENT = 80;
/** A creature move's size by intensity, before the fight scales it. */
export const MOVE_INTENSITY = { light: 0.5, normal: 1, heavy: 1.4 } as const;
/** How much a pace move slows its Will's rise that turn, in percent of the rise kept. */
export const PACE_WILL_PERCENT = 50;
/** The most junk cards a creature can put in the player's deck at once. */
export const MAX_JUNK_CARDS = 3;
/** Skittish: playing this many cards in a turn raises the creature's Will by `SKITTISH_WILL` (scaled to the fight). */
export const SKITTISH_CARDS = 3;
export const SKITTISH_WILL = 6;
/** Spines: Grit each of the player's attack hits costs them. */
export const SPINES_GRIT = 1;
/** Burrow: how much less the player's attacks deal against a burrowed creature, in percent. */
export const BURROW_PERCENT = 50;
/** Pinched Hand: how much less Hold each Hold card gives. Numb Fingers and Tangled raise card costs by `TAX_COST`. */
export const PINCHED_HAND_HOLD = 2;
export const TAX_COST = 1;
/** Second Wind: below this share of Health or Will (percent), a mini-boss or boss moves `SECOND_WIND_POINTS` (scaled to the fight) from its other bar into the low one. */
export const SECOND_WIND_PERCENT = 25;
export const SECOND_WIND_POINTS = 15;
/** How much bigger a creature's move is after its Wind-up, in percent. */
export const WIND_UP_PERCENT = 30;
/** The most Strength a creature's moves can give it in a fight (starting Strength aside). */
export const MAX_MOVE_STRENGTH = 3;
/** The most Patience the player can have. */
export const MAX_PATIENCE = 5;
/** Hold left at the end of the creatures' turn becomes 1 Patience per this much. */
export const HOLD_PER_PATIENCE = 3;
/** The least Health a fight's creatures have together, before `ENCOUNTER_GROWTH_PERCENT`. */
export const ENCOUNTER_HP_POOL = 50;
/**
 * The least Will a fight's creatures start with together, before `ENCOUNTER_GROWTH_PERCENT`. Small
 * creatures get a bigger bar (start, top and rise alike), so draining them takes about as long as
 * wearing their Health down.
 */
export const ENCOUNTER_WILL_POOL = 45;
/**
 * What a fight's creatures deal per turn on average (Strike or Pull, over all their moves as often
 * as they come, intensity and Wind-ups included), before `ENCOUNTER_GROWTH_PERCENT`. Split between
 * them in a group.
 */
export const ENCOUNTER_TURN_AVERAGE = 5.5;
/** How much a fight's Health pool and damage grow, in percent, per fight already gone through this run. */
export const ENCOUNTER_GROWTH_PERCENT = 2;
/** Most creatures in an ordinary fight: larger groups and `extraCatch` creatures beyond it are left out (several stack too tall on phones). */
export const MAX_CREATURES_PER_FIGHT = 1;
/** A creature's share of the damage in a group of several, in percent. */
export const GROUP_DAMAGE_PERCENT = 110;
/** What a mini-boss's and a boss's moves average per turn (rolled each fight, no growth). */
export const MINI_BOSS_DAMAGE: [number, number] = [9, 10];
export const BOSS_DAMAGE: [number, number] = [10, 12];

/**
 * The fight-variety features, each with its own toggle, so they can be tried one by one (the debug
 * panel's Features). The engine reads them from `GameData.features` (`hasFeature`); content built
 * without any (`buildGameData` alone, as the tests do) has them all off, which plays as before.
 */
export interface Features {
  /** More events, spread across the levels, never twice in a run while unseen ones remain. */
  moreEvents: boolean;
  /** Gear earned mid-run as relics: after mini-bosses, on treasures and after trophy fights. */
  gearRelics: boolean;
  /** About 1 in 6 fights per level is a tougher trophy fight, with a better reward. */
  trophyElites: boolean;
  /** Each mini-boss and boss is drawn from a few candidates per run. */
  bossPools: boolean;
  /** Creatures keep their own Health, Will and damage spread instead of all being raised to the same pools. */
  ownStats: boolean;
  /** Each temperament has a signature trait. */
  traits: boolean;
  /** Trophy creatures, and some adult and elder ones, roll an affix. */
  affixes: boolean;
  /** Bosses play their own move sets, each with a signature mechanic. */
  bossGimmicks: boolean;
  /** Long ordinary fights tighten: more Pulls, fewer pace moves. */
  escalation: boolean;
  /** Two-creature fights in the adult and elder levels. */
  groupFights: boolean;
}
export type FeatureId = keyof Features;
/** What the game plays with unless the debug panel says otherwise. */
export const FEATURES: Features = {
  moreEvents: true,
  gearRelics: true,
  trophyElites: true,
  bossPools: true,
  ownStats: true,
  traits: true,
  affixes: true,
  bossGimmicks: true,
  escalation: true,
  groupFights: true,
};
export const NO_FEATURES: Features = Object.fromEntries(Object.keys(FEATURES).map((id) => [id, false])) as unknown as Features;

/** Relic choices (`gearRelics`): how many relics are offered at once, and each rarity's weight by level (kid, adult, elder; the last covers later ones). */
export const RELIC_CHOICES = 3;
export const RELIC_ODDS: { common: number; uncommon: number; rare: number }[] = [
  { common: 60, uncommon: 30, rare: 10 },
  { common: 45, uncommon: 35, rare: 20 },
  { common: 30, uncommon: 40, rare: 30 },
];

/** Trophy fights (`trophyElites`): about 1 in `TROPHY_NODE_SHARE` ordinary fights of a level (at least `TROPHY_MIN_NODES`, never in column 1). */
export const TROPHY_NODE_SHARE = 6;
export const TROPHY_MIN_NODES = 2;
/** A trophy fight's creatures: Health and Will this much bigger, damage this much bigger, in percent. */
export const TROPHY_POOL_PERCENT = 140;
export const TROPHY_DAMAGE_PERCENT = 120;
/** A trophy-size catch sells for this share of its value, in percent (`trophyElites`). */
export const TROPHY_SELL_PERCENT = 200;
