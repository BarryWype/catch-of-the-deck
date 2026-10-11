import type { ShopItemDef } from '../engine';

/** What the shop sells, on every shop node of the levels (levels.ts). */
export const shop: ShopItemDef[] = [
  { id: 'heart', name: 'Heart', icon: '❤️', price: 10, effect: { type: 'heal', amount: 30 } },
  { id: 'removeCard', name: 'Remove a card', icon: '✂️', price: 20, effect: { type: 'removeCard' }, limit: 1 },
];
