import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

// useGame's module tree reads these at import; the test has no DOM.
vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) });
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('navigator', { language: 'en' });
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });

const home = [{ id: 'clownfish', bond: 3, size: 'normal' as const }];
const writes = { profile: vi.fn(), save: vi.fn(), clearSave: vi.fn(), clearProfile: vi.fn(), transfer: vi.fn() };
vi.mock('../src/ui/saveStore', () => ({
  SAVE_VERSION: 1,
  PROFILE_VERSION: 1,
  loadSavedGame: async () => null,
  loadProfile: async () => ({ version: 1, homeAquarium: home, creatureBook: {}, biggestCatch: {}, unlockedBuilds: [], fishermenMet: [], goldenShells: 0, logbook: [], recovering: [], tutorials: [] }),
  writeProfile: writes.profile,
  writeSavedGame: writes.save,
  clearSavedGame: writes.clearSave,
  clearProfile: writes.clearProfile,
  applyTransfer: writes.transfer,
}));

const { useGame } = await import('../src/ui/useGame');
const { debugCatch } = await import('../src/engine');

describe('the debug sandbox', () => {
  it('a scenario plays without saving the profile or the run, and ending it brings the real profile back', async () => {
    const game = useGame(1);
    await nextTick();
    expect(game.homeAquarium.value).toEqual(home);

    game.playScenario({
      seed: 5,
      build: 'net',
      level: 0,
      companions: [{ id: 'europeanPilchard', bond: 1, size: 'small' }],
      start: { type: 'creature', id: 'clownfish' },
      profile: { unlocked: ['net', 'fly'], fishermenMet: ['oldNed'], home: [{ id: 'guppy', bond: 2, size: 'trophy' }] },
    });
    expect(game.debugScenario.value).not.toBeNull();
    expect(game.screen.value).toBe('combat');
    expect(game.unlocked.value).toEqual(['net', 'fly']);
    expect(game.homeAquarium.value.map((c) => c.id)).toEqual(['guppy']);

    // Win the fight, so the creature book and biggest catch change, then end the run at a leave node.
    game.setDebugCombat(debugCatch(game.combat.value!, 'e0', 'will'));
    await nextTick();
    game.claimVictory();
    await nextTick();
    expect(game.creatureBook.value.clownfish).toBe('captured');
    game.endRunAfterBoss();
    await nextTick();
    expect(game.screen.value).toBe('complete');

    expect(writes.profile).not.toHaveBeenCalled();
    expect(writes.save).not.toHaveBeenCalled();
    expect(writes.clearSave).not.toHaveBeenCalled();

    game.toMenu();
    await nextTick();
    expect(game.debugScenario.value).toBeNull();
    expect(game.screen.value).toBe('menu');
    expect(game.homeAquarium.value).toEqual(home);
    expect(game.unlocked.value).toEqual([]);
    expect(game.fishermenMet.value).toEqual([]);
    expect(game.creatureBook.value).toEqual({});
    expect(writes.profile).not.toHaveBeenCalled();
    expect(writes.save).not.toHaveBeenCalled();
  });

  it('a real run still saves', async () => {
    const game = useGame(1);
    await nextTick();
    game.newRun(2);
    game.chooseBuild('rod', undefined);
    game.startRun();
    await nextTick();
    expect(writes.save).toHaveBeenCalled();
  });

  it('a transfer code is refused during a scenario, and applied and shown outside one', async () => {
    const game = useGame(1);
    await nextTick();
    const contents = {
      save: null,
      profile: { version: 1, homeAquarium: [{ id: 'guppy', bond: 0, size: 'large' as const }], creatureBook: { guppy: 'captured' as const }, biggestCatch: {}, unlockedBuilds: [], fishermenMet: [], goldenShells: 0, logbook: [], recovering: [], tutorials: [] },
    };
    game.playScenario({ seed: 5, build: 'net', level: 0, start: { type: 'creature', id: 'clownfish' } });
    expect(game.importTransfer(contents)).toBe(false);
    expect(writes.transfer).not.toHaveBeenCalled();
    game.toMenu();

    expect(game.importTransfer(contents)).toBe(true);
    expect(writes.transfer).toHaveBeenCalledWith(contents);
    expect(game.homeAquarium.value.map((c) => c.id)).toEqual(['guppy']);
    expect(game.savedGame.value).toBeNull();
    expect(game.screen.value).toBe('menu');
  });
});

describe('going back into a shop', () => {
  it('the map can be looked at from a shop, and the same visit reopened from the header or its node until the player moves on', async () => {
    const game = useGame(1);
    await nextTick();
    game.playScenario({ seed: 5, build: 'rod', level: 0, companions: [], start: { type: 'shop', store: 'cafe' } });
    expect(game.screen.value).toBe('shop');
    const visit = game.shopVisit.value;
    expect(game.canReturnToShop.value).toBe(true);

    game.leaveShop();
    expect(game.screen.value).toBe('map');
    expect(game.canReturnToShop.value).toBe(true);
    game.returnToShop();
    expect(game.screen.value).toBe('shop');
    expect(game.shopVisit.value).toBe(visit);

    game.leaveShop();
    game.travel(game.run.value!.position);
    expect(game.screen.value).toBe('shop');
    expect(game.shopVisit.value).toBe(visit);

    game.leaveShop();
    const { availableDestinations } = await import('../src/engine');
    const next = availableDestinations(game.run.value!).find((n) => n.kind === 'fight')!;
    game.travel(next.id);
    expect(game.canReturnToShop.value).toBe(false);
    game.endScenario();
  });
});
