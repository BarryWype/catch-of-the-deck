import { nextFloat, nextInt, shuffleInPlace, type RngHolder } from './rng';
import type { EncounterDef, GameData, LevelDef, LevelNodeKind, StoreKind } from './types';

/** The node every level's map starts on (the grandparents' house). */
export const START_NODE_ID = 'start';

export type MapNodeKind = 'start' | 'fisherman' | LevelNodeKind;

/** A node of the map being played: its level's `LevelNodeDef`, with the level's tier. */
export interface MapNode {
  id: string;
  column: number;
  /** Position on the coast art. Display-only. */
  x: number;
  y: number;
  kind: MapNodeKind;
  /** Creature tier its fight draws from (the level's tier). */
  tier: number;
  /** Fights: fishing spot id, creature type and fixed creatures (see `encountersFor`); null when not set. */
  spot: string | null;
  creatureType: string | null;
  enemies: string[] | null;
  label: string | null;
  /** Why a mini-boss or boss is let go after the fight (see `isReleaseFight`). */
  releaseReason: string | null;
  /** Fisherman nodes: who stands there (`FishermanDef`). */
  fisherman?: string;
  /** Shop nodes: which store it is (`assignStores`). */
  store?: StoreKind;
  /** Ids of the nodes reachable from here. */
  next: string[];
}

export interface GameMap {
  /** Column 0 is the start; nodes in a column are sorted top to bottom. */
  columns: MapNode[][];
}

/**
 * The map of a level: hand-made, or generated on the coast's places. `fishermen` (see
 * `fishermenToMeet`) stand on generated maps of their level.
 */
export function buildLevelMap(data: GameData, levelIndex: number, holder: RngHolder, fishermen: readonly string[] = []): GameMap {
  const level = data.levels[levelIndex];
  if (level.nodes) return assignStores(handMadeMap(level, level.nodes), holder);
  const map = generateLevelMap(level, levelIndex, data, holder);
  placeFishermen(map, fishermen.filter((id) => data.fishermen[id]?.level === level.id));
  return assignStores(map, holder);
}

export const STORE_KINDS: readonly StoreKind[] = ['cafe', 'tackle', 'bait'];

/** Every shop node becomes one of the stores, each as likely, drawn last so the rest of the map doesn't depend on it. */
function assignStores(map: GameMap, holder: RngHolder): GameMap {
  for (const node of map.columns.flat()) if (node.kind === 'shop') node.store = STORE_KINDS[nextInt(holder, 0, STORE_KINDS.length - 1)];
  return map;
}

/**
 * Each fisherman takes a node of the column right after the mini-boss (all reachable from it): an
 * event if there is one, else a fight, else one of two shops; never the last shop nor the leave
 * node. No RNG, so the rest of the map is the same with or without him.
 */
function placeFishermen(map: GameMap, fishermen: readonly string[]) {
  const column = map.columns[COLUMNS_PER_HALF + 2] ?? [];
  for (const id of fishermen) {
    const shops = column.filter((n) => n.kind === 'shop');
    const slot = column.find((n) => n.kind === 'event') ?? column.find((n) => n.kind === 'fight') ?? (shops.length > 1 ? shops[0] : undefined);
    if (slot) Object.assign(slot, { kind: 'fisherman', fisherman: id, spot: null, creatureType: null, label: null });
  }
}

function startNode(level: LevelDef, next: string[]): MapNode {
  return {
    id: START_NODE_ID,
    column: 0,
    ...level.start,
    kind: 'start',
    tier: 0,
    spot: null,
    creatureType: null,
    enemies: null,
    label: null,
    releaseReason: null,
    next,
  };
}

/** A hand-made map, from the level's nodes. The start leads to every node of the first column. */
function handMadeMap(level: LevelDef, levelNodes: NonNullable<LevelDef['nodes']>): GameMap {
  const nodes: MapNode[] = levelNodes.map((n) => ({
    id: n.id,
    column: n.column,
    x: n.x,
    y: n.y,
    kind: n.kind,
    tier: level.tier,
    spot: n.spot ?? null,
    creatureType: n.creatureType ?? null,
    enemies: n.enemies ? [...n.enemies] : null,
    label: n.label ?? null,
    releaseReason: n.releaseReason ?? null,
    next: [...n.next],
  }));
  const firstColumn = Math.min(...nodes.map((n) => n.column));
  const start = startNode(
    level,
    nodes.filter((n) => n.column === firstColumn).map((n) => n.id),
  );
  const columns: MapNode[][] = [[start]];
  for (const node of nodes) (columns[node.column] ??= []).push(node);
  for (const column of columns) column?.sort((a, b) => a.y - b.y);
  return { columns: columns.filter(Boolean) };
}

/** Columns of nodes between the start and the mini-boss, and again between the mini-boss and the boss. */
export const COLUMNS_PER_HALF = 7;
/** Each of those columns has this many nodes, as features allow; events fill in only up to the minimum. */
const MIN_NODES = 2;
const MAX_NODES = 4;
/** Closest two nodes of a column may be, in art pixels: one above the other, or side by side. */
const NODE_GAP = 30;
/** Chance that a node also links to the next node down in the following column. */
const EXTRA_LINK_CHANCE = 0.3;
/** Chance that a fight turns into an event. */
const SURPRISE_EVENT_CHANCE = 0.25;
/** Columns that always turn one of their fights into an event, so a run isn't all fights. */
export const EVENT_COLUMNS = [2, 4, 6, 10, 12, 14];
/** Chance that an event turns out to be a shop instead. */
const EVENT_SHOP_CHANCE = 0.1;

/**
 * A generated level. Columns 1–7 go from the start to the mini-boss (column 8), columns 9–15 on to
 * the boss (column 16). Each column takes 2–4 of the coast's places within its stretch of the
 * map as fights at their spot; when it has fewer than 2, events fill in. Each event has a chance
 * to come out as a shop instead. A level's `firstColumn` replaces column 1 with the same fights
 * every run. After the mini-boss come a shop and the leave node; there's another shop before it,
 * and a treasure before the boss. Every other column (`EVENT_COLUMNS`) has an event in place of
 * one of its fights, and other fights may turn into surprise events.
 */
function generateLevelMap(level: LevelDef, levelIndex: number, data: GameData, holder: RngHolder): GameMap {
  const { miniBoss, boss, escape, eventBand = [10, level.height - 10] } = level;
  if (!miniBoss || !boss || !escape) throw new Error(`Level "${level.id}" has neither nodes nor a mini-boss, boss and escape.`);

  // The places this age can fish at.
  const stops = data.coast.places.flatMap((place) => {
    const visit = place.visits[levelIndex];
    return visit ? [{ x: visit.at?.x ?? place.x, y: visit.at?.y ?? place.y, spot: visit.spot, label: visit.label }] : [];
  });

  const node = (id: string, column: number, x: number, y: number, kind: LevelNodeKind, extra: Partial<MapNode> = {}): MapNode => ({
    id,
    column,
    x,
    y,
    kind,
    tier: level.tier,
    spot: null,
    creatureType: null,
    enemies: null,
    label: null,
    releaseReason: null,
    next: [],
    ...extra,
  });
  const fixedFight = (id: string, column: number, kind: 'miniBoss' | 'boss', def: NonNullable<LevelDef['boss']>) =>
    node(id, column, def.x, def.y, kind, { enemies: [...def.enemies], label: def.label, releaseReason: def.releaseReason });

  const columns: MapNode[][] = [];
  const halves = [
    [level.start.x, miniBoss.x],
    [miniBoss.x, boss.x],
  ];
  halves.forEach(([from, to], half) => {
    const step = (to - from) / (COLUMNS_PER_HALF + 1);
    for (let c = 1; c <= COLUMNS_PER_HALF; c++) {
      const column = half * (COLUMNS_PER_HALF + 1) + c;
      const [left, right] = [from + step * (c - 0.5), from + step * (c + 0.5)];
      const afterMiniBoss = column === COLUMNS_PER_HALF + 2;
      const taken = afterMiniBoss ? [escape] : [];
      const free = (x: number, y: number) => taken.every((t) => Math.hypot(t.x - x, t.y - y) >= NODE_GAP);
      const centre = from + step * c;
      if (column === 1 && level.firstColumn) {
        columns[column] = level.firstColumn
          .map((s) => node('', column, s.x, s.y, 'fight', { spot: s.spot, label: s.label }))
          .sort((a, b) => a.y - b.y)
          .map((n, i) => ({ ...n, id: `${level.id}-1${'abcdefgh'[i]}` }));
        continue;
      }
      const near = stops.filter((s) => s.x >= left && s.x < right);
      const count = nextInt(holder, MIN_NODES, MAX_NODES);
      const nodes: Omit<MapNode, 'id'>[] = [];
      for (const stop of shuffleInPlace(holder, near)) {
        if (nodes.length === count) break;
        if (!free(stop.x, stop.y)) continue;
        taken.push(stop);
        nodes.push(node('', column, stop.x, stop.y, 'fight', { spot: stop.spot, label: stop.label }));
      }
      const heights = Array.from({ length: Math.floor((eventBand[1] - eventBand[0]) / 4) + 1 }, (_, i) => eventBand[0] + i * 4);
      // Events only fill the column up to the minimum, when it's short of features.
      for (const y of shuffleInPlace(holder, heights)) {
        if (nodes.length >= MIN_NODES) break;
        if (!free(centre, y)) continue;
        taken.push({ x: centre, y });
        nodes.push(node('', column, centre, y, nextFloat(holder) < EVENT_SHOP_CHANCE ? 'shop' : 'event'));
      }
      const ids = 'abcdefgh';
      const built = nodes.sort((a, b) => a.y - b.y).map((n, i) => ({ ...n, id: `${level.id}-${column}${ids[i]}` }));
      if (afterMiniBoss) built.push(node(`${level.id}-home`, column, escape.x, escape.y, 'leave'));
      columns[column] = built.sort((a, b) => a.y - b.y);
    }
  });
  columns[COLUMNS_PER_HALF + 1] = [fixedFight(`${level.id}-miniBoss`, COLUMNS_PER_HALF + 1, 'miniBoss', miniBoss)];
  const last = 2 * (COLUMNS_PER_HALF + 1);
  columns[last] = [fixedFight(`${level.id}-boss`, last, 'boss', boss)];

  // Shops, the treasure and a few surprise events, in place of fights.
  const pick = (from: number, to: number) => {
    const options = columns.slice(from, to + 1).flat().filter((n) => n.kind === 'fight' || n.kind === 'event');
    return options[nextInt(holder, 0, options.length - 1)];
  };
  const becomes = (n: MapNode | undefined, kind: LevelNodeKind) => n && Object.assign(n, { kind, spot: null, label: null });
  becomes(pick(3, COLUMNS_PER_HALF), 'shop');
  becomes(pick(COLUMNS_PER_HALF + 2, COLUMNS_PER_HALF + 2), 'shop');
  becomes(pick(last - 4, last - 1), 'treasure');
  for (const column of EVENT_COLUMNS) {
    const fights = columns[column].filter((n) => n.kind === 'fight');
    if (fights.length > 1 && !columns[column].some((n) => n.kind === 'event'))
      becomes(fights[nextInt(holder, 0, fights.length - 1)], nextFloat(holder) < EVENT_SHOP_CHANCE ? 'shop' : 'event');
  }
  for (let column = 1; column < last; column++) link(columns[column], columns[column + 1], holder);

  // Surprise events, never right before or after another event.
  const nodes = columns.flat();
  const nextToEvent = (n: MapNode) =>
    nodes.some((other) => other.kind === 'event' && (other.next.includes(n.id) || n.next.includes(other.id)));
  for (const n of columns.slice(level.firstColumn ? 2 : 1).flat()) {
    if (n.kind === 'fight' && nextFloat(holder) < SURPRISE_EVENT_CHANCE && !nextToEvent(n))
      becomes(n, nextFloat(holder) < EVENT_SHOP_CHANCE ? 'shop' : 'event');
  }
  columns[0] = [startNode(level, columns[1].map((n) => n.id))];
  return { columns };
}

/**
 * Links a column to the next without crossings: each node to the one at the same relative height
 * (sometimes also the one below), then anything left without a way in. Leave nodes lead nowhere.
 */
function link(from: MapNode[], to: MapNode[], holder: RngHolder) {
  const sources = from.filter((n) => n.kind !== 'leave');
  const along = (i: number, n: number, m: number) => (n === 1 ? Math.round((m - 1) / 2) : Math.round((i * (m - 1)) / (n - 1)));
  sources.forEach((source, i) => {
    const j = along(i, sources.length, to.length);
    source.next.push(to[j].id);
    const nextStarts = i + 1 < sources.length ? along(i + 1, sources.length, to.length) : to.length;
    if (j + 1 < to.length && nextStarts >= j + 1 && nextFloat(holder) < EXTRA_LINK_CHANCE) source.next.push(to[j + 1].id);
  });
  // The mini-boss leads everywhere next, the leave node included.
  if (sources.length === 1 && sources[0].kind === 'miniBoss') sources[0].next = to.map((n) => n.id);
  to.forEach((target, j) => {
    if (!sources.some((s) => s.next.includes(target.id)) && target.kind !== 'leave') sources[along(j, to.length, sources.length)].next.push(target.id);
  });
}

export function encounterTier(encounter: EncounterDef): number {
  return encounter.tier ?? 1;
}

/**
 * Encounters a fight node can lead to. Fixed `enemies` win. Otherwise, encounters whose creatures
 * all live at the node's fishing spot (its waters and creature types) and match its `creatureType`,
 * at the node's tier. When that's empty it relaxes, in order: the spot's creature types, then the
 * tier, then the spot altogether.
 */
export function encountersFor(node: MapNode, data: GameData): EncounterDef[] {
  if (node.enemies) return [{ id: node.id, name: node.label ?? node.id, enemies: node.enemies }];
  const spot = node.spot ? data.spots[node.spot] : undefined;
  const fits = (encounter: EncounterDef, spotTypes: boolean, anySpot = false) =>
    encounter.enemies.every((id) => {
      const enemy = data.enemies[id];
      const type = enemy?.tags?.[0] ?? '';
      if (node.creatureType && !enemy?.tags?.includes(node.creatureType)) return false;
      if (!spot || anySpot) return true;
      return spot.waters.includes(enemy?.water ?? '') && (!spotTypes || !spot.types || spot.types.includes(type));
    });
  const atTier = data.encounters.filter((e) => encounterTier(e) === node.tier);
  const pools = [
    atTier.filter((e) => fits(e, true)),
    atTier.filter((e) => fits(e, false)),
    data.encounters.filter((e) => fits(e, true)),
    data.encounters.filter((e) => fits(e, false)),
    atTier.filter((e) => fits(e, false, true)),
  ];
  return pools.find((pool) => pool.length) ?? data.encounters;
}

export function findNode(map: GameMap, id: string): MapNode | undefined {
  for (const column of map.columns) {
    const node = column.find((n) => n.id === id);
    if (node) return node;
  }
  return undefined;
}
