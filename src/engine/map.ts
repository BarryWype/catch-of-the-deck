import type { EncounterDef, GameData, LevelDef, LevelNodeKind } from './types';

/** The node every level's map starts on (the grandparents' house). */
export const START_NODE_ID = 'start';

export type MapNodeKind = 'start' | LevelNodeKind;

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
  /** Ids of the nodes reachable from here. */
  next: string[];
}

export interface GameMap {
  /** Column 0 is the start; nodes in a column are sorted top to bottom. */
  columns: MapNode[][];
}

/** The map of a level, from its content. The start leads to every node of the first column. */
export function buildLevelMap(level: LevelDef): GameMap {
  const nodes: MapNode[] = level.nodes.map((n) => ({
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
    next: [...n.next],
  }));
  const firstColumn = Math.min(...nodes.map((n) => n.column));
  const start: MapNode = {
    id: START_NODE_ID,
    column: 0,
    ...level.start,
    kind: 'start',
    tier: 0,
    spot: null,
    creatureType: null,
    enemies: null,
    label: null,
    next: nodes.filter((n) => n.column === firstColumn).map((n) => n.id),
  };
  const columns: MapNode[][] = [[start]];
  for (const node of nodes) (columns[node.column] ??= []).push(node);
  for (const column of columns) column?.sort((a, b) => a.y - b.y);
  return { columns: columns.filter(Boolean) };
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
