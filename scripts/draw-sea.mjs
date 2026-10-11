// Draws the open sea below the coast base map, for the older ages that fish further out:
//
//   node scripts/draw-sea.mjs   (or: npm run sea)
//
// Writes, in the flat colours of src/ui/assets/map/basemap.png (1000x150):
// - src/ui/assets/map/sea.png: 1000x150, drawn under the base map (map y 150-300), shallow at the
//   top and deeper further down.
// - src/ui/assets/map/sea/features.png: 1000x150 layer holding the sea features, one per 160px
//   slot (kelp, coral reef, sandbar, underwater cliffs, trench, shipwreck). content/coast.ts crops
//   each one out of it, like the elements cut from the coast art.

import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const WIDTH = 1000;
const HEIGHT = 150;

const SEA = [0, 183, 239];
const SEA_MID = [0, 158, 226];
const SEA_DEEP = [0, 126, 207];
const SEA_ABYSS = [0, 96, 184];
const FOAM = [110, 214, 248];

// A fixed seed, so running the script again gives the same art.
let seed = 7;
function random() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function image() {
  return new PNG({ width: WIDTH, height: HEIGHT });
}
function set(png, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  png.data[i] = r;
  png.data[i + 1] = g;
  png.data[i + 2] = b;
  png.data[i + 3] = a;
}
function rect(png, x, y, w, h, colour) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(png, i, j, colour);
}
function ellipse(png, cx, cy, rx, ry, colour) {
  for (let j = -ry; j <= ry; j++) {
    for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) set(png, cx + i, cy + j, colour);
  }
}
function save(png, path) {
  writeFileSync(path, PNG.sync.write(png));
  console.log(`wrote ${path}`);
}

// The sea: bands getting deeper, with a dithered edge between them and a few light ripples near the top.
const sea = image();
const BANDS = [
  [0, SEA],
  [38, SEA_MID],
  [80, SEA_DEEP],
  [118, SEA_ABYSS],
];
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    let band = 0;
    while (band + 1 < BANDS.length && y >= BANDS[band + 1][0]) band++;
    const next = BANDS[band + 1];
    // Within 4 rows of the next band, a checkerboard mixes the two colours.
    const colour = next && y >= next[0] - 4 && (x + y) % 2 === 0 ? next[1] : BANDS[band][1];
    set(sea, x, y, colour);
  }
}
for (let n = 0; n < 90; n++) {
  const x = Math.floor(random() * (WIDTH - 6));
  const y = Math.floor(random() * 34);
  rect(sea, x, y, 3 + Math.floor(random() * 4), 1, FOAM);
}

// The features, each drawn in its own 160px slot.
const features = image();

// Kelp forest (slot 0): wavy strands with a few floats.
for (let s = 0; s < 7; s++) {
  const base = 6 + s * 5;
  const height = 22 + Math.floor(random() * 10);
  const colour = s % 2 ? [24, 120, 64] : [52, 158, 74];
  for (let j = 0; j < height; j++) {
    const x = base + Math.round(Math.sin((j + s * 3) / 3) * 1.5);
    set(features, x, 40 - j, colour);
    set(features, x + 1, 40 - j, colour);
    if (j % 7 === 3) ellipse(features, x + 2, 40 - j, 1, 1, [180, 160, 50]);
  }
}

// Coral reef (slot 1): coloured blobs and branches.
const CORAL = [[255, 127, 80], [232, 84, 118], [250, 200, 80], [190, 90, 200]];
for (let n = 0; n < 9; n++) ellipse(features, 172 + n * 4 + Math.floor(random() * 4), 24 + Math.floor(random() * 6), 3 + Math.floor(random() * 3), 2 + Math.floor(random() * 2), CORAL[n % CORAL.length]);
for (let n = 0; n < 6; n++) {
  const x = 172 + n * 6;
  const colour = CORAL[(n + 1) % CORAL.length];
  rect(features, x, 14 + (n % 3), 1, 10, colour);
  rect(features, x - 2, 16 + (n % 3), 2, 1, colour);
  rect(features, x + 1, 18 + (n % 3), 2, 1, colour);
}

// Sandbar (slot 2): pale sand under shallow water.
ellipse(features, 348, 26, 27, 5, [120, 214, 236]);
ellipse(features, 348, 26, 23, 3, [236, 222, 140]);
ellipse(features, 344, 25, 12, 1, [255, 242, 0]);

// Underwater cliffs (slot 3): a stepped rock ledge falling into the dark.
const ROCK = [110, 110, 110];
const ROCK_DARK = [70, 70, 70];
for (let i = 0; i < 60; i++) {
  const top = 12 + Math.floor(i / 12) * 6 + Math.floor(random() * 2);
  rect(features, 482 + i, top, 1, 46 - top, i % 12 < 2 ? ROCK_DARK : ROCK);
  rect(features, 482 + i, 46, 1, 6, [0, 60, 130]);
}

// Trench (slot 4): a dark gash in the sea floor.
ellipse(features, 676, 26, 35, 12, [0, 60, 130]);
ellipse(features, 676, 27, 26, 7, [0, 40, 100]);
ellipse(features, 678, 28, 14, 3, [0, 22, 70]);

// Shipwreck (slot 5): a broken hull resting on its side, with its mast.
const WOOD = [156, 90, 60];
const WOOD_DARK = [100, 58, 38];
for (let i = 0; i < 34; i++) {
  const lift = Math.floor(i / 6);
  rect(features, 804 + i, 26 - lift, 1, 8, i % 5 === 0 ? WOOD_DARK : WOOD);
}
for (let j = 0; j < 18; j++) set(features, 826 + Math.floor(j / 3), 20 - j, WOOD_DARK);
rect(features, 812, 30, 4, 3, [0, 60, 130]);

const OUT = 'src/ui/assets/map';
mkdirSync(`${OUT}/sea`, { recursive: true });
save(sea, `${OUT}/sea.png`);
save(features, `${OUT}/sea/features.png`);
