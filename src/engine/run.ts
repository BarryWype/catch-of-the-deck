import { addBond, BOND_PER_ENCOUNTER, bondToFull, type HomeCreature } from './bond';
import { createCombat } from './combat';
import { bonusTotal, companionEffects } from './companions';
import { equipmentEffects, instantSaleValue, saleValue } from './equipment';
import { buildLevelMap, encountersFor, encounterTier, findNode, layoutCoast, START_NODE_ID, type CoastPlacement, type GameMap, type MapNode } from './map';
import { nextFloat, nextInt, shuffleInPlace } from './rng';
import { isAlive } from './effects';
import type { BuildDef, CombatState, EnemyState, GameData } from './types';
import { clone } from './util';

/** Everything that persists between fights. */
export interface RunState {
  seed: number;
  rng: number;
  /** Starting build id. */
  build: string;
  hp: number;
  maxHp: number;
  deck: string[];
  floor: number;
  /** Index in `GameData.levels` of the level being played (an act of the run). */
  level: number;
  /** The coast features laid out for this run, shared by every level. */
  coast: CoastPlacement[];
  /** That level's map. */
  map: GameMap;
  /** Id of the map node the player is standing on. */
  position: string;
  /** Node ids travelled through, starting point included. */
  visited: string[];
  /**
   * The bucket: enemy definition ids of the creatures caught this run and not sold, in order
   * (duplicates allowed). It only reaches the home aquarium if the run is won (`bringCatchHome`).
   */
  bucket: string[];
  /**
   * The creatures brought from the home aquarium, which give their companion bonus. Always the
   * first entries of `bucket`, in the same order (captures are added after them, and selling one
   * removes it from both). Their bond grows with every fight (`BOND_PER_ENCOUNTER`).
   */
  companions: HomeCreature[];
  coins: number;
  /** Equipment ids carried this run. */
  equipment: string[];
}

export const CARD_REWARD_COUNT = 3;
/** Chance that an event turns out to be an ordinary fight. */
export const EVENT_FIGHT_CHANCE = 0.1;
/** How many home-aquarium creatures the player can bring along in the bucket. */
export const SESSION_SLOTS = 3;

/**
 * Start a run on the first level, with the chosen build's starter deck, its chosen starting
 * `item`, and `brought` (creatures taken from the home aquarium, see `takeFromHome`) already in
 * the bucket.
 */
export function createRun(
  seed: number,
  data: GameData,
  buildId: string,
  brought: readonly HomeCreature[] = [],
  item: string | undefined = data.builds[buildId]?.startingItems?.[0],
): RunState {
  const build = data.builds[buildId];
  if (!build) throw new Error(`Unknown build "${buildId}"`);
  if (item !== undefined && !build.startingItems?.includes(item)) throw new Error(`"${item}" isn't a starting item of ${buildId}`);
  if (brought.length > SESSION_SLOTS) throw new Error(`Can't bring more than ${SESSION_SLOTS} creatures`);
  const maxHp = data.character.maxHp + bonusTotal(companionEffects(brought, data), 'bonusMaxHp');
  const run: RunState = {
    seed,
    rng: seed | 0,
    build: buildId,
    hp: maxHp,
    maxHp,
    deck: [...build.starterDeck],
    floor: 1,
    level: 0,
    coast: [],
    map: { columns: [] },
    position: START_NODE_ID,
    visited: [START_NODE_ID],
    bucket: brought.map((c) => c.id),
    companions: brought.map((c) => ({ ...c })),
    coins: 0,
    equipment: item === undefined ? [] : [item],
  };
  run.coast = layoutCoast(run, data.coast);
  run.map = buildLevelMap(data, 0, run.coast, run);
  return run;
}

/** Builds that can be picked at the start of a run: those available from the first level. */
export function startingBuilds(data: GameData): BuildDef[] {
  const first = data.levels[0]?.id;
  return Object.values(data.builds).filter((b) => (b.level ?? first) === first);
}

/**
 * Is the run standing on a mini-boss or boss? Those are let go after the fight: too big, too
 * fierce or protected to keep. They never reach the bucket, nor get sold on the spot.
 */
export function isReleaseFight(run: RunState): boolean {
  const kind = findNode(run.map, run.position)?.kind;
  return kind === 'miniBoss' || kind === 'boss';
}

/** Is the run on its last level? Beating that level's boss wins the run. */
export function isLastLevel(run: RunState, data: GameData): boolean {
  return run.level >= data.levels.length - 1;
}

/** After a level's boss: the next level, back at the start of its map. Everything else carries over. */
export function enterNextLevel(run: RunState, data: GameData): RunState {
  if (isLastLevel(run, data)) throw new Error('There is no level after this one.');
  const next = { ...clone(run), level: run.level + 1, position: START_NODE_ID, visited: [START_NODE_ID] };
  next.map = buildLevelMap(data, next.level, next.coast, next);
  return next;
}

/** Nodes the player can travel to next (none at the boss or a leave node, which end the level or the run). */
export function availableDestinations(run: RunState): MapNode[] {
  const current = findNode(run.map, run.position);
  return (current?.next ?? []).map((id) => findNode(run.map, id)!);
}

export function isMapComplete(run: RunState): boolean {
  return availableDestinations(run).length === 0;
}

/** A copy of the run standing on an adjacent node of one of `kinds`. Throws if there's no such node. */
function moveTo(run: RunState, nodeId: string, ...kinds: MapNode['kind'][]): { next: RunState; node: MapNode } {
  const node = availableDestinations(run).find((n) => n.id === nodeId);
  if (!node || !kinds.includes(node.kind)) throw new Error(`Can't travel to a ${kinds.join('/')} at "${nodeId}" from "${run.position}".`);
  const next = clone(run);
  next.position = node.id;
  next.visited.push(node.id);
  return { next, node };
}

/** Move to an adjacent fight (mini-boss and boss included) and start it. Throws if the node isn't a reachable fight. */
export function travelTo(run: RunState, nodeId: string, data: GameData): { run: RunState; combat: CombatState } {
  const { next, node } = moveTo(run, nodeId, 'fight', 'miniBoss', 'boss');
  return { run: next, combat: startFight(next, node, data) };
}

/**
 * Start the fight at `node` (advancing `next`'s RNG): an encounter from its fishing spot at its
 * tier (`encountersFor`), only decided on arrival.
 */
function startFight(next: RunState, node: MapNode, data: GameData): CombatState {
  const pool = encountersFor(node, data);
  const encounter = pool[nextInt(next, 0, pool.length - 1)];
  const combatSeed = nextInt(next, 0, 0x7fffffff);
  next.companions = next.companions.map((c) => addBond(c, BOND_PER_ENCOUNTER, data));
  return createCombat(
    {
      seed: combatSeed,
      deck: next.deck,
      enemies: [...encounter.enemies, ...extraCatch(next, node, data)],
      playerHp: next.hp,
      playerMaxHp: next.maxHp,
      equipment: next.equipment,
      bonuses: companionEffects(next.companions, data),
    },
    data,
  );
}

/**
 * Creatures `extraCatch` equipment drags into an ordinary fight (never a mini-boss or boss): for
 * each such effect whose `spots` include the fight's, a roll at its chance, then one creature of
 * its types at the fight's tier, from the fishing spot's waters when there is one.
 */
function extraCatch(next: RunState, node: MapNode, data: GameData): string[] {
  if (node.kind !== 'fight') return [];
  const extra: string[] = [];
  for (const effect of equipmentEffects(next.equipment, data)) {
    if (effect.type !== 'extraCatch') continue;
    if (effect.spots && !effect.spots.includes(node.spot ?? '')) continue;
    if (nextFloat(next) >= effect.percent / 100) continue;
    const pool = data.encounters
      .filter((e) => e.enemies.length === 1 && encounterTier(e) === node.tier)
      .map((e) => data.enemies[e.enemies[0]])
      .filter((enemy) => enemy && effect.types.includes(enemy.tags?.[0] ?? ''));
    const spot = node.spot ? data.spots[node.spot] : undefined;
    const local = pool.filter((enemy) => spot?.waters.includes(enemy.water ?? ''));
    const options = local.length ? local : pool;
    if (options.length) extra.push(options[nextInt(next, 0, options.length - 1)].id);
  }
  return extra;
}

/**
 * Move to an adjacent event. With `EVENT_FIGHT_CHANCE` it's an ordinary fight against any
 * creature of the level's tier; otherwise the event is drawn among those allowed at that column
 * (treasure events aside).
 */
export function visitEvent(
  run: RunState,
  nodeId: string,
  data: GameData,
): { run: RunState; eventId: string; combat?: undefined } | { run: RunState; combat: CombatState; eventId?: undefined } {
  const { next, node } = moveTo(run, nodeId, 'event');
  if (nextFloat(next) < EVENT_FIGHT_CHANCE) {
    return { run: next, combat: startFight(next, { ...node, kind: 'fight', spot: null, creatureType: null, enemies: null }, data) };
  }
  const ids = Object.values(data.events)
    .filter((e) => !e.treasure && node.column >= (e.minColumn ?? 0))
    .map((e) => e.id);
  if (!ids.length) throw new Error(`No event can happen at column ${node.column}.`);
  return { run: next, eventId: ids[nextInt(next, 0, ids.length - 1)] };
}

/** Move to an adjacent treasure: one of the treasure events, drawn on arrival. */
export function visitTreasure(run: RunState, nodeId: string, data: GameData): { run: RunState; eventId: string } {
  const { next } = moveTo(run, nodeId, 'treasure');
  const ids = Object.values(data.events).filter((e) => e.treasure).map((e) => e.id);
  if (!ids.length) throw new Error('There is no treasure event.');
  return { run: next, eventId: ids[nextInt(next, 0, ids.length - 1)] };
}

/** Move to an adjacent "finish the session" node: a dead end, the run ends there as a success (see `bringCatchHome`). */
export function visitLeave(run: RunState, nodeId: string): RunState {
  return moveTo(run, nodeId, 'leave').next;
}

/** Move to an adjacent shop. */
export function visitShop(run: RunState, nodeId: string): RunState {
  return moveTo(run, nodeId, 'shop').next;
}

/**
 * Carry the fight's outcome into the run: HP, floor (on a win), and the creatures captured,
 * even in a fight another creature then fled: they go into the bucket unless equipment sells
 * them on the spot. Mini-bosses and bosses are let go instead (`isReleaseFight`).
 */
export function finishCombat(run: RunState, combat: CombatState, data: GameData): RunState {
  const next = { ...clone(run), hp: Math.max(0, combat.player.hp) };
  if (combat.phase === 'lost') return next;
  next.hp = Math.min(next.maxHp, next.hp + bonusTotal(combat.bonuses, 'healAfterFight'));
  if (combat.phase === 'won') next.floor++;
  if (isReleaseFight(run)) return next;
  const sellBonus = bonusTotal(combat.bonuses, 'sellBonus');
  // Everything caught counts, even when another creature then got away.
  for (const enemy of combat.enemies.filter((e) => combat.phase === 'won' || !isAlive(e))) {
    const sale = instantSaleValue(enemy.defId, run.equipment, data, sellBonus);
    if (sale === null) next.bucket.push(enemy.defId);
    else next.coins += sale;
  }
  return next;
}

/** Sell the bucket's creature at index `slot` for its sell value (plus companion sell bonuses). */
export function sellCreature(run: RunState, slot: number, data: GameData): RunState {
  const id = run.bucket[slot];
  if (id === undefined) throw new Error(`Nothing captured at slot ${slot}`);
  const sellBonus = bonusTotal(companionEffects(run.companions, data), 'sellBonus');
  return {
    ...clone(run),
    bucket: run.bucket.filter((_, i) => i !== slot),
    companions: run.companions.filter((_, i) => i !== slot),
    coins: run.coins + saleValue(id, sellBonus, data),
  };
}

/** Split the home aquarium into what stays and the creatures at `slots` (indices), brought for a run. */
export function takeFromHome(
  home: readonly HomeCreature[],
  slots: readonly number[],
): { home: HomeCreature[]; brought: HomeCreature[] } {
  for (const slot of slots) if (!home[slot]) throw new Error(`Nothing in the home aquarium at slot ${slot}`);
  return { home: home.filter((_, i) => !slots.includes(i)), brought: slots.map((slot) => home[slot]) };
}

/**
 * The home aquarium after a successful run (boss beaten, or the session finished at a leave node):
 * everything still in the bucket joins it. Companions come back with the bond they gained on the
 * way; creatures caught on the way start with no bond, or with `bondOnCapture` equipment's. A lost or abandoned run never calls this, so its bucket,
 * companions included, is lost.
 */
export function bringCatchHome(home: readonly HomeCreature[], run: RunState, data: GameData): HomeCreature[] {
  const bond = equipmentEffects(run.equipment, data).reduce((sum, e) => (e.type === 'bondOnCapture' ? sum + e.amount : sum), 0);
  const caught = run.bucket.slice(run.companions.length).map((id) => ({ id, bond: Math.min(bond, bondToFull(id, data)) }));
  return [...home, ...run.companions.map((c) => ({ ...c })), ...caught];
}

/**
 * Eggs laid in the home aquarium when a run ends, however it ended: each species with at least
 * two creatures rolls its `breedChance` once. Returns the creature id inside each new egg.
 * Rolls use the finished run's RNG, in the order species first appear.
 */
export function layEggs(home: readonly HomeCreature[], run: RunState, data: GameData): string[] {
  const rng = { rng: run.rng };
  const counts = new Map<string, number>();
  for (const { id } of home) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .filter(([id, count]) => count >= 2 && nextFloat(rng) < (data.enemies[id]?.breedChance ?? 0))
    .map(([id]) => id);
}

/** How far the player got with a creature, in the creature book. */
export type Discovery = 'seen' | 'captured';

/**
 * The creature book after `combat`: its creatures are seen, and captured once caught (or the
 * fight won), unless they were `released` (a mini-boss or boss, see `isReleaseFight`).
 * Returns `book` itself when nothing new was learnt.
 */
export function recordEncounter(
  book: Readonly<Record<string, Discovery>>,
  combat: CombatState,
  released = false,
): Readonly<Record<string, Discovery>> {
  const statusOf = (e: EnemyState): Discovery => ((combat.phase === 'won' || !isAlive(e)) && !released ? 'captured' : 'seen');
  const updates = combat.enemies.filter((e) => book[e.defId] !== 'captured' && book[e.defId] !== statusOf(e));
  if (!updates.length) return book;
  return { ...book, ...Object.fromEntries(updates.map((e) => [e.defId, statusOf(e)])) };
}

/** Offer `count` distinct non-starter cards: shared ones plus those of the run's build. */
export function rollCardRewards(
  run: RunState,
  data: GameData,
  count = CARD_REWARD_COUNT,
): { run: RunState; choices: string[] } {
  const next = clone(run);
  const pool = Object.values(data.cards)
    .filter((c) => c.rarity !== 'starter' && (c.build === undefined || c.build === run.build))
    .map((c) => c.id);
  return { run: next, choices: shuffleInPlace(next, pool).slice(0, count) };
}

export function addCardToDeck(run: RunState, cardId: string, data: GameData): RunState {
  if (!data.cards[cardId]) throw new Error(`Unknown card "${cardId}"`);
  return { ...clone(run), deck: [...run.deck, cardId] };
}
