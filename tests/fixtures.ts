import { applyAction, buildGameData, createCombat, type CombatState, type CompanionEffect, type GameMap, type MapNodeKind } from '../src/engine';

/**
 * Test-only content with fixed numbers, so engine tests don't break when a
 * designer rebalances the real cards.
 */
export const testData = buildGameData({
  character: { name: 'Tester', maxHp: 80, home: { name: 'Home' } },
  cards: [
    { id: 'strike', name: 'Strike', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', effects: [{ type: 'dealDamage', amount: 6 }] },
    { id: 'defend', name: 'Defend', type: 'skill', rarity: 'starter', cost: 1, target: 'none', effects: [{ type: 'gainBlock', amount: 5 }] },
    {
      id: 'bash', name: 'Bash', type: 'attack', rarity: 'starter', cost: 2, target: 'enemy',
      effects: [{ type: 'dealDamage', amount: 8 }, { type: 'applyStatus', status: 'vulnerable', amount: 2 }],
    },
    { id: 'twin', name: 'Twin', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', effects: [{ type: 'dealDamage', amount: 5, hits: 2 }] },
    { id: 'flex', name: 'Flex', type: 'power', rarity: 'rare', cost: 1, target: 'none', effects: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] },
    { id: 'weaken', name: 'Weaken', type: 'skill', rarity: 'common', cost: 0, target: 'enemy', effects: [{ type: 'applyStatus', status: 'weak', amount: 2 }] },
    { id: 'ponder', name: 'Ponder', type: 'skill', rarity: 'common', cost: 0, target: 'none', effects: [{ type: 'drawCards', amount: 2 }] },
    { id: 'adrenaline', name: 'Adrenaline', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none', exhaust: true, effects: [{ type: 'gainEnergy', amount: 1 }] },
    { id: 'heavy', name: 'Heavy', type: 'attack', rarity: 'common', cost: 3, target: 'enemy', effects: [{ type: 'dealDamage', amount: 20 }] },
    { id: 'calm', name: 'Calm', type: 'skill', rarity: 'common', cost: 0, target: 'enemy', effects: [{ type: 'changeEscape', amount: -10 }] },
    { id: 'spook', name: 'Spook', type: 'skill', rarity: 'common', cost: 0, target: 'enemy', effects: [{ type: 'changeEscape', amount: 10 }] },
    { id: 'pin', name: 'Pin', type: 'skill', rarity: 'common', cost: 0, target: 'enemy', effects: [{ type: 'changeEscapeRate', amount: -3 }] },
    { id: 'snare', name: 'Snare', type: 'skill', rarity: 'common', cost: 0, target: 'enemy', effects: [{ type: 'applyStatus', status: 'snared', amount: 1 }] },
    { id: 'lure', name: 'Lure', type: 'skill', rarity: 'common', cost: 0, target: 'none', build: 'angler', effects: [{ type: 'drawCards', amount: 1 }] },
    {
      id: 'hook', name: 'Hook', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy',
      effects: [{ type: 'dealDamage', amount: 5, hits: 2, bonus: { against: ['fish'], amount: 4 } }],
    },
  ],
  enemies: [
    {
      id: 'dummy', name: 'Dummy', hp: [100, 100], sellValue: 5, escapeAt: 1000, escapeStart: 4, escapeRate: 1, tags: ['fish'], water: 'salt',
      moves: [{ id: 'hit', name: 'Hit', effects: [{ type: 'dealDamage', amount: 10 }] }],
      pattern: { type: 'sequence', moves: ['hit'] },
    },
    {
      id: 'cycler', name: 'Cycler', hp: [20, 30], escapeAt: 1000, escapeStart: 4, escapeRate: 1, tags: ['shell'], water: 'salt',
      moves: [
        { id: 'a', name: 'A', effects: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] },
        { id: 'b', name: 'B', effects: [{ type: 'gainBlock', amount: 5 }] },
        { id: 'c', name: 'C', effects: [{ type: 'dealDamage', amount: 3 }] },
      ],
      pattern: { type: 'sequence', moves: ['a', 'b', 'c'], loopFrom: 1 },
    },
    {
      id: 'gambler', name: 'Gambler', hp: [30, 30], escapeAt: 1000, escapeStart: 4, escapeRate: 1,
      moves: [
        { id: 'x', name: 'X', effects: [{ type: 'dealDamage', amount: 1 }] },
        { id: 'y', name: 'Y', effects: [{ type: 'gainBlock', amount: 1 }] },
      ],
      pattern: { type: 'weighted', weights: { x: 1, y: 1 }, maxConsecutive: 1 },
    },
    // Three species of one temperament, to test companion bonuses.
    ...['shellA', 'shellB', 'shellC'].map((id) => ({
      id, name: id, hp: [10, 10] as [number, number], sellValue: 10, escapeAt: 100, escapeStart: 50, escapeRate: 1, temperament: 'shelled',
      moves: [{ id: 'm', name: 'M', effects: [] }], pattern: { type: 'sequence' as const, moves: ['m'] },
    })),
  ],
  companionBonuses: [
    {
      id: 'shelled', name: 'Shelled', temperamentName: 'Shelled',
      effects: [{ type: 'bonusBlock', amount: 1 }, { type: 'bonusMaxHp', amount: 5 }, { type: 'sellBonus', amount: 10 }],
      fullSchool: [{ type: 'keepBlock', amount: 2 }],
    },
  ],
  encounters: [{ id: 'dummy', name: 'Dummy', enemies: ['dummy'] }],
  builds: [
    { id: 'basic', name: 'Basic', description: '', starterDeck: ['strike', 'defend'], strongAgainst: [] },
    { id: 'angler', name: 'Angler', description: '', starterDeck: ['hook', 'defend'], strongAgainst: ['fish'], startingEquipment: ['reel'] },
  ],
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
      id: 'one', name: 'One', tier: 1, start: { x: 0, y: 0 },
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
      id: 'two', name: 'Two', tier: 2, start: { x: 0, y: 0 },
      nodes: [
        { id: 'two-1', column: 1, x: 10, y: 10, kind: 'fight', spot: 'sea', next: ['two-2'] },
        { id: 'two-2', column: 2, x: 20, y: 10, kind: 'miniBoss', enemies: ['dummy'], next: ['two-3a', 'two-3b'] },
        { id: 'two-3a', column: 3, x: 30, y: 10, kind: 'fight', spot: 'sea', next: ['two-4'] },
        { id: 'two-3b', column: 3, x: 30, y: 20, kind: 'leave', next: [] },
        { id: 'two-4', column: 4, x: 40, y: 10, kind: 'boss', enemies: ['cycler', 'cycler'], next: [] },
      ],
    },
  ],
});

/** The run with node `id` of its map turned into `kind` (for event, shop and treasure tests). */
export function withNodeKind<R extends { map: GameMap }>(run: R, id: string, kind: MapNodeKind): R {
  const columns = run.map.columns.map((column) => column.map((n) => (n.id === id ? { ...n, kind } : n)));
  return { ...run, map: { columns } };
}

export function setup(
  deck: string[],
  opts: { enemies?: string[]; seed?: number; hp?: number; equipment?: string[]; bonuses?: CompanionEffect[] } = {},
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
    testData,
  );
}

/** Play the first card in hand with the given definition id. */
export function play(state: CombatState, defId: string, targetId = 'e0'): CombatState {
  const card = state.piles.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`No "${defId}" in hand: ${state.piles.hand.map((c) => c.defId).join(', ')}`);
  return applyAction(state, { type: 'playCard', cardUid: card.uid, targetId }, testData);
}

export function endTurn(state: CombatState): CombatState {
  return applyAction(state, { type: 'endTurn' }, testData);
}

export function repeat(id: string, n: number): string[] {
  return Array.from({ length: n }, () => id);
}
