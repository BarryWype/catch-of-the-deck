import { rescaleBond, type CatchSize, type CombatState, type Discovery, type HomeCreature, type RunState, type ShopVisit } from '../engine';
import { gameData } from './i18n';
import type { Screen } from './useGame';

/**
 * Two files, see ARCHITECTURE.md → Persistence:
 * - `save`: the run in progress, deleted when it ends;
 * - `profile`: what lasts between runs (the home aquarium, its eggs, the creature book).
 * Bump a version when that file's shape changes, and upgrade older files in its `upgrade…`.
 */
export const SAVE_VERSION = 18;
export const PROFILE_VERSION = 6;

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
  /** Creatures brought home from won runs or hatched, each with its own bond. */
  homeAquarium: HomeCreature[];
  /** Every creature ever met, by id; missing means never encountered. */
  creatureBook: Record<string, Discovery>;
  /** The biggest of each species ever caught, by id. */
  biggestCatch: Record<string, CatchSize>;
  /** Eggs waiting to be hatched: the creature id inside each. */
  eggs: string[];
  /** Builds unlocked through a fisherman's quest (builds without `unlock` are always available). */
  unlockedBuilds: string[];
  /** Fishermen met on the map, whose quests are open until their builds are unlocked. */
  fishermenMet: string[];
}

type DataFile = 'save' | 'profile';

/** A file in the app's data folder in the desktop app (see electron/main.js), localStorage in a browser. */
const storage = window.desktop ?? {
  readData: async (name: DataFile) => localStorage.getItem(`slay-the-fish:${name}`),
  writeData: async (name: DataFile, json: string) => localStorage.setItem(`slay-the-fish:${name}`, json),
  deleteData: async (name: DataFile) => localStorage.removeItem(`slay-the-fish:${name}`),
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
  // v2 had no eggs.
  if (profile.version === 2) profile = { ...profile, version: 3, eggs: [] };
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
      eggs: [],
      unlockedBuilds: [],
      fishermenMet: [],
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
