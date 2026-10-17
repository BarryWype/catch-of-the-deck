import { describe, expect, it } from 'vitest';
import {
  BUCKET_SIZE,
  catchesOf,
  createRun,
  finishCombat,
  keepCatch,
  recordSizes,
  rollSize,
  sellCatch,
  sizeOdds,
  travelTo,
  type CatchSize,
  type CombatState,
} from '../src/engine';
import { caught, homeCreature, ids, testData } from './fixtures';

/** A won fight at 1a against `n` dummies (sell value 5). */
function wonAgainst(n: number, run = createRun(5, testData, 'basic')) {
  const fight = travelTo(run, '1a', testData);
  const enemies = Array.from({ length: n }, (_, i) => ({ ...fight.combat.enemies[0], id: `e${i}`, hp: 0 }));
  return { run: fight.run, combat: { ...fight.combat, phase: 'won', enemies } as CombatState };
}

describe('the bucket limit', () => {
  it('holds BUCKET_SIZE creatures, companions included; the rest wait, the run untouched otherwise', () => {
    expect(BUCKET_SIZE).toBe(7);
    const start = { ...createRun(5, testData, 'basic', [homeCreature('shellA')]), bucket: [...caught('shellA'), ...caught('cycler', 'cycler', 'cycler', 'cycler')] };
    const { run, combat } = wonAgainst(3, start);
    const after = finishCombat(run, combat, testData);
    expect(ids(after.bucket)).toEqual(['shellA', 'cycler', 'cycler', 'cycler', 'cycler', 'dummy', 'dummy']);
    expect(ids(after.waiting)).toEqual(['dummy']);
  });

  it('a group fight can overflow by several: each waiting catch is kept or sold in turn', () => {
    const start = { ...createRun(5, testData, 'basic', [homeCreature('shellA')]), bucket: [...caught('shellA'), ...caught('cycler', 'cycler', 'cycler', 'cycler', 'cycler', 'cycler')] };
    const { run, combat } = wonAgainst(3, start);
    let after = finishCombat(run, combat, testData);
    expect(after.bucket).toHaveLength(7);
    expect(after.waiting).toHaveLength(3);
    // Keep the first in place of a cycler (sold for its value plus the 10% companion sell bonus).
    after = keepCatch(after, 1, testData);
    expect(ids(after.bucket)).toEqual(['shellA', 'cycler', 'cycler', 'cycler', 'cycler', 'cycler', 'dummy']);
    expect(after.waiting).toHaveLength(2);
    // Sell the second: 5 + 10%, rounded up.
    const coins = after.coins;
    after = sellCatch(after, testData);
    expect(after.coins).toBe(coins + 6);
    expect(after.waiting).toHaveLength(1);
    // Keep the last in place of the companion: its bonus ends.
    after = keepCatch(after, 0, testData);
    expect(after.companions).toEqual([]);
    expect(after.bucket).toHaveLength(7);
    expect(after.waiting).toEqual([]);
    expect(() => sellCatch(after, testData)).toThrow();
    expect(() => keepCatch(after, 0, testData)).toThrow();
  });

  it('the choice survives a reload: the waiting catches are saved with the run', () => {
    const start = { ...createRun(5, testData, 'basic'), bucket: caught('cycler', 'cycler', 'cycler', 'cycler', 'cycler', 'cycler') };
    const { run, combat } = wonAgainst(2, start);
    const after = finishCombat(run, combat, testData);
    const reloaded = JSON.parse(JSON.stringify(after));
    expect(reloaded.waiting).toEqual(after.waiting);
    expect(keepCatch(reloaded, 0, testData)).toEqual(keepCatch(after, 0, testData));
  });

  it('a bucket already over the limit keeps everything but takes nothing more', () => {
    const over = caught(...Array<string>(9).fill('cycler'));
    const { run, combat } = wonAgainst(1, { ...createRun(5, testData, 'basic'), bucket: over });
    const after = finishCombat(run, combat, testData);
    expect(after.bucket).toHaveLength(9);
    expect(ids(after.waiting)).toEqual(['dummy']);
  });

  it('equipment that sells catches on the spot comes first', () => {
    const full = { ...createRun(5, testData, 'basic'), equipment: ['spear'], bucket: caught(...Array<string>(7).fill('cycler')) };
    const { run, combat } = wonAgainst(2, full);
    const after = finishCombat(run, combat, testData);
    expect(after.waiting).toEqual([]);
    expect(after.coins).toBe(12); // 2 × (5 + 20%)
  });
});

describe('catch sizes', () => {
  it('start at 30/50/17/3; each fight before moves 1 point of small to large and 0.5 to trophy, until small is 5', () => {
    expect(sizeOdds(0)).toEqual({ small: 30, normal: 50, large: 17, trophy: 3 });
    expect(sizeOdds(4)).toEqual({ small: 24, normal: 50, large: 21, trophy: 5 });
    const capped = sizeOdds(40);
    expect(capped.small).toBe(5);
    expect(capped).toEqual(sizeOdds(100));
    expect(Object.values(capped).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  it('roll at those odds; draining Will rolls twice and keeps the bigger', () => {
    const count = (fights: number, byWill: boolean) => {
      const rng = { rng: 1 };
      const sizes: Record<CatchSize, number> = { small: 0, normal: 0, large: 0, trophy: 0 };
      for (let i = 0; i < 20000; i++) sizes[rollSize(rng, fights, byWill)]++;
      return sizes;
    };
    const first = count(0, false);
    expect(first.small / 20000).toBeCloseTo(0.3, 1);
    expect(first.normal / 20000).toBeCloseTo(0.5, 1);
    expect(first.trophy / 20000).toBeCloseTo(0.03, 1);
    const drained = count(0, true);
    expect(drained.small / 20000).toBeCloseTo(0.09, 1); // both small: 30% × 30%
    expect(count(20, false).small / 20000).toBeCloseTo(0.05, 1);
  });

  it('are the same for the same seed, and calling catchesOf again gives the same sizes', () => {
    const roll = (seed: number) => {
      const rng = { rng: seed };
      return Array.from({ length: 20 }, () => rollSize(rng, 3, false));
    };
    expect(roll(42)).toEqual(roll(42));
    expect(roll(42)).not.toEqual(roll(43));
    const { run, combat } = wonAgainst(3);
    expect(catchesOf(run, combat)).toEqual(catchesOf(run, combat));
    expect(finishCombat(run, combat, testData).bucket).toEqual(catchesOf(run, combat));
  });

  it('none from a lost fight', () => {
    const { run, combat } = wonAgainst(2);
    expect(catchesOf(run, { ...combat, phase: 'lost' })).toEqual([]);
  });
});

describe('the creature book’s biggest catch', () => {
  it('keeps the biggest size of each species, and is unchanged when nothing grew', () => {
    const book = recordSizes({}, [{ id: 'dummy', size: 'normal' }, { id: 'dummy', size: 'large' }, { id: 'cycler', size: 'small' }]);
    expect(book).toEqual({ dummy: 'large', cycler: 'small' });
    expect(recordSizes(book, [{ id: 'dummy', size: 'normal' }])).toBe(book);
    expect(recordSizes(book, [{ id: 'dummy', size: 'trophy' }])).toEqual({ dummy: 'trophy', cycler: 'small' });
  });
});
