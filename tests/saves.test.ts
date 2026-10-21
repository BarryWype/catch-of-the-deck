import { describe, expect, it, vi } from 'vitest';

// saveStore reads these at import (storage, the language); the test has no DOM.
vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) });
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('navigator', { language: 'en' });
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });

const { PROFILE_VERSION, SAVE_VERSION, upgradeProfile, upgradeSave } = await import('../src/ui/saveStore');

describe('saves from before stars, sizes and the bucket limit', () => {
  it('profile v4: bond keeps its share of the new full bond, sizes are normal, captured species get a normal biggest catch', () => {
    // Clownfish is tier 1 (100 → 40), catfish tier 2 (200 → 60).
    const old = {
      version: 4,
      homeAquarium: [
        { id: 'clownfish', bond: 20 },
        { id: 'clownfish', bond: 55 },
        { id: 'catfish', bond: 200 },
      ],
      creatureBook: { clownfish: 'captured', catfish: 'captured', blueTang: 'seen' },
      eggs: [],
    };
    const profile = upgradeProfile(old as never)!;
    expect(profile.version).toBe(PROFILE_VERSION);
    expect(profile.homeAquarium).toEqual([
      { id: 'clownfish', bond: 8, size: 'normal' },
      { id: 'clownfish', bond: 22, size: 'normal' },
      { id: 'catfish', bond: 60, size: 'normal' },
    ]);
    expect(profile.biggestCatch).toEqual({ clownfish: 'normal', catfish: 'normal' });
  });

  it('run save v13: bucket entries get a normal size, companions the new bond scale, nothing waits', () => {
    const old = {
      version: 13,
      run: { map: { columns: [] }, bucket: ['clownfish', 'blueTang'], companions: [{ id: 'clownfish', bond: 50 }] },
      combat: null,
    };
    const save = upgradeSave(old as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run.bucket).toEqual([
      { id: 'clownfish', size: 'normal' },
      { id: 'blueTang', size: 'normal' },
    ]);
    expect(save.run.companions).toEqual([{ id: 'clownfish', bond: 20, size: 'normal' }]);
    expect(save.run.waiting).toEqual([]);
  });

  it('run save v14: the run gets the reroll every run starts with', () => {
    const save = upgradeSave({ version: 14, run: { map: { columns: [] }, bucket: [] }, combat: null } as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run.rewardRerolls).toBe(1);
  });

  it('run save v15: no card removal on offer', () => {
    const save = upgradeSave({ version: 15, run: { map: { columns: [] }, bucket: [] }, combat: null } as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run.bossRemoval).toBe(false);
  });

  it('run save v16: no fishermen on the map', () => {
    const save = upgradeSave({ version: 16, run: { map: { columns: [] }, bucket: [] }, combat: null } as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run.fishermen).toEqual([]);
  });

  it('run save v17: no bucket quest shown yet', () => {
    const save = upgradeSave({ version: 17, run: { map: { columns: [] }, bucket: [], fishermen: [] }, combat: null } as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run.questsShown).toEqual([]);
  });

  it('run save v18: shop nodes become Tackle shops, the visit too, with no store effects yet', () => {
    const shopNode = { id: 's', kind: 'shop' };
    const old = { version: 18, run: { map: { columns: [[shopNode, { id: 'f', kind: 'fight' }]] }, bucket: [] }, shopVisit: { bought: { heart: 1 } }, combat: null };
    const save = upgradeSave(old as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run.map.columns[0]).toEqual([{ ...shopNode, store: 'tackle' }, { id: 'f', kind: 'fight' }]);
    expect(save.shopVisit).toEqual({ store: 'tackle', bought: { heart: 1 } });
    expect(save.run).toMatchObject({ bucketSize: 7, boons: [], sentHome: [], luckyLure: false, spareHooks: 0 });
  });

  it('profile v5: keeps everything, with only the default builds unlocked and no fisherman met', () => {
    const old = { version: 5, homeAquarium: [{ id: 'clownfish', bond: 8, size: 'normal' }], creatureBook: { clownfish: 'captured' }, biggestCatch: {} };
    const profile = upgradeProfile({ ...old, eggs: [] } as never)!;
    expect(profile).toEqual({ ...old, version: PROFILE_VERSION, unlockedBuilds: [], fishermenMet: [], goldenShells: 0, logbook: [], recovering: [], tutorials: ['map', 'fight'] });
  });
});

describe('saves from before the Logbook', () => {
  it('profile v6: keeps everything, with no golden shells and no Logbook node bought', () => {
    const old = { version: 6, homeAquarium: [{ id: 'clownfish', bond: 8, size: 'normal' }], creatureBook: { clownfish: 'captured' }, biggestCatch: {}, unlockedBuilds: ['fly'], fishermenMet: ['oldNed'] };
    expect(upgradeProfile(old as never)).toEqual({ ...old, version: PROFILE_VERSION, goldenShells: 0, logbook: [], recovering: [], tutorials: ['map', 'fight'] });
  });

  it('profile v7: no companion resting', () => {
    const old = { version: 7, homeAquarium: [], creatureBook: {}, biggestCatch: {}, unlockedBuilds: [], fishermenMet: [], goldenShells: 2, logbook: ['tackleBox'] };
    expect(upgradeProfile(old as never)).toEqual({ ...old, version: PROFILE_VERSION, recovering: [], tutorials: [] });
  });

  it('profile v8: waiting eggs hatch into the home aquarium, small and at bond level 1', () => {
    // Clownfish: full bond 40, level 1 at 8.
    const old = { version: 8, homeAquarium: [{ id: 'guppy', bond: 3, size: 'normal' }], creatureBook: {}, biggestCatch: {}, eggs: ['clownfish', 'clownfish'], unlockedBuilds: [], fishermenMet: [], goldenShells: 0, logbook: [], recovering: [] };
    const { eggs: _, ...rest } = old;
    expect(upgradeProfile(old as never)).toEqual({
      ...rest,
      version: PROFILE_VERSION,
      homeAquarium: [old.homeAquarium[0], { id: 'clownfish', size: 'small', bond: 8 }, { id: 'clownfish', size: 'small', bond: 8 }],
      tutorials: [],
    });
  });

  it('profile v9: a player who has met creatures has seen the tutorial; a fresh one hasn’t', () => {
    const old = { version: 9, homeAquarium: [], creatureBook: { clownfish: 'seen' }, biggestCatch: {}, unlockedBuilds: [], fishermenMet: [], goldenShells: 0, logbook: [], recovering: [] };
    expect(upgradeProfile(old as never)).toEqual({ ...old, version: PROFILE_VERSION, tutorials: ['map', 'fight'] });
    expect(upgradeProfile({ ...old, creatureBook: {} } as never)!.tutorials).toEqual([]);
  });

  it('run save v20: the nodes done are this level’s, and the companions start from today’s bond', () => {
    const run = { map: { columns: [] }, bucket: [], visited: ['start', 'a', 'b'], companions: [{ id: 'clownfish', bond: 12, size: 'normal' }] };
    const save = upgradeSave({ version: 20, run, combat: null } as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run).toMatchObject({ nodesDone: 2, companionBondsAtStart: [12] });
  });

  it('run save v19: the run has no Logbook node', () => {
    const save = upgradeSave({ version: 19, run: { map: { columns: [] }, bucket: [] }, combat: null } as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run.progression).toEqual([]);
  });
});
