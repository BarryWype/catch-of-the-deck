import fishesUrl from './assets/fishes.png';
import gearUrl from './assets/fishing_gear.png';
import objectsUrl from './assets/objects.png';
import octopusUrl from './assets/creatures/Octopus.png';

export interface SpriteSheet {
  url: string;
  columns: number;
  rows: number;
  /** Size of one cell in source pixels. */
  cell: number;
}

/** Sheets that content can reference by name (`sprite: { sheet, index }`). */
export const SHEETS: Record<string, SpriteSheet> = {
  fishes: { url: fishesUrl, columns: 12, rows: 12, cell: 32 },
  gear: { url: gearUrl, columns: 6, rows: 6, cell: 32 },
  objects: { url: objectsUrl, columns: 5, rows: 4, cell: 32 },
  /** Giant octopus: one 4-frame idle strip. */
  octopus: { url: octopusUrl, columns: 4, rows: 1, cell: 96 },
};

/** One animation: a row of square frames in a sheet. Looping clips repeat; others hold their last frame. */
export interface AnimationClip {
  url: string;
  /** Frames in this row, and rows in the whole sheet. */
  frames: number;
  rows: number;
  /** Frames per row in the whole sheet, when rows have different lengths. Defaults to `frames`. */
  columns?: number;
  row: number;
  fps: number;
  loop: boolean;
}

/**
 * Animated creature sheets made by `npm run sprites`: assets/creatures/NNN.png,
 * one per `fishes` sprite. 6 frames × 4 rows of 48×48 px.
 */
export type AnimationName = 'idle' | 'attack' | 'capture' | 'flee';
const CREATURE_ROWS: Record<AnimationName, { row: number; fps: number; loop: boolean }> = {
  idle: { row: 0, fps: 6, loop: true },
  attack: { row: 1, fps: 12, loop: false },
  capture: { row: 2, fps: 9, loop: false },
  flee: { row: 3, fps: 12, loop: false },
};

/** Creature art drawn as a single strip (sheet names in SHEETS): every animation plays that strip. */
const STRIP_SHEETS = ['octopus'];

export function creatureClip(url: string, name: AnimationName): AnimationClip {
  const strip = STRIP_SHEETS.map((id) => SHEETS[id]).find((sheet) => sheet.url === url);
  if (strip) return { url, frames: strip.columns, rows: 1, row: 0, fps: 6, loop: name === 'idle' };
  return { url, frames: 6, rows: 4, ...CREATURE_ROWS[name] };
}

/**
 * Characters: assets/character/<name>_fish.png (idle, 4 frames), _hook.png (a catch, 6) and
 * _hurt.png (2, see scripts/generate-hurt-sprites.mjs), strips of 48×48 frames.
 */
const characterFiles = import.meta.glob<string>('./assets/character/*.png', { eager: true, query: '?url', import: 'default' });
const characterUrl = (name: string, strip: string) => characterFiles[`./assets/character/${name}_${strip}.png`];

/** The player in a fight, as the build's `character` (the Fisherman by default). */
export type PlayerAnimation = 'idle' | 'win' | 'hurt';
const PLAYER_STRIPS: Record<PlayerAnimation, Omit<AnimationClip, 'url'> & { strip: string }> = {
  idle: { strip: 'fish', frames: 4, rows: 1, row: 0, fps: 4, loop: true },
  win: { strip: 'hook', frames: 6, rows: 1, row: 0, fps: 8, loop: false },
  hurt: { strip: 'hurt', frames: 2, rows: 1, row: 0, fps: 4, loop: false },
};
export function playerClip(animation: PlayerAnimation, character = 'Fisherman'): AnimationClip {
  const { strip, ...clip } = PLAYER_STRIPS[animation];
  return { url: characterUrl(character, strip) ?? characterUrl('Fisherman', strip), ...clip };
}

/** Another fisherman's idle strip (`FishermanDef.sprite`), if his art exists. */
export function characterClip(sprite: string | undefined): AnimationClip | undefined {
  return sprite && characterUrl(sprite, 'fish') ? playerClip('idle', sprite) : undefined;
}

const creatureFiles = import.meta.glob<string>('./assets/creatures/*.png', { eager: true, query: '?url', import: 'default' });
const animatedByIndex: Record<number, string> = {};
for (const [path, url] of Object.entries(creatureFiles)) {
  const match = /(\d+)\.png$/.exec(path);
  if (match) animatedByIndex[Number(match[1])] = url;
}

/** URL of the animated sheet for a sprite, if one exists. */
export function animatedSheetFor(sprite: { sheet: string; index: number }): string | undefined {
  if (STRIP_SHEETS.includes(sprite.sheet)) return SHEETS[sprite.sheet].url;
  return sprite.sheet === 'fishes' ? animatedByIndex[sprite.index] : undefined;
}

/** Column/row of a 1-based index, counted left to right, top to bottom. */
export function cellOf(sheet: SpriteSheet, index: number) {
  return { column: (index - 1) % sheet.columns, row: Math.floor((index - 1) / sheet.columns) };
}
