import { applyAction, buildGameData, createCombat, type Catch, type CombatState, type CompanionEffect, type GameData, type GameMap, type HomeCreature, type MapNodeKind } from '../src/engine';

/**
 * Test-only content with fixed numbers, so engine tests don't break when a
 * designer rebalances the real cards.
 */
export const testData = buildGameData({
  character: { name: 'Tester', maxHp: 80, home: { name: 'Home' } },
  cards: [
    { id: 'strike', name: 'Strike', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', effects: [{ type: 'dealDamage', amount: 6 }] },
    { id: 'defend', name: 'Defend', type: 'defense', rarity: 'normal', cost: 1, target: 'none', effects: [{ type: 'gainBlock', amount: 5 }] },
    {
      id: 'bash', name: 'Bash', type: 'attack', rarity: 'normal', cost: 2, target: 'enemy',
      effects: [{ type: 'dealDamage', amount: 8 }, { type: 'applyStatus', status: 'vulnerable', amount: 2 }],
    },
    { id: 'twin', family: 'shells', name: 'Twin', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', effects: [{ type: 'dealDamage', amount: 5, hits: 2 }] },
    { id: 'flex', family: 'shells', name: 'Flex', type: 'power', rarity: 'rare', cost: 1, target: 'none', effects: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] },
    { id: 'weaken', family: 'shells', name: 'Weaken', type: 'support', rarity: 'normal', cost: 0, target: 'enemy', effects: [{ type: 'applyStatus', status: 'weak', amount: 2 }] },
    { id: 'ponder', family: 'shells', name: 'Ponder', type: 'support', rarity: 'normal', cost: 0, target: 'none', effects: [{ type: 'drawCards', amount: 2 }] },
    { id: 'adrenaline', family: 'shells', name: 'Adrenaline', type: 'support', rarity: 'normal', cost: 0, target: 'none', exhaust: true, effects: [{ type: 'gainEnergy', amount: 1 }] },
    { id: 'heavy', family: 'shells', name: 'Heavy', type: 'attack', rarity: 'normal', cost: 3, target: 'enemy', effects: [{ type: 'dealDamage', amount: 20 }] },
    { id: 'calm', family: 'shells', name: 'Calm', type: 'support', rarity: 'normal', cost: 0, target: 'enemy', effects: [{ type: 'changeEscape', amount: -10 }] },
    { id: 'spook', family: 'shells', name: 'Spook', type: 'support', rarity: 'normal', cost: 0, target: 'enemy', effects: [{ type: 'changeEscape', amount: 10 }] },
    { id: 'pin', family: 'shells', name: 'Pin', type: 'support', rarity: 'normal', cost: 0, target: 'enemy', effects: [{ type: 'applyStatus', status: 'slow', amount: 1 }] },
    { id: 'snare', family: 'shells', name: 'Snare', type: 'support', rarity: 'normal', cost: 0, target: 'enemy', effects: [{ type: 'applyStatus', status: 'snared', amount: 1 }] },
    { id: 'lure', family: 'shells', name: 'Lure', type: 'support', rarity: 'normal', cost: 0, target: 'none', build: 'angler', effects: [{ type: 'drawCards', amount: 1 }] },
    {
      id: 'hook', name: 'Hook', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy',
      effects: [{ type: 'dealDamage', amount: 5, hits: 2, bonus: { against: ['fish'] } }],
    },
  ],
  enemies: [
    {
      id: 'dummy', name: 'Dummy', hp: [100, 100], sellValue: 5, escapeAt: 1000, escapeStart: 4, escapeRate: 1, tags: ['fish'], water: 'salt',
      moves: [{ id: 'hit', name: 'Hit', tag: 'strike', intensity: 'normal' as const, effects: [{ type: 'dealDamage', amount: 10 }] }],
      pattern: { type: 'sequence', moves: ['hit'] },
    },
    {
      id: 'cycler', name: 'Cycler', hp: [20, 30], escapeAt: 1000, escapeStart: 4, escapeRate: 1, tags: ['shell'], water: 'salt',
      moves: [
        { id: 'a', name: 'A', tag: 'pull', intensity: 'normal' as const, effects: [{ type: 'pull', amount: 0 }, { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] },
        { id: 'b', name: 'B', tag: 'pull', intensity: 'normal' as const, effects: [{ type: 'pull', amount: 0 }, { type: 'gainBlock', amount: 5 }] },
        { id: 'c', name: 'C', tag: 'strike', intensity: 'normal' as const, effects: [{ type: 'dealDamage', amount: 3 }] },
      ],
      pattern: { type: 'sequence', moves: ['a', 'b', 'c'], loopFrom: 1 },
    },
    {
      id: 'gambler', name: 'Gambler', hp: [30, 30], escapeAt: 1000, escapeStart: 4, escapeRate: 1,
      moves: [
        { id: 'x', name: 'X', tag: 'strike', intensity: 'normal' as const, effects: [{ type: 'dealDamage', amount: 1 }] },
        { id: 'y', name: 'Y', tag: 'pull', intensity: 'normal' as const, effects: [{ type: 'pull', amount: 0 }, { type: 'gainBlock', amount: 1 }] },
      ],
      pattern: { type: 'weighted', weights: { x: 1, y: 1 }, maxConsecutive: 1 },
    },
    // Three species of one temperament, to test companion bonuses.
    ...['shellA', 'shellB', 'shellC'].map((id) => ({
      id, name: id, hp: [10, 10] as [number, number], sellValue: 10, escapeAt: 100, escapeStart: 50, escapeRate: 1, temperament: 'shelled',
      moves: [{ id: 'm', name: 'M', tag: 'pull' as const, intensity: 'normal' as const, effects: [{ type: 'pull' as const, amount: 0 }] }], pattern: { type: 'sequence' as const, moves: ['m'] },
    })),
  ],
  families: [{ id: 'shells', name: 'Shells', emblem: 'shellA', temperaments: ['shelled'], identity: '', focus: '' }],
  companionBonuses: [
    {
      id: 'shelled', name: 'Shelled', temperamentName: 'Shelled',
      effects: [{ type: 'bonusBlock', amount: 1, byStars: [1, 2] }, { type: 'bonusMaxHp', amount: 5 }, { type: 'sellBonus', amount: 10 }],
      fullSchool: [{ type: 'keepBlock', amount: 2 }],
    },
  ],
  encounters: [{ id: 'dummy', name: 'Dummy', enemies: ['dummy'] }],
  builds: [
    { id: 'basic', name: 'Basic', description: '', starterDeck: ['strike', 'defend'], strongAgainst: [] },
    { id: 'angler', name: 'Angler', description: '', starterDeck: ['hook', 'defend'], strongAgainst: ['fish'], startingItems: ['reel'] },
  ],
  fishermen: [],
  events: [],
  shop: [],
  equipment: [
    { id: 'reel', name: 'Reel', description: '', effects: [{ type: 'slowEscape', percent: 20 }] },
    { id: 'spear', name: 'Spear', description: '', effects: [{ type: 'sellOnCapture', bonusPercent: 20 }] },
  ],
  creatureTypes: [
    { id: 'fish', name: 'Fish' },
    { id: 'shell', name: 'Shell' },
  ],
  spots: [{ id: 'sea', name: 'Sea', color: '#000', waters: ['salt'], types: ['fish'] }],
  // Two small levels: two first steps, a mini-boss leading to a leave node or on to the boss.
  levels: [
    {
      id: 'one', name: 'One', tier: 1, start: { x: 0, y: 0 }, height: 100,
      nodes: [
        { id: '1a', column: 1, x: 10, y: 10, kind: 'fight', spot: 'sea', next: ['2'] },
        { id: '1b', column: 1, x: 10, y: 20, kind: 'fight', enemies: ['cycler'], next: ['2'] },
        { id: '2', column: 2, x: 20, y: 10, kind: 'miniBoss', enemies: ['gambler'], next: ['3a', '3b'] },
        { id: '3a', column: 3, x: 30, y: 10, kind: 'fight', spot: 'sea', next: ['4'] },
        { id: '3b', column: 3, x: 30, y: 20, kind: 'leave', next: [] },
        { id: '4', column: 4, x: 40, y: 10, kind: 'boss', enemies: ['dummy'], next: [] },
      ],
    },
    {
      id: 'two', name: 'Two', tier: 2, start: { x: 0, y: 0 }, height: 100,
      nodes: [
        { id: 'two-1', column: 1, x: 10, y: 10, kind: 'fight', spot: 'sea', next: ['two-2'] },
        { id: 'two-2', column: 2, x: 20, y: 10, kind: 'miniBoss', enemies: ['dummy'], next: ['two-3a', 'two-3b'] },
        { id: 'two-3a', column: 3, x: 30, y: 10, kind: 'fight', spot: 'sea', next: ['two-4'] },
        { id: 'two-3b', column: 3, x: 30, y: 20, kind: 'leave', next: [] },
        { id: 'two-4', column: 4, x: 40, y: 10, kind: 'boss', enemies: ['cycler', 'cycler'], next: [] },
      ],
    },
  ],
  coast: { places: [] },
});

/** The run with node `id` of its map turned into `kind` (for event, shop and treasure tests). */
export function withNodeKind<R extends { map: GameMap }>(run: R, id: string, kind: MapNodeKind): R {
  const columns = run.map.columns.map((column) => column.map((n) => (n.id === id ? { ...n, kind } : n)));
  return { ...run, map: { columns } };
}

export function setup(
  deck: string[],
  opts: { enemies?: string[]; seed?: number; hp?: number; equipment?: string[]; bonuses?: CompanionEffect[]; data?: GameData } = {},
): CombatState {
  return createCombat(
    {
      seed: opts.seed ?? 1,
      deck,
      enemies: opts.enemies ?? ['dummy'],
      playerHp: opts.hp ?? 80,
      playerMaxHp: 80,
      equipment: opts.equipment,
      bonuses: opts.bonuses,
    },
    opts.data ?? testData,
  );
}

/** Play the first card in hand with the given definition id. */
export function play(state: CombatState, defId: string, targetId = 'e0', data: GameData = testData): CombatState {
  const card = state.piles.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`No "${defId}" in hand: ${state.piles.hand.map((c) => c.defId).join(', ')}`);
  return applyAction(state, { type: 'playCard', cardUid: card.uid, targetId }, data);
}

export function endTurn(state: CombatState): CombatState {
  return applyAction(state, { type: 'endTurn' }, testData);
}

export function repeat(id: string, n: number): string[] {
  return Array.from({ length: n }, () => id);
}

/** A normal-sized creature in the home aquarium. */
export function homeCreature(id: string, bond = 0): HomeCreature {
  return { id, bond, size: 'normal' };
}

/** Normal-sized catches, for a bucket. */
export function caught(...ids: string[]): Catch[] {
  return ids.map((id) => ({ id, size: 'normal' }));
}

/** The creature ids of a bucket or aquarium. */
export function ids(creatures: readonly { id: string }[]): string[] {
  return creatures.map((c) => c.id);
}
