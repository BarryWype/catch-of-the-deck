import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/content';
import { creatures } from '../src/content/creatures';

const CREATURE_DIR = fileURLToPath(new URL('../src/ui/assets/creatures/', import.meta.url));
const CHARACTER_DIR = fileURLToPath(new URL('../src/ui/assets/character/', import.meta.url));

/** Width/height from a PNG header (IHDR starts at byte 16). */
function pngSize(file: string) {
  const header = readFileSync(file).subarray(0, 24);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

describe('creature animation sheets', () => {
  it.each(creatures.filter((c) => !c.sprite).map((c) => [c.no, c.name] as const))('#%i %s has a 6×4 sheet of 48px frames', (no) => {
    const file = `${CREATURE_DIR}${String(no).padStart(3, '0')}.png`;
    expect(existsSync(file), `${file} is missing: run "npm run sprites"`).toBe(true);
    expect(pngSize(file)).toEqual({ width: 6 * 48, height: 4 * 48 });
  });
});

describe('character strips', () => {
  const players = ['Fisherman', ...Object.values(gameData.builds).flatMap((b) => (b.character ? [b.character] : []))];
  it.each(players)('%s has idle, catch and hurt strips of 48px frames', (name) => {
    for (const [strip, frames] of [['fish', 4], ['hook', 6], ['hurt', 2]] as const) {
      const file = `${CHARACTER_DIR}${name}_${strip}.png`;
      expect(existsSync(file), `${file} is missing`).toBe(true);
      expect(pngSize(file)).toEqual({ width: frames * 48, height: 48 });
    }
  });

  it.each(Object.values(gameData.fishermen).map((f) => f.sprite ?? ''))('fisherman art %s has an idle strip', (name) => {
    expect(pngSize(`${CHARACTER_DIR}${name}_fish.png`)).toEqual({ width: 4 * 48, height: 48 });
  });
});
