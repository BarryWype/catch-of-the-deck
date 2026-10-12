import { PLAYER_HP_NAME } from './constants';
import type { RunState } from './run';
import type { GameData, ShopItemDef } from './types';
import { clone } from './util';

/** Purchases made during the current shop visit, by item id. */
export interface ShopVisit {
  bought: Record<string, number>;
}

/** Why the item can't be bought right now, or null if it can. */
export function shopItemBlocked(item: ShopItemDef, run: RunState, visit: ShopVisit): string | null {
  if (item.limit !== undefined && (visit.bought[item.id] ?? 0) >= item.limit) return 'Sold out.';
  if (item.effect.type === 'heal' && run.hp >= run.maxHp) return `Already at full ${PLAYER_HP_NAME}.`;
  if (item.effect.type === 'removeCard' && run.deck.length <= 1) return 'No card to spare.';
  if (run.coins < item.price) return 'Not enough coins.';
  return null;
}

/** Buy an item. A `removeCard` item needs the index of the deck card to remove. */
export function buyShopItem(
  run: RunState,
  visit: ShopVisit,
  itemId: string,
  data: GameData,
  cardIndex?: number,
): { run: RunState; visit: ShopVisit } {
  const item = data.shop.find((i) => i.id === itemId);
  if (!item) throw new Error(`Unknown shop item "${itemId}"`);
  const blocked = shopItemBlocked(item, run, visit);
  if (blocked) throw new Error(blocked);
  const next = clone(run);
  next.coins -= item.price;
  if (item.effect.type === 'heal') next.hp = Math.min(next.maxHp, next.hp + item.effect.amount);
  if (item.effect.type === 'removeCard') {
    if (cardIndex === undefined || !next.deck[cardIndex]) throw new Error('Choose a card to remove.');
    next.deck.splice(cardIndex, 1);
  }
  return { run: next, visit: { bought: { ...visit.bought, [item.id]: (visit.bought[item.id] ?? 0) + 1 } } };
}
