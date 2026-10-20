import { beforeEach, describe, expect, it, vi } from 'vitest';

// saveStore reads these at import (storage, the language); the test has no DOM. localStorage holds the files.
const files = new Map<string, string>();
const storage = {
  getItem: (key: string) => files.get(key) ?? null,
  setItem: vi.fn((key: string, value: string) => void files.set(key, value)),
  removeItem: vi.fn((key: string) => void files.delete(key)),
};
vi.stubGlobal('window', { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) });
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('navigator', { language: 'en' });
vi.stubGlobal('localStorage', storage);

const {
  PROFILE_VERSION,
  SAVE_VERSION,
  TRANSFER_PART_LENGTH,
  TransferError,
  applyTransfer,
  collectTransferPart,
  encodeTransfer,
  exportTransferCode,
  importTransferCode,
  splitTransferCode,
} = await import('../src/ui/saveStore');

const profile = {
  version: PROFILE_VERSION,
  homeAquarium: [{ id: 'clownfish', bond: 12, size: 'large' as const }],
  creatureBook: { clownfish: 'captured' as const, guppy: 'seen' as const },
  biggestCatch: { clownfish: 'large' as const },
  eggs: ['clownfish'],
  unlockedBuilds: ['fly'],
  fishermenMet: ['oldNed'],
};
const save = {
  version: SAVE_VERSION,
  seed: 7,
  screen: 'map',
  run: { level: 1, floor: 4, map: { columns: [] }, bucket: [] },
  combat: null,
  rewardChoices: [],
  eventId: null,
  shopVisit: { store: 'tackle', bought: {} },
};

/** Deflate and base64url any text, as a code would carry it. */
async function codeOf(text: string) {
  const bytes = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  return 'STF1:' + Buffer.from(bytes).toString('base64url');
}

beforeEach(() => {
  files.clear();
  storage.setItem.mockClear();
  storage.removeItem.mockClear();
});

describe('transfer codes', () => {
  it("export → import gives back this device's save and profile", async () => {
    files.set('catch-of-the-deck:profile', JSON.stringify(profile));
    files.set('catch-of-the-deck:save', JSON.stringify(save));
    const code = await exportTransferCode();
    expect(code).toMatch(/^STF1:[\w-]+$/);
    expect(await importTransferCode(code)).toEqual({ save, profile });
  });

  it('a code with no run in progress carries a null save', async () => {
    files.set('catch-of-the-deck:profile', JSON.stringify(profile));
    expect((await importTransferCode(await exportTransferCode())).save).toBeNull();
  });

  it('a code from an older build is upgraded', async () => {
    const oldProfile = { version: 5, homeAquarium: [{ id: 'clownfish', bond: 4, size: 'normal' }], creatureBook: { clownfish: 'captured' }, biggestCatch: {}, eggs: [] };
    const oldSave = { ...save, version: 17, run: { map: { columns: [] }, bucket: [], fishermen: [] }, shopVisit: { bought: {} } };
    const imported = await importTransferCode(await encodeTransfer({ save: oldSave as never, profile: oldProfile as never }));
    expect(imported.profile.version).toBe(PROFILE_VERSION);
    expect(imported.profile.unlockedBuilds).toEqual([]);
    expect(imported.save?.version).toBe(SAVE_VERSION);
    expect(imported.save?.run.questsShown).toEqual([]);
  });

  it('rejects malformed, truncated, wrong-prefix and newer codes, writing nothing', async () => {
    const good = await encodeTransfer({ save: save as never, profile });
    const cases: [string, string][] = [
      ['', 'prefix'],
      ['hello', 'prefix'],
      ['STF2:' + good.slice(5), 'prefix'],
      [good.slice(0, good.length - 12), 'corrupt'],
      [good.slice(0, 5) + '!!!' + good.slice(8), 'corrupt'],
      ['STF1:' + Buffer.from('not deflate at all').toString('base64url'), 'corrupt'],
      [await codeOf('{"save":null'), 'corrupt'],
      [await codeOf('{"save":null}'), 'corrupt'],
      [await codeOf(JSON.stringify({ save: null, profile: { version: 1, homeAquarium: 'oops' } })), 'corrupt'],
      [await codeOf(JSON.stringify({ save: null, profile: { ...profile, version: PROFILE_VERSION + 1 } })), 'newer'],
      [await codeOf(JSON.stringify({ save: { ...save, version: SAVE_VERSION + 1 }, profile })), 'newer'],
      [splitTransferCode(good + 'x'.repeat(TRANSFER_PART_LENGTH))[0], 'prefix'],
    ];
    for (const [code, reason] of cases) {
      const error = await importTransferCode(code).catch((e) => e);
      expect(error, code.slice(0, 30)).toBeInstanceOf(TransferError);
      expect(error.reason, code.slice(0, 30)).toBe(reason);
    }
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('applying writes both files, and deletes the save when the code has none', async () => {
    files.set('catch-of-the-deck:save', JSON.stringify(save));
    applyTransfer({ save: null, profile });
    await vi.waitFor(() => expect(files.has('catch-of-the-deck:save')).toBe(false));
    expect(JSON.parse(files.get('catch-of-the-deck:profile')!)).toEqual(profile);
    applyTransfer({ save: save as never, profile });
    await vi.waitFor(() => expect(JSON.parse(files.get('catch-of-the-deck:save')!)).toEqual(save));
  });

  it('a long code is split into parts, read back in any order', async () => {
    const big = { ...profile, homeAquarium: Array.from({ length: 300 }, (_, i) => ({ id: `creature${i}`, bond: i, size: 'normal' as const })) };
    const code = await encodeTransfer({ save: null, profile: big });
    const parts = splitTransferCode(code);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p, i) => p.startsWith(`STF1:${i + 1}/${parts.length}:`) && p.length <= TRANSFER_PART_LENGTH + 12)).toBe(true);

    let collected: string[] = [];
    let result = { parts: collected, code: null as string | null, total: 0 };
    for (const part of [...parts].reverse().concat(parts[0])) {
      result = collectTransferPart(collected, part);
      collected = result.parts;
    }
    expect(result.total).toBe(parts.length);
    expect(result.code).toBe(code);
    expect((await importTransferCode(result.code!)).profile).toEqual(big);
  });

  it('a short code is a single QR, and a part from another code starts the collection over', () => {
    expect(splitTransferCode('STF1:abc')).toEqual(['STF1:abc']);
    expect(collectTransferPart([], 'STF1:abc').code).toBe('STF1:abc');
    const started = collectTransferPart([], 'STF1:1/3:aa').parts;
    expect(started).toEqual(['aa', '', '']);
    expect(collectTransferPart(started, 'STF1:2/2:bb').parts).toEqual(['', 'bb']);
    expect(collectTransferPart([], 'not a code').code).toBeNull();
  });
});
