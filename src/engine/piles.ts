import { MAX_HAND_SIZE } from './constants';
import { shuffleInPlace } from './rng';
import type { CombatState } from './types';
import { text } from './text';
import { addLog } from './util';

export function reshuffleDiscardIntoDraw(state: CombatState): void {
  state.piles.draw.push(...state.piles.discard);
  state.piles.discard = [];
  shuffleInPlace(state, state.piles.draw);
  addLog(state, text('log.shuffled'));
}

/**
 * Draw up to `count` cards. When the draw pile runs out, the discard pile is
 * shuffled into it. Stops early if both are empty or the hand is full.
 * Returns the number of cards actually drawn.
 */
export function drawCards(state: CombatState, count: number): number {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (state.piles.hand.length >= MAX_HAND_SIZE) break;
    if (state.piles.draw.length === 0) {
      if (state.piles.discard.length === 0) break;
      reshuffleDiscardIntoDraw(state);
    }
    state.piles.hand.push(state.piles.draw.pop()!);
    drawn++;
  }
  return drawn;
}

export function discardHand(state: CombatState): void {
  state.piles.discard.push(...state.piles.hand);
  state.piles.hand = [];
}
