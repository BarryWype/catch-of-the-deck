export const PLAYER_ID = 'player';
export const STARTING_HAND_SIZE = 5;
export const BASE_ENERGY = 3;
export const MAX_HAND_SIZE = 10;
export const MAX_LOG_ENTRIES = 100;
export const VULNERABLE_MULTIPLIER = 1.5;
export const WEAK_MULTIPLIER = 0.75;
/** Extra damage, in percent, of a card's `bonus` against its creature types (rounded). */
export const STRONG_BONUS_PERCENT = 20;
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
 * What a fight's creatures deal per turn on average (Strike or Pull, over all their moves as often
 * as they come, intensity and Wind-ups included), before `ENCOUNTER_GROWTH_PERCENT`. Split between
 * them in a group.
 */
export const ENCOUNTER_TURN_AVERAGE = 5.5;
/** How much a fight's Health pool and damage grow, in percent, per fight already gone through this run. */
export const ENCOUNTER_GROWTH_PERCENT = 2;
/** A creature's share of the damage in a group of several, in percent. */
export const GROUP_DAMAGE_PERCENT = 110;
/** What a mini-boss's and a boss's moves average per turn (rolled each fight, no growth). */
export const MINI_BOSS_DAMAGE: [number, number] = [9, 10];
export const BOSS_DAMAGE: [number, number] = [10, 12];
