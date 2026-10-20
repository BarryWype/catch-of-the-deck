import { BUCKET_SIZE, bondThreshold, rescaleBond, type CatchSize, type RecoveringCreature, type CombatState, type Discovery, type HomeCreature, type RunState, type ShopVisit } from '../engine';
import { gameData } from './i18n';
import type { Screen } from './useGame';

/**
 * Two files, see ARCHITECTURE.md → Persistence:
 * - `save`: the run in progress, deleted when it ends;
 * - `profile`: what lasts between runs (the home aquarium, the creature book, the Logbook).
 * Bump a version when that file's shape changes, and upgrade older files in its `upgrade…`.
 */
export const SAVE_VERSION = 21;
export const PROFILE_VERSION = 9;

/** Everything needed to pick a run up exactly where it was left. */
export interface SavedGame {
  version: number;
  seed: number;
  screen: Screen;
  run: RunState;
  combat: CombatState | null;
  rewardChoices: string[];
  eventId: string | null;
  shopVisit: ShopVisit;
}

/** What the player keeps from run to run. */
export interface Profile {
  version: number;
  /** Creatures brought home from won runs, each with its own bond. */
  homeAquarium: HomeCreature[];
  /** Every creature ever met, by id; missing means never encountered. */
  creatureBook: Record<string, Discovery>;
  /** The biggest of each species ever caught, by id. */
  biggestCatch: Record<string, CatchSize>;
  /** Builds unlocked through a fisherman's quest (builds without `unlock` are always available). */
  unlockedBuilds: string[];
  /** Fishermen met on the map, whose quests are open until their builds are unlocked. */
  fishermenMet: string[];
  /** Golden shells left to spend in the Logbook, and the Logbook nodes bought. */
  goldenShells: number;
  logbook: string[];
  /** Companions back injured from runs that ended badly, resting apart from the home aquarium. */
  recovering: RecoveringCreature[];
}

type DataFile = 'save' | 'profile';

/** A file in the app's data folder in the desktop app (see electron/main.js), localStorage in a browser. */
const storage = window.desktop ?? {
  readData: async (name: DataFile) => localStorage.getItem(`catch-of-the-deck:${name}`),
  writeData: async (name: DataFile, json: string) => localStorage.setItem(`catch-of-the-deck:${name}`, json),
  deleteData: async (name: DataFile) => localStorage.removeItem(`catch-of-the-deck:${name}`),
};

/** Full bond by tier before profile v5 and save v14: bond points are moved to today's (`rescaleBond`). */
const OLD_BOND_BY_TIER: Record<number, number> = { 1: 100, 2: 200, 3: 400 };
const rescaleOld = (c: Omit<HomeCreature, 'size'>): HomeCreature =>
  rescaleBond({ ...c, size: 'normal' }, OLD_BOND_BY_TIER[gameData.enemies[c.id]?.tier ?? 1] ?? 100, gameData);

async function read<T>(name: DataFile): Promise<T | null> {
  try {
    const json = await storage.readData(name);
    return json ? (JSON.parse(json) as T) : null;
  } catch {
    return null;
  }
}

// Writes run one after another, so an older version of a file can never land after a newer one.
let queue: Promise<unknown> = Promise.resolve();
function enqueue(task: () => Promise<unknown>) {
  queue = queue.then(task).catch((error) => console.error('Saving failed:', error));
}

/** Older saves are turned into the current shape here; null means it can't be resumed. */
export function upgradeSave(save: SavedGame): SavedGame | null {
  // v1 called the bucket `captured`.
  if (save.version === 1) {
    const { captured, ...run } = save.run as RunState & { captured: string[] };
    save = { ...save, version: 2, run: { ...run, bucket: captured as unknown as RunState['bucket'] } };
  }
  // v2 had no companions: nothing was brought from the home aquarium.
  if (save.version === 2) {
    const combat = save.combat && {
      ...save.combat,
      bonuses: [],
      bonusTracker: { attacksThisTurn: 0, attacksThisFight: 0, dodged: 0, belowHalf: false, carriedBlock: 0 },
    };
    save = { ...save, version: 3, run: { ...save.run, companions: [] }, combat };
  }
  // v3 companions were plain creature ids, before bonds.
  if (save.version === 3) {
    const companions = (save.run.companions as unknown as string[]).map((id) => ({ id, bond: 0, size: 'normal' as const }));
    save = { ...save, version: 4, run: { ...save.run, companions } };
  }
  // v6 fights had no Patience.
  if (save.version === 6) {
    const combat = save.combat && { ...save.combat, player: { ...save.combat.player, patience: 0 } };
    save = { ...save, version: 7, combat };
  }
  // v7 runs had no reward skips or rerolls.
  if (save.version === 7) save = { ...save, version: 8, run: { ...save.run, rewardSkipsUsed: 0, rewardRerollsUsed: 0 } };
  // v8 fights had Poison, now Venom.
  if (save.version === 8) {
    const venom = <T extends { statuses: Record<string, number> }>(c: T): T => {
      const { poison, ...rest } = c.statuses;
      return { ...c, statuses: poison ? { ...rest, venom: poison } : rest };
    };
    const combat = save.combat && { ...save.combat, player: venom(save.combat.player), enemies: save.combat.enemies.map(venom) };
    save = { ...save, version: 9, combat };
  }
  // v9 runs had no rare pity or reward families.
  if (save.version === 9) save = { ...save, version: 10, run: { ...save.run, rarePity: 10, rewardFamilies: [] } };
  // v10 runs didn't count their fights: every won fight raised the floor.
  if (save.version === 10) save = { ...save, version: 11, run: { ...save.run, fights: save.run.floor - 1 } };
  // v13 buckets held creature ids, before sizes and the bucket limit, with the old bond pace.
  // A bucket already over the limit stays as it is.
  if (save.version === 13) {
    const bucket = (save.run.bucket as unknown as string[]).map((id) => ({ id, size: 'normal' as const }));
    save = { ...save, version: 14, run: { ...save.run, bucket, waiting: [], companions: save.run.companions.map(rescaleOld) } };
  }
  // v14 runs had no rerolls of their own: they get the one a run starts with.
  if (save.version === 14) save = { ...save, version: 15, run: { ...save.run, rewardRerolls: 1 } };
  // v15 runs had no card removal after a boss.
  if (save.version === 15) save = { ...save, version: 16, run: { ...save.run, bossRemoval: false } };
  // v16 runs had no fishermen on their maps.
  if (save.version === 16) save = { ...save, version: 17, run: { ...save.run, fishermen: [] } };
  // v17 runs had shown no bucket quests.
  if (save.version === 17) save = { ...save, version: 18, run: { ...save.run, questsShown: [] } };
  // v18 runs had one shop, before the three stores: their shop nodes become Tackle shops.
  if (save.version === 18) {
    const columns = save.run.map.columns.map((column) => column.map((n) => (n.kind === 'shop' ? { ...n, store: 'tackle' as const } : n)));
    const run = { ...save.run, map: { columns }, bucketSize: BUCKET_SIZE, boons: [], sentHome: [], luckyLure: false, spareHooks: 0 };
    save = { ...save, version: 19, run, shopVisit: { ...save.shopVisit, store: 'tackle' } };
  }
  // v19 runs were before the Logbook: no node bought.
  if (save.version === 19) save = { ...save, version: 20, run: { ...save.run, progression: [] } };
  // v20 runs didn't count their nodes, nor keep their companions' starting bond: this level's nodes, and today's bond.
  if (save.version === 20) {
    const run = { ...save.run, nodesDone: Math.max(0, (save.run.visited?.length ?? 1) - 1), companionBondsAtStart: (save.run.companions ?? []).map((c) => c.bond) };
    save = { ...save, version: 21, run };
  }
  // v4 runs were on a generated map, before hand-made levels, v5 runs on the hand-made coast,
  // before coast features, v11 runs on the old 1000×150 coast art and v12 runs on a coast laid out
  // each run, before the static map: they can't be resumed.
  return save.version === SAVE_VERSION ? save : null;
}

export async function loadSavedGame(): Promise<SavedGame | null> {
  const save = await read<SavedGame>('save');
  return save ? upgradeSave(save) : null;
}

export function writeSavedGame(save: SavedGame) {
  const json = JSON.stringify(save);
  enqueue(() => storage.writeData('save', json));
}

export function clearSavedGame() {
  enqueue(() => storage.deleteData('save'));
}

export function upgradeProfile(profile: Profile): Profile | null {
  // v1 had no creature book: whatever is in the home aquarium was captured.
  if (profile.version === 1) {
    const ids = profile.homeAquarium as unknown as string[];
    const creatureBook = Object.fromEntries(ids.map((id) => [id, 'captured' as const]));
    profile = { ...profile, version: 2, creatureBook };
  }
  // v2 had no eggs (and eggs are gone since v9).
  if (profile.version === 2) profile = { ...profile, version: 3 };
  // v3 home aquariums were plain creature ids, before bonds.
  if (profile.version === 3) {
    const homeAquarium = (profile.homeAquarium as unknown as string[]).map((id) => ({ id, bond: 0, size: 'normal' as const }));
    profile = { ...profile, version: 4, homeAquarium };
  }
  // v4 had the old bond pace, and no sizes: what was caught is normal-sized.
  if (profile.version === 4) {
    const captured = Object.keys(profile.creatureBook).filter((id) => profile.creatureBook[id] === 'captured');
    const biggestCatch = Object.fromEntries(captured.map((id) => [id, 'normal' as const]));
    profile = { ...profile, version: 5, homeAquarium: profile.homeAquarium.map(rescaleOld), biggestCatch };
  }
  // v5 had no build unlocks: every run used the first build, so only the default builds are unlocked.
  if (profile.version === 5) profile = { ...profile, version: 6, unlockedBuilds: [], fishermenMet: [] };
  // v6 was before the Logbook: no shells, nothing bought.
  if (profile.version === 6) profile = { ...profile, version: 7, goldenShells: 0, logbook: [] };
  // v7 was before injured companions: none resting.
  if (profile.version === 7) profile = { ...profile, version: 8, recovering: [] };
  // v8 had eggs, before breeding was removed: each waiting egg hatches into the home aquarium, small and at bond level 1.
  if (profile.version === 8) {
    const { eggs = [], ...rest } = profile as Profile & { eggs?: string[] };
    const hatched = eggs.map((id) => ({ id, size: 'small' as const, bond: bondThreshold(id, 1, gameData) }));
    profile = { ...rest, version: 9, homeAquarium: [...rest.homeAquarium, ...hatched] };
  }
  return profile.version === PROFILE_VERSION ? profile : null;
}

/** The profile, or a fresh one (nothing owned or met) if there's none or it can't be read. */
export async function loadProfile(): Promise<Profile> {
  const profile = await read<Profile>('profile');
  return (
    (profile && upgradeProfile(profile)) ?? {
      version: PROFILE_VERSION,
      homeAquarium: [],
      creatureBook: {},
      biggestCatch: {},
      unlockedBuilds: [],
      fishermenMet: [],
      goldenShells: 0,
      logbook: [],
      recovering: [],
    }
  );
}

export function writeProfile(profile: Profile) {
  const json = JSON.stringify(profile);
  enqueue(() => storage.writeData('profile', json));
}

export function clearProfile() {
  enqueue(() => storage.deleteData('profile'));
}

/**
 * A transfer code carries both files to another device (see ARCHITECTURE.md → Persistence):
 * `STF1:` + base64url(deflate(JSON of `TransferContents`)). A QR too small for it shows it in parts,
 * `STF1:<n>/<total>:<slice of the base64url>`.
 */
export const TRANSFER_PREFIX = 'STF1:';
/** The longest part a QR holds, so phones and webcams still read it easily. */
export const TRANSFER_PART_LENGTH = 800;

/** What a transfer code holds: `save` is null when no run is in progress. */
export interface TransferContents {
  save: SavedGame | null;
  profile: Profile;
}

/** Why a code was refused: `transfer.error.<reason>` in the language files. */
export class TransferError extends Error {
  constructor(readonly reason: 'prefix' | 'corrupt' | 'newer') {
    super(`Invalid transfer code (${reason})`);
  }
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  return new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());
}

/** Both files as a transfer code. */
export async function exportTransferCode(): Promise<string> {
  const contents: TransferContents = { save: await loadSavedGame(), profile: await loadProfile() };
  return encodeTransfer(contents);
}

export async function encodeTransfer(contents: TransferContents): Promise<string> {
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(contents)), new CompressionStream('deflate'));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return TRANSFER_PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Read a transfer code, upgrading files from older builds; throws a `TransferError` and writes nothing if it can't be used. */
export async function importTransferCode(code: string): Promise<TransferContents> {
  code = code.replace(/\s/g, '');
  if (!code.startsWith(TRANSFER_PREFIX) || /^\d+\/\d+:/.test(code.slice(TRANSFER_PREFIX.length))) throw new TransferError('prefix');
  let parsed: { save?: SavedGame | null; profile?: Profile };
  try {
    const binary = atob(code.slice(TRANSFER_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate'))));
  } catch {
    throw new TransferError('corrupt');
  }
  const { save, profile } = parsed ?? {};
  if (typeof profile?.version !== 'number' || (save != null && typeof save.version !== 'number')) throw new TransferError('corrupt');
  if (profile.version > PROFILE_VERSION || (save && save.version > SAVE_VERSION)) throw new TransferError('newer');
  try {
    const upgradedProfile = upgradeProfile(profile);
    // Like a save on this device, a run too old to resume is dropped.
    const upgradedSave = save ? upgradeSave(save) : null;
    const valid =
      upgradedProfile &&
      [upgradedProfile.homeAquarium, upgradedProfile.unlockedBuilds, upgradedProfile.fishermenMet, upgradedProfile.logbook, upgradedProfile.recovering].every(Array.isArray) &&
      Number.isInteger(upgradedProfile.goldenShells) &&
      (!upgradedSave || typeof upgradedSave.run === 'object');
    if (!valid) throw new TransferError('corrupt');
    return { save: upgradedSave, profile: upgradedProfile };
  } catch {
    throw new TransferError('corrupt');
  }
}

/** The code cut into the parts a QR shows in turn, or the code itself when one QR holds it. */
export function splitTransferCode(code: string): string[] {
  const payload = code.slice(TRANSFER_PREFIX.length);
  if (code.length <= TRANSFER_PART_LENGTH) return [code];
  const total = Math.ceil(payload.length / TRANSFER_PART_LENGTH);
  const size = Math.ceil(payload.length / total);
  return Array.from({ length: total }, (_, i) => `${TRANSFER_PREFIX}${i + 1}/${total}:${payload.slice(i * size, (i + 1) * size)}`);
}

/**
 * Add a scanned QR to the parts collected so far (in any order). Returns the parts, the full code
 * once every part is in, and how many there are; a part from a code of another length starts over.
 */
export function collectTransferPart(parts: string[], scanned: string): { parts: string[]; code: string | null; total: number } {
  const match = /^STF1:(\d+)\/(\d+):(.*)$/.exec(scanned.trim());
  if (!match) return { parts, code: scanned.trim().startsWith(TRANSFER_PREFIX) ? scanned.trim() : null, total: 1 };
  const [index, total] = [Number(match[1]), Number(match[2])];
  if (index < 1 || index > total) return { parts, code: null, total: parts.length };
  const next = parts.length === total ? [...parts] : Array<string>(total).fill('');
  next[index - 1] = match[3];
  const done = next.every((p) => p !== '');
  return { parts: next, code: done ? TRANSFER_PREFIX + next.join('') : null, total };
}

/** Replace this device's files with what a transfer code brought. */
export function applyTransfer({ save, profile }: TransferContents) {
  writeProfile(profile);
  if (save) writeSavedGame(save);
  else clearSavedGame();
}
