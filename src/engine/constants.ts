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
/** The most Patience the player can have. */
export const MAX_PATIENCE = 5;
/** Hold left at the end of the creatures' turn becomes 1 Patience per this much. */
export const HOLD_PER_PATIENCE = 3;
/** The least Health a fight's creatures have together, before `ENCOUNTER_GROWTH_PERCENT`. */
export const ENCOUNTER_HP_POOL = 50;
/** What a fight's creatures' moves average, Strike or Pull, before `ENCOUNTER_GROWTH_PERCENT`. Split between them in a group. */
export const ENCOUNTER_DAMAGE = 8;
/** How much a fight's Health pool and damage grow, in percent, per fight already gone through this run. */
export const ENCOUNTER_GROWTH_PERCENT = 2;
/** A creature's share of the damage in a group of several, in percent. */
export const GROUP_DAMAGE_PERCENT = 110;
/** What a mini-boss's and a boss's moves average (rolled each fight, no growth). */
export const MINI_BOSS_DAMAGE: [number, number] = [9, 10];
export const BOSS_DAMAGE: [number, number] = [10, 12];
