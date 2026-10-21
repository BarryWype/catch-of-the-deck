import { applyAction } from './combat';
import { isAlive } from './effects';
import { executeIntent } from './intents';
import type { CombatState, GameData } from './types';
import { clone } from './util';

/**
 * The fight as it would be after playing this card, worked out by playing it on a copy, so every
 * modifier counts (Strength, Weak, Vulnerable, Block, Burrow, bonuses, Powers…). null when it
 * can't be played. A play that rolls the dice (a random creature, random hits, a reshuffle) keeps
 * the creatures as they are: what it will hit isn't known yet.
 */
export function previewCard(state: CombatState, cardUid: string, targetId: string | undefined, data: GameData): CombatState | null {
  const next = applyAction(state, { type: 'playCard', cardUid, targetId }, data);
  if (next === state) return null;
  return next.rng === state.rng ? next : { ...next, enemies: state.enemies };
}

/**
 * The fight as it would be after each creature plays its shown move, in order, on a copy: Strikes
 * after the player's Hold and dodges, Pulls after Hold, Block, healing. Only the moves: not Venom,
 * nor the Will's rise at the end of the turn. A hidden (inked) move, and one a creature may be
 * bluffing with, is left out.
 */
export function previewIntents(state: CombatState, data: GameData): CombatState {
  const next = clone(state);
  if (next.phase !== 'playerTurn') return next;
  for (const enemy of next.enemies) {
    if (!isAlive(enemy) || enemy.intentHidden || enemy.bluff !== undefined) continue;
    executeIntent(next, enemy, data);
    if (next.player.hp <= 0) break;
  }
  return next;
}
