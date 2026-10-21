import { text } from './text';
import { equipmentEffects } from './equipment';
import { hasFeature } from './features';
import { nextInt } from './rng';
import { grantReward, startEventFight, withoutCreature, type RunState } from './run';
import type { CombatState, EventChoice, EventEffect, EventReward, GameData } from './types';
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

/** What an event reward is, said the player's way: a relic is a rare card while relics are off. */
function rewardText(reward: EventReward, data: GameData): string {
  return text(reward === 'relic' && hasFeature(data, 'gearRelics') ? 'event.reward.relic' : 'event.reward.rareCard');
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
    case 'loseCoins':
      return text('event.loseCoins', { coins: effect.amount });
    case 'coinsPerCreature':
      return text('event.coinsPerCreature', { coins: coinsPerCreatureValue(run, effect.amount, data), n: run.bucket.length });
    case 'cardReward':
      return text(effect.rare ? 'event.rareCardReward' : 'event.cardReward');
    case 'removeCard':
      return text('event.removeCard');
    case 'loseCard':
      return text('event.loseCard');
    case 'addJunk':
      return text('event.addJunk', { card: data.cards[effect.card]?.name ?? effect.card });
    case 'fight': {
      const who = effect.enemies?.length
        ? effect.enemies.map((id) => data.enemies[id]?.name ?? id).join(', ')
        : text(effect.trophy && hasFeature(data, 'trophyElites') ? 'event.trophyCreature' : 'event.aCreature');
      const prizes = [...(effect.reward ? [rewardText(effect.reward, data)] : []), ...(effect.coins ? [text('event.coins', { coins: effect.coins })] : [])];
      return text('event.fight', { who }) + (prizes.length ? ` ${text('event.ifYouWin', { reward: prizes.join(', ') })}` : '');
    }
    case 'tradeCatch':
      return text('event.tradeCatch', { reward: rewardText(effect.reward, data) });
    case 'freeNextFight':
      return effect.cardId ? text('event.freeCard', { card: data.cards[effect.cardId]?.name ?? effect.cardId }) : text('event.freeChosenCard');
    case 'gainEquipment':
      return effect.id
        ? text('event.gainEquipment', { item: data.equipment[effect.id]?.name ?? effect.id })
        : hasFeature(data, 'gearRelics')
          ? text('event.relicChoice')
          : text('event.rareCardReward');
  }
}

/** What the player must pick before a choice applies: a deck card, a bucket creature, or nothing. */
export function eventChoicePick(choice: EventChoice): 'card' | 'creature' | null {
  if (choice.effects.some((e) => e.type === 'tradeCatch')) return 'creature';
  if (choice.effects.some((e) => e.type === 'removeCard' || (e.type === 'freeNextFight' && !e.cardId))) return 'card';
  return null;
}

/** Why a choice can't be picked right now, or null if it can. */
export function eventChoiceBlocked(choice: EventChoice, run: RunState): string | null {
  const sum = (type: 'loseHp' | 'loseCoins') => choice.effects.reduce((total, e) => total + (e.type === type ? e.amount : 0), 0);
  if (sum('loseHp') >= run.hp) return text('event.notEnoughGrit');
  if (sum('loseCoins') > run.coins) return text('event.notEnoughCoins');
  if (eventChoicePick(choice) === 'creature' && !run.bucket.length) return text('event.noCreature');
  if (choice.effects.some((e) => e.type === 'removeCard' || e.type === 'loseCard') && run.deck.length <= 1) return text('event.deckTooSmall');
  return null;
}

/**
 * Apply one choice of an event. `pick` is the deck card or bucket slot it acts on, when it needs
 * one (`eventChoicePick`). `cardReward` tells the caller to offer a card next; `combat` is the
 * fight it started, if any (`fight`).
 */
export function applyEventChoice(
  run: RunState,
  eventId: string,
  choiceIndex: number,
  data: GameData,
  pick?: number,
): { run: RunState; cardReward: boolean; combat?: CombatState } {
  const choice = data.events[eventId]?.choices[choiceIndex];
  if (!choice) throw new Error(`Unknown choice ${choiceIndex} of event "${eventId}"`);
  const blocked = eventChoiceBlocked(choice, run);
  if (blocked) throw new Error(blocked);
  const needs = eventChoicePick(choice);
  if (needs === 'card' && (pick === undefined || !run.deck[pick])) throw new Error('Choose a card.');
  if (needs === 'creature' && (pick === undefined || !run.bucket[pick])) throw new Error('Choose a creature.');
  let next = clone(run);
  let cardReward = false;
  let combat: CombatState | undefined;
  for (const effect of choice.effects) {
    if (effect.type === 'heal') next.hp += healAmount(next, effect.percent);
    if (effect.type === 'loseHp') next.hp = Math.max(1, next.hp - effect.amount);
    if (effect.type === 'gainCoins') next.coins += effect.amount;
    if (effect.type === 'loseCoins') next.coins -= effect.amount;
    if (effect.type === 'coinsPerCreature') next.coins += coinsPerCreatureValue(next, effect.amount, data);
    if (effect.type === 'cardReward') {
      cardReward = true;
      if (effect.rare) next.luckyLure = true;
    }
    if (effect.type === 'removeCard') next.deck = next.deck.filter((_, i) => i !== pick);
    if (effect.type === 'loseCard') next.deck.splice(nextInt(next, 0, next.deck.length - 1), 1);
    if (effect.type === 'addJunk') next.deck.push(effect.card);
    if (effect.type === 'freeNextFight') next.freeCard = effect.cardId ?? run.deck[pick!];
    if (effect.type === 'tradeCatch' || effect.type === 'gainEquipment') {
      if (effect.type === 'tradeCatch') next = withoutCreature(next, pick!);
      const granted = effect.type === 'gainEquipment' && effect.id ? { run: { ...next, equipment: [...next.equipment, effect.id] }, cardReward: false } : grantReward(next, effect.type === 'tradeCatch' ? effect.reward : 'relic', data);
      next = granted.run;
      cardReward ||= granted.cardReward;
    }
    if (effect.type === 'fight') ({ run: next, combat } = startEventFight(next, effect, data));
  }
  return { run: next, cardReward, ...(combat ? { combat } : {}) };
}
