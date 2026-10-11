import { describe, expect, it } from 'vitest';
import {
  BOND_AT_HOME,
  availableDestinations,
  bondLevel,
  bondThreshold,
  bringCatchHome,
  createRun,
  hatchling,
  restAtHome,
  travelTo,
} from '../src/engine';
import { gameData } from '../src/content';
import { testData } from './fixtures';

const data = {
  ...testData,
  enemies: { ...testData.enemies, cycler: { ...testData.enemies.cycler, bondToFull: 200 } },
};

describe('bond', () => {
  it('levels come at 20%, 50% and 100% of the creature’s full bond', () => {
    expect([1, 2, 3].map((level) => bondThreshold('cycler', level, data))).toEqual([40, 100, 200]);
    expect([0, 39, 40, 99, 100, 199, 200].map((bond) => bondLevel({ id: 'cycler', bond }, data))).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect(bondThreshold('dummy', 3, data)).toBe(100); // no bondToFull: 100
  });

  it('full bond comes from the tier: 100, 200, 400', () => {
    expect(gameData.enemies.clownfish.bondToFull).toBe(100); // tier 1
    expect(gameData.enemies.catfish.bondToFull).toBe(200); // tier 2
    expect(Object.values(gameData.enemies).some((e) => e.bondToFull === 400)).toBe(true);
  });

  it('companions gain a point per fight, never past full, and keep it when the run comes home', () => {
    let run = createRun(5, data, 'basic', [{ id: 'cycler', bond: 10 }, { id: 'dummy', bond: 100 }]);
    run = travelTo(run, availableDestinations(run)[0].id, data).run;
    expect(run.companions).toEqual([{ id: 'cycler', bond: 11 }, { id: 'dummy', bond: 100 }]);
    run = { ...run, bucket: [...run.bucket, 'gambler'] };
    expect(bringCatchHome([], run)).toEqual([
      { id: 'cycler', bond: 11 },
      { id: 'dummy', bond: 100 },
      { id: 'gambler', bond: 0 },
    ]);
  });

  it('creatures left at home grow slowly, up to level 1 only, and never lose bond', () => {
    const home = [
      { id: 'cycler', bond: 0 },
      { id: 'cycler', bond: 39 },
      { id: 'cycler', bond: 120 },
    ];
    expect(restAtHome(home, data)).toEqual([
      { id: 'cycler', bond: BOND_AT_HOME },
      { id: 'cycler', bond: 40 },
      { id: 'cycler', bond: 120 },
    ]);
  });

  it('hatchlings start at level 1', () => {
    expect(bondLevel(hatchling('cycler', data), data)).toBe(1);
  });
});
