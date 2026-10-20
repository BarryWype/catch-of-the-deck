import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

// useGame's module tree reads these at import; the test has no DOM.
vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) });
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('navigator', { language: 'en' });
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });

const home = [
  { id: 'clownfish', bond: 4, size: 'normal' as const },
  { id: 'guppy', bond: 2, size: 'small' as const },
];
const writes = { profile: vi.fn() };
vi.mock('../src/ui/saveStore', () => ({
  SAVE_VERSION: 1,
  PROFILE_VERSION: 1,
  loadSavedGame: async () => null,
  loadProfile: async () => ({ version: 1, homeAquarium: home, creatureBook: {}, biggestCatch: {}, unlockedBuilds: [], fishermenMet: [], goldenShells: 0, logbook: [], recovering: [] }),
  writeProfile: writes.profile,
  writeSavedGame: () => {},
  clearSavedGame: () => {},
  clearProfile: () => {},
  applyTransfer: () => {},
}));

const { useGame } = await import('../src/ui/useGame');
const { createRun, debugSetPlayer, enterNextLevel, injuredCompanions, recoverCompanions, sellCreature, travelTo, visitLeave } = await import('../src/engine');
const { homeCreature, testData } = await import('./fixtures');

describe('companions injured by a run that ends badly', () => {
  it('a run counts every map node it steps on, over every level', () => {
    let run = createRun(5, testData, 'basic');
    expect(run.nodesDone).toBe(0);
    run = travelTo(run, '1a', testData).run;
    run = travelTo(run, '2', testData).run;
    expect(run.nodesDone).toBe(2);
    expect(visitLeave(run, '3b').nodesDone).toBe(3);
    run = enterNextLevel({ ...run, position: '4', visited: [...run.visited, '3a', '4'], nodesDone: 4 }, testData);
    expect(run.visited).toEqual(['start']);
    expect(travelTo(run, 'two-1', testData).run.nodesDone).toBe(5);
  });

  it('come back with the bond they started with, for the nodes the run did; not those in a life jacket, sold or posted', () => {
    const start = createRun(5, testData, 'basic', [homeCreature('shellA', 10), homeCreature('shellB', 20), homeCreature('shellC', 30)]);
    expect(start.companionBondsAtStart).toEqual([10, 20, 30]);
    let run = travelTo(start, '1a', testData).run;
    expect(run.companions.map((c) => c.bond)).toEqual([11, 21, 31]);
    run = sellCreature(run, 1, testData);
    run = { ...run, bucket: run.bucket.map((c, slot) => (slot === 1 ? { ...c, lifeJacket: true } : c)), nodesDone: 7 };
    expect(injuredCompanions(run)).toEqual([{ id: 'shellA', size: 'normal', bond: 10, nodesLeft: 7, nodes: 7 }]);
  });

  it('rest one node at a time, and those done come back as home creatures', () => {
    const resting = [
      { ...homeCreature('shellA', 3), nodesLeft: 1, nodes: 5 },
      { ...homeCreature('shellB', 6), nodesLeft: 3, nodes: 3 },
    ];
    expect(recoverCompanions(resting, 1)).toEqual({ recovering: [{ ...resting[1], nodesLeft: 2 }], back: [homeCreature('shellA', 3)] });
    expect(recoverCompanions(resting, 0).back).toEqual([]);
  });

  it('a lost run sets them apart; each node of the next run rests them, then they come home', async () => {
    const game = useGame(1);
    await nextTick();
    game.newRun(7);
    game.bring(0);
    game.startRun();
    expect(game.homeAquarium.value.map((c) => c.id)).toEqual(['guppy']);
    const first = game.run.value!.map.columns[1][0];
    game.travel(first.id);
    expect(game.screen.value).toBe('combat');
    // Lose the fight: the run did 1 node.
    game.combat.value = debugSetPlayer(game.combat.value!, { hp: 0 });
    game.dispatch({ type: 'endTurn' });
    expect(game.combat.value?.phase).toBe('lost');
    expect(game.recovering.value).toEqual([{ id: 'clownfish', size: 'normal', bond: 4, nodesLeft: 1, nodes: 1 }]);
    expect(game.homeAquarium.value.map((c) => c.id)).toEqual(['guppy']);
    expect(writes.profile).toHaveBeenLastCalledWith(expect.objectContaining({ recovering: game.recovering.value }));

    // It can't be brought on the next run, and comes home after its first node.
    game.toMenu();
    game.newRun(8);
    expect(game.homeLeft.value.map((c) => c.id)).toEqual(['guppy']);
    game.startRun();
    game.travel(game.run.value!.map.columns[1][0].id);
    expect(game.recovering.value).toEqual([]);
    expect(game.homeAquarium.value).toContainEqual({ id: 'clownfish', size: 'normal', bond: 4 });
  });

  it('abandoning a run also sends them home injured; a run with no node done sends them straight back', async () => {
    const game = useGame(1);
    await nextTick();
    game.newRun(7);
    game.bring(0);
    game.startRun();
    game.travel(game.run.value!.map.columns[1][0].id);
    await nextTick();
    expect(game.savedGame.value).not.toBeNull();
    game.newRun(9);
    expect(game.recovering.value).toEqual([{ id: 'clownfish', size: 'normal', bond: 4, nodesLeft: 1, nodes: 1 }]);

    game.bring(0); // the guppy
    game.startRun();
    await nextTick();
    game.newRun(10);
    expect(game.homeAquarium.value).toContainEqual({ id: 'guppy', size: 'small', bond: 2 });
    expect(game.recovering.value).toHaveLength(1);
  });
});
