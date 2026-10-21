import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { buildGameData, createCombat, NO_FEATURES, OWN_STATS_MAX_PERCENT, OWN_STATS_MIN_PERCENT, turnAverage, type GameData } from '../src/engine';

const data: GameData = buildGameData({ ...contentSource, features: { ...NO_FEATURES, ownStats: true } });
const config = (enemies: string[], extra = {}) => ({ seed: 1, deck: ['tug'], enemies, playerHp: 60, playerMaxHp: 60, hpPool: 50, willPool: 45, damage: 5.5, ...extra });
const one = (id: string, d: GameData = data, extra = {}) => createCombat(config([id], extra), d).enemies[0];

describe('creatures’ own stats', () => {
  it('computes each tier’s average once, with the game data', () => {
    const tier1 = contentSource.enemies.filter((e) => e.tier === 1);
    expect(data.tierAverages![1].hp).toBeCloseTo(tier1.reduce((sum, e) => sum + (e.hp[0] + e.hp[1]) / 2, 0) / tier1.length);
  });

  it('keeps the spread: a bigger creature than its tier’s average gets more than the pool, a smaller one less', () => {
    const big = one('queenAngelfish');
    const small = one('guppy');
    expect(big.maxHp).toBeGreaterThan(small.maxHp);
    expect(big.maxHp).toBeGreaterThan(50);
    expect(small.maxHp).toBeLessThan(50);
    // Without the feature, both are raised to the same pool.
    expect(one('queenAngelfish', gameData).maxHp).toBe(one('guppy', gameData).maxHp);
  });

  it('never goes beyond 70–140% of the pool, for Health, Will and damage', () => {
    for (const id of Object.keys(data.enemies)) {
      const e = one(id);
      expect(e.maxHp, id).toBeGreaterThanOrEqual(Math.floor((50 * OWN_STATS_MIN_PERCENT) / 100));
      expect(e.maxHp, id).toBeLessThanOrEqual(Math.ceil((50 * OWN_STATS_MAX_PERCENT) / 100));
      expect(e.escape, id).toBeGreaterThanOrEqual(Math.floor((45 * OWN_STATS_MIN_PERCENT) / 100));
      expect(e.escape, id).toBeLessThanOrEqual(Math.ceil((45 * OWN_STATS_MAX_PERCENT) / 100));
      const def = data.enemies[id];
      const dealt = turnAverage(def.moves, def.pattern) * e.damageScale!;
      expect(dealt, id).toBeGreaterThanOrEqual((5.5 * OWN_STATS_MIN_PERCENT) / 100 - 1e-9);
      expect(dealt, id).toBeLessThanOrEqual((5.5 * OWN_STATS_MAX_PERCENT) / 100 + 1e-9);
    }
  });

  it('a creature whose moves hit harder than its tier’s average deals more than the average', () => {
    const tier = data.tierAverages![1].turnAverage;
    const ids = Object.values(data.enemies).filter((e) => e.tier === 1);
    const hard = ids.find((e) => turnAverage(e.moves, e.pattern) > tier * 1.05)!;
    const e = one(hard.id);
    expect(turnAverage(hard.moves, hard.pattern) * e.damageScale!).toBeGreaterThan(5.5);
  });

  it('leaves mini-bosses and bosses to their own rules', () => {
    expect(one('blueCrab', data, { bosses: true })).toEqual(one('blueCrab', gameData, { bosses: true }));
  });
});
