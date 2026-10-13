import { text } from './text';
import { equipmentEffects } from './equipment';
import type { RunState } from './run';
import type { EventChoice, EventEffect, GameData } from './types';
import { clone } from './util';

/** Coins a `coinsPerCreature` of `amount` gives: per creature, raised by passerby equipment bonuses (rounded up). */
export function coinsPerCreatureValue(run: RunState, amount: number, data: GameData): number {
  const bonus = equipmentEffects(run.equipment, data)
    .filter((e) => e.type === 'passerbyBonus')
    .reduce((sum, e) => sum + e.bonusPercent, 0);
  return Math.ceil((amount * (100 + bonus)) / 100) * run.bucket.length;
}

/** HP a `heal` of `percent` restores right now (never above max HP). */
export function healAmount(run: RunState, percent: number): number {
  return Math.min(run.maxHp - run.hp, Math.ceil((run.maxHp * percent) / 100));
}

/** Player-facing text for one effect, with the run's real numbers. */
export function describeEventEffect(effect: EventEffect, run: RunState, data: GameData): string {
  switch (effect.type) {
    case 'heal':
      return text('event.heal', { n: healAmount(run, effect.percent) });
    case 'loseHp':
      return text('event.loseHp', { n: effect.amount });
    case 'gainCoins':
      return text('event.gainCoins', { coins: effect.amount });
    case 'coinsPerCreature':
      return text('event.coinsPerCreature', { coins: coinsPerCreatureValue(run, effect.amount, data), n: run.bucket.length });
    case 'cardReward':
      return text('event.cardReward');
  }
}

/** Why a choice can't be picked right now, or null if it can. */
export function eventChoiceBlocked(choice: EventChoice, run: RunState): string | null {
  const hpLoss = choice.effects.reduce((sum, e) => sum + (e.type === 'loseHp' ? e.amount : 0), 0);
  if (hpLoss >= run.hp) return text('event.notEnoughGrit');
  return null;
}

/** Apply one choice of an event. `cardReward` tells the caller to offer a card next. */
export function applyEventChoice(
  run: RunState,
  eventId: string,
  choiceIndex: number,
  data: GameData,
): { run: RunState; cardReward: boolean } {
  const choice = data.events[eventId]?.choices[choiceIndex];
  if (!choice) throw new Error(`Unknown choice ${choiceIndex} of event "${eventId}"`);
  const blocked = eventChoiceBlocked(choice, run);
  if (blocked) throw new Error(blocked);
  const next = clone(run);
  for (const effect of choice.effects) {
    if (effect.type === 'heal') next.hp += healAmount(next, effect.percent);
    if (effect.type === 'loseHp') next.hp = Math.max(1, next.hp - effect.amount);
    if (effect.type === 'gainCoins') next.coins += effect.amount;
    if (effect.type === 'coinsPerCreature') next.coins += coinsPerCreatureValue(next, effect.amount, data);
  }
  return { run: next, cardReward: choice.effects.some((e) => e.type === 'cardReward') };
}
