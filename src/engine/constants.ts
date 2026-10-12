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
/** The most Patience the player can have. */
export const MAX_PATIENCE = 5;
/** Hold left at the end of the creatures' turn becomes 1 Patience per this much. */
export const HOLD_PER_PATIENCE = 3;
/** Player-facing name of the player's Block: their hold on the line, which soaks Strikes and Pulls. */
export const PLAYER_BLOCK_NAME = 'Hold';
/** Player-facing name of the player's HP: the will to keep fishing, worn down by the creatures. */
export const PLAYER_HP_NAME = 'Grit';
/** Player-facing name of a creature's escape bar. */
export const ESCAPE_BAR_NAME = 'Panic';
