import type { EventDef } from '../engine';

/**
 * Map events, met on the levels' event nodes (levels.ts). Which one happens is drawn on
 * arrival, among those whose `minColumn` the node has reached. Events marked `treasure` are only
 * met on treasure nodes instead. Each choice's `effects` are applied in order; the effect text
 * shown to the player is generated from them.
 */
export const events: EventDef[] = [
  {
    id: 'passerby',
    name: 'Enthusiastic Passerby',
    icon: '🧑',
    minColumn: 5,
    description: 'A walker stops to admire your bucket and insists on tipping you for every creature in it.',
    choices: [{ label: 'Thank them', effects: [{ type: 'coinsPerCreature', amount: 2 }] }],
  },
  {
    id: 'picnic',
    name: "Grandma's Picnic Basket",
    icon: '🧺',
    description: 'Left on a rock with a note: "For my favourite fisher. Eat something!"',
    choices: [
      { label: 'Eat', effects: [{ type: 'heal', percent: 30 }] },
      { label: 'Sell the jam to a neighbour', effects: [{ type: 'gainCoins', amount: 8 }] },
    ],
  },
  {
    id: 'crate',
    name: 'Washed-up Crate',
    icon: '📦',
    description: 'A battered crate lies in the shallows, nailed shut. Something rattles inside.',
    choices: [
      { label: 'Pry it open', effects: [{ type: 'loseHp', amount: 5 }, { type: 'cardReward' }] },
      { label: 'Leave it', effects: [] },
    ],
  },
  {
    id: 'sunkenChest',
    name: 'Sunken Chest',
    icon: '💰',
    treasure: true,
    description: 'Half buried in the sand, an old chest. The lock gave up years ago.',
    choices: [
      { label: 'Take the coins', effects: [{ type: 'gainCoins', amount: 25 }] },
      { label: 'Look for something useful', effects: [{ type: 'cardReward' }] },
    ],
  },
];
