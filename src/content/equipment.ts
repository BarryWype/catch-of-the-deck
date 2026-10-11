import type { EquipmentDef } from '../engine';

/**
 * Objects carried for the whole run. The player starts with one, picked among their build's
 * `startingItems` (builds.ts). `description` is the rules text the player sees; `effects` is
 * what the engine actually applies.
 */
export const equipment: EquipmentDef[] = [
  {
    id: 'reliableReel',
    name: 'Reliable Reel',
    icon: '🎣',
    description: 'Creatures’ Panic rises 20% slower (at least 1, rounded up).',
    effects: [{ type: 'slowEscape', percent: 20 }],
  },
  {
    id: 'sharpSpear',
    name: 'Sharp Spear',
    icon: '🔱',
    description: 'Captured creatures are sold on the spot for 20% more, instead of going into your bucket.',
    effects: [{ type: 'sellOnCapture', bonusPercent: 20 }],
  },
  {
    id: 'rubberDuck',
    name: 'Rubber Duck',
    icon: '🦆',
    description: 'Enthusiastic passersby give 50% more coins per fish.',
    effects: [{ type: 'passerbyBonus', bonusPercent: 50 }],
  },
  {
    id: 'strongRod',
    name: 'Strong Rod',
    icon: '🎋',
    description: 'Cards that lower Panic lower it 25% more (rounded up).',
    effects: [{ type: 'strongerPull', percent: 25 }],
  },
  {
    id: 'handline',
    name: 'Handline',
    icon: '🧵',
    description: '20% chance to generate a bait (not implemented yet).',
    effects: [],
  },
  {
    id: 'softNet',
    name: 'Soft Net',
    icon: '🥅',
    description: 'Creatures you catch come home with 30 bond points.',
    effects: [{ type: 'bondOnCapture', amount: 30 }],
  },
  {
    id: 'crabHook',
    name: 'Crab Hook',
    icon: '🪝',
    description: 'At rock pools, estuaries, streams, beaches and cliff rocks: 30% chance that a fight drags in an extra crustacean or shellfish.',
    effects: [{ type: 'extraCatch', percent: 30, types: ['crustacean', 'shellfish'], spots: ['RP', 'ES', 'ST', 'BE', 'CL'] }],
  },
];
