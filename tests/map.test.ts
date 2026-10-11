import { describe, expect, it } from 'vitest';
import {
  buildLevelMap,
  COLUMNS_PER_HALF,
  encountersFor,
  layoutCoast,
  START_NODE_ID,
  validateContent,
  type GameMap,
  type LevelDef,
} from '../src/engine';
import { contentSource, gameData } from '../src/content';
import { testData } from './fixtures';

const handMade = (levelIndex = 0) => buildLevelMap(testData, levelIndex, [], { rng: 1 });

describe('hand-made level maps', () => {
  it('start at the house, which leads to every node of the first column', () => {
    const { columns } = handMade();
    expect(columns[0]).toEqual([expect.objectContaining({ id: START_NODE_ID, kind: 'start', next: ['1a', '1b'] })]);
    expect(columns.map((c) => c.map((n) => n.id))).toEqual([['start'], ['1a', '1b'], ['2'], ['3a', '3b'], ['4']]);
    expect(columns[1].every((n) => n.tier === 1)).toBe(true);
  });
});

describe('the coast', () => {
  const rect = (placement: { feature: string; x: number }) => {
    const f = gameData.coast.features.find((feature) => feature.id === placement.feature)!;
    return { x: placement.x, y: f.y, width: f.crop.width, height: f.crop.height };
  };
  const overlap = (a: ReturnType<typeof rect>, b: typeof a) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  it('lays the features out along their range, without covering each other or a reserved area', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const coast = layoutCoast({ rng: seed }, gameData.coast);
      expect(coast.length, `seed ${seed}`).toBeGreaterThan(gameData.coast.features.length / 2);
      const rects = coast.map(rect);
      coast.forEach((placement, i) => {
        const f = gameData.coast.features.find((feature) => feature.id === placement.feature)!;
        expect(placement.x).toBeGreaterThanOrEqual(f.range[0]);
        expect(placement.x).toBeLessThanOrEqual(f.range[1]);
        for (const other of [...rects.slice(i + 1), ...gameData.coast.reserved]) expect(overlap(rects[i], other), `${placement.feature} (seed ${seed})`).toBe(false);
      });
    }
  });

  it('is the same for a seed, and changes from run to run', () => {
    expect(layoutCoast({ rng: 4 }, gameData.coast)).toEqual(layoutCoast({ rng: 4 }, gameData.coast));
    expect(layoutCoast({ rng: 4 }, gameData.coast)).not.toEqual(layoutCoast({ rng: 5 }, gameData.coast));
  });
});

describe.each(gameData.levels.map((level, i) => [level.id, i] as const))('the generated %s level', (_, levelIndex) => {
  const level = gameData.levels[levelIndex];
  const maps: GameMap[] = Array.from({ length: 25 }, (_, seed) => {
    const holder = { rng: seed + 1 };
    return buildLevelMap(gameData, levelIndex, layoutCoast(holder, gameData.coast), holder);
  });
  const miniBossColumn = COLUMNS_PER_HALF + 1;
  const bossColumn = 2 * miniBossColumn;

  it('has 7 columns to the mini-boss and 7 more to the boss, at their fixed places', () => {
    for (const { columns } of maps) {
      expect(columns).toHaveLength(bossColumn + 1);
      expect(columns[miniBossColumn]).toEqual([expect.objectContaining({ kind: 'miniBoss', x: level.miniBoss!.x, y: level.miniBoss!.y })]);
      expect(columns[bossColumn]).toEqual([expect.objectContaining({ kind: 'boss', x: level.boss!.x, y: level.boss!.y })]);
      for (const column of [...columns.slice(1, miniBossColumn), ...columns.slice(miniBossColumn + 1, bossColumn)]) {
        const lanes = column.filter((n) => n.kind !== 'leave').length;
        expect(lanes).toBeGreaterThanOrEqual(2);
        expect(lanes).toBeLessThanOrEqual(4);
      }
    }
  });

  it('starts with its fixed first column, every run', () => {
    for (const { columns } of maps) {
      const expected = level.firstColumn ?? [];
      if (expected.length) expect(columns[1].map((n) => [n.x, n.y, n.kind, n.spot])).toEqual(
        [...expected].sort((a, b) => a.y - b.y).map((s) => [s.x, s.y, 'fight', s.spot]),
      );
    }
  });

  it('follows the mini-boss with a shop and the leave node, and has a treasure before the boss', () => {
    for (const { columns } of maps) {
      const after = columns[miniBossColumn][0].next.map((id) => columns[miniBossColumn + 1].find((n) => n.id === id)!);
      expect(after.map((n) => n.kind)).toEqual(expect.arrayContaining(['shop', 'leave']));
      expect(after.find((n) => n.kind === 'leave')!.next).toEqual([]);
      expect(columns.flat().filter((n) => n.kind === 'treasure')).toHaveLength(1);
    }
  });

  it('links each column only to the next, and every node can be reached from the house', () => {
    for (const { columns } of maps) {
      const nodes = columns.flat();
      const reached = new Set([START_NODE_ID]);
      for (const node of nodes) {
        if (!reached.has(node.id)) continue;
        if (node.kind !== 'boss' && node.kind !== 'leave') expect(node.next.length, node.id).toBeGreaterThan(0);
        for (const id of node.next) {
          expect(nodes.find((n) => n.id === id)!.column, `${node.id} → ${id}`).toBe(node.column + 1);
          reached.add(id);
        }
      }
      expect(nodes.filter((n) => !reached.has(n.id)).map((n) => n.id)).toEqual([]);
    }
  });

  it('every fight is at a fishing spot of the coast, which finds creatures', () => {
    for (const { columns } of maps) {
      for (const node of columns.flat().filter((n) => n.kind === 'fight')) {
        expect(gameData.spots[node.spot!], node.id).toBeDefined();
        expect(encountersFor(node, gameData).length, node.id).toBeGreaterThan(0);
      }
    }
  });
});

describe('encounters at a fishing spot', () => {
  const node = handMade().columns[1][0];

  it('keeps to the spot’s waters and creature types, at the node’s tier', () => {
    const data = {
      ...testData,
      encounters: [
        { id: 'a', name: 'A', enemies: ['dummy'] },
        { id: 'shell', name: 'Shell', enemies: ['cycler'] },
        { id: 'deep', name: 'Deep', tier: 2, enemies: ['dummy', 'dummy'] },
      ],
    };
    expect(encountersFor(node, data).map((e) => e.id)).toEqual(['a']);
    expect(encountersFor({ ...node, tier: 2 }, data).map((e) => e.id)).toEqual(['deep']);
    // Nothing of the spot's types at this tier: any type from its waters, then any tier.
    expect(encountersFor({ ...node, tier: 3 }, data).map((e) => e.id)).toEqual(['a', 'deep']);
  });

  it('fixed enemies win, and creatureType narrows the pool', () => {
    expect(encountersFor({ ...node, enemies: ['gambler'] }, testData)[0].enemies).toEqual(['gambler']);
    const data = { ...testData, encounters: [...testData.encounters, { id: 'shell', name: 'Shell', enemies: ['cycler'] }] };
    expect(encountersFor({ ...node, spot: null, creatureType: 'shell' }, data).map((e) => e.id)).toEqual(['shell']);
  });
});

describe('level validation', () => {
  const kid = contentSource.levels[0];
  const errorsWith = (level: LevelDef) => validateContent({ ...contentSource, levels: [level, ...contentSource.levels.slice(1)] });
  const handMadeLevel: LevelDef = {
    ...kid,
    miniBoss: undefined,
    boss: undefined,
    escape: undefined,
    nodes: [
      { id: 'h-1', column: 1, x: 0, y: 0, kind: 'fight', spot: 'BE', next: ['h-2'] },
      { id: 'h-2', column: 2, x: 0, y: 0, kind: 'miniBoss', enemies: ['blueCrab'], next: ['h-3a', 'h-3b'] },
      { id: 'h-3a', column: 3, x: 0, y: 0, kind: 'fight', spot: 'BE', next: ['h-4'] },
      { id: 'h-3b', column: 3, x: 0, y: 0, kind: 'leave', next: [] },
      { id: 'h-4', column: 4, x: 0, y: 0, kind: 'boss', enemies: ['commonLobster'], next: [] },
    ],
  };
  const edit = (id: string, change: object): LevelDef => ({ ...handMadeLevel, nodes: handMadeLevel.nodes!.map((n) => (n.id === id ? { ...n, ...change } : n)) });

  it('accepts the real levels, and a hand-made one', () => {
    expect(validateContent(contentSource)).toEqual([]);
    expect(errorsWith(handMadeLevel)).toEqual([]);
  });

  it('explains broken hand-made levels', () => {
    expect(errorsWith(edit('h-1', { next: ['nope'] }))).toEqual(expect.arrayContaining([expect.stringContaining('unknown node "nope"')]));
    expect(errorsWith(edit('h-3a', { next: ['h-1', 'h-4'] }))).toEqual([expect.stringContaining('links back')]);
    expect(errorsWith(edit('h-3a', { spot: 'XX' }))).toEqual([expect.stringContaining('unknown fishing spot "XX"')]);
    expect(errorsWith(edit('h-3b', { kind: 'fight', spot: 'BE', next: ['h-4'] }))).toEqual([expect.stringContaining('leave node')]);
    expect(errorsWith(edit('h-4', { kind: 'fight' }))).toEqual(expect.arrayContaining([expect.stringContaining('exactly one boss')]));
  });

  it('explains broken generated levels and coast features', () => {
    expect(errorsWith({ ...kid, boss: undefined })).toEqual([expect.stringContaining('a miniBoss, a boss and an escape')]);
    expect(errorsWith({ ...kid, miniBoss: { ...kid.miniBoss!, enemies: ['ghost'] } })).toEqual([expect.stringContaining('unknown enemy "ghost"')]);
    const [first, ...rest] = contentSource.coast.features;
    const badFeature = { ...first, visits: [{ spot: 'XX', label: 'X' }] };
    expect(validateContent({ ...contentSource, coast: { ...contentSource.coast, features: [badFeature, ...rest] } })).toEqual([
      expect.stringContaining('unknown fishing spot "XX"'),
    ]);
  });
});
