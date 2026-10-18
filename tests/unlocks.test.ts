import { describe, expect, it, vi } from 'vitest';
// Loaded before the stubs below: Vue's DOM runtime looks for a real `document` when it loads.
import 'vue';
import { gameData } from '../src/content';
import { FORAGING_TARGETS } from '../src/content/builds';
import {
  COLUMNS_PER_HALF,
  buildLevelMap,
  createRun,
  fishermenToMeet,
  isQuestMet,
  newUnlocks,
  questProgress,
  unlockedBuilds,
  visitFisherman,
  type QuestCondition,
} from '../src/engine';
import { homeCreature } from './fixtures';

// useGame's module tree reads these at import; the test has no DOM.
vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) });
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('navigator', { language: 'en' });
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

const quest = gameData.builds.foraging.unlock!.quest;
const need = quest.count;
/** Species of each kind: those Foraging's quest counts, and the others. */
const shelled = Object.values(gameData.enemies).filter((e) => e.tags?.some((t) => FORAGING_TARGETS.includes(t as never))).map((e) => e.id);
const other = Object.values(gameData.enemies).filter((e) => !e.tags?.some((t) => FORAGING_TARGETS.includes(t as never))).map((e) => e.id);
const home = (ids: string[]) => ids.map((id) => homeCreature(id));

describe('quest condition: different species of some creature types at home', () => {
  it('counts different species, not creatures', () => {
    const q: QuestCondition = { type: 'speciesAtHome', count: 3, creatureTypes: FORAGING_TARGETS };
    expect(questProgress(q, home([shelled[0], shelled[0], shelled[0], shelled[1]]), gameData)).toEqual({ have: 2, need: 3 });
  });

  it('only counts the listed creature types', () => {
    expect(questProgress(quest, home(other.slice(0, 10)), gameData).have).toBe(0);
    expect(questProgress(quest, home([...other.slice(0, 10), shelled[0]]), gameData).have).toBe(1);
  });

  it('is met at the threshold, not one below, and progress never goes past it', () => {
    expect(shelled.length).toBeGreaterThan(need);
    expect(isQuestMet(quest, home(shelled.slice(0, need - 1)), gameData)).toBe(false);
    expect(isQuestMet(quest, home(shelled.slice(0, need)), gameData)).toBe(true);
    expect(questProgress(quest, home(shelled), gameData)).toEqual({ have: need, need });
  });
});

describe('build unlocks', () => {
  it('new players start with Rod only; Foraging joins once unlocked', () => {
    expect(unlockedBuilds(gameData, []).map((b) => b.id)).toEqual(['rod']);
    expect(unlockedBuilds(gameData, ['foraging']).map((b) => b.id)).toEqual(['rod', 'foraging']);
  });

  it('a met quest unlocks only once its fisherman has been met', () => {
    const full = home(shelled.slice(0, need));
    expect(newUnlocks(gameData, [], [], full)).toEqual([]);
    expect(newUnlocks(gameData, [], ['oldNed'], full)).toEqual(['foraging']);
    expect(newUnlocks(gameData, ['foraging'], ['oldNed'], full)).toEqual([]);
  });
});

describe('the fisherman on the map', () => {
  const fishermanNodes = (levelIndex: number, fishermen: string[], seed: number) =>
    buildLevelMap(gameData, levelIndex, { rng: seed }, fishermen).columns.flat().filter((n) => n.kind === 'fisherman');

  it('stands one node after the Kid mini-boss on every seed while Foraging is locked', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const nodes = fishermanNodes(0, fishermenToMeet(gameData, []), seed);
      expect(nodes, `seed ${seed}`).toHaveLength(1);
      expect(nodes[0]).toMatchObject({ fisherman: 'oldNed', column: COLUMNS_PER_HALF + 2 });
    }
  });

  it('is reachable straight from the mini-boss', () => {
    const run = createRun(1, gameData, 'rod', [], undefined, ['oldNed']);
    const miniBoss = run.map.columns[COLUMNS_PER_HALF + 1][0];
    const node = run.map.columns.flat().find((n) => n.kind === 'fisherman')!;
    expect(miniBoss.next).toContain(node.id);
    expect(visitFisherman({ ...run, position: miniBoss.id }, node.id).position).toBe(node.id);
  });

  it('is never on the other ages, nor once Foraging is unlocked', () => {
    expect(fishermenToMeet(gameData, ['foraging'])).toEqual([]);
    for (let seed = 1; seed <= 20; seed++) {
      expect(fishermanNodes(0, fishermenToMeet(gameData, ['foraging']), seed)).toHaveLength(0);
      expect(fishermanNodes(1, ['oldNed'], seed)).toHaveLength(0);
      expect(fishermanNodes(2, ['oldNed'], seed)).toHaveLength(0);
    }
  });

  it('replaces a node without changing the rest of the map', () => {
    const strip = (map: ReturnType<typeof buildLevelMap>) => map.columns.flat().map((n) => ({ id: n.id, x: n.x, y: n.y, next: n.next }));
    for (let seed = 1; seed <= 20; seed++) {
      expect(strip(buildLevelMap(gameData, 0, { rng: seed }, ['oldNed']))).toEqual(strip(buildLevelMap(gameData, 0, { rng: seed })));
    }
  });
});

describe('unlocking at the end of a run', () => {
  /** A game whose home aquarium already meets Foraging's quest, after meeting Old Ned. */
  async function readyGame() {
    const { useGame } = await import('../src/ui/useGame');
    const game = useGame(1);
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the (empty) profile load first
    game.homeAquarium.value = home(shelled.slice(0, need));
    game.fishermenMet.value = ['oldNed'];
    game.run.value = createRun(1, gameData, 'rod', [], undefined, ['oldNed']);
    return game;
  }

  it('unlocks when the run ends well', async () => {
    const game = await readyGame();
    game.endRunAfterBoss();
    expect(game.unlocked.value).toEqual(['foraging']);
    expect(game.newlyUnlocked.value).toEqual(['foraging']);
    expect(game.builds.value.map((b) => b.id)).toEqual(['rod', 'foraging']);
  });

  it('not when the Grit runs out', async () => {
    const game = await readyGame();
    const { setup } = await import('./fixtures');
    game.combat.value = { ...setup(['tug'], { data: gameData, enemies: ['clownfish'] }), phase: 'lost' };
    game.newlyUnlocked.value = ['stale']; // the run end clears it: proof it ran
    game.dispatch({ type: 'endTurn' });
    expect(game.unlocked.value).toEqual([]);
    expect(game.newlyUnlocked.value).toEqual([]);
  });

  it('not without having met the fisherman', async () => {
    const game = await readyGame();
    game.fishermenMet.value = [];
    game.endRunAfterBoss();
    expect(game.unlocked.value).toEqual([]);
  });
});
