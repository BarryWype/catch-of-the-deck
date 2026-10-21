import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { buildGameData, createRun, enterNextLevel, FEATURES, validateContent, type GameData, type RunState } from '../src/engine';

const data: GameData = buildGameData({ ...contentSource, features: FEATURES });
const bossesOf = (run: RunState) =>
  run.map.columns.flat().flatMap((n) => (n.kind === 'miniBoss' || n.kind === 'boss' ? [{ kind: n.kind, enemies: n.enemies!, releaseReason: n.releaseReason }] : []));

/** Every level's mini-boss and boss met by this seed's run. */
function runBosses(seed: number, d: GameData = data) {
  let run = createRun(seed, d, 'rod');
  const met = [...bossesOf(run)];
  for (let level = 1; level < d.levels.length; level++) {
    run = enterNextLevel(run, d);
    met.push(...bossesOf(run));
  }
  return met;
}

describe('boss pools', () => {
  const slots = contentSource.levels.flatMap((l) => [l.miniBoss!, l.boss!]);

  it('every slot has 2–3 candidates, each with a boss pattern and a reason to let it go', () => {
    for (const slot of slots) {
      expect(slot.candidates!.length).toBeGreaterThanOrEqual(2);
      expect(slot.candidates!.length).toBeLessThanOrEqual(3);
      for (const c of slot.candidates!) {
        expect(data.enemies[c.enemies[0]].bossPattern?.type, c.enemies[0]).toBe('sequence');
        expect(c.releaseReason).toBeTruthy();
      }
    }
  });

  it('a creature is a candidate of one slot only, so no run meets it twice', () => {
    const all = slots.flatMap((s) => s.candidates!.flatMap((c) => c.enemies));
    expect(new Set(all).size).toBe(all.length);
    for (let seed = 1; seed <= 30; seed++) {
      const met = runBosses(seed).flatMap((b) => b.enemies);
      expect(new Set(met).size).toBe(met.length);
    }
    const twice = structuredClone(contentSource);
    twice.levels[1].boss!.candidates!.push({ enemies: ['blueCrab'], releaseReason: 'again' });
    expect(validateContent(twice).join('\n')).toContain('"blueCrab" is already a candidate');
  });

  it('the draw is seeded, varies between runs, and comes with its reason', () => {
    expect(runBosses(9)).toEqual(runBosses(9));
    const kidMiniBosses = new Set(Array.from({ length: 30 }, (_, i) => runBosses(i + 1)[0].enemies[0]));
    expect(kidMiniBosses.size).toBe(3);
    for (const met of runBosses(12)) {
      const slot = slots.find((s) => s.candidates!.some((c) => c.enemies[0] === met.enemies[0]))!;
      expect(met.releaseReason).toBe(slot.candidates!.find((c) => c.enemies[0] === met.enemies[0])!.releaseReason);
    }
  });

  it('with the feature off, the levels’ own bosses', () => {
    expect(runBosses(9, gameData).map((b) => b.enemies[0])).toEqual(contentSource.levels.flatMap((l) => [l.miniBoss!.enemies[0], l.boss!.enemies[0]]));
  });
});
