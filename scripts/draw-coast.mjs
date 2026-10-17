// Draws the family coast the map is played on, once, with every place on it:
//
//   node scripts/draw-coast.mjs   (or: npm run coast)
//
// Writes src/ui/assets/coast/map.png (1300x450): the land, the beach (first water row SHORE_Y),
// the shallows, then the open sea further down for the older ages. The grandparents' house and
// its creek are on the left, the river delta (the mini-bosses) in the middle, the lighthouse
// headland (the bosses) on the right, and between them, column by column, the ponds, lakes,
// streams, beaches, jetties, harbours, rocks, tide pools, reefs and wrecks the fights happen at.
//
// It prints every place as [kind, x, y]: content/coast.ts lists them, with what each age does
// there. Move or add a place here, then update it there.

import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const WIDTH = 1300;
const HEIGHT = 450;
/** First row of water along the straight part of the shore. */
const SHORE_Y = 196;

const C = {
  outline: [34, 52, 40],
  grass: [92, 172, 76],
  grassDark: [70, 146, 64],
  grassLight: [128, 198, 92],
  tuft: [56, 124, 56],
  flower: [250, 236, 120],
  flowerWhite: [244, 244, 236],
  tree: [44, 120, 62],
  treeDark: [30, 88, 50],
  treeLight: [74, 154, 76],
  trunk: [110, 74, 48],
  shadow: [58, 120, 56],
  sand: [240, 218, 152],
  sandDark: [218, 190, 124],
  wetSand: [200, 182, 130],
  foam: [236, 248, 252],
  shallow: [102, 210, 228],
  shallow2: [64, 186, 218],
  sea: [38, 156, 206],
  seaMid: [28, 128, 190],
  seaDeep: [20, 98, 166],
  abyss: [14, 70, 138],
  ripple: [150, 226, 240],
  fresh: [66, 156, 214],
  freshDark: [44, 118, 182],
  freshLight: [126, 200, 238],
  bank: [84, 118, 60],
  mud: [146, 132, 86],
  mudDark: [116, 104, 66],
  brackish: [86, 168, 164],
  reed: [150, 168, 72],
  reedTop: [120, 82, 50],
  lily: [64, 150, 70],
  rock: [146, 146, 156],
  rockDark: [98, 98, 112],
  rockLight: [192, 192, 200],
  wall: [244, 226, 180],
  wallDark: [212, 190, 140],
  roof: [182, 62, 54],
  roofDark: [134, 40, 40],
  door: [110, 70, 44],
  window: [120, 200, 236],
  path: [204, 172, 114],
  wood: [164, 104, 62],
  woodDark: [112, 70, 44],
  white: [246, 246, 240],
  red: [204, 58, 52],
  lamp: [255, 232, 120],
  glow: [255, 246, 190],
};

// A fixed seed, so running the script again gives the same art.
let seed = 11;
function random() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
/** A stable 0-1 value per pixel, for textures that don't depend on drawing order. */
function hash(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise, about `size` pixels per blob. */
function noise(x, y, size, salt = 0) {
  const gx = x / size;
  const gy = y / size;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(x0, y0, salt) * (1 - sx) + hash(x0 + 1, y0, salt) * sx;
  const bottom = hash(x0, y0 + 1, salt) * (1 - sx) + hash(x0 + 1, y0 + 1, salt) * sx;
  return top * (1 - sy) + bottom * sy;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function image(width, height) {
  return new PNG({ width, height });
}
function set(png, x, y, [r, g, b], a = 255) {
  x = Math.round(x);
  y = Math.round(y);
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
    for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx || 1) + (j * j) / (ry * ry || 1) <= 1) set(png, cx + i, cy + j, colour);
  }
}
function save(png, path) {
  writeFileSync(path, PNG.sync.write(png));
  console.log(`wrote ${path}`);
}

/**
 * Fills the pixels of a box where `inside(x, y)` holds: `fill`, an `edge` colour round the outside
 * rows, and `light` along the top inner edge (light comes from the top left).
 */
function shape(png, ox, oy, w, h, inside, { fill, edge, light, dark }) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && inside(x, y);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      const border = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      let colour = fill;
      if (border && edge) colour = edge;
      else if (light && (!at(x, y - 2) || !at(x - 2, y))) colour = light;
      else if (dark && (!at(x, y + 2) || !at(x + 2, y))) colour = dark;
      set(png, ox + x, oy + y, colour);
    }
  }
}

/** A blob: the union of a few ellipses, with a ragged edge. */
function blob(ellipses, rough = 0.12, salt = 0) {
  return (x, y) =>
    ellipses.some(([cx, cy, rx, ry]) => {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      return d <= 1 + (noise(x, y, 4, salt) - 0.5) * rough * 4;
    });
}

/**
 * Water along one or more joined paths (`[points, widths]` each): every bank first, then every
 * water, so branches flow into each other, then a lighter thread in the middle. From `shore`
 * (the first sea row, in the image's rows) down, there's no bank and the water turns into the
 * shallows' colour, so the mouth opens into the sea.
 */
function waterway(png, paths, { bank = C.bank, water = C.fresh, light = C.freshLight, shore = Infinity } = {}) {
  const samples = [];
  for (const [points, widths] of paths) {
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const w = widths[i] + (widths[i + 1] - widths[i]) * t;
        samples.push([Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t), w]);
      }
    }
  }
  const disc = (cx, cy, r, colourAt) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r) {
      const colour = colourAt(cx + i, cy + j);
      if (colour) set(png, cx + i, cy + j, colour);
    }
  };
  // Across the beach (the 8 rows above `shore`) the banks turn to wet sand and the water fades
  // into the sea's colour; where it meets the sea, a patch of shallows breaks the foam line.
  const beach = shore - 8;
  const waterAt = (x, y) => (y >= shore || (y >= beach && bayer(x, y) < (y - beach + 1) / 9) ? C.shallow : water);
  for (const [x, y, w] of samples) disc(x, y, Math.ceil(w / 2) + 1, (_, py) => (py < beach ? bank : py < shore ? C.wetSand : null));
  for (const [x, y, w] of samples) disc(x, y, Math.ceil(w / 2), waterAt);
  for (const [x, y, w] of samples) if (w >= 4 && y < beach) set(png, x - 1, y, light);
  for (const [x, y, w] of samples) {
    if (y !== shore) continue;
    const rx = Math.ceil(w / 2) + 3;
    for (let j = 0; j <= 3; j++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / 9 <= 1) set(png, x + i, y + j, C.shallow);
  }
}

/**
 * A winding line of points from (x, top) down to `bottom`: one long `bend` over its whole length,
 * and loops of `swing` every `period` rows, growing wider downstream as rivers do on flat land.
 */
function meander(x, top, bottom, swing, period, phase = 0, bend = 0) {
  const points = [];
  for (let y = top; y <= bottom; y += 3) {
    const t = (y - top) / (bottom - top);
    const loops = Math.sin((y + phase) / period) + 0.35 * Math.sin((y + phase) / (period * 0.43) + 1.3);
    points.push([x + bend * Math.sin(Math.PI * t + phase / 40) + loops * swing * (0.55 + 0.6 * t), y]);
  }
  return points;
}
/** Widths along a path: from `from` to `to`, flaring at the mouth. */
const widening = (points, from, to, flare = 2) => points.map((_, i) => from + ((to - from) * i) / points.length + (i > points.length - 4 ? flare : 0));
function tree(png, x, y, r = 5) {
  ellipse(png, x + 2, y + r + 1, r, Math.max(1, Math.round(r / 2.5)), C.shadow);
  rect(png, x, y + r - 2, 2, 4, C.trunk);
  ellipse(png, x, y, r + 1, r + 1, C.outline);
  ellipse(png, x, y, r, r, C.tree);
  ellipse(png, x + 1, y + 2, r - 1, r - 2, C.treeDark);
  ellipse(png, x - 1, y - 1, r - 2, r - 2, C.tree);
  ellipse(png, x - 2, y - 2, Math.max(1, r - 4), Math.max(1, r - 4), C.treeLight);
}

function rock(png, x, y, rx, ry) {
  ellipse(png, x, y, rx + 1, ry + 1, C.outline);
  ellipse(png, x, y, rx, ry, C.rock);
  ellipse(png, x + 1, y + 1, rx - 1, ry - 1, C.rockDark);
  ellipse(png, x - 1, y, rx - 1, ry - 1, C.rock);
  ellipse(png, x - Math.ceil(rx / 3), y - Math.ceil(ry / 3), Math.max(1, Math.floor(rx / 3)), Math.max(1, Math.floor(ry / 3)), C.rockLight);
}

function reeds(png, x, y, n = 3) {
  for (let i = 0; i < n; i++) {
    const h = 3 + Math.floor(random() * 3);
    rect(png, x + i * 2, y - h, 1, h, C.reed);
    set(png, x + i * 2, y - h, C.reedTop);
  }
}

/** Sea colour `d` rows from the shore, dithered between bands. */
const BANDS = [
  [0, C.shallow],
  [16, C.shallow2],
  [44, C.sea],
  [100, C.seaMid],
  [160, C.seaDeep],
  [215, C.abyss],
];
function seaColour(x, d) {
  let band = 0;
  while (band + 1 < BANDS.length && d >= BANDS[band + 1][0]) band++;
  const next = BANDS[band + 1];
  if (next && d >= next[0] - 6 && bayer(x, d) < (d - (next[0] - 6)) / 6) return next[1];
  return BANDS[band][1];
}

// ---------------------------------------------------------------------------
// The ground: land, beach and sea, the whole way down
// ---------------------------------------------------------------------------

const DELTA = { left: 610, right: 776 };
const HEADLAND = 1196;

/** The first water row at each column: wavy by the house, straight along the coast, out round the headland. */
function shoreAt(x) {
  if (x < 128) return SHORE_Y + Math.round((6 * Math.sin(x / 16) + 4) * smooth(128, 96, x));
  return SHORE_Y + Math.round(40 * smooth(HEADLAND, HEADLAND + 40, x) - 3 * Math.sin((x - HEADLAND) / 9) * smooth(HEADLAND + 30, HEADLAND + 60, x));
}

const ground = image(WIDTH, HEIGHT);
for (let x = 0; x < WIDTH; x++) {
  const shore = shoreAt(x);
  for (let y = 0; y < HEIGHT; y++) {
    const d = y - shore;
    let colour;
    if (d < -8) {
      const n = noise(x, y, 22) + (noise(x, y, 7, 3) - 0.5) * 0.25 + (bayer(x, y) - 0.5) * 0.12;
      colour = n > 0.66 ? C.grassLight : n < 0.34 ? C.grassDark : C.grass;
    } else if (d === -8) colour = bayer(x, y) < 0.5 ? C.sand : C.grass;
    else if (d < -2) colour = hash(x, y, 5) < 0.06 ? C.sandDark : C.sand;
    else if (d < 0) colour = C.wetSand;
    else if (d === 0) colour = hash(Math.floor(x / 3), 0, 7) < 0.7 ? C.foam : C.shallow;
    else if (d === 1 && hash(Math.floor(x / 2), 1, 8) < 0.3) colour = C.foam;
    else colour = seaColour(x, d + Math.round((noise(x, y, 18, 12) - 0.5) * 10));
    set(ground, x, y, colour);
  }
}
for (let n = 0; n < 2600; n++) {
  const x = Math.floor(random() * WIDTH);
  const y = Math.floor(random() * SHORE_Y);
  if (y > shoreAt(x) - 11) continue;
  if (random() < 0.08) set(ground, x, y, random() < 0.5 ? C.flower : C.flowerWhite);
  else {
    set(ground, x, y, C.tuft);
    set(ground, x + 1, y - 1, C.tuft);
    set(ground, x + 2, y, C.tuft);
  }
}
for (let n = 0; n < 420; n++) {
  const x = Math.floor(random() * (WIDTH - 6));
  const y = shoreAt(x) + 6 + Math.floor(random() * (HEIGHT - shoreAt(x) - 6));
  const deep = y - shoreAt(x) > 110;
  rect(ground, x, y, 2 + Math.floor(random() * 4), 1, deep ? C.sea : C.ripple);
}

// ---------------------------------------------------------------------------
// Everything on it, drawn on its own layer: the woods are then grown only where it's empty
// ---------------------------------------------------------------------------

const layer = image(WIDTH, HEIGHT);
/** Where nodes may go: [kind, x, y], printed at the end for content/coast.ts. */
const places = [];
const place = (kind, x, y) => places.push([kind, Math.round(x), Math.round(y)]);

// The grandparents' house (the start, at about 37,88), its garden, its path and its creek.
const creek = [...meander(102, 18, 170, 5, 11, 0, 4), [106, 184], [110, shoreAt(110) + 4]];
waterway(layer, [[creek, widening(creek, 2, 4)]], { shore: shoreAt(110) });
for (let y = 100; y < 190; y++) rect(layer, 37 + Math.round(Math.sin(y / 12) * 3), y, 3, 1, C.path);
rect(layer, 14, 70, 46, 1, C.woodDark);
rect(layer, 14, 104, 46, 1, C.woodDark);
for (let x = 14; x < 60; x += 4) rect(layer, x, 68, 1, 4, C.wood);
for (let x = 14; x < 60; x += 4) if (x < 34 || x > 42) rect(layer, x, 102, 1, 4, C.wood);
rect(layer, 14, 70, 1, 35, C.woodDark);
rect(layer, 59, 70, 1, 35, C.woodDark);
rect(layer, 23, 82, 28, 18, C.outline);
rect(layer, 24, 83, 26, 16, C.wall);
rect(layer, 24, 95, 26, 4, C.wallDark);
for (let j = 0; j < 12; j++) {
  rect(layer, 20 + j, 82 - j, 34 - 2 * j, 1, j === 11 ? C.outline : j % 3 === 0 ? C.roofDark : C.roof);
  set(layer, 19 + j, 82 - j, C.outline);
  set(layer, 54 - j, 82 - j, C.outline);
}
rect(layer, 44, 66, 4, 8, C.outline);
rect(layer, 45, 67, 2, 7, C.roofDark);
rect(layer, 35, 90, 5, 9, C.door);
set(layer, 38, 94, C.lamp);
for (const wx of [27, 43]) {
  rect(layer, wx, 86, 5, 5, C.outline);
  rect(layer, wx + 1, 87, 3, 3, C.window);
  set(layer, wx + 1, 87, C.white);
}
// Its vegetable patch.
for (let row = 0; row < 3; row++) for (let x = 64; x < 84; x += 3) set(layer, x, 112 + row * 4, row % 2 ? C.lily : C.tree);
rect(layer, 62, 110, 24, 1, C.woodDark);
rect(layer, 62, 122, 24, 1, C.woodDark);
rock(layer, 66, 214, 5, 3);
rock(layer, 74, 210, 4, 3);
rock(layer, 60, 220, 3, 2);

// The river delta, where the mini-bosses wait: one river from the woods, three channels through mudflats.
const mouth = (DELTA.left + DELTA.right) / 2;
for (let y = 128; y < SHORE_Y - 1; y++) {
  const spread = (y - 128) / (SHORE_Y - 128);
  for (let x = DELTA.left; x < DELTA.right; x++) {
    if (Math.abs(x - mouth) < 20 + spread * 64 + (noise(x, y, 6, 9) - 0.5) * 10) set(layer, x, y, hash(x, y, 2) < 0.12 ? C.mudDark : C.mud);
  }
}
const deltaRiver = [...meander(mouth, 14, 130, 9, 12, 0, 12), [mouth, 136]];
const channels = [[-58, 7], [0, 10], [54, 7]].map(([dx, w]) => {
  const points = [[mouth, 134]];
  for (let y = 140; y <= SHORE_Y + 6; y += 6) points.push([mouth + dx * ((y - 134) / (SHORE_Y - 134)) + Math.sin(y / 9) * 3, y]);
  return [points, points.map((_, i) => w + i * 0.8)];
});
waterway(layer, [[deltaRiver, deltaRiver.map(() => 10)], ...channels], { bank: C.mudDark, shore: SHORE_Y });
for (let n = 0; n < 40; n++) {
  const x = DELTA.left + 12 + Math.floor(random() * (DELTA.right - DELTA.left - 24));
  const y = 140 + Math.floor(random() * 50);
  if (layer.data[(y * WIDTH + x) * 4] === C.mud[0]) reeds(layer, x, y, 2);
}
// The outer channels are fishing spots of their own.
place('channel', 640, 182);
place('channel', 737, 178);

// The lighthouse headland, where the bosses wait: rocky ground, the tower and its light.
for (let x = HEADLAND; x < WIDTH; x++) {
  const shore = shoreAt(x);
  for (let y = shore - 30; y < shore - 2; y++) {
    if (noise(x, y, 5, 4) > 0.55 - smooth(HEADLAND, WIDTH, x) * 0.2) set(layer, x, y, hash(x, y, 6) < 0.3 ? C.rockDark : C.rock);
  }
}
for (let n = 0; n < 14; n++) rock(layer, HEADLAND + 34 + Math.floor(random() * 66), shoreAt(1260) - 4 + Math.floor(random() * 10), 2 + Math.floor(random() * 3), 2);
const tower = { x: 1252, top: 156, bottom: 222 };
for (let y = tower.top; y < tower.bottom; y++) {
  const half = 5 + Math.floor((y - tower.top) / 16);
  const stripe = Math.floor((y - tower.top) / 9) % 2 === 1;
  rect(layer, tower.x - half - 1, y, 2 * half + 3, 1, C.outline);
  rect(layer, tower.x - half, y, 2 * half + 1, 1, stripe ? C.red : C.white);
  set(layer, tower.x + half, y, stripe ? C.roofDark : C.wallDark);
}
rect(layer, tower.x - 7, tower.top - 2, 15, 2, C.outline);
rect(layer, tower.x - 4, tower.top - 9, 9, 7, C.outline);
rect(layer, tower.x - 3, tower.top - 8, 7, 5, C.lamp);
rect(layer, tower.x - 4, tower.top - 12, 9, 3, C.roofDark);
set(layer, tower.x, tower.top - 13, C.outline);
for (let i = 1; i < 30; i++) {
  for (const side of [-1, 1]) {
    for (let j = -Math.floor(i / 6); j <= Math.floor(i / 6); j++) {
      const x = tower.x + side * (6 + i);
      const y = tower.top - 6 + j;
      if (bayer(x, y) < 0.5 - i / 70) set(layer, x, y, C.glow);
    }
  }
}

// ---------------------------------------------------------------------------
// The places: each draws itself and marks where its node goes
// ---------------------------------------------------------------------------

const lakeColours = { fill: C.fresh, edge: C.bank, light: C.freshLight, dark: C.freshDark };

function pond(cx, cy, rx, ry) {
  const salt = Math.floor(random() * 1000);
  const ox = cx - rx - 3;
  const oy = cy - ry - 3;
  const lobe = random() < 0.5 ? -1 : 1;
  shape(layer, ox, oy, 2 * rx + 7, 2 * ry + 7, blob([[rx + 3, ry + 3, rx, ry], [rx + 3 + lobe * rx * 0.45, ry + 4, rx * 0.6, ry * 0.7]], 0.1, salt), lakeColours);
  ellipse(layer, cx + lobe * Math.round(rx / 2), cy - 1, 2, 1, C.lily);
  if (random() < 0.5) set(layer, cx + lobe * Math.round(rx / 2), cy - 1, C.flowerWhite);
  reeds(layer, cx - lobe * rx, cy + ry - 1, 2 + Math.floor(random() * 2));
  place('pond', cx, cy);
}

function lake(cx, cy, rx, ry) {
  const ox = cx - rx - 4;
  const oy = cy - ry - 4;
  const w = 2 * rx + 9;
  const h = 2 * ry + 9;
  shape(layer, ox, oy, w, h, blob([[rx * 0.7, ry + 4, rx * 0.65, ry * 0.9], [rx * 1.3, ry + 5, rx * 0.75, ry], [rx * 1.75, ry, rx * 0.3, ry * 0.6]], 0.08, Math.floor(cx)), lakeColours);
  // A sandy shore on its south side, an island with a tree, a little jetty.
  for (let x = Math.round(rx * 0.4); x < rx; x++) set(layer, ox + x, oy + h - 5 + Math.round(Math.sin(x / 5)), C.sand);
  shape(layer, cx + Math.round(rx * 0.25), cy - 6, 18, 12, blob([[9, 6, 8, 5]], 0.05, 4), { fill: C.grass, edge: C.sandDark, light: C.grassLight });
  tree(layer, cx + Math.round(rx * 0.25) + 9, cy - 4, 4);
  rect(layer, ox + Math.round(rx * 0.35), oy + h - 14, 2, 9, C.wood);
  for (let n = 0; n < 8; n++) rect(layer, ox + 8 + Math.floor(random() * (w - 20)), oy + 8 + Math.floor(random() * (h - 18)), 3, 1, C.freshLight);
  place('lake', cx - rx * 0.45, cy + 2);
}

/**
 * A stream from `top` down to the sea at `x`: winding, then straightening across the beach.
 * `fork` gives it two headwaters that join a third of the way down. Its node sits halfway along.
 */
function stream(x, top, { swing = 5, period = 11, bend = 4, phase = 0, width = [3, 5], fork = 0, kind = 'stream' } = {}) {
  const path = meander(x, top, SHORE_Y - 26, swing, period, phase, bend);
  const [lastX] = path[path.length - 1];
  const points = [...path, [(lastX + x) / 2, SHORE_Y - 13], [x, SHORE_Y - 3], [x, SHORE_Y + 4]];
  const paths = [[points, widening(points, width[0], width[1])]];
  if (fork) {
    const join = Math.floor(points.length / 3);
    const [jx, jy] = points[join];
    for (const side of [-1, 1]) {
      const head = [...meander(jx + side * fork, top - 6, jy - 8, 3, 9, phase + side * 17, -side * fork * 0.3), [jx, jy]];
      paths.push([head, head.map(() => Math.max(2, width[0] - 1))]);
    }
    paths[0] = [points.slice(join), widening(points.slice(join), width[0], width[1])];
  }
  waterway(layer, paths, { shore: SHORE_Y });
  const middle = points.reduce((best, p) => (Math.abs(p[1] - (top + SHORE_Y) / 2) < Math.abs(best[1] - (top + SHORE_Y) / 2) ? p : best));
  if (kind === 'river') {
    reeds(layer, middle[0] - 14, middle[1] - 20, 3);
    reeds(layer, middle[0] + 10, middle[1] + 24, 3);
  }
  place(kind, middle[0], middle[1]);
}

function lagoon(x) {
  const ox = x - 30;
  const oy = 142;
  shape(layer, ox, oy, 66, 50, blob([[30, 26, 26, 18], [46, 30, 16, 14]], 0.1, Math.floor(x)), { fill: C.brackish, edge: C.mudDark, light: C.freshLight, dark: C.fresh });
  for (let i = 0; i < 66; i++) {
    if (i > 44 && i < 54) {
      for (let y = 46; y < 54; y++) set(layer, ox + i, oy + y, C.brackish);
      continue;
    }
    for (let y = 46; y < 54; y++) set(layer, ox + i, oy + y, y > 51 ? C.wetSand : C.sand);
  }
  reeds(layer, ox + 8, oy + 22, 3);
  reeds(layer, ox + 20, oy + 40, 2);
  place('lagoon', x, 168);
}

function beach(x, w = 52) {
  const ox = x - Math.round(w / 2);
  const oy = 180;
  for (let i = 0; i < w; i++) {
    const top = Math.round(10 - 8 * Math.sin((Math.PI * i) / (w - 1)));
    const bottom = 16 + Math.round(2 * Math.sin((Math.PI * i) / (w - 1)));
    for (let y = top; y < bottom; y++) set(layer, ox + i, oy + y, y >= bottom - 2 ? C.wetSand : hash(i, y, 9) < 0.06 ? C.sandDark : C.sand);
    if (i % 3) set(layer, ox + i, oy + bottom, C.foam);
  }
  if (random() < 0.6) {
    // A beach umbrella and a towel.
    const u = ox + 10 + Math.floor(random() * (w - 30));
    rect(layer, u + 5, oy + 4, 1, 7, C.woodDark);
    for (let j = 0; j < 3; j++) rect(layer, u + j, oy + 4 - j, 11 - 2 * j, 1, j % 2 ? C.white : C.red);
    rect(layer, u + 13, oy + 9, 6, 3, C.window);
    rect(layer, u + 13, oy + 10, 6, 1, C.white);
  } else {
    // Driftwood and shells.
    rect(layer, ox + 12, oy + 8, 10, 2, C.wood);
    rect(layer, ox + 12, oy + 9, 10, 1, C.woodDark);
    set(layer, ox + w - 14, oy + 10, C.flowerWhite);
  }
  place('beach', x, 189);
}

function jetty(x) {
  const ox = x - 5;
  for (let y = 0; y < 34; y++) rect(layer, ox + 2, 186 + y, 6, 1, y % 3 === 2 ? C.woodDark : C.wood);
  for (const y of [12, 22, 32]) {
    rect(layer, ox + 1, 186 + y, 1, 3, C.woodDark);
    rect(layer, ox + 8, 186 + y, 1, 3, C.woodDark);
  }
  set(layer, ox + 5, 219, C.foam);
  place('jetty', x, 210);
}

function harbour(x) {
  const ox = x - 9;
  const oy = 184;
  const stone = (sx, sy, w, h) => {
    rect(layer, ox + sx - 1, oy + sy - 1, w + 2, h + 2, C.outline);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const mortar = j % 4 === 3 || (i + (Math.floor(j / 4) % 2) * 3) % 6 === 5;
        set(layer, ox + sx + i, oy + sy + j, j === 0 ? C.rockLight : mortar ? C.rockDark : C.rock);
      }
    }
  };
  stone(33, 6, 5, 28);
  stone(18, 30, 20, 5);
  for (let i = 17; i < 40; i += 2) set(layer, ox + i, oy + 37, C.foam);
  rect(layer, ox + 2, oy + 8, 14, 22, C.woodDark);
  rect(layer, ox + 3, oy + 8, 12, 20, C.wood);
  for (let y = 10; y < 28; y += 3) rect(layer, ox + 3, oy + y, 12, 1, C.woodDark);
  rect(layer, ox + 17, oy + 22, 12, 5, C.outline);
  rect(layer, ox + 18, oy + 22, 10, 3, C.white);
  rect(layer, ox + 18, oy + 25, 10, 1, C.red);
  rect(layer, ox + 21, oy + 18, 5, 4, C.wallDark);
  rect(layer, ox + 22, oy + 19, 2, 2, C.window);
  rect(layer, ox + 24, oy + 12, 1, 6, C.woodDark);
  rect(layer, ox + 25, oy + 12, 3, 2, C.red);
  place('harbour', x, 198);
}

function rocks(x, big = false) {
  if (big) {
    rock(layer, x - 4, 192, 8, 6);
    rock(layer, x + 8, 195, 6, 5);
    rock(layer, x - 9, 198, 3, 2);
    for (let i = -14; i < 16; i += 2) set(layer, x + i, 202, C.foam);
  } else {
    rock(layer, x - 3, 193, 7, 5);
    rock(layer, x + 7, 195, 5, 4);
    rock(layer, x + 2, 189, 4, 3);
    for (let i = -10; i < 14; i += 2) set(layer, x + i, 200, C.foam);
  }
  place('rocks', x, 192);
}

function tidePools(x, y) {
  shape(layer, x - 21, y - 12, 42, 24, blob([[14, 12, 13, 9], [30, 13, 11, 8]], 0.15, Math.floor(x)), { fill: C.rock, edge: C.outline, light: C.rockLight, dark: C.rockDark });
  ellipse(layer, x - 8, y, 4, 2, C.shallow2);
  ellipse(layer, x + 7, y - 1, 3, 2, C.shallow2);
  set(layer, x + 6, y - 1, C.red);
  set(layer, x - 7, y - 1, C.flower);
  place('tidePools', x, y);
}

function sandflat(x, y) {
  const rx = 22 + Math.floor(random() * 8);
  ellipse(layer, x, y, rx + 4, 7, C.shallow);
  ellipse(layer, x, y, rx, 4, C.wetSand);
  ellipse(layer, x - 2, y - 1, Math.round(rx * 0.6), 2, C.sand);
  for (let i = -rx + 4; i < rx - 4; i += 3) set(layer, x + i, y + Math.round(Math.sin(i)), C.foam);
  place('sandflat', x, y);
}

function outerRocks(x, y) {
  ellipse(layer, x, y, 15, 9, C.foam);
  ellipse(layer, x, y, 13, 7, C.shallow);
  rock(layer, x - 4, y - 1, 6, 5);
  rock(layer, x + 5, y + 1, 4, 3);
  if (random() < 0.5) rock(layer, x + 1, y - 5, 3, 2);
  place('outerRocks', x, y);
}

function kelp(x, y) {
  for (let s = 0; s < 7; s++) {
    const base = x - 17 + s * 5;
    const height = 16 + Math.floor(random() * 12);
    const colour = s % 2 ? C.treeDark : C.tree;
    for (let j = 0; j < height; j++) {
      const sx = base + Math.round(Math.sin((j + s * 3) / 3) * 1.5);
      set(layer, sx, y + 15 - j, colour);
      set(layer, sx + 1, y + 15 - j, colour);
      if (j % 7 === 3) set(layer, sx + 2, y + 15 - j, C.reed);
    }
  }
  place('kelp', x, y);
}

function reef(x, y) {
  const CORAL = [[255, 127, 80], [232, 84, 118], [250, 200, 80], [190, 90, 200]];
  for (let n = 0; n < 10; n++) ellipse(layer, x - 19 + n * 4 + Math.floor(random() * 3), y + 3 + Math.floor(random() * 5), 3 + Math.floor(random() * 3), 2 + Math.floor(random() * 2), CORAL[n % 4]);
  for (let n = 0; n < 7; n++) {
    const bx = x - 18 + n * 6;
    const colour = CORAL[(n + 1) % 4];
    rect(layer, bx, y - 10 + (n % 3), 1, 12, colour);
    rect(layer, bx - 2, y - 7 + (n % 3), 2, 1, colour);
    rect(layer, bx + 1, y - 5 + (n % 3), 2, 1, colour);
  }
  place('reef', x, y);
}

function buoy(x, y) {
  ellipse(layer, x, y + 4, 7, 2, C.ripple);
  ellipse(layer, x, y + 4, 5, 1, C.sea);
  rect(layer, x - 3, y - 3, 7, 7, C.outline);
  rect(layer, x - 2, y - 2, 5, 5, C.red);
  rect(layer, x - 2, y, 5, 1, C.white);
  rect(layer, x, y - 8, 1, 5, C.outline);
  set(layer, x, y - 9, C.lamp);
  place('buoy', x, y);
}

function cliff(x, y) {
  for (let i = 0; i < 60; i++) {
    const top = y - 14 + Math.floor(i / 12) * 6 + Math.floor(random() * 2);
    for (let j = top; j < y + 20; j++) set(layer, x - 30 + i, j, i % 12 < 2 ? C.rockDark : j === top ? C.rockLight : C.rock);
    rect(layer, x - 30 + i, y + 20, 1, 6, C.abyss);
  }
  place('cliff', x, y);
}

function wreck(x, y) {
  for (let i = 0; i < 34; i++) {
    const lift = Math.floor(i / 6);
    for (let j = 22 - lift; j < 30 - lift; j++) set(layer, x - 18 + i, y - 22 + j, i % 5 === 0 ? C.woodDark : j === 22 - lift ? C.wood : C.trunk);
  }
  for (let j = 0; j < 20; j++) set(layer, x + 2 + Math.floor(j / 3), y - 4 - j, C.woodDark);
  rect(layer, x - 10, y + 3, 4, 3, C.abyss);
  place('wreck', x, y);
}

function trench(x, y) {
  ellipse(layer, x, y, 36, 13, C.seaDeep);
  ellipse(layer, x, y + 1, 27, 8, C.abyss);
  ellipse(layer, x + 2, y + 2, 15, 3, [6, 40, 96]);
  place('trench', x, y);
}

// The layout, column by column of the map (columns are ~80 px wide: house → delta → lighthouse).
// Rows: inland high (y 40-70), inland low (110-160), the shoreline, the shallows (220-280),
// then out at sea for the adult (320-350) and the elder (390-430).

// x 78-160
pond(150, 58, 9, 7);
rocks(150);
tidePools(140, 252);
reef(118, 324);
wreck(120, 414);
// x 160-242
lake(222, 56, 46, 20);
stream(184, 100, { swing: 4, bend: 3 });
beach(224);
sandflat(206, 262);
kelp(236, 230);
buoy(198, 342);
trench(205, 420);
// x 242-324
pond(302, 42, 10, 7);
stream(318, 70, { swing: 5, bend: -4, phase: 20 });
jetty(266);
outerRocks(286, 254);
reef(298, 322);
cliff(280, 398);
// x 324-406
stream(366, 14, { swing: 9, period: 15, bend: 8, width: [7, 12], kind: 'river', phase: 8 });
harbour(392);
tidePools(350, 264);
sandflat(400, 244);
buoy(370, 342);
wreck(385, 422);
// x 406-487
pond(432, 64, 11, 8);
pond(462, 130, 8, 6);
beach(452);
outerRocks(438, 272);
kelp(474, 236);
reef(452, 330);
trench(444, 402);
// x 487-569
pond(510, 70, 10, 7);
lagoon(506);
stream(558, 34, { swing: 5, bend: 3, phase: 44 });
tidePools(520, 240);
sandflat(546, 276);
buoy(522, 338);
cliff(532, 412);
// x 569-651, up to the delta
pond(590, 54, 9, 6);
rocks(588, true);
outerRocks(626, 252);
reef(616, 338);
wreck(600, 422);
// x 728-799, past the delta (the escape is at 794,188)
pond(764, 62, 10, 7);
tidePools(762, 248);
buoy(756, 342);
trench(766, 420);
// x 799-870
lake(842, 70, 40, 18);
stream(862, 104, { swing: 4, bend: 3, phase: 60 });
jetty(820);
sandflat(836, 258);
reef(842, 322);
cliff(830, 400);
// x 870-941
pond(904, 48, 9, 7);
pond(924, 148, 8, 6);
harbour(900);
outerRocks(912, 264);
buoy(904, 346);
wreck(916, 422);
// x 941-1013
stream(992, 30, { swing: 7, bend: 5, width: [4, 7], fork: 12, phase: 33 });
pond(954, 150, 7, 5);
rocks(960);
tidePools(984, 242);
reef(976, 330);
trench(980, 418);
// x 1013-1084
pond(1040, 60, 11, 8);
lagoon(1062);
sandflat(1044, 268);
outerRocks(1076, 236);
buoy(1050, 346);
cliff(1052, 404);
// x 1084-1155
pond(1126, 44, 9, 6);
stream(1116, 92, { swing: 4, bend: 3, phase: 71 });
jetty(1142);
tidePools(1124, 256);
reef(1126, 328);
wreck(1112, 424);
// x 1155-1227, before the lighthouse
pond(1180, 96, 9, 6);
rocks(1172);
outerRocks(1194, 240);
kelp(1166, 272);
buoy(1182, 338);
trench(1170, 412);

// ---------------------------------------------------------------------------
// Woods along the top, groves wherever the land is still empty, then everything on top
// ---------------------------------------------------------------------------

const emptyAround = (x, y, r) => {
  for (let j = -r - 3; j <= r + 5; j++) {
    for (let i = -r - 3; i <= r + 4; i++) {
      const px = x + i;
      const py = y + j;
      if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) continue;
      if (layer.data[(py * WIDTH + px) * 4 + 3]) return false;
    }
  }
  return true;
};
for (let x = -4; x < WIDTH + 6; x += 7 + Math.floor(random() * 4)) {
  const y = 3 + Math.floor(random() * 9);
  if (emptyAround(x, y, 3)) tree(ground, x, y, 5 + Math.floor(random() * 3));
}
for (let x = 2; x < WIDTH; x += 9 + Math.floor(random() * 5)) {
  const y = 12 + Math.floor(random() * 6);
  if (emptyAround(x, y, 3)) tree(ground, x, y, 4 + Math.floor(random() * 2));
}
// Groves: a few trees together, never on a place, a path or the beach.
for (let n = 0; n < 70; n++) {
  const cx = 70 + Math.floor(random() * (WIDTH - 140));
  const cy = 30 + Math.floor(random() * 130);
  for (let t = 0; t < 2 + Math.floor(random() * 4); t++) {
    const x = cx + Math.floor((random() - 0.5) * 22);
    const y = cy + Math.floor((random() - 0.5) * 16);
    const r = 4 + Math.floor(random() * 3);
    if (y + r + 4 < shoreAt(x) - 10 && emptyAround(x, y, r + 2)) tree(ground, x, y, r);
  }
}

const map = ground;
for (let i = 0; i < WIDTH * HEIGHT; i++) {
  if (!layer.data[i * 4 + 3]) continue;
  for (let k = 0; k < 4; k++) map.data[i * 4 + k] = layer.data[i * 4 + k];
}

const OUT = 'src/ui/assets/coast';
mkdirSync(OUT, { recursive: true });
save(map, `${OUT}/map.png`);
console.log(JSON.stringify(places));
