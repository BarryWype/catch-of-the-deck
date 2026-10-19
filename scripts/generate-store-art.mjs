// Generates the stores event's pixel art: three shop interiors seen across the counter
// (tackle shop, bait shop, cafe), 240x160 each, plus each shopkeeper as a separate
// sprite so the UI can lay them over the scene (and make the cafe's one clickable), each
// store's map node, and the store items' icons that weren't in the icon set.
//
//   node scripts/generate-store-art.mjs   (or: npm run store-art)
//
// Layering in the UI, back to front: the scene's wall and shelves are one image with
// the counter, so the keeper sprite sits with its bottom edge on COUNTER_TOP and
// nothing of it is hidden. Everything is seeded, so re-running gives the same images.

import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const OUT = 'src/ui/assets/stores';
mkdirSync(OUT, { recursive: true });

// --- tiny helpers ------------------------------------------------------------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = ([r, g, b], f) => [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
const alpha = (c, a) => [...c.slice(0, 3), a];

/**
 * A drawing surface. `rim` outlines the drawing where it meets transparency, so each
 * prop is drawn on its own canvas, rimmed, then `stamp`ed onto the scene: that gives
 * every object the dark outline the icons and creatures have.
 */
function canvas(w, h) {
  const px = Array.from({ length: w * h }, () => null);
  const put = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (!c || x < 0 || y < 0 || x >= w || y >= h) return;
    if (c.length === 4 && px[y * w + x]) {
      const a = c[3] / 255;
      const b = px[y * w + x];
      px[y * w + x] = [0, 1, 2].map((i) => Math.round(c[i] * a + b[i] * (1 - a)));
    } else px[y * w + x] = c;
  };
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c);
  };
  const line = (x0, y0, x1, y1, c) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) put(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, c);
  };
  const disc = (cx, cy, r, c) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, c);
  };
  const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && px[y * w + x];
  return {
    w,
    h,
    put,
    rect,
    line,
    disc,
    get: (x, y) => px[y * w + x],
    rim(ink = INK) {
      const edge = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (px[y * w + x] && (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1))) edge.push(y * w + x);
      for (const i of edge) px[i] = ink;
    },
    stamp(target, dx, dy) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) target.put(dx + x, dy + y, px[y * w + x]);
    },
    /** Saves it as `name` in `dir`, each pixel drawn `scale` x `scale`. */
    write(name, scale = 1, dir = OUT) {
      const png = new PNG({ width: w * scale, height: h * scale });
      for (let i = 0; i < w * h * scale * scale; i++) {
        const x = Math.floor((i % (w * scale)) / scale);
        const y = Math.floor(Math.floor(i / (w * scale)) / scale);
        const c = px[y * w + x];
        if (!c) continue;
        png.data.set([c[0], c[1], c[2], c.length === 4 ? c[3] : 255], i * 4);
      }
      writeFileSync(`${dir}/${name}`, PNG.sync.write(png));
      console.log(`Wrote ${dir}/${name} (${w * scale}x${h * scale}).`);
    },
  };
}

/** Draws `fn` on a fresh w x h canvas, outlines it, and stamps it onto `scene` at (x, y). */
function prop(scene, x, y, w, h, fn) {
  const c = canvas(w, h);
  fn(c);
  c.rim();
  c.stamp(scene, x, y);
}

// --- palette: the icon set's ink and the map's bright, warm colours ----------------

const INK = hex('#2e1c2c');
const WOOD_D = hex('#5a3626');
const WOOD_M = hex('#87553a');
const WOOD_L = hex('#a8704a');
const WOOD_H = hex('#c98d5c');
const RED = hex('#c43c32');
const RED_D = hex('#8d2c44');
const RED_H = hex('#e86838');
const ORANGE = hex('#ff9148');
const CREAM = hex('#f2e2b6');
const CREAM_D = hex('#d4bf8e');
const GOLD = hex('#d9a032');
const GOLD_H = hex('#ffd76e');
const SKY = hex('#8fd3f0');
const SKY_L = hex('#c8eef8');
const SEA = hex('#2f8fd0');
const SEA_D = hex('#1f5fa8');
const FOAM = hex('#e8f8fb');
const GREEN = hex('#3c9a46');
const GREEN_D = hex('#256b34');
const GREEN_L = hex('#7cc45a');
const STEEL = hex('#95adb4');
const STEEL_L = hex('#bfddd1');
const STEEL_D = hex('#5e6f7e');
const PLUM = hex('#86718c');
const WHITE = hex('#ffffff');
const GLASS = hex('#bfeaf2');

// --- shared scene layout -------------------------------------------------------------

const W = 240;
const H = 160;
/** The counter's top edge: the keeper sprite's bottom edge sits here. */
const COUNTER_TOP = 118;
/** Shelf boards: each board's top y, and the x span of the left and right shelves. */
const BOARD_TOP = { A: 56, B: 96 };
const SHELF_X = { left: [8, 88], right: [152, 232] };
/** Where an item's base sits: its centre x, and the board it stands on. */
const SLOT_X = { left: [28, 68], right: [172, 212] };
/** A store with only this many items sells from the counter instead, either side of the keeper (their centre x). */
const COUNTER_SLOTS = [88, 152];
/** Where the keeper sprite goes (its top-left corner); every keeper is KEEPER_W x KEEPER_H. */
const KEEPER_W = 30;
const KEEPER_H = 46;
const KEEPER_AT = { x: 120 - KEEPER_W / 2, y: COUNTER_TOP - KEEPER_H };

/** The back wall: vertical planks in `base`, a ceiling beam, and a skirting shadow behind the counter. */
function wall(c, base, seed) {
  const rand = rng(seed);
  for (let x = 0; x < W; x += 10) {
    const tint = 0.94 + rand() * 0.12;
    c.rect(x, 0, x + 9, COUNTER_TOP, shade(base, tint));
    c.line(x, 0, x, COUNTER_TOP, shade(base, 0.78));
    c.line(x + 1, 0, x + 1, COUNTER_TOP, shade(base, tint * 1.06));
    for (let k = 0; k < 6; k++) c.put(x + 2 + Math.floor(rand() * 7), Math.floor(rand() * COUNTER_TOP), shade(base, 0.86));
    const nail = 10 + Math.floor(rand() * 4);
    c.put(x + 5, nail, shade(base, 0.6));
    c.put(x + 5, nail + 60, shade(base, 0.6));
  }
  c.rect(0, 0, W - 1, 5, WOOD_D);
  c.rect(0, 0, W - 1, 0, INK);
  c.rect(0, 4, W - 1, 4, WOOD_M);
  c.rect(0, 6, W - 1, 6, alpha(INK, 70));
  c.rect(0, COUNTER_TOP - 3, W - 1, COUNTER_TOP - 1, alpha(INK, 60));
}

/** A window showing the sky, the sea and a little boat. */
function seaWindow(c, x0, y0, w, h) {
  prop(c, x0, y0, w, h, (p) => {
    p.rect(0, 0, w - 1, h - 1, WOOD_L);
    p.rect(3, 3, w - 4, h - 4, SKY);
    p.rect(3, 3, w - 4, 6, SKY_L);
    const sea = Math.round(h * 0.62);
    p.rect(3, sea, w - 4, h - 4, SEA);
    p.rect(3, sea + 5, w - 4, h - 4, SEA_D);
    for (let x = 5; x < w - 4; x += 6) p.put(x + (x % 4), sea + 2, FOAM);
    // A cloud, and a sailboat on the horizon.
    p.rect(8, 9, 15, 10, WHITE);
    p.rect(10, 8, 13, 8, WHITE);
    p.line(w - 16, sea - 1, w - 9, sea - 1, RED_D);
    p.line(w - 15, sea, w - 10, sea, RED_D);
    p.line(w - 12, sea - 10, w - 12, sea - 2, WOOD_D);
    for (let i = 0; i < 7; i++) p.line(w - 11, sea - 9 + i, w - 11 + Math.floor(i / 1.5), sea - 9 + i, WHITE);
    // The frame's cross bar and its lit top edge.
    p.rect(Math.floor(w / 2) - 1, 3, Math.floor(w / 2), h - 4, WOOD_L);
    p.rect(3, sea - 4, w - 4, sea - 3, WOOD_L);
    p.rect(0, 0, w - 1, 0, WOOD_H);
    p.rect(0, h - 3, w - 1, h - 1, WOOD_M);
  });
}

/** A shelf board with two brackets. */
function board(c, x0, x1, top) {
  prop(c, x0, top, x1 - x0 + 1, 10, (p) => {
    const w = x1 - x0;
    p.rect(0, 0, w, 4, WOOD_L);
    p.rect(0, 0, w, 0, WOOD_H);
    p.rect(0, 4, w, 4, WOOD_M);
    for (const bx of [8, w - 8]) for (let i = 0; i < 5; i++) p.rect(bx - 3 + i, 5 + i, bx + 2 - i, 5 + i, WOOD_M);
  });
  c.rect(x0 + 1, top + 10, x1 - 1, top + 11, alpha(INK, 50));
}

/** The counter across the bottom: a pale top lip and a panelled front in `front`. */
function counter(c, front, trim) {
  prop(c, 0, COUNTER_TOP, W, H - COUNTER_TOP, (p) => {
    p.rect(0, 0, W - 1, H - COUNTER_TOP - 1, front);
    p.rect(0, 0, W - 1, 4, trim);
    p.rect(0, 0, W - 1, 0, shade(trim, 1.2));
    p.rect(0, 5, W - 1, 5, shade(front, 0.6));
    for (let x = 6; x < W - 6; x += 39) {
      p.rect(x, 10, x + 32, 36, shade(front, 0.82));
      p.rect(x, 10, x + 32, 10, shade(front, 0.6));
      p.rect(x, 36, x + 32, 36, shade(front, 1.15));
      p.rect(x, 10, x, 36, shade(front, 0.6));
      p.rect(x + 32, 10, x + 32, 36, shade(front, 1.15));
    }
  });
}

/** A hanging lamp from the ceiling beam, with its glow on the wall. */
function lamp(c, x, drop) {
  c.disc(x, drop + 6, 14, alpha(GOLD_H, 34));
  c.disc(x, drop + 6, 8, alpha(GOLD_H, 46));
  c.line(x, 6, x, drop, INK);
  prop(c, x - 6, drop, 13, 10, (p) => {
    p.rect(1, 2, 11, 5, GOLD);
    p.rect(3, 0, 9, 1, GOLD);
    p.rect(0, 5, 12, 6, GOLD);
    p.rect(2, 2, 4, 4, GOLD_H);
    p.rect(4, 7, 8, 9, GOLD_H);
  });
}

// --- props ----------------------------------------------------------------------------

/** A jar: glass with a coloured fill and a lid. */
function jar(c, x, y, fill, lid = RED) {
  prop(c, x, y, 9, 12, (p) => {
    p.rect(1, 0, 7, 2, lid);
    p.rect(1, 0, 7, 0, shade(lid, 1.25));
    p.rect(0, 3, 8, 11, GLASS);
    p.rect(1, 5, 7, 10, fill);
    p.rect(1, 5, 7, 5, shade(fill, 1.25));
    p.rect(1, 4, 1, 9, WHITE);
  });
}

/** A tin can with a label band. */
function tin(c, x, y, body, label) {
  prop(c, x, y, 9, 10, (p) => {
    p.rect(0, 0, 8, 9, body);
    p.rect(0, 0, 8, 1, shade(body, 1.3));
    p.rect(0, 3, 8, 6, label);
    p.rect(1, 1, 1, 8, shade(body, 1.2));
  });
}

/** A small fish silhouette, facing right, used on signs and trophies. */
function fish(p, x, y, len, body, belly) {
  for (let i = 0; i <= len; i++) {
    const half = Math.round(1 + Math.sin((i / len) * Math.PI) * (len / 5));
    p.rect(x + i, y - half, x + i, y + half, body);
    if (belly) p.rect(x + i, y + 1, x + i, y + half, belly);
  }
  for (let i = 0; i < Math.ceil(len / 4); i++) p.rect(x - 1 - i, y - i - 1, x - 1 - i, y + i + 1, body);
  p.put(x + len - 2, y - 1, INK);
}

// --- shopkeepers: 30x46, head, shoulders, and arms resting on the counter --------------

/**
 * `hair` covers the top of the head; `hat` draws over it; `beard` covers the jaw; `shirt`
 * is the sleeves and body, `apron` its front panel; `extra` draws last (before the rim).
 */
function keeper(name, { skin, hair, shirt, apron, hat, beard, extra }) {
  const c = canvas(KEEPER_W, KEEPER_H);
  const { rect, put } = c;
  const skinD = shade(skin, 0.82);

  // Body and sleeves, then hands flat on the counter.
  rect(5, 28, 24, 45, shirt);
  rect(3, 30, 26, 45, shirt);
  rect(6, 27, 23, 27, shirt);
  rect(3, 30, 4, 45, shade(shirt, 0.8));
  rect(25, 30, 26, 45, shade(shirt, 0.8));
  rect(7, 31, 7, 45, shade(shirt, 0.8));
  rect(22, 31, 22, 45, shade(shirt, 0.8));
  rect(1, 42, 7, 45, skin);
  rect(22, 42, 28, 45, skin);
  rect(1, 42, 7, 42, skinD);
  rect(22, 42, 28, 42, skinD);
  if (apron) {
    rect(9, 32, 20, 45, apron);
    rect(10, 33, 19, 33, shade(apron, 1.15));
    rect(9, 27, 10, 31, apron);
    rect(19, 27, 20, 31, apron);
    rect(12, 38, 17, 41, shade(apron, 0.82));
  }

  // Neck and head.
  rect(12, 23, 17, 27, skinD);
  rect(8, 8, 21, 23, skin);
  rect(9, 7, 20, 24, skin);
  rect(7, 13, 7, 17, skinD);
  rect(22, 13, 22, 17, skinD);
  rect(9, 21, 20, 24, skinD);
  rect(10, 20, 19, 23, skin);
  // Eyes, brows, cheeks, and a small smile.
  rect(11, 14, 12, 16, INK);
  rect(17, 14, 18, 16, INK);
  put(11, 14, WHITE);
  put(17, 14, WHITE);
  rect(10, 12, 12, 12, shade(skin, 0.6));
  rect(17, 12, 19, 12, shade(skin, 0.6));
  rect(9, 18, 10, 18, alpha(RED_H, 140));
  rect(19, 18, 20, 18, alpha(RED_H, 140));
  rect(13, 20, 16, 20, shade(skin, 0.55));
  put(12, 19, shade(skin, 0.55));
  put(17, 19, shade(skin, 0.55));

  if (hair) hair(c);
  if (beard) beard(c);
  if (hat) hat(c);
  if (extra) extra(c);
  c.rim();
  c.write(name);
}

// --- the tackle shop --------------------------------------------------------------------

{
  const c = canvas(W, H);
  wall(c, WOOD_M, 11);
  seaWindow(c, 94, 14, 52, 40);
  lamp(c, 48, 18);
  lamp(c, 192, 18);

  // A trophy fish on a plaque above the window.
  prop(c, 104, 4, 32, 9, (p) => {
    p.rect(0, 0, 31, 8, WOOD_L);
    p.rect(0, 0, 31, 0, WOOD_H);
    fish(p, 8, 4, 18, STEEL, STEEL_L);
  });

  // A hanging net, top-left, with two floats.
  // It sags from the beam: a diamond mesh inside a curve, its knots picked out.
  for (let y = 11; y <= 42; y++) {
    for (let x = 8; x <= 40; x++) {
      if (y > 42 - Math.abs(x - 24) * 0.9 || (x + y) % 5 && (x - y + 40) % 5) continue;
      c.put(x, y, (x + y) % 5 || (x - y + 40) % 5 ? hex('#b8a46a') : hex('#e0cc8a'));
    }
  }
  c.line(8, 10, 40, 10, WOOD_D);
  for (const [x, y] of [[14, 30], [32, 24]]) prop(c, x - 3, y - 3, 7, 7, (p) => {
    p.disc(3, 3, 3, RED);
    p.rect(0, 3, 6, 3, WHITE);
  });

  // A rod rack, top-right: three rods leaning on a peg board.
  prop(c, 200, 8, 34, 6, (p) => {
    p.rect(0, 0, 33, 5, WOOD_L);
    p.rect(0, 0, 33, 0, WOOD_H);
    for (const x of [6, 16, 26]) p.rect(x, 2, x + 1, 3, WOOD_D);
  });
  for (const [x, col] of [[206, RED], [216, GOLD], [226, SEA]]) {
    c.line(x, 14, x - 3, 48, WOOD_D);
    c.line(x + 1, 14, x - 2, 48, WOOD_H);
    c.rect(x - 3, 38, x - 1, 44, col);
    c.put(x - 5, 41, STEEL);
    c.rect(x - 6, 40, x - 5, 42, STEEL_D);
  }

  for (const side of ['left', 'right']) for (const top of Object.values(BOARD_TOP)) board(c, ...SHELF_X[side], top);

  // Fixed goods at the boards' ends, clear of the item slots.
  jar(c, 9, BOARD_TOP.A - 12, hex('#e86890'));
  tin(c, 78, BOARD_TOP.A - 10, RED, CREAM);
  tin(c, 153, BOARD_TOP.A - 10, SEA, CREAM);
  jar(c, 222, BOARD_TOP.A - 12, GREEN_L, GOLD);
  tin(c, 9, BOARD_TOP.B - 10, GOLD, RED_D);
  jar(c, 78, BOARD_TOP.B - 12, ORANGE, SEA_D);
  jar(c, 153, BOARD_TOP.B - 12, hex('#c5b6df'));
  tin(c, 223, BOARD_TOP.B - 10, GREEN, CREAM);

  // A row of lures hanging under the lower shelves.
  const lure = [RED_H, GOLD_H, GREEN_L, hex('#e86890'), SKY];
  for (let i = 0; i < 10; i++) {
    const x = (i < 5 ? 18 : 162) + (i % 5) * 14;
    c.line(x, 108, x, 110, STEEL_D);
    prop(c, x - 2, 110, 5, 6, (p) => {
      p.rect(0, 0, 4, 3, lure[i % 5]);
      p.rect(1, 4, 3, 4, STEEL);
      p.put(3, 5, STEEL);
    });
  }

  counter(c, WOOD_M, WOOD_L);
  // A tackle box and a coil of line on the counter's ends.
  prop(c, 14, 108, 26, 12, (p) => {
    p.rect(0, 2, 25, 11, RED);
    p.rect(0, 2, 25, 3, RED_H);
    p.rect(0, 7, 25, 7, RED_D);
    p.rect(10, 0, 15, 2, STEEL_D);
    p.rect(11, 5, 14, 8, GOLD);
  });
  prop(c, 204, 110, 18, 10, (p) => {
    p.disc(8.5, 5, 5, hex('#8fd3c0'));
    p.disc(8.5, 5, 2, WOOD_D);
    p.rect(0, 8, 17, 9, WOOD_D);
  });
  c.write('tackle-shop.png');

  // An old salt with a cap and a white beard.
  keeper('tackle-keeper.png', {
    skin: hex('#e8b08a'),
    shirt: hex('#4a6fa5'),
    apron: hex('#8a6a44'),
    hair: (k) => {
      k.rect(7, 10, 8, 16, hex('#d8d8d8'));
      k.rect(21, 10, 22, 16, hex('#d8d8d8'));
    },
    beard: (k) => {
      k.rect(8, 18, 21, 25, hex('#e8e8ee'));
      k.rect(10, 26, 19, 27, hex('#e8e8ee'));
      k.rect(12, 28, 17, 28, hex('#e8e8ee'));
      k.rect(11, 19, 18, 19, hex('#c8c8d0'));
      k.rect(13, 21, 16, 21, shade(hex('#e8b08a'), 0.55));
    },
    hat: (k) => {
      const cap = hex('#3d4f8a');
      k.rect(7, 4, 22, 10, cap);
      k.rect(9, 2, 20, 3, cap);
      k.rect(5, 10, 24, 11, shade(cap, 0.7));
      k.rect(9, 4, 20, 4, shade(cap, 1.3));
      k.rect(13, 6, 16, 8, GOLD_H);
    },
  });
}

// --- the bait shop ----------------------------------------------------------------------

/**
 * The bait shop's empty aquarium sits on the counter, right, in place of the lower
 * right shelf; the sign hangs on the counter front below it. Both rects are printed.
 */
const TANK = { x: 172, y: 86, w: 64, h: 33 };
const SIGN = { x: 178, y: 126, w: 52, h: 24 };

{
  const c = canvas(W, H);
  const TEAL = hex('#3f8f86');
  wall(c, TEAL, 23);
  seaWindow(c, 94, 14, 52, 40);
  lamp(c, 48, 18);
  lamp(c, 192, 18);

  // A painted sign board over the window: a worm on a hook.
  prop(c, 102, 3, 36, 10, (p) => {
    p.rect(0, 0, 35, 9, CREAM);
    p.rect(0, 0, 35, 0, WHITE);
    p.rect(0, 9, 35, 9, CREAM_D);
    p.line(9, 2, 9, 6, STEEL_D);
    p.line(9, 6, 12, 7, STEEL_D);
    p.put(12, 6, STEEL_D);
    for (let i = 0; i < 12; i++) p.put(15 + i, 5 + Math.round(Math.sin(i * 0.9)), hex('#e86890'));
  });

  // Strings of dried bait hanging top-left; a bucket of worms top-right on a hook.
  for (const x of [14, 26, 38]) {
    c.line(x, 6, x, 16, WOOD_D);
    for (let k = 0; k < 3; k++) prop(c, x - 3, 16 + k * 8, 7, 6, (p) => fish(p, 2, 3, 4, hex('#c8a060'), null));
  }
  prop(c, 198, 12, 26, 26, (p) => {
    for (let x = 3; x <= 22; x++) p.put(x, 6 - Math.round(Math.sqrt(Math.max(0, 90 - (x - 12.5) ** 2)) * 0.6), STEEL_D);
    p.rect(3, 6, 22, 24, hex('#b64336'));
    p.rect(3, 6, 22, 8, hex('#e86838'));
    p.rect(3, 14, 22, 15, RED_D);
    p.rect(5, 9, 6, 22, hex('#ff9148'));
    for (const [x, y] of [[8, 5], [12, 4], [16, 5], [19, 4]]) p.rect(x, y, x + 1, y + 1, hex('#e86890'));
  });

  board(c, ...SHELF_X.left, BOARD_TOP.A);
  board(c, ...SHELF_X.left, BOARD_TOP.B);
  board(c, ...SHELF_X.right, BOARD_TOP.A);

  jar(c, 9, BOARD_TOP.A - 12, hex('#e86890'), GREEN);
  jar(c, 78, BOARD_TOP.A - 12, hex('#c8a060'), RED);
  jar(c, 153, BOARD_TOP.A - 12, GREEN_L, SEA_D);
  jar(c, 222, BOARD_TOP.A - 12, ORANGE, GREEN);
  tin(c, 9, BOARD_TOP.B - 10, GREEN, CREAM);
  jar(c, 52, BOARD_TOP.B - 12, hex('#c5b6df'), GOLD);

  // A cooler under the lower left shelf.
  prop(c, 18, 104, 30, 15, (p) => {
    p.rect(0, 0, 29, 14, WHITE);
    p.rect(0, 0, 29, 3, SKY);
    p.rect(0, 4, 29, 4, STEEL);
    p.rect(12, 7, 17, 9, SEA);
  });

  // The aquarium: dark frame, empty water, sand, a rock and a weed. No fish.
  prop(c, TANK.x, TANK.y, TANK.w, TANK.h, (p) => {
    const { w, h } = TANK;
    p.rect(0, 0, w - 1, h - 1, STEEL_D);
    p.rect(2, 3, w - 3, h - 5, hex('#5fb8d8'));
    p.rect(2, 3, w - 3, 5, hex('#9fdcec'));
    p.rect(2, 6, w - 3, 6, FOAM);
    p.rect(2, h - 9, w - 3, h - 5, hex('#e8cf8a'));
    p.rect(2, h - 9, w - 3, h - 9, hex('#f5e2a8'));
    for (let x = 4; x < w - 3; x += 5) p.put(x, h - 7, hex('#c9a860'));
    p.disc(13, h - 10, 4, STEEL);
    p.rect(10, h - 14, 13, h - 13, STEEL_L);
    for (let y = h - 9; y > 10; y -= 1) p.put(w - 12 + Math.round(Math.sin(y * 0.5) * 1.5), y, GREEN);
    for (let y = h - 9; y > 16; y -= 1) p.put(w - 8 + Math.round(Math.cos(y * 0.5) * 1.2), y, GREEN_L);
    for (const [x, y] of [[30, 20], [32, 14], [29, 10]]) p.put(x, y, FOAM);
    // A glint on the glass, the lid and the stand.
    p.line(5, 9, 9, 9, alpha(WHITE, 180));
    p.line(5, 10, 7, 10, alpha(WHITE, 180));
    p.rect(0, 0, w - 1, 2, STEEL);
    p.rect(0, 0, w - 1, 0, STEEL_L);
    p.rect(0, h - 4, w - 1, h - 1, WOOD_D);
    p.rect(0, h - 4, w - 1, h - 4, WOOD_L);
  });

  counter(c, hex('#2f6f6a'), WOOD_L);

  // The sign hanging on the counter front: blank, the UI writes the family and the x2.
  c.line(SIGN.x + 8, COUNTER_TOP + 5, SIGN.x + 8, SIGN.y, WOOD_D);
  c.line(SIGN.x + SIGN.w - 9, COUNTER_TOP + 5, SIGN.x + SIGN.w - 9, SIGN.y, WOOD_D);
  prop(c, SIGN.x, SIGN.y, SIGN.w, SIGN.h, (p) => {
    const { w, h } = SIGN;
    p.rect(0, 0, w - 1, h - 1, CREAM);
    p.rect(1, 1, w - 2, 1, WHITE);
    p.rect(0, h - 2, w - 1, h - 1, CREAM_D);
    p.rect(2, 3, 2, h - 4, alpha(GOLD, 120));
    p.rect(w - 3, 3, w - 3, h - 4, alpha(GOLD, 120));
  });
  c.put(SIGN.x + 8, SIGN.y + 2, INK);
  c.put(SIGN.x + SIGN.w - 9, SIGN.y + 2, INK);

  // A tray of worm cups on the counter, left.
  prop(c, 20, 109, 34, 10, (p) => {
    p.rect(0, 4, 33, 9, WOOD_L);
    p.rect(0, 4, 33, 4, WOOD_H);
    for (const x of [2, 12, 22]) {
      p.rect(x, 0, x + 8, 5, WHITE);
      p.rect(x + 1, 0, x + 7, 1, hex('#6a4a30'));
      p.put(x + 3, 0, hex('#e86890'));
      p.put(x + 5, 1, hex('#e86890'));
    }
  });
  c.write('bait-shop.png');

  // A cheerful bait seller: red bandana, braid, rubber apron.
  keeper('bait-keeper.png', {
    skin: hex('#c98a62'),
    shirt: hex('#e8d9b0'),
    apron: hex('#3c9a46'),
    hair: (k) => {
      const h = hex('#5a3626');
      k.rect(7, 7, 22, 12, h);
      k.rect(7, 12, 8, 20, h);
      k.rect(21, 12, 22, 18, h);
      k.rect(6, 12, 8, 26, h);
      k.rect(21, 12, 23, 26, h);
      k.rect(22, 14, 22, 24, shade(h, 1.3));
    },
    hat: (k) => {
      k.rect(8, 4, 21, 9, RED);
      k.rect(10, 3, 19, 3, RED);
      k.rect(8, 9, 21, 9, RED_D);
      for (const [x, y] of [[11, 5], [15, 7], [19, 5]]) k.put(x, y, WHITE);
      k.rect(4, 6, 7, 7, RED);
      k.rect(3, 8, 5, 9, RED);
    },
  });
}

// --- the cafe -----------------------------------------------------------------------

{
  const c = canvas(W, H);
  const PAPER = hex('#f0d6a8');
  wall(c, PAPER, 37);
  // Wainscot: a darker lower band with a rail.
  c.rect(0, 74, W - 1, COUNTER_TOP, shade(hex('#a8704a'), 0.95));
  for (let x = 0; x < W; x += 6) c.line(x, 76, x, COUNTER_TOP, shade(hex('#a8704a'), 0.8));
  c.rect(0, 72, W - 1, 75, WOOD_L);
  c.rect(0, 72, W - 1, 72, WOOD_H);
  c.rect(0, 75, W - 1, 75, WOOD_D);

  // A menu chalkboard behind the barista: blank lines the UI can write over.
  prop(c, 92, 12, 56, 42, (p) => {
    p.rect(0, 0, 55, 41, WOOD_L);
    p.rect(0, 0, 55, 0, WOOD_H);
    p.rect(3, 3, 52, 38, hex('#2f3d3a'));
    p.rect(3, 3, 52, 4, hex('#3d4d49'));
    for (let y = 12; y < 36; y += 7) {
      p.line(8, y, 32, y, alpha(WHITE, 110));
      p.line(40, y, 47, y, alpha(GOLD_H, 140));
    }
    // A chalk cup drawing in the corner.
    p.rect(8, 6, 13, 9, alpha(WHITE, 160));
    p.put(14, 7, alpha(WHITE, 160));
    p.put(10, 5, alpha(WHITE, 110));
    p.rect(6, 39, 49, 40, WOOD_M);
    p.rect(14, 38, 17, 38, WHITE);
  });

  // Bunting across the top.
  const flags = [RED, GOLD_H, SKY, GREEN_L];
  for (let i = 0, x = 4; x < W - 6; i++, x += 12) {
    if (x > 84 && x < 152) continue;
    const sag = Math.round(Math.sin(((x % 80) / 80) * Math.PI) * 3);
    c.line(x, 8 + sag, x + 12, 8 + sag, INK);
    prop(c, x + 2, 9 + sag, 8, 7, (p) => {
      for (let r = 0; r < 6; r++) p.rect(r / 2, r, 7 - r / 2, r, flags[i % 4]);
    });
  }
  lamp(c, 48, 22);
  lamp(c, 192, 22);

  for (const side of ['left', 'right']) for (const top of Object.values(BOARD_TOP)) board(c, ...SHELF_X[side], top);

  // Stacked cups and a teapot at the board ends.
  const cup = (x, y, col) =>
    prop(c, x, y, 9, 7, (p) => {
      p.rect(0, 0, 6, 6, col);
      p.rect(0, 0, 6, 0, shade(col, 1.2));
      p.rect(7, 2, 8, 4, col);
      p.rect(1, 1, 5, 1, hex('#6a4a30'));
    });
  cup(10, BOARD_TOP.A - 7, WHITE);
  cup(10, BOARD_TOP.A - 13, hex('#ffa074'));
  cup(78, BOARD_TOP.A - 7, SKY);
  cup(153, BOARD_TOP.A - 7, hex('#ffa074'));
  cup(222, BOARD_TOP.A - 7, WHITE);
  cup(222, BOARD_TOP.A - 13, SKY);
  jar(c, 9, BOARD_TOP.B - 12, hex('#6a4a30'), RED);
  jar(c, 52, BOARD_TOP.B - 12, hex('#e8d9b0'), GOLD);
  prop(c, 186, BOARD_TOP.B - 11, 13, 11, (p) => {
    p.disc(6, 6, 4.5, hex('#e86838'));
    p.rect(4, 0, 8, 1, hex('#e86838'));
    p.line(10, 4, 12, 2, hex('#e86838'));
    p.rect(4, 4, 5, 5, ORANGE);
  });
  jar(c, 222, BOARD_TOP.B - 12, hex('#e86890'), GREEN);

  // A plant, an espresso machine and a cake dome along the counter, clear of the two items on it by the barista (`COUNTER_SLOTS`).
  prop(c, 8, 100, 22, 19, (p) => {
    p.rect(6, 11, 15, 18, hex('#b64336'));
    p.rect(6, 11, 15, 12, hex('#e86838'));
    for (const [x, y, r] of [[10.5, 6, 4.5], [5.5, 8, 3.5], [15.5, 7, 4], [10.5, 3, 3]]) p.disc(x, y, r, GREEN);
    for (const [x, y] of [[9, 4], [14, 5], [5, 7], [10, 1]]) p.rect(x, y, x + 1, y, GREEN_L);
    p.rect(9, 9, 11, 9, GREEN_D);
  });
  // The espresso machine: a red body, chrome top, group head, and a cup under it.
  prop(c, 38, 99, 30, 20, (p) => {
    p.rect(1, 0, 28, 4, STEEL);
    p.rect(1, 0, 28, 0, STEEL_L);
    p.rect(3, 5, 26, 16, RED);
    p.rect(3, 5, 26, 5, RED_H);
    p.rect(3, 5, 4, 16, RED_H);
    p.rect(20, 7, 24, 10, STEEL_L);
    p.put(22, 8, INK);
    p.rect(8, 6, 15, 8, STEEL);
    p.rect(10, 9, 13, 10, STEEL_D);
    p.rect(9, 13, 14, 16, WHITE);
    p.rect(15, 14, 15, 15, WHITE);
    p.rect(0, 17, 29, 19, STEEL_D);
    p.rect(0, 17, 29, 17, STEEL);
  });
  c.line(48, 110, 47, 107, alpha(WHITE, 160));
  c.line(50, 109, 51, 106, alpha(WHITE, 120));
  prop(c, 174, 98, 26, 21, (p) => {
    p.rect(1, 17, 24, 20, WHITE);
    p.rect(0, 19, 25, 20, STEEL);
    p.rect(5, 10, 20, 16, hex('#ffa074'));
    p.rect(5, 10, 20, 11, hex('#fbe7e8'));
    p.rect(5, 13, 20, 13, hex('#fbe7e8'));
    p.rect(11, 7, 12, 9, RED);
    for (let y = 2; y <= 17; y++) {
      const half = Math.round(Math.sqrt(Math.max(0, 130 - (17 - y) ** 2 * 0.45)));
      p.put(12.5 - half, y, alpha(GLASS, 200));
      p.put(12.5 + half, y, alpha(GLASS, 200));
    }
    p.rect(6, 1, 19, 1, alpha(GLASS, 200));
    p.rect(11, 0, 14, 0, STEEL_D);
    p.line(7, 4, 7, 8, alpha(WHITE, 220));
  });
  // A tip jar on the right of the counter.
  jar(c, 210, 106, GOLD_H, WOOD_D);

  counter(c, hex('#6a4a30'), hex('#d4bf8e'));
  c.write('cafe.png');

  // The barista: tidy bun, glasses, striped shirt, brown apron. Clickable in the UI.
  keeper('cafe-keeper.png', {
    skin: hex('#f0c8a0'),
    shirt: hex('#f3fbfb'),
    apron: hex('#87553a'),
    hair: (k) => {
      const h = hex('#2e2a3a');
      k.rect(7, 6, 22, 11, h);
      k.rect(7, 11, 8, 17, h);
      k.rect(21, 11, 22, 17, h);
      k.disc(14.5, 3, 3.5, h);
      k.rect(10, 7, 14, 7, shade(h, 1.6));
    },
    extra: (k) => {
      for (const y of [33, 37, 41]) {
        k.rect(3, y, 7, y, hex('#c43c32'));
        k.rect(22, y, 26, y, hex('#c43c32'));
      }
      for (const x0 of [10, 16]) {
        k.rect(x0, 13, x0 + 3, 13, INK);
        k.rect(x0, 16, x0 + 3, 16, INK);
        k.rect(x0, 13, x0, 16, INK);
        k.rect(x0 + 3, 13, x0 + 3, 16, INK);
      }
      k.put(14, 14, INK);
      k.put(15, 14, INK);
    },
  });
}

// --- map nodes: a 40x40 storefront per store, drawn 1:1 in map units -----------------

/** A little shop on a pier: roof, striped awning, a door, two windows, and the store's sign. */
function storeNode(name, { roof, stripe, wall: wallC, sign }) {
  const c = canvas(40, 40);
  const { rect, line, put } = c;
  rect(0, 36, 39, 39, SEA_D);
  put(6, 37, SEA);
  put(30, 38, SEA);
  rect(1, 34, 38, 35, WOOD_M);
  line(1, 34, 38, 34, WOOD_L);
  rect(4, 12, 35, 33, wallC);
  for (let x = 4; x < 36; x += 4) line(x, 20, x, 33, shade(wallC, 0.9));
  for (let y = 0; y < 8; y++) rect(4 - Math.max(0, 2 - y), 4 + y, 35 + Math.max(0, 2 - y), 4 + y, y === 0 ? shade(roof, 1.2) : roof);
  rect(4, 11, 35, 11, shade(roof, 0.7));
  for (let x = 3; x <= 36; x++) rect(x, 14, x, 18, Math.floor((x - 3) / 4) % 2 ? CREAM : stripe);
  for (let x = 3; x <= 36; x += 4) rect(x, 19, x + 1, 19, Math.floor((x - 3) / 4) % 2 ? CREAM_D : shade(stripe, 0.8));
  // Door, and two windows with something in them.
  rect(17, 23, 22, 33, WOOD_M);
  rect(17, 23, 22, 23, WOOD_H);
  put(21, 28, GOLD_H);
  for (const x of [7, 26]) {
    rect(x, 23, x + 6, 29, SKY);
    rect(x, 23, x + 6, 23, SKY_L);
    rect(x + 3, 23, x + 3, 29, WOOD_L);
    rect(x - 1, 30, x + 7, 30, WOOD_L);
  }
  // The sign board on the roof.
  rect(13, 0, 26, 7, CREAM);
  rect(13, 0, 26, 0, WHITE);
  sign(c);
  c.rim();
  c.write(name);
}

storeNode('cafe-node.png', {
  roof: hex('#6a4a30'),
  stripe: ORANGE,
  wall: hex('#f0d6a8'),
  sign: (c) => {
    c.rect(17, 2, 21, 5, RED);
    c.rect(22, 3, 23, 4, RED);
    c.put(18, 1, alpha(STEEL, 200));
  },
});
storeNode('tackle-node.png', {
  roof: RED_D,
  stripe: RED,
  wall: hex('#a8704a'),
  sign: (c) => fish(c, 17, 3, 6, STEEL, null),
});
storeNode('bait-node.png', {
  roof: hex('#2f6f6a'),
  stripe: GREEN,
  wall: hex('#3f8f86'),
  sign: (c) => {
    for (let i = 0; i < 9; i++) c.put(15 + i, 3 + Math.round(Math.sin(i * 0.9)), hex('#e86890'));
    c.put(24, 3, INK);
  },
});

// --- item icons: 16x16 art drawn x4, in the icon set's style (ui/assets/icons) --------

{
  const c = canvas(16, 16);
  const { rect, put } = c;
  const VEST = hex('#ff9148');
  const VEST_D = hex('#e86838');
  // An orange life jacket: two front panels, a collar gap, reflective bands and a buckle.
  rect(3, 3, 6, 6, VEST);
  rect(9, 3, 12, 6, VEST);
  rect(2, 5, 6, 6, VEST);
  rect(9, 5, 13, 6, VEST);
  rect(2, 7, 13, 14, VEST);
  rect(5, 2, 6, 2, VEST);
  rect(9, 2, 10, 2, VEST);
  rect(7, 7, 8, 14, VEST_D);
  rect(2, 9, 13, 9, WHITE);
  rect(2, 12, 13, 12, WHITE);
  rect(7, 9, 8, 9, STEEL);
  rect(7, 12, 8, 12, STEEL);
  rect(3, 5, 3, 8, hex('#ffc890'));
  put(10, 5, hex('#ffc890'));
  c.rim();
  c.write('life-jacket.png', 4, 'src/ui/assets/icons');
}

{
  const c = canvas(16, 16);
  const { rect, line } = c;
  const BOX = hex('#c98d5c');
  const BOX_D = hex('#a8704a');
  // A parcel tied with string, with an address label.
  rect(1, 4, 14, 14, BOX);
  rect(1, 4, 14, 5, hex('#e0aa78'));
  rect(1, 10, 14, 14, BOX_D);
  line(7, 4, 7, 14, CREAM);
  line(1, 8, 14, 8, CREAM);
  rect(6, 2, 6, 4, CREAM);
  rect(8, 2, 8, 4, CREAM);
  rect(9, 10, 12, 12, WHITE);
  line(10, 11, 11, 11, SEA_D);
  c.rim();
  c.write('parcel.png', 4, 'src/ui/assets/icons');
}

{
  // The scissors, for the Tackle shop's Remove a card: drawn 64x64 directly.
  const c = canvas(64, 64);
  const { put, line, rect } = c;
  const BLADE = hex('#c9c6d8');
  const BLADE_D = hex('#8f8ca8');

  // Two blades from the pivot (30, 34) up to their tips, tapering.
  for (const tip of [[14, 10], [46, 10]]) {
    const [x0, y0] = [30, 34];
    for (let i = 0; i <= 34; i++) {
      const x = x0 + ((tip[0] - x0) * i) / 34;
      const y = y0 + ((tip[1] - y0) * i) / 34;
      const width = Math.round(3 - (i / 34) * 1.5);
      for (let w = 0; w <= width; w++) {
        const isUpper = tip[0] < x0 ? w === width : w === 0;
        put(x + w, y, isUpper ? BLADE_D : BLADE);
      }
    }
  }
  // The pivot screw, and the shafts down to the handles.
  rect(27, 31, 33, 37, INK);
  rect(30, 32, 32, 34, hex('#f5d76e'));
  line(30, 34, 21, 43, INK);
  line(30, 34, 39, 43, INK);
  line(30, 35, 22, 44, BLADE_D);
  line(30, 35, 38, 44, BLADE_D);
  // A ring handle at each shaft's end, shaded underneath.
  for (const [cx, cy] of [[19, 50], [41, 50]]) {
    for (let y = cy - 8; y <= cy + 8; y++) {
      for (let x = cx - 8; x <= cx + 8; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 7.5 || d < 4.5) continue;
        put(x, y, y > cy + 1 ? hex('#821621') : hex('#c74338'));
      }
    }
  }
  c.rim();
  c.write('scissors.png', 1, 'src/ui/assets/icons');
}

console.log(`  Counter top y=${COUNTER_TOP}; keeper sprite ${KEEPER_W}x${KEEPER_H} at (${KEEPER_AT.x}, ${KEEPER_AT.y}).`);
console.log(`  Slots: x ${[...SLOT_X.left, ...SLOT_X.right].join(', ')} on boards y=${BOARD_TOP.A} and y=${BOARD_TOP.B} (bait shop: no lower right board).`);
console.log(`  Cafe items on the counter at x ${COUNTER_SLOTS.join(', ')}.`);
console.log(`  Bait shop tank ${JSON.stringify(TANK)}, sign ${JSON.stringify(SIGN)}.`);
