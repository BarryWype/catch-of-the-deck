// Makes the missing hurt animations of the character sprites, from their own idle art:
//
//   node scripts/generate-hurt-sprites.mjs   (or: npm run hurt-sprites)
//
// src/ui/assets/character/<name>_hurt.png is 2 frames of 48x48, like Fisherman_hurt.png: a red
// flash, then the recoil pose. The pose is the first idle frame (<name>_fish.png) with the rod it
// holds out cut away (the cut closed with outline), and the rod swung back over the shoulder as
// in Fisherman_hurt.png, copied from there into the empty pixels behind the character (its hand
// recoloured to the character's own: the colour gripping the rod in the idle frame).

import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const DIR = 'src/ui/assets/character';
const NAMES = ['SteamMan', 'GraveRobber', 'Woodcutter'];
const CELL = 48;
const OUTLINE = [37, 19, 26];
const FLASH = [232, 68, 68];
/** In Fisherman_hurt.png: the hand on the rod's butt, and the rod's colours. */
const REFERENCE_HAND = [225, 161, 113];
const ROD = [
  [137, 90, 69],
  [167, 172, 186],
];

/** One 48x48 frame of a strip, as RGBA rows. */
function frame(file, index) {
  const png = PNG.sync.read(readFileSync(`${DIR}/${file}`));
  const out = new PNG({ width: CELL, height: CELL });
  PNG.bitblt(png, out, index * CELL, 0, CELL, CELL, 0, 0);
  return out;
}

const at = (x, y) => (y * CELL + x) * 4;
const opaque = (png, x, y) => png.data[at(x, y) + 3] > 0;
const isOutline = (png, x, y) => OUTLINE.every((c, i) => png.data[at(x, y) + i] === c);
const set = (png, x, y, [r, g, b], a = 255) => png.data.set([r, g, b, a], at(x, y));

/** The rod held out in front: right of the hands and below the shoulders, past the rod's top bar. */
const heldRod = (x, y) => (x >= 29 && y >= 24) || (x >= 24 && y >= 27);
/** Where Fisherman_hurt.png has the rod over the shoulder and the hand holding its butt. */
const swungRod = (x, y) => x <= 11 && y >= 17 && y <= 33;

const reference = frame('Fisherman_hurt.png', 1);
const colourAt = (png, x, y) => [...png.data.subarray(at(x, y), at(x, y) + 3)];
const same = (a, b) => a.every((c, i) => c === b[i]);

/** The colour of the hand gripping the rod in the idle frame: the commonest non-rod colour around the grip. */
function gripColour(png) {
  const counts = new Map();
  for (let y = 27; y <= 30; y++)
    for (let x = 25; x <= 27; x++) {
      const colour = colourAt(png, x, y);
      if (!opaque(png, x, y) || same(colour, OUTLINE) || ROD.some((c) => same(c, colour))) continue;
      counts.set(colour.join(), (counts.get(colour.join()) ?? 0) + 1);
    }
  const [best] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return best.split(',').map(Number);
}

for (const name of NAMES) {
  const pose = frame(`${name}_fish.png`, 0);
  const hand = gripColour(pose);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (heldRod(x, y)) set(pose, x, y, [0, 0, 0], 0);
  // Close the arms where the rod was cut off.
  for (let y = 27; y < CELL; y++) if (opaque(pose, 23, y) && !isOutline(pose, 23, y)) set(pose, 24, y, OUTLINE);

  const rod = new Set();
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      if (!swungRod(x, y) || !opaque(reference, x, y) || opaque(pose, x, y)) continue;
      pose.data.set(reference.data.subarray(at(x, y), at(x, y) + 4), at(x, y));
      if (same(colourAt(pose, x, y), REFERENCE_HAND)) set(pose, x, y, hand);
      else rod.add(at(x, y));
    }

  const flash = new PNG({ width: CELL, height: CELL });
  pose.data.copy(flash.data);
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) if (opaque(flash, x, y) && !isOutline(flash, x, y) && !rod.has(at(x, y))) set(flash, x, y, FLASH);

  const out = new PNG({ width: CELL * 2, height: CELL });
  PNG.bitblt(flash, out, 0, 0, CELL, CELL, 0, 0);
  PNG.bitblt(pose, out, 0, 0, CELL, CELL, CELL, 0);
  writeFileSync(`${DIR}/${name}_hurt.png`, PNG.sync.write(out));
  console.log(`Wrote ${DIR}/${name}_hurt.png`);
}
