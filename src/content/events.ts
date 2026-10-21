import type { EventDef } from '../engine';

/**
 * Map events, met on the levels' event nodes (levels.ts). Which one happens is drawn on
 * arrival, among those whose `minColumn` the node has reached (and on their `levels`, if given).
 * Events marked `treasure` are only met on treasure nodes instead. An event with a `feature` only
 * comes up while that feature is on (the debug panel's Features). Each choice's `effects` are
 * applied in order; the effect text shown to the player is generated from them.
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

  // --- More events (the `moreEvents` feature): each a trade-off, some only on some levels. ---
  {
    id: 'gull',
    name: 'Cheeky Gull',
    icon: '🐦',
    feature: 'moreEvents',
    levels: ['kid'],
    description: 'A gull lands on your tackle box, grabs a mouthful and flaps off down the jetty, very pleased with itself.',
    choices: [
      { label: 'Let it have it', effects: [{ type: 'loseCard' }] },
      { label: 'Chase it down the jetty', effects: [{ type: 'fight', enemies: ['garfish'], reward: 'rareCard' }] },
    ],
  },
  {
    id: 'tangledNet',
    name: 'Tangled Net',
    icon: '🕸️',
    feature: 'moreEvents',
    minColumn: 3,
    description: 'An old net drifts against the rocks, something still thrashing inside it. Its owner left a few things in it too.',
    choices: [
      { label: 'Wade in and cut it free', effects: [{ type: 'loseHp', amount: 6 }, { type: 'gainEquipment' }] },
      { label: 'Salvage the net', effects: [{ type: 'gainCoins', amount: 8 }] },
    ],
  },
  {
    id: 'oldFisherman',
    name: 'An Old Fisherman’s Lesson',
    icon: '🧓',
    feature: 'moreEvents',
    description: 'An old man mending lines waves you over. "You’re carrying too much, kid. Sit. Let me tell you about the summer of ’62…"',
    choices: [
      { label: 'Listen to the whole story', effects: [{ type: 'loseHp', amount: 4 }, { type: 'removeCard' }] },
      { label: 'Nod politely and move on', effects: [] },
    ],
  },
  {
    id: 'storm',
    name: 'Storm Rolling In',
    icon: '⛈️',
    feature: 'moreEvents',
    levels: ['adult', 'elder'],
    description: 'Black clouds pile up over the headland. The fish always bite best just before the rain.',
    choices: [
      { label: 'Shelter under the cliff', effects: [{ type: 'heal', percent: 12 }] },
      { label: 'Fish through the squall', effects: [{ type: 'loseHp', amount: 8 }, { type: 'cardReward', rare: true }] },
    ],
  },
  {
    id: 'bottleMap',
    name: 'A Bottle with a Map',
    icon: '🍾',
    feature: 'moreEvents',
    minColumn: 4,
    description: 'A corked bottle bobs in the shallows. Inside, a hand-drawn map marks a spot with a big fish and the word "HUGE".',
    choices: [
      { label: 'Follow the map', effects: [{ type: 'fight', trophy: true, reward: 'relic' }] },
      { label: 'Sell the bottle to a collector', effects: [{ type: 'gainCoins', amount: 6 }] },
    ],
  },
  {
    id: 'kidSwap',
    name: 'A Kid Wants to Swap',
    icon: '🧒',
    feature: 'moreEvents',
    levels: ['kid', 'adult'],
    description: 'A kid with a bucket of their own peers into yours. "I’ll give you my best card for one of those!"',
    choices: [
      { label: 'Swap a creature', effects: [{ type: 'tradeCatch', reward: 'rareCard' }] },
      { label: 'Show them how to cast instead', effects: [{ type: 'heal', percent: 10 }] },
    ],
  },
  {
    id: 'rivalAngler',
    name: 'A Rival Angler',
    icon: '🎣',
    feature: 'moreEvents',
    levels: ['adult', 'elder'],
    description: 'A loud angler in a brand-new hat bets you can’t land the next thing that bites.',
    choices: [
      { label: 'Take the bet', effects: [{ type: 'loseCoins', amount: 10 }, { type: 'fight', coins: 25 }] },
      { label: 'Wish them luck', effects: [] },
    ],
  },
  {
    id: 'junkPool',
    name: 'A Tide Pool Full of Junk',
    icon: '🥫',
    feature: 'moreEvents',
    levels: ['kid', 'adult'],
    description: 'The tide has left a pool full of bottle caps, old lures and the odd coin. Something sharp is in there too.',
    choices: [
      { label: 'Rummage through it', effects: [{ type: 'gainCoins', amount: 15 }, { type: 'addJunk', card: 'pebbleInTheBoot' }] },
      { label: 'Leave it be', effects: [] },
    ],
  },
  {
    id: 'lighthouseKeeper',
    name: 'The Lighthouse Keeper',
    icon: '🗼',
    feature: 'moreEvents',
    levels: ['elder'],
    description: 'The keeper is an old friend of your grandparents. The lamp is flickering, and the kettle is on.',
    choices: [
      { label: 'Rest by the lamp', effects: [{ type: 'heal', percent: 35 }] },
      { label: 'Help repair the lamp', effects: [{ type: 'loseHp', amount: 6 }, { type: 'gainEquipment' }] },
    ],
  },
  {
    id: 'grandpaTackle',
    name: 'Grandpa’s Tackle Box',
    icon: '🧰',
    feature: 'moreEvents',
    levels: ['kid'],
    description: 'Grandpa left his tackle box open on the porch, with a note: "Borrow anything. Bring it back."',
    choices: [
      { label: 'Borrow his lucky lure', effects: [{ type: 'freeNextFight' }] },
      { label: 'Tidy it up for him', effects: [{ type: 'gainCoins', amount: 5 }] },
    ],
  },
  {
    id: 'seaFog',
    name: 'Sea Fog',
    icon: '🌫️',
    feature: 'moreEvents',
    levels: ['elder'],
    minColumn: 3,
    description: 'A thick fog rolls in. You can hear something big splashing close by, but you can’t see a thing.',
    choices: [
      { label: 'Wait for it to lift', effects: [{ type: 'heal', percent: 15 }] },
      { label: 'Cast blind into the fog', effects: [{ type: 'fight', reward: 'rareCard' }] },
    ],
  },
  {
    id: 'seal',
    name: 'A Hungry Seal',
    icon: '🦭',
    feature: 'moreEvents',
    levels: ['adult', 'elder'],
    description: 'A seal hauls itself onto the rocks beside you and stares at your bucket. It has something shiny tangled round its flipper.',
    choices: [
      { label: 'Toss it a creature', effects: [{ type: 'tradeCatch', reward: 'relic' }] },
      { label: 'Shoo it away', effects: [{ type: 'loseHp', amount: 5 }] },
    ],
  },
  {
    id: 'beachClean',
    name: 'Beach Clean-up',
    icon: '🧹',
    feature: 'moreEvents',
    levels: ['kid'],
    description: 'The neighbours are cleaning the beach. They hand you a bag and a grabber.',
    choices: [
      { label: 'Pitch in all afternoon', effects: [{ type: 'loseHp', amount: 4 }, { type: 'cardReward' }] },
      { label: 'Pocket the lost coins you find', effects: [{ type: 'gainCoins', amount: 10 }, { type: 'addJunk', card: 'tangledLine' }] },
    ],
  },
  {
    id: 'nightFishing',
    name: 'Night Fishing',
    icon: '🏮',
    feature: 'moreEvents',
    levels: ['adult', 'elder'],
    minColumn: 9,
    description: 'The sun is down and the water is glassy. The big ones come up at night, they say.',
    choices: [
      { label: 'Fish by lantern light', effects: [{ type: 'addJunk', card: 'slimySeaweed' }, { type: 'cardReward', rare: true }] },
      { label: 'Get some sleep', effects: [{ type: 'heal', percent: 25 }] },
    ],
  },
  {
    id: 'thermos',
    name: 'A Thermos of Cocoa',
    icon: '☕',
    feature: 'moreEvents',
    levels: ['adult'],
    description: 'Grandma slipped a thermos into your bag. Still hot.',
    choices: [
      { label: 'Drink it now', effects: [{ type: 'heal', percent: 15 }] },
      { label: 'Save it for the next spot', effects: [{ type: 'freeNextFight', cardId: 'breatheOut' }] },
    ],
  },
];
