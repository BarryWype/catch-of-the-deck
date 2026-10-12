import type { CompanionBonusDef } from '../engine';
import type { BehaviorId } from './behaviors';

/**
 * What each temperament gives when creatures of it are brought from the home aquarium.
 * `effects` are for one species: 2 different species of the same temperament double the
 * amounts (two of the same species still count once), and 3 species keep the doubled amounts
 * and add `fullSchool`. See engine/companions.ts.
 *
 * `description` and `bestBuild` are notes for developers (and future help guides): the game
 * writes the bonus text from `effects`, so keep `description` in sync when changing numbers.
 */
export const companionBonuses: Array<CompanionBonusDef & { id: BehaviorId }> = [
  {
    id: 'armored',
    name: 'Hard Shell',
    temperamentName: 'Armored',
    icon: '🐚',
    description: 'Whenever you gain Hold, gain +1 more.',
    bestBuild: 'foraging',
    effects: [{ type: 'bonusBlock', amount: 1 }],
    fullSchool: [{ type: 'keepBlock', amount: 2 }],
  },
  {
    id: 'crustacean',
    name: 'Pinch',
    temperamentName: 'Crustacean',
    icon: '🦀',
    description: 'When you fully block an attack, deal 2 damage back.',
    bestBuild: 'foraging',
    effects: [{ type: 'trigger', on: 'fullBlock', effect: { type: 'dealDamage', amount: 2 } }],
    fullSchool: [{ type: 'trigger', on: 'combatStart', effect: { type: 'gainBlock', amount: 5 } }],
  },
  {
    id: 'jellyfish',
    name: 'Sting',
    temperamentName: 'Jellyfish',
    icon: '🪼',
    description: 'Your first attack each turn applies 1 Poison.',
    bestBuild: 'any',
    effects: [{ type: 'trigger', on: 'firstAttackEachTurn', effect: { type: 'applyStatus', status: 'poison', amount: 1 } }],
    fullSchool: [
      { type: 'trigger', on: 'combatStart', effect: { type: 'applyStatus', status: 'poison', amount: 2, target: 'allEnemies' } },
    ],
  },
  {
    id: 'venomous',
    name: 'Spines',
    temperamentName: 'Venomous',
    icon: '🦔',
    description: 'When an enemy hits you, it takes 1 damage.',
    bestBuild: 'any',
    effects: [{ type: 'trigger', on: 'hitByEnemy', effect: { type: 'dealDamage', amount: 1 } }],
    fullSchool: [{ type: 'trigger', on: 'hitByEnemy', effect: { type: 'applyStatus', status: 'poison', amount: 1 } }],
  },
  {
    id: 'puffer',
    name: 'Inflate',
    temperamentName: 'Puffer',
    icon: '🐡',
    description: 'The first time you drop below 50% Grit in a fight, gain 8 Hold.',
    bestBuild: 'defensive',
    effects: [{ type: 'trigger', on: 'firstBelowHalfHp', effect: { type: 'gainBlock', amount: 8 } }],
    fullSchool: [
      { type: 'trigger', on: 'firstBelowHalfHp', effect: { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' } },
    ],
  },
  {
    id: 'eel',
    name: 'Slippery',
    temperamentName: 'Eel',
    icon: '🐍',
    description: 'Skip a card reward twice per level (3 times with 2 species). With 3 species, also reroll a card reward 3 times per level.',
    bestBuild: 'spear',
    effects: [{ type: 'rewardSkips', amount: 2, bySpecies: [2, 3] }],
    fullSchool: [{ type: 'rewardRerolls', amount: 3 }],
  },
  {
    id: 'predator',
    name: 'Hunter',
    temperamentName: 'Predator',
    icon: '🦈',
    description: '+1 damage on all attacks.',
    bestBuild: 'spear',
    effects: [{ type: 'bonusDamage', amount: 1 }],
    fullSchool: [
      { type: 'trigger', on: 'combatStart', effect: { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' } },
    ],
  },
  {
    id: 'ambusher',
    name: 'Ambush',
    temperamentName: 'Ambusher',
    icon: '👁️',
    description: 'Your first attack each fight deals double damage.',
    bestBuild: 'spear',
    effects: [{ type: 'firstAttackDamage', amount: 100 }],
    fullSchool: [{ type: 'trigger', on: 'firstAttackEachFight', effect: { type: 'applyStatus', status: 'vulnerable', amount: 2 } }],
  },
  {
    id: 'fighter',
    name: 'Tire Out',
    temperamentName: 'Fighter',
    icon: '🏋️',
    description: 'Cards that lower Panic lower it by 2 more.',
    bestBuild: 'rod',
    effects: [{ type: 'bonusEscapeReduction', amount: 2 }],
    fullSchool: [
      { type: 'trigger', on: 'combatStart', effect: { type: 'applyStatus', status: 'snared', amount: 1, target: 'allEnemies' } },
    ],
  },
  {
    id: 'giant',
    name: 'Presence',
    temperamentName: 'Giant',
    icon: '🐋',
    description: '+8 max Grit, and enemies\' escape rate is reduced by 10%.',
    bestBuild: 'rod',
    effects: [
      { type: 'bonusMaxHp', amount: 8 },
      { type: 'slowEscape', amount: 10 },
    ],
    fullSchool: [{ type: 'trigger', on: 'combatStart', effect: { type: 'changeEscape', amount: -10, target: 'allEnemies' } }],
  },
  {
    id: 'schooling',
    name: 'School',
    temperamentName: 'Schooling',
    icon: '🐟',
    description: 'Draw 1 extra card on your first turn.',
    bestBuild: 'any',
    effects: [{ type: 'trigger', on: 'combatStart', effect: { type: 'drawCards', amount: 1 } }],
    fullSchool: [{ type: 'trigger', on: 'firstAttackEachTurn', effect: { type: 'drawCards', amount: 1 } }],
  },
  {
    id: 'reefFish',
    name: 'Cleaner',
    temperamentName: 'Reef fish',
    icon: '🐠',
    description: 'Recover 2 Grit after each fight.',
    bestBuild: 'any',
    effects: [{ type: 'healAfterFight', amount: 2 }],
    fullSchool: [{ type: 'bonusMaxHp', amount: 5 }],
  },
  {
    id: 'cephalopod',
    name: 'Ink',
    temperamentName: 'Cephalopod',
    icon: '🐙',
    description: 'At the start of each fight, apply 1 Weak to all enemies.',
    bestBuild: 'any',
    effects: [
      { type: 'trigger', on: 'combatStart', effect: { type: 'applyStatus', status: 'weak', amount: 1, target: 'allEnemies' } },
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
    description: '+10% coins from every capture.',
    bestBuild: 'economy',
    effects: [{ type: 'sellBonus', amount: 10 }],
    fullSchool: [{ type: 'healAfterFight', amount: 3 }],
  },
];
