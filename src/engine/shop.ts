import { addBond, bondToFull } from './bond';
import { saleValue } from './equipment';
import { creatureFamilies } from './families';
import { text } from './text';
import { discountedPrice, isShopItemUnlocked } from './progression';
import { asHomeCreature, runSellBonus, withoutCreature, type RunState } from './run';
import type { Catch } from './sizes';
import type { GameData, ShopItemDef, StoreKind } from './types';
import { clone } from './util';

/** The store being visited (`visitShop`), and what happened there so far. */
export interface ShopVisit {
  store: StoreKind;
  /** Purchases made during this visit, by item id. */
  bought: Record<string, number>;
  /** Bait shop: the blessing a release gives this visit (`BlessingDef` id). */
  blessing?: string;
  /** Bait shop: the family the keeper's aquarium buys this visit… */
  family?: string;
  /** …and the creature it bought, shown in the tank. */
  sold?: Catch;
}

/**
 * What the visited store sells, in content order, at the run's prices: items a Logbook node unlocks
 * only once it's bought, and prices after its discounts (`discountedPrice`).
 */
export function storeItems(run: RunState, visit: Pick<ShopVisit, 'store'>, data: GameData): ShopItemDef[] {
  return data.shop
    .filter((item) => item.store === visit.store && isShopItemUnlocked(item, run.progression, data))
    .map((item) => ({ ...item, price: discountedPrice(item.price, run.progression, data) }));
}

/** Items that act on a bucket creature the player picks (`creatureBlocked` says which ones can be picked). */
export function needsCreature(item: ShopItemDef): boolean {
  return ['lifeJacket', 'sendHome', 'release', 'aquariumSale'].includes(item.effect.type);
}

/** Is the bucket creature at `slot` one of `family`? Any of its families counts. */
export function isOfFamily(run: RunState, slot: number, family: string | undefined, data: GameData): boolean {
  const id = run.bucket[slot]?.id;
  return !!id && creatureFamilies(id, data).some((f) => f.id === family);
}

/** Why the bucket creature at `slot` can't be picked for `item`, or null if it can. */
export function creatureBlocked(item: ShopItemDef, run: RunState, visit: ShopVisit, slot: number, data: GameData): string | null {
  const creature = run.bucket[slot];
  if (!creature) return text('shop.noCreature');
  if (item.effect.type === 'lifeJacket' && creature.lifeJacket) return text('shop.hasLifeJacket');
  if (item.effect.type === 'aquariumSale' && !isOfFamily(run, slot, visit.family, data)) return text('shop.wrongFamily');
  return null;
}

/** Why the item (one of `storeItems`, at the run's price) can't be bought right now, or null if it can. */
export function shopItemBlocked(item: ShopItemDef, run: RunState, visit: ShopVisit, data: GameData): string | null {
  if (item.limit !== undefined && (visit.bought[item.id] ?? 0) >= item.limit) return text('shop.soldOut');
  if (item.effect.type === 'heal' && run.hp >= run.maxHp) return text('shop.fullGrit');
  if (item.effect.type === 'removeCard' && run.deck.length <= 1) return text('shop.noCardToSpare');
  if (needsCreature(item) && !run.bucket.some((_, slot) => !creatureBlocked(item, run, visit, slot, data)))
    return text(item.effect.type === 'aquariumSale' ? 'shop.noneOfFamily' : 'shop.noCreature');
  if (run.coins < item.price) return text('shop.notEnoughCoins');
  return null;
}

/** What the keeper's aquarium pays for the bucket creature at `slot`: its sale value (`runSellBonus` included), times the item's percent. */
export function aquariumPrice(item: ShopItemDef, run: RunState, slot: number, data: GameData): number {
  if (item.effect.type !== 'aquariumSale' || !run.bucket[slot]) return 0;
  return Math.ceil((saleValue(run.bucket[slot].id, runSellBonus(run, data), data, run.bucket[slot].size) * item.effect.percent) / 100);
}

/**
 * Buy an item. `choice` is the deck card to remove for `removeCard`, and the bucket slot of the
 * creature for the items that `needsCreature`.
 */
export function buyShopItem(
  run: RunState,
  visit: ShopVisit,
  itemId: string,
  data: GameData,
  choice?: number,
): { run: RunState; visit: ShopVisit } {
  const item = storeItems(run, visit, data).find((i) => i.id === itemId);
  if (!item) throw new Error(`"${itemId}" isn't sold here`);
  const blocked = shopItemBlocked(item, run, visit, data);
  if (blocked) throw new Error(blocked);
  if (needsCreature(item)) {
    const why = choice === undefined ? text('shop.noCreature') : creatureBlocked(item, run, visit, choice, data);
    if (why) throw new Error(why);
  }
  let next = clone(run);
  next.coins -= item.price;
  const nextVisit: ShopVisit = { ...clone(visit), bought: { ...visit.bought, [item.id]: (visit.bought[item.id] ?? 0) + 1 } };
  const slot = choice!;
  const effect = item.effect;
  switch (effect.type) {
    case 'heal':
      next.hp = Math.min(next.maxHp, next.hp + effect.amount);
      break;
    case 'removeCard':
      if (choice === undefined || !next.deck[choice]) throw new Error('Choose a card to remove.');
      next.deck.splice(choice, 1);
      break;
    case 'maxHpForFights':
      next.maxHp += effect.amount;
      next.hp += effect.amount;
      next.boons.push({ fightsLeft: effect.fights, maxHp: effect.amount, item: item.id });
      break;
    case 'lifeJacket':
      next.bucket[slot].lifeJacket = true;
      break;
    case 'sendHome': {
      const posted = asHomeCreature(next, slot, data);
      next = withoutCreature(next, slot);
      next.sentHome.push(posted);
      break;
    }
    case 'rareReward':
      next.luckyLure = true;
      break;
    case 'extraRewardCard':
      next.spareHooks++;
      break;
    case 'bucketSpace':
      next.bucketSize += effect.amount;
      break;
    case 'release':
      next = bless(withoutCreature(next, slot), visit.blessing, item.id, data);
      break;
    case 'aquariumSale': {
      const price = aquariumPrice(item, next, slot, data);
      nextVisit.sold = { id: next.bucket[slot].id, size: next.bucket[slot].size };
      next = withoutCreature(next, slot);
      next.coins += price;
      break;
    }
  }
  return { run: next, visit: nextVisit };
}

/** The run with the blessing `id` given (a creature was released for it). */
function bless(run: RunState, id: string | undefined, item: string, data: GameData): RunState {
  const blessing = data.blessings.find((b) => b.id === id);
  if (!blessing) throw new Error(`Unknown blessing "${id}"`);
  const effect = blessing.effect;
  switch (effect.type) {
    case 'bonus':
      run.boons.push({ fightsLeft: effect.fights, bonus: clone(effect.bonus), item, blessing: blessing.id });
      break;
    case 'heal':
      run.hp = Math.min(run.maxHp, run.hp + effect.amount);
      break;
    case 'bond':
      run.companions = run.companions.map((c) => addBond(c, effect.amount, data));
      run.bucket = run.bucket.map((c, slot) =>
        slot < run.companions.length ? c : { ...c, bond: Math.min(bondToFull(c.id, data), (c.bond ?? 0) + effect.amount) },
      );
      break;
  }
  return run;
}
