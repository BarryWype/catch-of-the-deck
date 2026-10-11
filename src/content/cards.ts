import type { CardDef } from '../engine';
import { FORAGING_TARGETS, ROD_TARGETS, SPEAR_TARGETS } from './builds';

/**
 * Every card in the game. Rules text is generated from `effects`
 * (set `description` to override it). See README → "Adding a card".
 *
 * A damage `bonus` adds damage per hit against the listed creature types,
 * e.g. `bonus: { against: ROD_TARGETS }`.
 *
 * Panic (the escape bar) is how each build plays differently:
 * - Rod fishing manages line tension: hard reels hit big but make the fish
 *   panic, while playing the line calms it down and tires it out.
 * - Spear fishing strikes fast: big hits that panic the creature, and wounds
 *   that pin it so its Panic rises slower for the rest of the fight.
 * - Foraging barely hurts anything: it snares creatures so their Panic stops
 *   rising, and coaxes them calm until they can be scooped up at 0.
 * `build` cards are only offered as rewards to that build.
 */
export const cards: CardDef[] = [
  // --- Starter: shared ------------------------------------------------------
  {
    id: 'bucket',
    name: 'Bucket',
    art: '🪣',
    type: 'skill',
    rarity: 'starter',
    cost: 1,
    target: 'none',
    effects: [{ type: 'gainBlock', amount: 5 }],
  },

  // --- Starter: rod fishing -------------------------------------------------
  {
    id: 'cast',
    name: 'Cast',
    art: '🎣',
    type: 'attack',
    rarity: 'starter',
    cost: 1,
    target: 'enemy',
    effects: [{ type: 'dealDamage', amount: 5, bonus: { against: ROD_TARGETS } }],
  },
  {
    id: 'setTheHook',
    name: 'Set the Hook',
    art: '🪝',
    type: 'attack',
    rarity: 'starter',
    cost: 2,
    target: 'enemy',
    effects: [
      { type: 'dealDamage', amount: 7, bonus: { against: ROD_TARGETS } },
      { type: 'applyStatus', status: 'vulnerable', amount: 2 },
      { type: 'changeEscape', amount: -8 },
    ],
  },

  // --- Starter: spear fishing -----------------------------------------------
  {
    id: 'stick',
    name: 'Sharp Stick',
    art: '🪵',
    type: 'attack',
    rarity: 'starter',
    cost: 1,
    target: 'enemy',
    effects: [{ type: 'dealDamage', amount: 5, bonus: { against: SPEAR_TARGETS } }],
  },
  {
    id: 'harpoon',
    name: 'Harpoon',
    art: '🔱',
    type: 'attack',
    rarity: 'starter',
    cost: 2,
    target: 'enemy',
    effects: [
      { type: 'dealDamage', amount: 10, bonus: { against: SPEAR_TARGETS } },
      { type: 'changeEscapeRate', amount: -2 },
    ],
  },

  // --- Starter: foraging ----------------------------------------------------
  {
    id: 'smallNet',
    name: 'Small Net',
    art: '🥅',
    type: 'attack',
    rarity: 'starter',
    cost: 1,
    target: 'enemy',
    effects: [{ type: 'dealDamage', amount: 5, bonus: { against: FORAGING_TARGETS } }],
  },
  {
    id: 'crabNet',
    name: 'Crab Net',
    art: '🦀',
    type: 'attack',
    rarity: 'starter',
    cost: 2,
    target: 'enemy',
    effects: [
      { type: 'dealDamage', amount: 7, bonus: { against: FORAGING_TARGETS } },
      { type: 'applyStatus', status: 'weak', amount: 2 },
      { type: 'applyStatus', status: 'snared', amount: 1 },
    ],
  },

  // --- Rewards: rod fishing ---------------------------------------------------
  {
    id: 'reelHard',
    name: 'Reel Hard',
    art: '🎣',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    build: 'rod',
    effects: [
      { type: 'dealDamage', amount: 9, bonus: { against: ROD_TARGETS } },
      { type: 'changeEscape', amount: 8 },
    ],
  },
  {
    id: 'playTheLine',
    name: 'Play the Line',
    art: '🧵',
    type: 'skill',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    build: 'rod',
    effects: [
      { type: 'changeEscape', amount: -10 },
      { type: 'gainBlock', amount: 4 },
    ],
  },
  {
    id: 'tireItOut',
    name: 'Tire It Out',
    art: '🌀',
    type: 'skill',
    rarity: 'uncommon',
    cost: 1,
    target: 'enemy',
    build: 'rod',
    exhaust: true,
    effects: [{ type: 'changeEscapeRate', amount: -3 }],
  },
  {
    id: 'bigHaul',
    name: 'Big Haul',
    art: '🐋',
    type: 'attack',
    rarity: 'rare',
    cost: 2,
    target: 'enemy',
    build: 'rod',
    effects: [
      { type: 'dealDamage', amount: 18, bonus: { against: ROD_TARGETS } },
      { type: 'changeEscape', amount: 15 },
    ],
  },

  // --- Rewards: spear fishing -------------------------------------------------
  {
    id: 'lunge',
    name: 'Lunge',
    art: '🤿',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    build: 'spear',
    effects: [
      { type: 'dealDamage', amount: 9, bonus: { against: SPEAR_TARGETS } },
      { type: 'changeEscape', amount: 6 },
    ],
  },
  {
    id: 'finStrike',
    name: 'Fin Strike',
    art: '🗡️',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    build: 'spear',
    effects: [
      { type: 'dealDamage', amount: 5, bonus: { against: SPEAR_TARGETS } },
      { type: 'changeEscapeRate', amount: -2 },
    ],
  },
  {
    id: 'stillWater',
    name: 'Still Water',
    art: '🫧',
    type: 'skill',
    rarity: 'uncommon',
    cost: 0,
    target: 'enemy',
    build: 'spear',
    effects: [{ type: 'changeEscape', amount: -6 }],
  },
  {
    id: 'trident',
    name: 'Trident',
    art: '🔱',
    type: 'attack',
    rarity: 'rare',
    cost: 2,
    target: 'enemy',
    build: 'spear',
    effects: [
      { type: 'dealDamage', amount: 6, hits: 3, bonus: { against: SPEAR_TARGETS } },
      { type: 'changeEscape', amount: 10 },
    ],
  },

  // --- Rewards: foraging ------------------------------------------------------
  {
    id: 'tangleNet',
    name: 'Tangle Net',
    art: '🕸️',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    build: 'foraging',
    effects: [
      { type: 'dealDamage', amount: 2, bonus: { against: FORAGING_TARGETS } },
      { type: 'applyStatus', status: 'snared', amount: 2 },
    ],
  },
  {
    id: 'scatterBait',
    name: 'Scatter Bait',
    art: '🪱',
    type: 'skill',
    rarity: 'common',
    cost: 1,
    target: 'none',
    build: 'foraging',
    effects: [{ type: 'changeEscape', amount: -8, target: 'allEnemies' }],
  },
  {
    id: 'gentleScoop',
    name: 'Gentle Scoop',
    art: '🤲',
    type: 'skill',
    rarity: 'uncommon',
    cost: 1,
    target: 'enemy',
    build: 'foraging',
    exhaust: true,
    effects: [{ type: 'changeEscape', amount: -15 }],
  },
  {
    id: 'crabTrap',
    name: 'Crab Trap',
    art: '🪤',
    type: 'skill',
    rarity: 'rare',
    cost: 2,
    target: 'enemy',
    build: 'foraging',
    exhaust: true,
    effects: [
      { type: 'applyStatus', status: 'snared', amount: 3 },
      { type: 'changeEscape', amount: -10 },
    ],
  },

  // --- Rewards: gear picked up along the shore ----------------------------
  {
    id: 'doubleCast',
    name: 'Double Cast',
    art: '🎣',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    effects: [{ type: 'dealDamage', amount: 5, hits: 2 }],
  },
  {
    id: 'skippingStones',
    name: 'Skipping Stones',
    art: '🪨',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'none',
    effects: [{ type: 'dealDamage', amount: 3, hits: 3, target: 'randomEnemy' }],
  },
  {
    id: 'oarSwing',
    name: 'Oar Swing',
    art: '🛶',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    effects: [
      { type: 'dealDamage', amount: 9 },
      { type: 'drawCards', amount: 1 },
      { type: 'changeEscape', amount: 5 },
    ],
  },
  {
    id: 'paddleSplash',
    name: 'Paddle Splash',
    art: '💦',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    effects: [
      { type: 'gainBlock', amount: 5 },
      { type: 'dealDamage', amount: 5 },
      { type: 'changeEscape', amount: 3 },
    ],
  },
  {
    id: 'heavySinker',
    name: 'Heavy Sinker',
    art: '⚓',
    type: 'attack',
    rarity: 'common',
    cost: 2,
    target: 'enemy',
    effects: [
      { type: 'dealDamage', amount: 12 },
      { type: 'applyStatus', status: 'weak', amount: 2 },
    ],
  },
  {
    id: 'wideNet',
    name: 'Wide Net',
    art: '🕸️',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'none',
    effects: [
      { type: 'dealDamage', amount: 4, target: 'allEnemies' },
      { type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'allEnemies' },
    ],
  },
  {
    id: 'rainCoat',
    name: 'Rain Coat',
    art: '🧥',
    type: 'skill',
    rarity: 'common',
    cost: 1,
    target: 'none',
    effects: [
      { type: 'gainBlock', amount: 8 },
      { type: 'drawCards', amount: 1 },
    ],
  },
  {
    id: 'tackleBox',
    name: 'Tackle Box',
    art: '🧰',
    type: 'skill',
    rarity: 'uncommon',
    cost: 0,
    target: 'none',
    effects: [{ type: 'drawCards', amount: 3 }],
  },
  {
    id: 'grandmasSandwich',
    name: "Grandma's Sandwich",
    art: '🥪',
    type: 'skill',
    rarity: 'uncommon',
    cost: 1,
    target: 'none',
    exhaust: true,
    effects: [{ type: 'gainEnergy', amount: 2 }],
  },
  {
    id: 'reelItIn',
    name: 'Reel It In',
    art: '🧵',
    type: 'skill',
    rarity: 'uncommon',
    cost: 1,
    target: 'enemy',
    exhaust: true,
    effects: [
      { type: 'applyStatus', status: 'strength', amount: -2 },
      { type: 'changeEscape', amount: -10 },
    ],
  },
  {
    id: 'luckyHat',
    name: 'Lucky Hat',
    art: '👒',
    type: 'power',
    rarity: 'rare',
    cost: 1,
    target: 'none',
    effects: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }],
  },
];
