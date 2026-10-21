import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import {
  buildGameData,
  catchesOf,
  createCombat,
  createRun,
  enterNextLevel,
  FEATURES,
  finishCombat,
  NO_FEATURES,
  saleValue,
  travelTo,
  TROPHY_POOL_PERCENT,
  type GameData,
  type RunState,
} from '../src/engine';

const data: GameData = buildGameData({ ...contentSource, features: FEATURES });
const trophyNodes = (run: RunState) => run.map.columns.flat().filter((n) => n.trophy);

describe('trophy fights on the map', () => {
  it('about 1 in 6 fights per level, at least 2, never in column 1, the same for the same seed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let run = createRun(seed, data, 'rod');
      for (let level = 0; level < data.levels.length; level++) {
        if (level) run = enterNextLevel(run, data);
        const fights = run.map.columns.flat().filter((n) => n.kind === 'fight' && n.column > 1).length;
        const trophies = trophyNodes(run);
        expect(trophies.length).toBe(Math.min(fights, Math.max(2, Math.round(fights / 6))));
        expect(trophies.every((n) => n.kind === 'fight' && n.column > 1)).toBe(true);
      }
      expect(trophyNodes(createRun(seed, data, 'rod')).map((n) => n.id)).toEqual(trophyNodes(createRun(seed, data, 'rod')).map((n) => n.id));
    }
  });

  it('none with the feature off, and the map is otherwise the same', () => {
    const on = createRun(4, { ...data, features: { ...NO_FEATURES, trophyElites: true } }, 'rod');
    const off = createRun(4, gameData, 'rod');
    expect(trophyNodes(off)).toEqual([]);
    const strip = (r: RunState) => r.map.columns.flat().map(({ trophy, ...n }) => n);
    expect(strip(on)).toEqual(strip(off));
  });
});

describe('a trophy fight', () => {
  const config = { seed: 2, deck: ['tug'], enemies: ['clownfish'], playerHp: 60, playerMaxHp: 60, hpPool: 50, willPool: 45, damage: 5.5 };

  it('has 40% more Health and Will, 1 Strength, and its creature is marked', () => {
    const plain = createCombat(config, data).enemies[0];
    const big = createCombat({ ...config, trophy: true }, data).enemies[0];
    expect(big.maxHp).toBe(Math.round((plain.maxHp * TROPHY_POOL_PERCENT) / 100));
    expect(big.escapeAt).toBe(Math.round((plain.escapeAt * TROPHY_POOL_PERCENT) / 100));
    expect(big.statuses.strength).toBe(1);
    expect(big.trophy).toBe(true);
  });

  it('started from the map, hits 20% harder', () => {
    const run = createRun(6, data, 'rod');
    const node = trophyNodes(run)[0];
    const start = { ...run, position: run.map.columns[node.column - 1][0].id, map: { columns: run.map.columns.map((c, i) => (i === node.column - 1 ? c.map((n) => ({ ...n, next: [node.id] })) : c)) } };
    const { combat } = travelTo(start, node.id, data);
    const { combat: plain } = travelTo(start, node.id, { ...data, features: { ...FEATURES, trophyElites: false } });
    expect(combat.enemies[0].trophy).toBe(true);
    expect(combat.enemies[0].damageScale! / plain.enemies[0].damageScale!).toBeCloseTo(1.2);
  });

  it('is caught at trophy size, sells for double, and its win offers gear (a rare card with gear off)', () => {
    const run = createRun(7, data, 'rod');
    const combat = { ...createCombat({ ...config, trophy: true }, data), phase: 'won' as const };
    expect(catchesOf(run, combat)[0].size).toBe('trophy');
    expect(saleValue('clownfish', 0, data, 'trophy')).toBe(2 * saleValue('clownfish', 0, data, 'normal'));
    expect(saleValue('clownfish', 0, gameData, 'trophy')).toBe(saleValue('clownfish', 0, gameData, 'normal'));
    expect(finishCombat(run, combat, data).relicChoices).toHaveLength(3);
    const noGear = { ...data, features: { ...NO_FEATURES, trophyElites: true } };
    expect(finishCombat(run, combat, noGear)).toMatchObject({ luckyLure: true });
  });
});
