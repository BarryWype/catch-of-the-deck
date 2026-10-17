import { describe, expect, it } from 'vitest';
import {
  BOND_AT_HOME,
  availableDestinations,
  bondLevel,
  bondPerFight,
  bondThreshold,
  enterNextLevel,
  rescaleBond,
  bringCatchHome,
  createRun,
  hatchling,
  restAtHome,
  travelTo,
} from '../src/engine';
import { gameData } from '../src/content';
import { caught, homeCreature, testData } from './fixtures';

const data = {
  ...testData,
  enemies: { ...testData.enemies, cycler: { ...testData.enemies.cycler, bondToFull: 200 } },
};

describe('bond', () => {
  it('levels come at 20%, 50% and 100% of the creature’s full bond', () => {
    expect([1, 2, 3].map((level) => bondThreshold('cycler', level, data))).toEqual([40, 100, 200]);
    expect([0, 39, 40, 99, 100, 199, 200].map((bond) => bondLevel(homeCreature('cycler', bond), data))).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect(bondThreshold('dummy', 3, data)).toBe(100); // no bondToFull: 100
  });

  it('full bond comes from the tier: 40, 60, 90', () => {
    expect(gameData.enemies.clownfish.bondToFull).toBe(40); // tier 1
    expect(gameData.enemies.catfish.bondToFull).toBe(60); // tier 2
    expect(Object.values(gameData.enemies).some((e) => e.bondToFull === 90)).toBe(true);
  });

  it('a fight gives the level’s tier in bond, doubled against a mini-boss or boss', () => {
    expect([1, 2, 3].map((tier) => bondPerFight(tier, false))).toEqual([1, 2, 3]);
    expect([1, 2, 3].map((tier) => bondPerFight(tier, true))).toEqual([2, 4, 6]);
    let run = createRun(5, data, 'basic', [homeCreature('cycler', 10)]);
    run = travelTo(run, '1a', data).run;
    run = travelTo(run, '2', data).run; // the first level's mini-boss
    expect(run.companions[0].bond).toBe(10 + 1 + 2);
    const adult = enterNextLevel(createRun(5, data, 'basic', [homeCreature('cycler', 10)]), data);
    expect(travelTo(adult, availableDestinations(adult)[0].id, data).run.companions[0].bond).toBe(12);
  });

  it('companions gain bond every fight, never past full, and keep it when the run comes home', () => {
    let run = createRun(5, data, 'basic', [homeCreature('cycler', 10), homeCreature('dummy', 100)]);
    run = travelTo(run, availableDestinations(run)[0].id, data).run;
    expect(run.companions).toEqual([homeCreature('cycler', 11), homeCreature('dummy', 100)]);
    run = { ...run, bucket: [...run.bucket, ...caught('gambler')] };
    expect(bringCatchHome([], run, data)).toEqual([
      homeCreature('cycler', 11),
      homeCreature('dummy', 100),
      homeCreature('gambler', 0),
    ]);
  });

  it('creatures left at home grow slowly, up to level 1 only, and never lose bond', () => {
    const home = [
      homeCreature('cycler', 0),
      homeCreature('cycler', 39),
      homeCreature('cycler', 120),
    ];
    expect(restAtHome(home, data)).toEqual([
      homeCreature('cycler', BOND_AT_HOME),
      homeCreature('cycler', 40),
      homeCreature('cycler', 120),
    ]);
  });

  it('hatchlings start small, at level 1', () => {
    expect(bondLevel(hatchling('cycler', data), data)).toBe(1);
    expect(hatchling('cycler', data).size).toBe('small');
  });

  it('old bond points keep their share of full bond, rounded, and never lose a level', () => {
    // cycler: full at 200 now, 400 before.
    expect(rescaleBond(homeCreature('cycler', 100), 400, data).bond).toBe(50); // 25%: level 1 both ways
    expect(rescaleBond(homeCreature('cycler', 0), 400, data).bond).toBe(0);
    expect(rescaleBond(homeCreature('cycler', 400), 400, data).bond).toBe(200);
    expect(rescaleBond(homeCreature('cycler', 80), 400, data)).toEqual(homeCreature('cycler', 40));
    // Full at 7: 20 of 100 (level 1) rounds to 1, below level 1 (2 points), so it gets 2.
    const small = { ...data, enemies: { ...data.enemies, gambler: { ...testData.enemies.gambler, bondToFull: 7 } } };
    expect(rescaleBond(homeCreature('gambler', 20), 100, small).bond).toBe(2);
    expect(rescaleBond(homeCreature('gambler', 19), 100, small).bond).toBe(1);
  });
});
