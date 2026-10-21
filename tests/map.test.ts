import { describe, expect, it } from 'vitest';
import {
  buildLevelMap,
  COLUMNS_PER_HALF,
  encountersFor,
  EVENT_COLUMNS,
  START_NODE_ID,
  validateContent,
  type GameMap,
  type LevelDef,
} from '../src/engine';
import { contentSource, gameData } from '../src/content';
import { testData } from './fixtures';

const handMade = (levelIndex = 0) => buildLevelMap(testData, levelIndex, { rng: 1 });

describe('hand-made level maps', () => {
  it('start at the house, which leads to every node of the first column', () => {
    const { columns } = handMade();
    expect(columns[0]).toEqual([expect.objectContaining({ id: START_NODE_ID, kind: 'start', next: ['1a', '1b'] })]);
    expect(columns.map((c) => c.map((n) => n.id))).toEqual([['start'], ['1a', '1b'], ['2'], ['3a', '3b'], ['4']]);
    expect(columns[1].every((n) => n.tier === 1)).toBe(true);
  });
});

describe('the coast', () => {
  it('has its places on the art, each with a fishing spot for every age it is visited by', () => {
    const ids = new Set(gameData.coast.places.map((p) => p.id));
    expect(ids.size).toBe(gameData.coast.places.length);
    for (const place of gameData.coast.places) {
      expect(place.x, place.id).toBeGreaterThanOrEqual(0);
      expect(place.x, place.id).toBeLessThan(1300);
      gameData.levels.forEach((level, i) => {
        const visit = place.visits[i];
        if (!visit) return;
        expect(gameData.spots[visit.spot], place.id).toBeDefined();
        expect(visit.at?.y ?? place.y, `${place.id} (${level.id})`).toBeLessThan(level.height);
      });
    }
  });
});

describe.each(gameData.levels.map((level, i) => [level.id, i] as const))('the generated %s level', (_, levelIndex) => {
  const level = gameData.levels[levelIndex];
  const maps: GameMap[] = Array.from({ length: 25 }, (_, seed) => {
    return buildLevelMap(gameData, levelIndex, { rng: seed + 1 });
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

  it('has an event (or a shop) in every other column, so a run is not all fights', () => {
    for (const { columns } of maps) {
      for (const column of EVENT_COLUMNS) {
        const lanes = columns[column].filter((n) => n.kind !== 'leave');
        expect(lanes.length === 1 || lanes.some((n) => n.kind !== 'fight'), `column ${column}`).toBe(true);
      }
    }
  });

  it('sometimes puts a shop where an event would be', () => {
    const shops = maps.map(({ columns }) => columns.flat().filter((n) => n.kind === 'shop').length);
    expect(shops.every((n) => n >= 2)).toBe(true); // the two fixed ones
    expect(shops.some((n) => n > 2)).toBe(true);
    expect(shops.some((n) => n === 2)).toBe(true); // most events stay events
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
        { id: 'deep', name: 'Deep', tier: 2, enemies: ['dummy'] },
        { id: 'group', name: 'Group', tier: 2, enemies: ['dummy', 'dummy'] },
      ],
    };
    expect(encountersFor(node, data).map((e) => e.id)).toEqual(['a']);
    // Groups are left out (MAX_CREATURES_PER_FIGHT).
    expect(encountersFor({ ...node, tier: 2 }, data).map((e) => e.id)).toEqual(['deep']);
    // Nothing of the spot's types at this tier: any type from its waters, then any tier.
    expect(encountersFor({ ...node, tier: 3 }, data).map((e) => e.id)).toEqual(['a', 'deep']);
  });

  it('fixed enemies win', () => {
    expect(encountersFor({ ...node, enemies: ['gambler'] }, testData)[0].enemies).toEqual(['gambler']);
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

  it('explains broken generated levels and coast places', () => {
    expect(errorsWith({ ...kid, boss: undefined })).toEqual([expect.stringContaining('a miniBoss, a boss and an escape')]);
    expect(errorsWith({ ...kid, miniBoss: { ...kid.miniBoss!, enemies: ['ghost'] } })).toEqual([expect.stringContaining('unknown enemy "ghost"')]);
    const [first, ...rest] = contentSource.coast.places;
    const badPlace = { ...first, visits: [{ spot: 'XX', label: 'X' }] };
    expect(validateContent({ ...contentSource, coast: { places: [badPlace, ...rest] } })).toEqual([
      expect.stringContaining('unknown fishing spot "XX"'),
    ]);
  });
});
