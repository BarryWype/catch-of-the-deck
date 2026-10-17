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
      run: { bucket: ['clownfish', 'blueTang'], companions: [{ id: 'clownfish', bond: 50 }] },
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
    const save = upgradeSave({ version: 14, run: { bucket: [] }, combat: null } as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run.rewardRerolls).toBe(1);
  });

  it('run save v15: no card removal on offer', () => {
    const save = upgradeSave({ version: 15, run: { bucket: [] }, combat: null } as never)!;
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.run.bossRemoval).toBe(false);
  });
});
