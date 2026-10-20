import { describe, expect, it, vi } from 'vitest';
// Loaded before the stubs below: Vue's DOM runtime looks for a real `document` when it loads.
import 'vue';
import { gameData } from '../src/content';
import { FORAGING_TARGETS } from '../src/content/builds';
import {
  COLUMNS_PER_HALF,
  buildLevelMap,
  createRun,
  describeQuest,
  fishermenToMeet,
  isQuestMet,
  newUnlocks,
  questProgress,
  questsFor,
  questsShownTo,
  unlockedBuilds,
  visitFisherman,
  type QuestCondition,
} from '../src/engine';
import { caught, homeCreature } from './fixtures';

// useGame's module tree reads these at import; the test has no DOM.
vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) });
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('navigator', { language: 'en' });
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

const quest = gameData.builds.foraging.unlock!.quest;
const need = quest.count;
/** Species of each kind: those Foraging's quest counts, and the others. */
const isTarget = (temperament: string | undefined) => FORAGING_TARGETS.includes(temperament as never);
const shelled = Object.values(gameData.enemies).filter((e) => isTarget(e.temperament)).map((e) => e.id);
const other = Object.values(gameData.enemies).filter((e) => !isTarget(e.temperament)).map((e) => e.id);
const home = (ids: string[]) => ids.map((id) => homeCreature(id));

describe('quest condition: different species of some temperaments at home', () => {
  it('counts different species, not creatures', () => {
    const q: QuestCondition = { type: 'speciesAtHome', count: 3, temperaments: FORAGING_TARGETS };
    expect(questProgress(q, home([shelled[0], shelled[0], shelled[0], shelled[1]]), gameData)).toEqual({ have: 2, need: 3 });
  });

  it('Ned counts armored, clawed and bottom-dweller species, and nothing else', () => {
    const of = (temperament: string) => Object.values(gameData.enemies).find((e) => e.temperament === temperament)!.id;
    expect(quest).toMatchObject({ temperaments: ['armored', 'clawed', 'bottomDweller'] });
    expect(questProgress(quest, home([of('armored'), of('clawed'), of('bottomDweller'), of('predator')]), gameData).have).toBe(3);
    expect(describeQuest(quest, gameData)).toBe('4 different species of 🐚 Armored, 🦀 Clawed or ⭐ Bottom dweller creatures in your home aquarium');
  });

  it('only counts the listed temperaments', () => {
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

describe('quest condition: different species in the bucket', () => {
  const net = gameData.builds.net.unlock!.quest;
  const fly = gameData.builds.fly.unlock!.quest;
  const trophy = (id: string) => ({ id, size: 'trophy' as const });

  it('Net: different schooling species, companions included', () => {
    expect(questProgress(net, caught('guppy', 'guppy', 'cardinalTetra', 'clownfish'), gameData)).toEqual({ have: 2, need: 3 });
    expect(isQuestMet(net, [...caught('guppy', 'cardinalTetra'), homeCreature('europeanPilchard')], gameData)).toBe(true);
  });

  it('Fly: a trophy-size freshwater creature, nothing smaller nor from the sea', () => {
    expect(isQuestMet(fly, [trophy('guppy')], gameData)).toBe(true);
    expect(isQuestMet(fly, [{ id: 'guppy', size: 'large' }, trophy('clownfish')], gameData)).toBe(false);
  });

  it('describes itself in the player’s words', () => {
    expect(describeQuest(net, gameData)).toBe('3 different schooling species in your bucket');
    expect(describeQuest(fly, gameData)).toBe('a trophy-size freshwater creature in your bucket');
  });

  it('is shown to its own fisherman only', () => {
    const school = caught('guppy', 'cardinalTetra', 'zebrafish');
    expect(questsShownTo(gameData, 'gus', school)).toEqual(['net']);
    expect(questsShownTo(gameData, 'silas', school)).toEqual([]);
    expect(questsShownTo(gameData, 'gus', school.slice(0, 2))).toEqual([]);
    expect(questsShownTo(gameData, 'oldNed', home(shelled))).toEqual([]);
  });

  it('meeting Gus with the school in the bucket records it on the run', () => {
    const r0 = createRun(1, gameData, 'rod', home(['guppy', 'cardinalTetra', 'zebrafish']), undefined, ['gus']);
    const run = { ...r0, level: 1, map: buildLevelMap(gameData, 1, { rng: 1 }, ['gus']) };
    const miniBoss = run.map.columns[COLUMNS_PER_HALF + 1][0];
    const node = run.map.columns.flat().find((n) => n.kind === 'fisherman')!;
    expect(node.fisherman).toBe('gus');
    expect(visitFisherman({ ...run, position: miniBoss.id }, node.id, gameData).questsShown).toEqual(['net']);
    expect(visitFisherman({ ...run, bucket: run.bucket.slice(0, 2), position: miniBoss.id }, node.id, gameData).questsShown).toEqual([]);
  });

  it('unlocks from what was shown, not from the home aquarium', () => {
    const school = home(['guppy', 'cardinalTetra', 'zebrafish']);
    expect(newUnlocks(gameData, [], ['gus'], school)).toEqual([]);
    expect(newUnlocks(gameData, [], ['gus'], [], ['net'])).toEqual(['net']);
    expect(newUnlocks(gameData, [], [], [], ['net'])).toEqual([]);
  });
});

describe('build unlocks', () => {
  it('new players start with Rod only; the others join once unlocked', () => {
    expect(unlockedBuilds(gameData, []).map((b) => b.id)).toEqual(['rod']);
    expect(unlockedBuilds(gameData, ['foraging']).map((b) => b.id)).toEqual(['rod', 'foraging']);
    expect(unlockedBuilds(gameData, ['fly', 'net', 'foraging']).map((b) => b.id)).toEqual(['rod', 'foraging', 'net', 'fly']);
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
    expect(visitFisherman({ ...run, position: miniBoss.id }, node.id, gameData).position).toBe(node.id);
  });

  it('each stands on his own age only, and none once his build is unlocked', () => {
    expect(fishermenToMeet(gameData, [])).toEqual(['oldNed', 'gus', 'silas']);
    expect(fishermenToMeet(gameData, ['foraging'])).toEqual(['gus', 'silas']);
    expect(fishermenToMeet(gameData, ['foraging', 'net', 'fly'])).toEqual([]);
    const all = fishermenToMeet(gameData, []);
    for (let seed = 1; seed <= 300; seed++) {
      expect(fishermanNodes(0, fishermenToMeet(gameData, ['foraging']), seed)).toHaveLength(0);
      for (const [level, id] of ['oldNed', 'gus', 'silas'].entries()) {
        expect(fishermanNodes(level, all, seed).map((n) => n.fisherman), `seed ${seed}`).toEqual([id]);
        expect(fishermanNodes(level, all, seed)[0].column).toBe(COLUMNS_PER_HALF + 2);
      }
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

  it('a bucket quest shown to its fisherman unlocks even if the creatures are gone by the end', async () => {
    const game = await readyGame();
    game.homeAquarium.value = [];
    game.fishermenMet.value = ['gus'];
    game.run.value = { ...createRun(1, gameData, 'rod', [], undefined, ['gus']), questsShown: ['net'] };
    game.endRunAfterBoss();
    expect(game.unlocked.value).toEqual(['net']);
  });

  it('not without having met the fisherman', async () => {
    const game = await readyGame();
    game.fishermenMet.value = [];
    game.endRunAfterBoss();
    expect(game.unlocked.value).toEqual([]);
  });
});

describe('quests a creature counts towards (its fight hover text)', () => {
  const ids = (builds: { id: string }[]) => builds.map((b) => b.id).sort();

  it('only open quests: fisherman met, build still locked; a size filter is left to the catch', () => {
    // Progenetica: a freshwater schooling fish, for Gus's net quest and Silas's trophy freshwater quest.
    expect(ids(questsFor('progenetica', gameData, [], ['gus', 'silas']))).toEqual(['fly', 'net']);
    expect(ids(questsFor('flyingFish', gameData, [], ['gus', 'silas']))).toEqual(['net']);
    expect(questsFor('progenetica', gameData, [], [])).toEqual([]);
    expect(ids(questsFor('progenetica', gameData, ['net'], ['gus', 'silas']))).toEqual(['fly']);
  });
});
