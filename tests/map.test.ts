import { describe, expect, it } from 'vitest';
import { buildLevelMap, encountersFor, encounterTier, START_NODE_ID, validateContent, type LevelDef } from '../src/engine';
import { contentSource, gameData } from '../src/content';
import { testData } from './fixtures';

describe('level maps', () => {
  it('a level map starts at the house, which leads to every node of the first column', () => {
    const { columns } = buildLevelMap(testData.levels[0]);
    expect(columns[0]).toEqual([expect.objectContaining({ id: START_NODE_ID, kind: 'start', next: ['1a', '1b'] })]);
    expect(columns.map((c) => c.map((n) => n.id))).toEqual([['start'], ['1a', '1b'], ['2'], ['3a', '3b'], ['4']]);
    expect(columns[1].every((n) => n.tier === 1)).toBe(true);
  });

  describe.each(gameData.levels.map((level) => [level.id, level] as const))('the %s level', (_, level) => {
    const { columns } = buildLevelMap(level);

    it('has 15 columns of encounters, a mini-boss in the middle and the boss alone at the end', () => {
      expect(columns).toHaveLength(17); // start + 15 + boss
      expect(columns[8].map((n) => n.kind)).toEqual(['miniBoss']);
      expect(columns[16].map((n) => n.kind)).toEqual(['boss']);
    });

    it('the mini-boss leads to at least 2 nodes, one of them a leave node that ends the run', () => {
      const after = columns[8][0].next.map((id) => columns[9].find((n) => n.id === id)!);
      expect(after.length).toBeGreaterThanOrEqual(2);
      expect(after.filter((n) => n.kind === 'leave')).toEqual([expect.objectContaining({ next: [] })]);
    });

    it('every fight finds creatures from its fishing spot at the level’s tier', () => {
      for (const node of columns.flat().filter((n) => n.kind === 'fight')) {
        const pool = encountersFor(node, gameData);
        expect(pool.length, node.id).toBeGreaterThan(0);
        for (const encounter of pool) {
          expect(encounterTier(encounter), `${node.id}: ${encounter.id}`).toBe(level.tier);
          for (const id of encounter.enemies) expect(gameData.spots[node.spot!].waters).toContain(gameData.enemies[id].water);
        }
      }
    });
  });
});

describe('encounters at a fishing spot', () => {
  const node = buildLevelMap(testData.levels[0]).columns[1][0];

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
  const edit = (id: string, change: object): LevelDef => ({ ...kid, nodes: kid.nodes.map((n) => (n.id === id ? { ...n, ...change } : n)) });

  it('accepts the real levels', () => {
    expect(validateContent(contentSource)).toEqual([]);
  });

  it('explains broken levels', () => {
    expect(errorsWith(edit('kid-1a', { next: ['nope'] }))).toEqual(expect.arrayContaining([expect.stringContaining('unknown node "nope"')]));
    expect(errorsWith(edit('kid-2a', { next: ['kid-1a'] }))).toEqual([expect.stringContaining('links back')]);
    expect(errorsWith(edit('kid-3a', { spot: 'XX' }))).toEqual([expect.stringContaining('unknown fishing spot "XX"')]);
    expect(errorsWith(edit('kid-9d', { kind: 'fight', spot: 'ES', next: ['kid-10a'] }))).toEqual([expect.stringContaining('leave node')]);
    expect(errorsWith(edit('kid-16', { kind: 'fight' }))).toEqual(expect.arrayContaining([expect.stringContaining('exactly one boss')]));
    // Nothing leads to kid-2a any more.
    expect(errorsWith(edit('kid-1a', { next: ['kid-2b'] }))).toEqual([expect.stringContaining('"kid-2a": can\'t be reached')]);
  });
});
