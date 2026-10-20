import type { ProgressionNodeDef } from '../engine';

/**
 * The Logbook, bought on the menu with golden shells (see engine/progression.ts). Each track is a
 * column, and each node requires the one before it; its name in each track is `logbook.track.<id>`
 * in the language files. `icon` is an emoji or a file in ui/assets/icons.
 */
export const progression: ProgressionNodeDef[] = [
  { id: 'tackleBox', track: 'gear', requires: [], cost: 10, icon: '🔄', effect: { type: 'rerollsAtStart', amount: 1 }, name: 'Tackle box', description: 'Start every run with 1 more card reward reroll.' },
  { id: 'savingsJar', track: 'gear', requires: ['tackleBox'], cost: 25, icon: 'coin-stack', effect: { type: 'coinsAtStart', amount: 10 }, name: 'Savings jar', description: 'Start every run with 10 more coins.' },
  { id: 'biggerBucket', track: 'gear', requires: ['savingsJar'], cost: 45, icon: 'bucket', effect: { type: 'bucketSpace', amount: 1 }, name: 'Bigger bucket', description: 'Your bucket holds 1 more creature.' },
  { id: 'deepBucket', track: 'gear', requires: ['biggerBucket'], cost: 70, icon: 'worm-in-bucket', effect: { type: 'bucketSpace', amount: 1 }, name: 'Deep bucket', description: 'Your bucket holds 1 more creature.' },

  { id: 'lifeJackets', track: 'haggling', requires: [], cost: 10, icon: 'life-jacket', effect: { type: 'shopItem', item: 'lifeJacket' }, name: 'Life jackets', description: 'The Tackle shop sells life jackets.' },
  { id: 'parcels', track: 'haggling', requires: ['lifeJackets'], cost: 25, icon: 'parcel', effect: { type: 'shopItem', item: 'parcel' }, name: 'Parcel service', description: 'The Tackle shop sells parcels.' },
  { id: 'haggler', track: 'haggling', requires: ['parcels'], cost: 45, icon: '🏷️', effect: { type: 'shopDiscount', amount: 20 }, name: 'Haggler', description: 'Store prices are 20% lower (rounded down).' },
  { id: 'luckyLures', track: 'haggling', requires: ['haggler'], cost: 70, icon: 'lure2', effect: { type: 'shopItem', item: 'luckyLure' }, name: 'Lucky lures', description: 'The Tackle shop sells lucky lures.' },

  { id: 'fishmonger', track: 'creatures', requires: [], cost: 10, icon: 'golden-fish', effect: { type: 'sellBonus', amount: 20 }, name: 'Fishmonger', description: 'Creatures sell for 20% more.' },
  { id: 'cosyAquarium', track: 'creatures', requires: ['fishmonger'], cost: 25, icon: 'house', effect: { type: 'restingBondLevel', level: 2 }, name: 'Cosy aquarium', description: 'Creatures resting at home bond up to level 2, instead of 1.' },
  { id: 'keenEye', track: 'creatures', requires: ['cosyAquarium'], cost: 45, icon: 'chest', effect: { type: 'rewardChoices', amount: 1 }, name: 'Keen eye', description: 'Card rewards offer 1 more card to choose from.' },
  { id: 'trustedHand', track: 'creatures', requires: ['keenEye'], cost: 70, icon: 'star', effect: { type: 'companionStars', amount: 1 }, name: 'Trusted hand', description: 'Every companion counts 1 more ★.' },
];
