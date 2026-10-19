import type { BlessingDef, ShopItemDef } from '../engine';

/**
 * What each store sells, on every visit (see STORES.md). Every shop node of the maps is one of the
 * three stores, drawn when the map is made. `icon` names a file in ui/assets/icons.
 */
export const shop: ShopItemDef[] = [
  { id: 'cocoa', store: 'cafe', name: 'Cocoa cup', icon: 'coffee', price: 15, effect: { type: 'heal', amount: 15 } },
  { id: 'espresso', store: 'cafe', name: 'Espresso', icon: 'coffee2', price: 20, effect: { type: 'maxHpForFights', amount: 20, fights: 5 }, limit: 1 },

  { id: 'lifeJacket', store: 'tackle', name: 'Life jacket', icon: 'life-jacket', price: 20, effect: { type: 'lifeJacket' }, limit: 1 },
  { id: 'parcel', store: 'tackle', name: 'Parcel', icon: 'parcel', price: 15, effect: { type: 'sendHome' }, limit: 1 },
  { id: 'luckyLure', store: 'tackle', name: 'Lucky lure', icon: 'lure2', price: 40, effect: { type: 'rareReward' }, limit: 1 },
  { id: 'spareHook', store: 'tackle', name: 'Spare hook', icon: 'hook', price: 10, effect: { type: 'extraRewardCard' } },
  { id: 'removeCard', store: 'tackle', name: 'Remove a card', icon: 'scissors', price: 20, effect: { type: 'removeCard' }, limit: 1 },

  { id: 'bucketExtension', store: 'bait', name: 'Bucket extension', icon: 'bucket', price: 20, effect: { type: 'bucketSpace', amount: 3 }, limit: 1 },
  { id: 'blessingRelease', store: 'bait', name: 'Blessing release', icon: 'golden-fish', price: 0, effect: { type: 'release' }, limit: 1 },
  { id: 'aquarium', store: 'bait', name: "Keeper's aquarium", icon: 'coin-stack', price: 0, effect: { type: 'aquariumSale', percent: 200 }, limit: 1 },
];

/** What releasing a creature at the Bait shop gives: one is drawn per visit. */
export const blessings: BlessingDef[] = [
  { id: 'damage', icon: 'sword', effect: { type: 'bonus', bonus: { type: 'bonusDamage', amount: 1 }, fights: 5 } },
  { id: 'drain', icon: 'net-green', effect: { type: 'bonus', bonus: { type: 'bonusEscapeReduction', amount: 2 }, fights: 4 } },
  {
    id: 'vulnerable',
    icon: 'arrow-down-red',
    effect: { type: 'bonus', bonus: { type: 'trigger', on: 'combatStart', effect: { type: 'applyStatus', status: 'vulnerable', amount: 2, target: 'allEnemies' } }, fights: 5 },
  },
  { id: 'hold', icon: 'life-buoy', effect: { type: 'bonus', bonus: { type: 'trigger', on: 'combatStart', effect: { type: 'gainBlock', amount: 5 } }, fights: 5 } },
  { id: 'bond', effect: { type: 'bond', amount: 30 } },
  { id: 'grit', effect: { type: 'heal', amount: 20 } },
];
