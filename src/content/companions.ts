import type { CompanionBonusDef } from '../engine';
import type { BehaviorId } from './behaviors';

/**
 * What each temperament gives when creatures of it are brought from the home aquarium.
 * `byStars` lists an effect's amount at 1★, 2★… 8★ of the temperament (a companion's tier, +1 at
 * bond level 2, +1 at level 3, each species counted once); the last entry covers more stars.
 * 3 different species add `fullSchool`. See engine/companions.ts.
 *
 * `description` is a note for developers: the game writes the bonus text from `effects`, so keep
 * it in sync when changing numbers.
 */
export const companionBonuses: Array<CompanionBonusDef & { id: BehaviorId }> = [
  {
    id: 'armored',
    name: 'Hard Shell',
    temperamentName: 'Armored',
    icon: '🐚',
    description: 'Whenever you gain Hold, gain 1 more (2 from 3★, 3 from 6★).',
    effects: [{ type: 'bonusBlock', amount: 1, byStars: [1, 1, 2, 2, 2, 3, 3, 3] }],
    fullSchool: [{ type: 'keepBlock', amount: 2 }],
  },
  {
    id: 'clawed',
    name: 'Pinch',
    temperamentName: 'Clawed',
    icon: '🦀',
    description: 'When you fully block an attack, deal 2 damage back (3 at 2★, 4 from 3★, 5 from 5★, 6 from 7★).',
    effects: [{ type: 'trigger', on: 'fullBlock', effect: { type: 'dealDamage', amount: 2 }, byStars: [2, 3, 4, 4, 5, 5, 6, 6] }],
    fullSchool: [{ type: 'trigger', on: 'combatStart', effect: { type: 'gainBlock', amount: 5 } }],
  },
  {
    id: 'jellyfish',
    name: 'Sting',
    temperamentName: 'Jellyfish',
    icon: '🪼',
    description: 'Your first attack each turn applies 1 Venom (2 from 3★, 3 from 6★).',
    effects: [{ type: 'trigger', on: 'firstAttackEachTurn', effect: { type: 'applyStatus', status: 'venom', amount: 1 }, byStars: [1, 1, 2, 2, 2, 3, 3, 3] }],
    fullSchool: [
      { type: 'trigger', on: 'combatStart', effect: { type: 'applyStatus', status: 'venom', amount: 2, target: 'allEnemies' } },
    ],
  },
  {
    id: 'venomous',
    name: 'Spines',
    temperamentName: 'Venomous',
    icon: '🦔',
    description: 'When an enemy hits you, it gets 1 Venom (2 from 4★, 3 from 7★). With 3 species, it also takes 2 damage.',
    effects: [{ type: 'trigger', on: 'hitByEnemy', effect: { type: 'applyStatus', status: 'venom', amount: 1 }, byStars: [1, 1, 1, 2, 2, 2, 3, 3] }],
    fullSchool: [{ type: 'trigger', on: 'hitByEnemy', effect: { type: 'dealDamage', amount: 2 } }],
  },
  {
    id: 'puffer',
    name: 'Inflate',
    temperamentName: 'Puffer',
    icon: '🐡',
    description: 'The first time you drop below 50% Grit in a fight, gain 6 Hold (+2 per star, 16 at 6–7★, 18 from 8★).',
    effects: [{ type: 'trigger', on: 'firstBelowHalfHp', effect: { type: 'gainBlock', amount: 6 }, byStars: [6, 8, 10, 12, 14, 16, 16, 18] }],
    fullSchool: [
      { type: 'trigger', on: 'firstBelowHalfHp', effect: { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' } },
    ],
  },
  {
    id: 'eel',
    name: 'Slippery',
    temperamentName: 'Eel',
    icon: '🐍',
    description: 'Skip a card reward once per level (2 from 2★, 3 from 4★, 4 from 7★). With 3 species, also reroll a card reward 3 times per level.',
    effects: [{ type: 'rewardSkips', amount: 1, byStars: [1, 2, 2, 3, 3, 3, 4, 4] }],
    fullSchool: [{ type: 'rewardRerolls', amount: 3 }],
  },
  {
    id: 'predator',
    name: 'Hunter',
    temperamentName: 'Predator',
    icon: '🦈',
    description: '+1 damage on all attacks (2 from 3★, 3 from 6★). With 3 species, 1 more.',
    effects: [{ type: 'bonusDamage', amount: 1, byStars: [1, 1, 2, 2, 2, 3, 3, 3] }],
    fullSchool: [{ type: 'bonusDamage', amount: 1 }],
  },
  {
    id: 'ambusher',
    name: 'Ambush',
    temperamentName: 'Ambusher',
    icon: '👁️',
    description: 'Your first attack each fight deals 50% more damage (100% from 2★, 150% from 4★, 200% from 6★, 250% from 8★).',
    effects: [{ type: 'firstAttackDamage', amount: 50, byStars: [50, 100, 100, 150, 150, 200, 200, 250] }],
    fullSchool: [{ type: 'trigger', on: 'firstAttackEachFight', effect: { type: 'applyStatus', status: 'vulnerable', amount: 2 } }],
  },
  {
    id: 'fighter',
    name: 'Tire Out',
    temperamentName: 'Fighter',
    icon: '🏋️',
    description: 'Your Drain drains 1 more (2 from 2★, 3 from 4★, 4 from 6★, 5 from 8★).',
    effects: [{ type: 'bonusEscapeReduction', amount: 1, byStars: [1, 2, 2, 3, 3, 4, 4, 5] }],
    fullSchool: [
      { type: 'trigger', on: 'combatStart', effect: { type: 'applyStatus', status: 'slow', amount: 1, target: 'allEnemies' } },
    ],
  },
  {
    id: 'giant',
    name: 'Presence',
    temperamentName: 'Giant',
    icon: '🐋',
    description: '+8 max Grit and creatures’ Will rises 10% slower at 3★ (one giant); +2 max Grit per star and 5% slower per 2★.',
    effects: [
      { type: 'bonusMaxHp', amount: 8, byStars: [4, 6, 8, 10, 12, 14, 16, 18] },
      { type: 'slowEscape', amount: 10, byStars: [5, 5, 10, 10, 15, 15, 20, 20] },
    ],
    fullSchool: [{ type: 'trigger', on: 'combatStart', effect: { type: 'changeEscape', amount: -10, target: 'allEnemies' } }],
  },
  {
    id: 'schooling',
    name: 'School',
    temperamentName: 'Schooling',
    icon: '🐟',
    description: 'Draw 1 extra card on your first and second turns (2 from 4★, 3 from 8★).',
    effects: [
      { type: 'trigger', on: 'combatStart', effect: { type: 'drawCards', amount: 1 }, byStars: [1, 1, 1, 2, 2, 2, 2, 3] },
      { type: 'trigger', on: 'secondTurnStart', effect: { type: 'drawCards', amount: 1 }, byStars: [1, 1, 1, 2, 2, 2, 2, 3] },
    ],
    fullSchool: [{ type: 'trigger', on: 'firstAttackEachTurn', effect: { type: 'drawCards', amount: 1 } }],
  },
  {
    id: 'reefFish',
    name: 'Cleaner',
    temperamentName: 'Reef fish',
    icon: '🐠',
    description: 'Recover 1 Grit after each fight (2 from 3★, 3 from 6★).',
    effects: [{ type: 'healAfterFight', amount: 1, byStars: [1, 1, 2, 2, 2, 3, 3, 3] }],
    fullSchool: [{ type: 'bonusMaxHp', amount: 8 }],
  },
  {
    id: 'cephalopod',
    name: 'Ink',
    temperamentName: 'Cephalopod',
    icon: '🐙',
    description: 'At the start of each fight, apply 1 Weak to all enemies (2 from 4★, 3 from 7★).',
    effects: [
      { type: 'trigger', on: 'combatStart', effect: { type: 'applyStatus', status: 'weak', amount: 1, target: 'allEnemies' }, byStars: [1, 1, 1, 2, 2, 2, 3, 3] },
    ],
    fullSchool: [
      { type: 'trigger', on: 'combatStart', effect: { type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'allEnemies' } },
    ],
  },
  {
    id: 'bottomDweller',
    name: 'Scavenger',
    temperamentName: 'Bottom dweller',
    icon: '⭐',
    description: '+15% coins from every capture (+5% per star, 50% from 8★).',
    effects: [{ type: 'sellBonus', amount: 15, byStars: [15, 20, 25, 30, 35, 40, 45, 50] }],
    fullSchool: [{ type: 'healAfterFight', amount: 2 }],
  },
];
