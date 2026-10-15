import { describe, expect, it } from 'vitest';
import { behaviors } from '../src/content/behaviors';
import { creatures } from '../src/content/creatures';
import { applyAction, createCombat, previewIntent, type CombatState, type EnemyDef, type EnemyMove, type GameData, type IntentPattern } from '../src/engine';
import { repeat, testData } from './fixtures';

const WIND = { type: 'applyStatus', status: 'windUp', amount: 1, target: 'self' } as const;
const MOVES: EnemyMove[] = [
  { id: 'wind', name: 'Wind', tag: 'windUp', effects: [WIND] },
  { id: 'hit', name: 'Hit', tag: 'strike', effects: [{ type: 'dealDamage', amount: 10 }] },
  { id: 'multi', name: 'Multi', tag: 'strike', effects: [{ type: 'dealDamage', amount: 3, hits: 3 }] },
  { id: 'tug', name: 'Tug', tag: 'pull', effects: [{ type: 'pull', amount: 8 }] },
  { id: 'nap', name: 'Nap', tag: 'rest', skipWillRise: true, effects: [] },
  { id: 'graze', name: 'Graze', tag: 'feed', skipWillRise: true, effects: [{ type: 'healPercent', percent: 8, target: 'self' }] },
  { id: 'flex', name: 'Flex', tag: 'buff', effects: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] },
];

/** A fight against one creature with these moves, in this pattern (no fight scaling unless `damage`). */
function fight(pattern: IntentPattern, opts: { damage?: number; bosses?: boolean; strength?: number } = {}): { s: CombatState; data: GameData } {
  const creature: EnemyDef = {
    ...testData.enemies.dummy,
    id: 'creature',
    hp: [50, 50],
    escapeAt: 1000,
    escapeStart: 100,
    escapeRate: 5,
    moves: MOVES,
    pattern,
    startingStatuses: opts.strength ? { strength: opts.strength } : {},
  };
  const data = { ...testData, enemies: { ...testData.enemies, creature } };
  const s = createCombat(
    { seed: 1, deck: repeat('strike', 10), enemies: ['creature'], playerHp: 80, playerMaxHp: 80, damage: opts.damage, bosses: opts.bosses },
    data,
  );
  return { s, data };
}
const seq = (...moves: string[]): IntentPattern => ({ type: 'sequence', moves });
const endTurn = (s: CombatState, data: GameData) => applyAction(s, { type: 'endTurn' }, data);

describe('quiet moves', () => {
  it('are left out of the fight scaling: only Strikes and Pulls average the fight damage', () => {
    // Hit 10, Multi 9 and Tug 8 average 9: a fight damage of 9 leaves them as written.
    const { s, data } = fight(seq('hit'), { damage: 9 });
    expect(s.enemies[0].damageScale).toBe(1);
    expect(previewIntent(s, s.enemies[0], data)?.damage).toBe(10);
  });

  it('Rest and Feed keep the Will from rising that turn; other moves let it rise', () => {
    const resting = fight(seq('nap'));
    expect(endTurn(resting.s, resting.data).enemies[0].escape).toBe(100);
    const windingUp = fight(seq('wind'));
    // +5, slowed by the Patience the unused energy gave.
    expect(endTurn(windingUp.s, windingUp.data).enemies[0].escape).toBeGreaterThan(100);
  });

  it('Feed heals 8% of its max Health (rounded up)', () => {
    const { s, data } = fight(seq('graze'));
    s.enemies[0].hp = 30;
    expect(endTurn(s, data).enemies[0].hp).toBe(34);
  });

  it('a weighted pattern can cap one move on its own (`maxRepeat`)', () => {
    let { s, data } = fight({ type: 'weighted', weights: { nap: 100, wind: 1 }, maxRepeat: { nap: 1 } });
    for (let i = 0; i < 20; i++) s = endTurn(s, data);
    const history = s.enemies[0].moveHistory;
    expect(history.some((m, i) => m === 'nap' && history[i + 1] === 'nap')).toBe(false);
  });
});

describe('Wind-up', () => {
  it('makes the next move 50% bigger, shown in its intent, and is used up by it', () => {
    let { s, data } = fight(seq('wind', 'hit', 'hit'));
    s = endTurn(s, data);
    expect(s.enemies[0].statuses.windUp).toBe(1);
    expect(previewIntent(s, s.enemies[0], data)?.damage).toBe(15);
    const before = s.player.hp;
    s = endTurn(s, data);
    expect(before - s.player.hp).toBe(15);
    expect(s.enemies[0].statuses.windUp).toBeUndefined();
    // The one after is back to normal.
    expect(previewIntent(s, s.enemies[0], data)?.damage).toBe(10);
  });

  it('scales a multi-hit Strike in total, after the fight scaling, rounded down', () => {
    // 3 × 3 = 9, × 1.5 = 13.5 → 13.
    let { s, data } = fight(seq('wind', 'multi'));
    s = endTurn(s, data);
    const before = s.player.hp;
    expect(before - endTurn(s, data).player.hp).toBe(13);
  });

  it('gives a mini-boss or boss 1 Strength as well', () => {
    const boss = fight(seq('wind'), { bosses: true });
    expect(endTurn(boss.s, boss.data).enemies[0].statuses.strength).toBe(1);
    const plain = fight(seq('wind'));
    expect(endTurn(plain.s, plain.data).enemies[0].statuses.strength).toBeUndefined();
  });
});

describe('Strength from moves', () => {
  it('is capped at +3 a fight, on top of the starting Strength', () => {
    let { s, data } = fight(seq('flex'), { strength: 2 });
    for (let i = 0; i < 4; i++) s = endTurn(s, data);
    expect(s.enemies[0].statuses.strength).toBe(2 + 3);
  });

  it('only predators, Pike, Red piranha (and bosses, through their Wind-ups) gain it', () => {
    const givesStrength = (moves: EnemyMove[]) => moves.some((m) => m.effects.some((e) => e.type === 'applyStatus' && e.status === 'strength' && e.target === 'self'));
    const sets = Object.entries(behaviors).filter(([, b]) => givesStrength(b.moves)).map(([id]) => id);
    expect(sets).toEqual(['predator']);
    const own = creatures.filter((c) => c.moves && givesStrength(c.moves.moves)).map((c) => c.id);
    expect(own.sort()).toEqual(['pike', 'redPiranha']);
  });

  it('every Rest and Feed move keeps the Will still', () => {
    const all = [...Object.values(behaviors).flatMap((b) => b.moves), ...creatures.flatMap((c) => c.moves?.moves ?? [])] as EnemyMove[];
    for (const move of all.filter((m) => m.tag === 'rest' || m.tag === 'feed')) expect(move.skipWillRise, move.id).toBe(true);
  });
});
