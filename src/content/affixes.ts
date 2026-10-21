import type { AffixDef } from '../engine';

/**
 * Creature affixes (the `affixes` feature): a trophy fight's creature always rolls one, and each
 * creature of an ordinary adult or elder fight has AFFIX_CHANCE_PERCENT (engine/constants.ts) to.
 * One at most per creature. `title` is the creature's name with it ({name} its own); `name` is its
 * badge. The numbers are in each `rule`.
 */
export const affixes: AffixDef[] = [
  { id: 'oldAndWily', name: 'Old and Wily', title: 'Old and Wily {name}', description: 'It hides its first move, as if it had inked.', rule: { type: 'hiddenStart' } },
  { id: 'hungry', name: 'Hungry', title: 'Hungry {name}', description: 'Each of its Wind-ups also gives it 1 Strength.', rule: { type: 'windUpStrength', amount: 1 } },
  { id: 'skittish', name: 'Skittish', title: 'Skittish {name}', description: 'It starts with 15% more Will.', rule: { type: 'startWill', percent: 15 } },
  { id: 'hookScarred', name: 'Hook-scarred', title: 'Hook-scarred {name}', description: 'Its Will rises 25% slower, but its Strikes deal 20% more.', rule: { type: 'scarred', willPercent: 25, strikePercent: 20 } },
  { id: 'armored', name: 'Armored', title: 'Armored {name}', description: 'It starts the fight, and each of its turns, with 4 Block.', rule: { type: 'turnBlock', amount: 4 } },
  { id: 'frenzied', name: 'Frenzied', title: 'Frenzied {name}', description: 'It doesn’t rest for its first 3 moves.', rule: { type: 'noPaceFor', turns: 3 } },
];
