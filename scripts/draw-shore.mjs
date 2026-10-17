// Draws the fight scene in pixel art, repeated at the sprites' scale (see CombatView.vue):
// - the land side's ground, one 64x64 tile per shore look (`.land`);
// - the water side's bottom, a 64x24 strip per bed (`.bed`), and the far shapes behind the
//   creatures, a 128x48 strip per backdrop (`.backdrop`), both see-through above their outline;
// - a small school of distant fish (`.school`).
//
//   node scripts/draw-shore.mjs   (or: npm run shore)
//
// Output: src/ui/assets/shore/*.png. Everything is seeded and wraps sideways (the ground tiles
// also up and down), so re-running gives the same images and the repeats don't show seams.

import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const OUT = 'src/ui/assets/shore';
const TILE = 64;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in [0, 1) that wraps at the tile's edges; `cell` must divide TILE. */
function noise(seed, cell) {
  const rand = rng(seed);
  const size = TILE / cell;
  const grid = Array.from({ length: size * size }, rand);
  const at = (x, y) => grid[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

const wrap = (v) => ((v % TILE) + TILE) % TILE;

/** Small hand-drawn shapes stamped over a painter: X = colour, o = shade, . = see-through. */
function stamps(seed, count, shapes) {
  const r = rng(seed);
  const placed = Array.from({ length: count }, () => ({ x: Math.floor(r() * TILE), y: Math.floor(r() * TILE), shape: shapes[Math.floor(r() * shapes.length)] }));
  return (x, y) => {
    for (const { x: sx, y: sy, shape } of placed) {
      const px = shape.rows[wrap(y - sy)]?.[wrap(x - sx)];
      if (px === 'X') return shape.X;
      if (px === 'o') return shape.o;
    }
    return undefined;
  };
}

const TUFT = ['X...X', '.X.X.', 'oXoXo'];
const BLADE = ['.X.', 'XoX'];
const FLOWER = ['.X.', 'XoX', '.X.'];
const PEBBLE = ['.XX.', 'XXXo', '.oo.'];
const SHELL = ['.XXX.', 'XoXoX', '.ooo.'];
const STAR = ['..X..', 'XXoXX', '.XoX.', '.X.X.'];
const REED = ['X..', 'X.X', 'XoX', 'oXo'];

// --- one painter per look: (x, y) -> '#rrggbb' -----------------------------------

const PAINTERS = {
  /** Stream, pond, lake, river: short grass in patches, tufts and a few flowers. */
  grass(seed) {
    const n = noise(seed, 16);
    const fine = noise(seed + 1, 4);
    const r = rng(seed + 2);
    const over = stamps(seed + 3, 22, [
      { rows: TUFT, X: '#86bf5e', o: '#4a8239' },
      { rows: TUFT, X: '#7ab454', o: '#457a35' },
      { rows: BLADE, X: '#94c96a', o: '#4f8a3d' },
      { rows: FLOWER, X: '#f4f0e2', o: '#f2cf5b' },
      { rows: PEBBLE, X: '#a7a294', o: '#77735f' },
    ]);
    return (x, y) => {
      const s = over(x, y);
      if (s) return s;
      const v = n(x, y) * 0.7 + fine(x, y) * 0.3;
      if (r() < 0.04) return '#6ea852';
      return v > 0.58 ? '#64a14d' : v > 0.4 ? '#5a9746' : '#518b40';
    };
  },
  /** Beach: rippled dry sand, grains, shells and the odd starfish. */
  beach(seed) {
    const n = noise(seed, 16);
    const r = rng(seed + 2);
    const over = stamps(seed + 3, 5, [
      { rows: SHELL, X: '#f3e9d4', o: '#cbbfa6' },
      { rows: SHELL, X: '#e9b1a8', o: '#c08374' },
      { rows: STAR, X: '#f08a3c', o: '#c25e1f' },
      { rows: PEBBLE, X: '#bfb6a0', o: '#8f8672' },
    ]);
    return (x, y) => {
      const s = over(x, y);
      if (s) return s;
      const ripple = wrap(y + Math.round(Math.sin((x / TILE) * Math.PI * 4) * 2)) % 8 === 0;
      const g = r();
      if (g < 0.025) return '#cdb27a';
      if (g < 0.04) return '#efe0b4';
      if (ripple) return '#d6bd84';
      return n(x, y) > 0.5 ? '#e6d29f' : '#dfc993';
    };
  },
  /** Rock pools, cliffs: flat stones of different sizes with dark cracks, moss and barnacles. */
  rocks(seed) {
    const r = rng(seed);
    const fine = noise(seed + 1, 4);
    // Stones are the cells around scattered centres (wrapping), each with its own tone.
    const stones = Array.from({ length: 14 }, () => ({ x: r() * TILE, y: r() * TILE, tone: r() }));
    const near = (x, y) => {
      let best = { d: Infinity, s: stones[0] };
      let second = Infinity;
      for (const s of stones) {
        const dx = Math.min(Math.abs(x - s.x), TILE - Math.abs(x - s.x));
        const dy = Math.min(Math.abs(y - s.y), TILE - Math.abs(y - s.y));
        const d = Math.hypot(dx, dy);
        if (d < best.d) [second, best] = [best.d, { d, s }];
        else if (d < second) second = d;
      }
      return { stone: best.s, gap: second - best.d };
    };
    const speck = rng(seed + 2);
    return (x, y) => {
      const { stone, gap } = near(x, y);
      if (gap < 1.2) return '#4b5155';
      const g = speck();
      if (gap < 2.4) return near(x - 1, y - 1).stone === stone ? '#6b7175' : '#5a6064';
      if (fine(x, y) > 0.72 && stone.tone < 0.5) return g < 0.5 ? '#6f8a4a' : '#5a763d';
      if (g < 0.015) return '#dcd8cc';
      const lit = near(x + 2, y + 2).stone !== stone;
      const tones = stone.tone > 0.66 ? ['#9aa0a3', '#8a9094'] : stone.tone > 0.33 ? ['#878d91', '#7a8084'] : ['#7c8286', '#6f7579'];
      return lit ? '#6d7377' : fine(x, y) > 0.5 ? tones[1] : tones[0];
    };
  },
  /** Jetty: weathered planks across, with staggered joints and nails. */
  jetty(seed) {
    const r = rng(seed);
    const grain = noise(seed + 1, 4);
    const PLANK = 8;
    const planks = Array.from({ length: TILE / PLANK }, () => ({ joint: Math.floor(r() * TILE), tone: r() }));
    return (x, y) => {
      const p = planks[Math.floor(y / PLANK)];
      const row = y % PLANK;
      if (row === PLANK - 1) return '#3b2817';
      if (wrap(x - p.joint) === 0) return '#4a321d';
      if ((row === 2 || row === 4) && (wrap(x - p.joint) === 2 || wrap(x - p.joint) === TILE - 2)) return '#2c2c30';
      if (row === 0) return '#b08a5a';
      const g = grain(x * 0.5, y * 4);
      const base = p.tone > 0.66 ? ['#9a7448', '#8a663e'] : p.tone > 0.33 ? ['#916c42', '#80603a'] : ['#a37d4f', '#906c44'];
      return g > 0.55 ? base[1] : base[0];
    };
  },
  /** Bay, open sea, deep drop: a scrubbed deck, narrow planks with dark caulking. */
  boat(seed) {
    const r = rng(seed);
    const grain = noise(seed + 1, 4);
    const PLANK = 6;
    const planks = Array.from({ length: TILE / PLANK + 1 }, () => ({ joint: Math.floor(r() * TILE), tone: r() }));
    return (x, y) => {
      const p = planks[Math.floor(y / PLANK)];
      const row = y % PLANK;
      if (row === PLANK - 1 || y === TILE - 1) return '#5b4128';
      if (wrap(x - p.joint) === 0 || wrap(x - p.joint) === 32) return '#7a5a37';
      if (row === 0) return '#e2c48f';
      const g = grain(x * 0.5, y * 4);
      return p.tone > 0.5 ? (g > 0.55 ? '#c8a66f' : '#d3b27b') : g > 0.55 ? '#bf9d66' : '#cbaa73';
    };
  },
  /** Estuary: wet mud with shiny puddles and reed shoots. */
  mud(seed) {
    const n = noise(seed, 8);
    const fine = noise(seed + 1, 4);
    const r = rng(seed + 2);
    const over = stamps(seed + 3, 10, [
      { rows: REED, X: '#8a9a45', o: '#5c6a2c' },
      { rows: BLADE, X: '#7d8d3e', o: '#55622a' },
      { rows: PEBBLE, X: '#8a7a5c', o: '#5d4f37' },
    ]);
    return (x, y) => {
      const v = n(x, y);
      if (v < 0.16) return fine(x, y) > 0.75 ? '#a6ad98' : '#5f6655';
      if (v < 0.19) return '#4a3d29';
      const s = over(x, y);
      if (s) return s;
      if (r() < 0.04) return '#4d3f2a';
      return fine(x, y) > 0.5 ? '#6f5b3d' : '#665336';
    };
  },
  /** Reef: pale coral sand and broken coral. */
  reef(seed) {
    const n = noise(seed, 16);
    const r = rng(seed + 2);
    const over = stamps(seed + 3, 8, [
      { rows: ['X.X', 'XoX', '.o.'], X: '#ef8a7a', o: '#b65a4f' },
      { rows: ['.X.', 'XXo', '.o.'], X: '#f3b25a', o: '#b97a2c' },
      { rows: PEBBLE, X: '#f4ece0', o: '#c9bca8' },
      { rows: SHELL, X: '#fbf3e4', o: '#cbbfa6' },
    ]);
    return (x, y) => {
      const s = over(x, y);
      if (s) return s;
      const g = r();
      if (g < 0.04) return '#c79f86';
      if (g < 0.07) return '#f6e7d6';
      return n(x, y) > 0.5 ? '#e8d3bb' : '#dfc8ae';
    };
  },
};

// --- the water side: (x, y) -> '#rrggbb', or null where it's see-through -------------

const BED = { w: 64, h: 24 };
const BACK = { w: 128, h: 48 };

/** The bed's top edge, in px from the top of the strip: gentle swells that wrap at 64. */
function bedEdge(seed, base, swell) {
  const n = noise(seed, 16);
  return (x) => base + Math.round((n(x, 0) - 0.5) * 2 * swell);
}

const BEDS = {
  /** Lakes, bays, the open sea: soft sand with pebbles and the odd shell. */
  sand(seed) {
    const top = bedEdge(seed, 6, 4);
    const n = noise(seed + 1, 8);
    const r = rng(seed + 2);
    const over = stamps(seed + 3, 6, [
      { rows: PEBBLE, X: '#a99f88', o: '#7d7461' },
      { rows: SHELL, X: '#efe3c8', o: '#bfae8d' },
    ]);
    return (x, y) => {
      const t = top(x);
      if (y < t) return null;
      if (y === t) return '#ead6a0';
      const s = y > t + 2 && over(x, y);
      if (s) return s;
      if (r() < 0.04) return '#b39456';
      const deep = y - t > 12;
      return n(x, y) > 0.5 ? (deep ? '#bf9f62' : '#d4b679') : deep ? '#b39459' : '#c9aa6e';
    };
  },
  /** Ponds, estuaries: soft dark silt with sunk leaves. */
  mud(seed) {
    const top = bedEdge(seed, 7, 3);
    const n = noise(seed + 1, 8);
    const r = rng(seed + 2);
    const over = stamps(seed + 3, 5, [
      { rows: ['XXo', '.oX'], X: '#7a6a35', o: '#57491f' },
      { rows: PEBBLE, X: '#6e6250', o: '#4b412f' },
    ]);
    return (x, y) => {
      const t = top(x);
      if (y < t) return null;
      if (y === t) return '#7d7550';
      const s = y > t + 2 && over(x, y);
      if (s) return s;
      if (r() < 0.05) return '#3f3423';
      return n(x, y) > 0.5 ? '#5e4d34' : '#54442d';
    };
  },
  /** Rock pools, cliffs, streams, rivers: a bed of rounded stones. */
  rock(seed) {
    const r = rng(seed);
    const stones = Array.from({ length: 9 }, (_, i) => ({ x: i * 7 + r() * 5, y: 6 + r() * 10, rx: 4 + r() * 4, ry: 3 + r() * 3, tone: r() }));
    const moss = rng(seed + 1);
    return (x, y) => {
      let hit = null;
      for (const st of stones) {
        const dx = Math.min(Math.abs(x - st.x), BED.w - Math.abs(x - st.x)) / st.rx;
        const dy = (y - st.y) / st.ry;
        if (dx * dx + dy * dy <= 1) hit = { st, edge: dx * dx + dy * dy > 0.7, lit: dy < -0.45 };
      }
      if (hit) {
        if (hit.lit && moss() < 0.25) return '#6f8a4a';
        if (hit.edge) return hit.lit ? '#9aa0a3' : '#4b5155';
        return hit.st.tone > 0.5 ? '#7c8286' : '#6c7276';
      }
      if (y < 12) return null;
      return y > 18 ? '#3f4448' : '#4b5155';
    };
  },
  /** The reef: pale coral sand with rubble in pink and orange. */
  coral(seed) {
    const top = bedEdge(seed, 6, 3);
    const n = noise(seed + 1, 8);
    const r = rng(seed + 2);
    const over = stamps(seed + 3, 8, [
      { rows: ['X.X', 'XoX', '.o.'], X: '#ef8a7a', o: '#b65a4f' },
      { rows: ['.X.', 'XXo'], X: '#f3b25a', o: '#b97a2c' },
      { rows: PEBBLE, X: '#f4ece0', o: '#c9bca8' },
    ]);
    return (x, y) => {
      const t = top(x);
      if (y < t) return null;
      if (y === t) return '#f3e4cd';
      const s = y > t + 1 && over(x, y);
      if (s) return s;
      if (r() < 0.04) return '#c79f86';
      return n(x, y) > 0.5 ? '#e3cdb0' : '#d8bf9f';
    };
  },
  /** The deep drop: black rock with a few glowing specks. */
  deep(seed) {
    const top = bedEdge(seed, 5, 5);
    const n = noise(seed + 1, 8);
    const r = rng(seed + 2);
    return (x, y) => {
      const t = top(x);
      if (y < t) return null;
      if (y === t) return '#3b4a5c';
      const g = r();
      if (g < 0.012) return '#6ff2e0';
      if (g < 0.018) return '#b48cff';
      return n(x, y) > 0.5 ? '#1f2834' : '#19212c';
    };
  },
};

const wrapBack = (v) => ((v % BACK.w) + BACK.w) % BACK.w;
/** Distance from x to a point at `at` on a strip that wraps every BACK.w. */
const across = (x, at) => Math.min(Math.abs(x - at), BACK.w - Math.abs(x - at));
const SHADOW = '#0b1a26';

/** Far shapes in one dark colour; the page fades them into the water. */
const BACKDROPS = {
  /** Salt water: kelp strands of different heights, swaying sideways as they rise. */
  kelp(seed) {
    const r = rng(seed);
    const strands = Array.from({ length: 9 }, (_, i) => ({ x: i * 14 + r() * 8, top: 4 + r() * 26, phase: r() * 6 }));
    return (x, y) => {
      for (const st of strands) {
        if (y < st.top) continue;
        const cx = st.x + Math.sin(y * 0.22 + st.phase) * 2;
        const d = across(x, cx);
        if (d < 1.2) return SHADOW;
        if (d < 3 && Math.round(y + st.phase * 3) % 7 === 0) return SHADOW;
      }
      return null;
    };
  },
  /** Fresh water: straight reed stalks, some with a seed head. */
  reeds(seed) {
    const r = rng(seed);
    const stalks = Array.from({ length: 16 }, () => ({ x: Math.floor(r() * BACK.w), top: 6 + Math.floor(r() * 30), head: r() < 0.5, lean: (r() - 0.5) * 0.15 }));
    return (x, y) => {
      for (const st of stalks) {
        if (y < st.top) continue;
        const cx = wrapBack(Math.round(st.x + (BACK.h - y) * st.lean));
        if (x === cx) return SHADOW;
        if (st.head && y < st.top + 5 && across(x, cx) <= 1) return SHADOW;
      }
      return null;
    };
  },
  /** Rocky ground: a far ridge of boulders. */
  rocks(seed) {
    const n = noise(seed, 16);
    const r = rng(seed + 1);
    const boulders = Array.from({ length: 6 }, () => ({ x: r() * BACK.w, rx: 8 + r() * 10, ry: 8 + r() * 14 }));
    return (x, y) => {
      const ridge = 30 + Math.round(n(x / 2, 0) * 10);
      if (y >= ridge) return SHADOW;
      for (const b of boulders) {
        const dx = across(x, b.x) / b.rx;
        const dy = (y - BACK.h) / b.ry;
        if (dx * dx + dy * dy <= 1) return SHADOW;
      }
      return null;
    };
  },
  /** The reef: coral heads, round brain corals and branching fans. */
  coral(seed) {
    const r = rng(seed);
    const heads = Array.from({ length: 7 }, () => ({ x: r() * BACK.w, r: 4 + r() * 7, fan: r() < 0.5, h: 18 + r() * 22 }));
    return (x, y) => {
      if (y > BACK.h - 4) return SHADOW;
      for (const c of heads) {
        const d = across(x, c.x);
        if (c.fan) {
          // A fan: a trunk splitting into branches that spread as they rise.
          const up = BACK.h - y;
          if (up > c.h) continue;
          if (up < 6 && d < 1.2) return SHADOW;
          const spread = (up - 6) * 0.6;
          if (up >= 6 && (Math.abs(d - spread) < 1 || (Math.abs(d - spread / 2) < 1 && up % 2 === 0))) return SHADOW;
        } else if (Math.hypot(d, y - (BACK.h - c.r)) <= c.r) return SHADOW;
      }
      return null;
    };
  },
};

/** A few small fish in a loose group, all facing right, to cross the background. */
function school() {
  const FISH = ['.XX..X', 'XXXXXX', '.XX..X'];
  const at = [[0, 3], [9, 0], [10, 7], [19, 3], [16, 9]];
  return (x, y) => (at.some(([fx, fy]) => FISH[y - fy]?.[x - fx] === 'X') ? SHADOW : null);
}

// --- write the files ---------------------------------------------------------------

function write(name, w, h, paint) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = paint(x, y);
      if (!c) continue;
      const o = (y * w + x) * 4;
      png.data[o] = parseInt(c.slice(1, 3), 16);
      png.data[o + 1] = parseInt(c.slice(3, 5), 16);
      png.data[o + 2] = parseInt(c.slice(5, 7), 16);
      png.data[o + 3] = 255;
    }
  }
  writeFileSync(`${OUT}/${name}.png`, PNG.sync.write(png));
}

mkdirSync(OUT, { recursive: true });
Object.entries(PAINTERS).forEach(([name, painter], i) => write(name, TILE, TILE, painter(2000 + i * 131)));
Object.entries(BEDS).forEach(([name, painter], i) => write(`bed-${name}`, BED.w, BED.h, painter(3000 + i * 131)));
Object.entries(BACKDROPS).forEach(([name, painter], i) => write(`back-${name}`, BACK.w, BACK.h, painter(4000 + i * 131)));
write('school', 26, 12, school());
console.log(`Wrote the shore tiles, beds, backdrops and school to ${OUT}.`);
