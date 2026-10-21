import type { CompanionEffect, Effect, EquipmentDef, EquipmentEffect } from '../engine';

/**
 * Objects carried for the whole run. The player starts with one, picked among their build's
 * `startingItems` (builds.ts). `description` is the rules text the player sees; `effects` is
 * what the engine actually applies.
 *
 * Relics (those with a `rarity`, the `gearRelics` feature) are earned during a run instead: a
 * choice of 3 after a mini-boss, on treasures and after trophy fights. Their ids are the gear
 * catalogue's (gear.ts) and their art its cell in the gear sheet. Most are one combat bonus,
 * worked out as a companion's (`bonus`, see CompanionEffect).
 */
const bonus = (b: CompanionEffect): EquipmentEffect => ({ type: 'bonus', bonus: b });
const on = (when: Extract<CompanionEffect, { type: 'trigger' }>['on'], effect: Effect): EquipmentEffect => bonus({ type: 'trigger', on: when, effect });
const gear = (index: number) => ({ sheet: 'gear', index });
export const equipment: EquipmentDef[] = [
  {
    id: 'reliableReel',
    name: 'Reliable Reel',
    icon: '🎣',
    description: 'Creatures’ Will rises 20% slower (at least 1, rounded up).',
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
    description: 'Your Drain drains 25% more (rounded up).',
    effects: [{ type: 'strongerPull', percent: 25 }],
  },
  {
    id: 'handline',
    name: 'Handline',
    icon: '🧵',
    description: 'Each fight has a 20% chance to start with a bait card of this age in your hand.',
    effects: [{ type: 'baitChance', percent: 20 }],
  },
  {
    id: 'softNet',
    name: 'Soft Net',
    icon: '🥅',
    description: 'Creatures you catch come home with 30% of their full bond (bond level 1).',
    effects: [{ type: 'bondOnCapture', percent: 30 }],
  },
  {
    id: 'crabHook',
    name: 'Crab Hook',
    icon: '🪝',
    description: 'At rock pools, estuaries, streams, beaches and cliff rocks: 30% chance that a fight drags in an extra crustacean or shellfish.',
    effects: [{ type: 'extraCatch', percent: 30, types: ['crustacean', 'shellfish'], spots: ['RP', 'ES', 'ST', 'BE', 'CL'] }],
  },

  // --- Relics: common ---
  { id: 'corkBobber', name: 'Cork bobber', rarity: 'common', sprite: gear(20), description: 'The first Pull against you each fight is halved.', effects: [bonus({ type: 'firstPullPercent', amount: 50 })] },
  { id: 'sinker', name: 'Sinker', rarity: 'common', sprite: gear(13), description: 'Whenever you gain Hold, gain 1 more.', effects: [bonus({ type: 'bonusBlock', amount: 1 })] },
  { id: 'spinnerLure', name: 'Spinner lure', rarity: 'common', sprite: gear(11), description: 'Your first attack each turn applies 1 Weak.', effects: [on('firstAttackEachTurn', { type: 'applyStatus', status: 'weak', amount: 1 })] },
  { id: 'baitCatapult', name: 'Bait catapult', rarity: 'common', sprite: gear(19), description: 'Start each fight with 1 Patience.', effects: [on('combatStart', { type: 'gainPatience', amount: 1 })] },
  { id: 'harpoon', name: 'Harpoon', rarity: 'common', sprite: gear(27), description: 'Your first attack each fight deals 3 more damage.', effects: [on('firstAttackEachFight', { type: 'dealDamage', amount: 3 })] },
  { id: 'crabTrap', name: 'Crab trap', rarity: 'common', sprite: gear(25), description: 'At the end of a turn you played no attack, gain 1 Hold.', effects: [on('quietTurnEnd', { type: 'gainBlock', amount: 1 })] },
  { id: 'wormBait', name: 'Worm bait', rarity: 'common', sprite: gear(15), description: 'Recover 2 Grit after each fight.', effects: [bonus({ type: 'healAfterFight', amount: 2 })] },
  { id: 'plasticBobber', name: 'Plastic bobber', rarity: 'common', sprite: gear(21), description: 'The first creature hit against you each fight deals nothing.', effects: [bonus({ type: 'dodgeAttacks', amount: 1 })] },
  { id: 'fishingLine', name: 'Fishing line', rarity: 'common', sprite: gear(6), description: 'Your Drain drains 1 more.', effects: [bonus({ type: 'bonusEscapeReduction', amount: 1 })] },
  { id: 'fishingHook', name: 'Fishing hook', rarity: 'common', sprite: gear(7), description: 'Every hit of your attacks deals 1 more damage.', effects: [bonus({ type: 'bonusDamage', amount: 1 })] },
  // --- Relics: uncommon ---
  { id: 'jigLure', name: 'Jig lure', rarity: 'uncommon', sprite: gear(8), description: 'Whenever your Hold soaks a whole hit, Drain 2 from the attacker.', effects: [on('fullBlock', { type: 'changeEscape', amount: -2 })] },
  { id: 'flyLure', name: 'Fly lure', rarity: 'uncommon', sprite: gear(9), description: 'Draw 2 more cards on your second turn.', effects: [on('secondTurnStart', { type: 'drawCards', amount: 2 })] },
  { id: 'crankbait', name: 'Crankbait', rarity: 'uncommon', sprite: gear(10), description: 'Your first attack each fight applies 2 Vulnerable.', effects: [on('firstAttackEachFight', { type: 'applyStatus', status: 'vulnerable', amount: 2 })] },
  { id: 'garlicBait', name: 'Garlic bait', rarity: 'uncommon', sprite: gear(17), description: 'Every creature starts each fight with 2 Slow.', effects: [on('combatStart', { type: 'applyStatus', status: 'slow', amount: 2, target: 'allEnemies' })] },
  { id: 'meatBait', name: 'Meat bait', rarity: 'uncommon', sprite: gear(14), description: 'Whenever a creature hits you, it gains 1 Venom.', effects: [on('hitByEnemy', { type: 'applyStatus', status: 'venom', amount: 1 })] },
  { id: 'seafoodBait', name: 'Seafood bait', rarity: 'uncommon', sprite: gear(18), description: 'The first time you drop below 50% Grit in a fight, recover 6 Grit.', effects: [on('firstBelowHalfHp', { type: 'heal', amount: 6, target: 'self' })] },
  { id: 'fishingNet', name: 'Fishing net', rarity: 'uncommon', sprite: gear(23), description: 'Your first attack each turn also Drains 2 from every creature.', effects: [on('firstAttackEachTurn', { type: 'changeEscape', amount: -2, target: 'allEnemies' })] },
  { id: 'fishTrap', name: 'Fish trap', rarity: 'uncommon', sprite: gear(24), description: 'At the end of a turn you played no attack, every creature gains 1 Slow.', effects: [on('quietTurnEnd', { type: 'applyStatus', status: 'slow', amount: 1, target: 'allEnemies' })] },
  { id: 'fishingMagnet', name: 'Fishing magnet', rarity: 'uncommon', sprite: gear(12), description: 'Creatures sell for 25% more.', effects: [bonus({ type: 'sellBonus', amount: 25 })] },
  // --- Relics: rare ---
  { id: 'fishingSonar', name: 'Fishing sonar', rarity: 'rare', sprite: gear(36), description: 'You see each creature’s next two moves.', effects: [bonus({ type: 'foresight', amount: 1 })] },
  { id: 'spearGun', name: 'Spear gun', rarity: 'rare', sprite: gear(26), description: 'Your first attack each turn deals 2 more damage.', effects: [on('firstAttackEachTurn', { type: 'dealDamage', amount: 2 })] },
  { id: 'trident', name: 'Trident', rarity: 'rare', sprite: gear(30), description: 'Your first attack each fight deals 50% more damage.', effects: [bonus({ type: 'firstAttackDamage', amount: 50 })] },
  { id: 'carbonFiberRod', name: 'Carbon fiber rod', rarity: 'rare', sprite: gear(5), description: 'Creatures’ Will rises 15% slower (at least 1, rounded up).', effects: [{ type: 'slowEscape', percent: 15 }] },
  { id: 'tackleBox', name: 'Tackle box', rarity: 'rare', sprite: gear(34), description: 'Draw 2 more cards at the start of each fight.', effects: [on('combatStart', { type: 'drawCards', amount: 2 })] },
];
