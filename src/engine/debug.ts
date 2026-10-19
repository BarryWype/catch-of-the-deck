import { bondThreshold, MAX_BOND_LEVEL, type HomeCreature } from './bond';
import { applyAction, checkCombatEnd } from './combat';
import { SECOND_WIND_ID } from './intents';
import { buildLevelMap, START_NODE_ID, STORE_KINDS, type MapNode } from './map';
import { drawCards } from './piles';
import { createRun, REWARD_REROLLS_AT_START, SESSION_SLOTS, travelTo, visitFisherman, visitShop, visitTreasure, type RunState } from './run';
import { CATCH_SIZES, type Catch, type CatchSize } from './sizes';
import { STATUS_META } from './statuses';
import type { ShopVisit } from './shop';
import type { CombatAction, CombatState, GameData, StatusId, StoreKind } from './types';
import { clone } from './util';

/**
 * The debug panel's tools (see README → Debug panel). A `DebugScenario` is plain JSON, so it can be
 * saved, pasted, and turned into a state by tests (`startScenario`). The combat setters return a
 * changed copy, like `applyAction`.
 */

/** A companion, a bucket creature or a home creature: `bond` is a bond level, 0 to `MAX_BOND_LEVEL`. */
export interface DebugCreature {
  id: string;
  bond: number;
  size: CatchSize;
}

/** Where the scenario starts: a fight (one creature, an encounter, the age's mini-boss or boss) or another node. */
export type DebugStart =
  | { type: 'creature'; id: string }
  | { type: 'encounter'; id: string }
  | { type: 'miniBoss' }
  | { type: 'boss' }
  | { type: 'event'; id: string }
  | { type: 'shop'; store?: StoreKind }
  | { type: 'treasure' }
  | { type: 'fisherman'; id: string };

/** The profile the scenario plays with, instead of the real one (which it never touches). */
export interface DebugProfile {
  unlocked: string[];
  fishermenMet: string[];
  home: DebugCreature[];
}

export interface DebugScenario {
  seed?: number;
  build: string;
  /** Index in `GameData.levels`: the age. */
  level: number;
  /** Fights already played this run (they make the next one tougher). */
  fights?: number;
  /** Grit at the start; full if omitted. */
  hp?: number;
  coins?: number;
  /** The run's own card reward rerolls. */
  rerolls?: number;
  companions?: DebugCreature[];
  /** Creatures already caught, in the bucket after the companions. */
  bucket?: Catch[];
  /** The build's starter deck if omitted. */
  deck?: string[];
  /** Cards of the deck to start the fight with in hand, instead of drawing. */
  hand?: string[];
  start: DebugStart;
  profile?: DebugProfile;
}

export type DebugStartKind = 'fight' | 'event' | 'shop' | 'treasure' | 'fisherman';

/** A home creature at a bond level (its points just reach it). */
export function debugCreature(creature: DebugCreature, data: GameData): HomeCreature {
  return { id: creature.id, size: creature.size, bond: creature.bond > 0 ? bondThreshold(creature.id, creature.bond, data) : 0 };
}

/** The scenario's run, at the start of its age's map. */
export function scenarioRun(scenario: DebugScenario, data: GameData): RunState {
  const companions = (scenario.companions ?? []).map((c) => debugCreature(c, data));
  const run = createRun(scenario.seed ?? 1, data, scenario.build, companions);
  run.level = scenario.level;
  run.map = buildLevelMap(data, scenario.level, run);
  run.fights = scenario.fights ?? 0;
  run.floor = run.fights + 1;
  run.hp = Math.min(run.maxHp, scenario.hp ?? run.maxHp);
  run.coins = scenario.coins ?? 0;
  run.rewardRerolls = scenario.rerolls ?? REWARD_REROLLS_AT_START;
  if (scenario.deck) run.deck = [...scenario.deck];
  run.bucket.push(...(scenario.bucket ?? []).map(({ id, size }) => ({ id, size })));
  return run;
}

/**
 * Put the scenario's run one step before its start node and step onto it: the fight begins, or
 * the event, shop, treasure or fisherman is visited. Fights other than the mini-boss and boss
 * (and the other nodes) take the place of the map's first node.
 */
export function startScenario(
  scenario: DebugScenario,
  data: GameData,
): { run: RunState; kind: DebugStartKind; combat?: CombatState; eventId?: string; visit?: ShopVisit } {
  const run = scenarioRun(scenario, data);
  const start = scenario.start;
  const nodes = run.map.columns.flat();
  const target =
    start.type === 'miniBoss' || start.type === 'boss' ? nodes.find((n) => n.kind === start.type) : nodes.find((n) => n.column === 1);
  if (!target) throw new Error(`No node for "${start.type}" on level ${scenario.level}.`);
  const reset: Partial<MapNode> = { spot: null, creatureType: null, enemies: null, label: null };
  if (start.type === 'creature') Object.assign(target, reset, { kind: 'fight', enemies: [start.id] });
  if (start.type === 'encounter') {
    const encounter = data.encounters.find((e) => e.id === start.id);
    if (!encounter) throw new Error(`Unknown encounter "${start.id}"`);
    Object.assign(target, reset, { kind: 'fight', enemies: [...encounter.enemies], label: encounter.name });
  }
  if (start.type === 'event' || start.type === 'treasure') Object.assign(target, reset, { kind: start.type });
  if (start.type === 'shop') Object.assign(target, reset, { kind: 'shop', store: start.store ?? 'tackle' });
  if (start.type === 'fisherman') Object.assign(target, reset, { kind: 'fisherman', fisherman: start.id });

  const before = nodes.find((n) => n.next.includes(target.id))!;
  run.position = before.id;
  run.visited = before.id === START_NODE_ID ? [START_NODE_ID] : [START_NODE_ID, before.id];

  switch (start.type) {
    case 'shop': {
      const visit = visitShop(run, target.id, data);
      return { run: visit.run, kind: 'shop', visit: visit.visit };
    }
    case 'fisherman':
      return { run: visitFisherman(run, target.id, data), kind: 'fisherman' };
    case 'treasure': {
      const visit = visitTreasure(run, target.id, data);
      return { run: visit.run, kind: 'treasure', eventId: visit.eventId };
    }
    case 'event':
      return { run: { ...run, position: target.id, visited: [...run.visited, target.id] }, kind: 'event', eventId: start.id };
    default: {
      const fight = travelTo(run, target.id, data);
      const combat = scenario.hand?.length ? debugSetHand(fight.combat, scenario.hand) : fight.combat;
      return { run: fight.run, kind: 'fight', combat };
    }
  }
}

/** The hand is these cards, taken from the draw pile, discard or hand; the cards it held go back on top of the draw pile. */
export function debugSetHand(state: CombatState, cardIds: readonly string[]): CombatState {
  const next = clone(state);
  const { piles } = next;
  piles.draw.push(...piles.hand);
  piles.hand = [];
  for (const id of cardIds) {
    const pile = [piles.draw, piles.discard].find((p) => p.some((c) => c.defId === id));
    if (!pile) throw new Error(`No "${id}" left in the deck for the hand.`);
    const index = pile.map((c) => c.defId).lastIndexOf(id);
    piles.hand.push(...pile.splice(index, 1));
  }
  return next;
}

export interface PlayerValues {
  hp?: number;
  block?: number;
  patience?: number;
  energy?: number;
}

/** Set the player's Grit, Hold, Patience or energy. Grit at 0 loses the fight. */
export function debugSetPlayer(state: CombatState, values: PlayerValues): CombatState {
  const next = clone(state);
  const { player } = next;
  if (values.hp !== undefined) player.hp = clamp(values.hp, 0, player.maxHp);
  if (values.block !== undefined) player.block = Math.max(0, values.block);
  if (values.patience !== undefined) player.patience = Math.max(0, values.patience);
  if (values.energy !== undefined) player.energy = Math.max(0, values.energy);
  checkCombatEnd(next);
  return next;
}

/** Set a creature's Health or Will. Health or Will at 0 catches it, a full Will lets it get away. */
export function debugSetCreature(state: CombatState, enemyId: string, values: { hp?: number; escape?: number }): CombatState {
  const next = clone(state);
  const enemy = next.enemies.find((e) => e.id === enemyId);
  if (!enemy) throw new Error(`No creature "${enemyId}" in this fight.`);
  if (values.hp !== undefined) enemy.hp = clamp(values.hp, 0, enemy.maxHp);
  if (values.escape !== undefined) enemy.escape = clamp(values.escape, 0, enemy.escapeAt);
  checkCombatEnd(next);
  return next;
}

/** Catch the creature now, by wearing its Health down or by draining its Will. */
export function debugCatch(state: CombatState, enemyId: string, by: 'health' | 'will'): CombatState {
  return debugSetCreature(state, enemyId, by === 'health' ? { hp: 0 } : { escape: 0 });
}

/** Give the player (`PLAYER_ID`) or a creature `stacks` of a status; 0 removes it. */
export function debugSetStatus(state: CombatState, combatantId: string, status: StatusId, stacks: number): CombatState {
  if (!STATUS_META[status]) throw new Error(`Unknown status "${status}"`);
  const next = clone(state);
  const who = next.player.id === combatantId ? next.player : next.enemies.find((e) => e.id === combatantId);
  if (!who) throw new Error(`No combatant "${combatantId}" in this fight.`);
  if (stacks === 0) delete who.statuses[status];
  else who.statuses[status] = stacks;
  return next;
}

/** The creature's next move is `moveId`: any move of its set, or a mini-boss's or boss's Second Wind. It shows. */
export function debugSetIntent(state: CombatState, enemyId: string, moveId: string, data: GameData): CombatState {
  const next = clone(state);
  const enemy = next.enemies.find((e) => e.id === enemyId);
  if (!enemy) throw new Error(`No creature "${enemyId}" in this fight.`);
  if (moveId !== SECOND_WIND_ID && !data.enemies[enemy.defId].moves.some((m) => m.id === moveId)) {
    throw new Error(`${enemy.defId} has no move "${moveId}".`);
  }
  enemy.intent = moveId;
  enemy.intentHidden = false;
  return next;
}

/** A new copy of `cardId` in the hand. */
export function debugAddToHand(state: CombatState, cardId: string, data: GameData): CombatState {
  if (!data.cards[cardId]) throw new Error(`Unknown card "${cardId}"`);
  const next = clone(state);
  const { piles } = next;
  const uids = new Set([...piles.draw, ...piles.hand, ...piles.discard, ...piles.exhaust].map((c) => c.uid));
  let n = uids.size;
  while (uids.has(`d${n}`)) n++;
  piles.hand.push({ uid: `d${n}`, defId: cardId });
  return next;
}

/** Draw `count` cards, as a card's draw would. */
export function debugDraw(state: CombatState, count: number): CombatState {
  const next = clone(state);
  drawCards(next, count);
  return next;
}

/** `applyAction` with infinite energy: a card is played whatever its cost, and the energy stays as it was. */
export function applyWithInfiniteEnergy(state: CombatState, action: CombatAction, data: GameData): CombatState {
  if (action.type !== 'playCard') return applyAction(state, action, data);
  const energy = state.player.energy;
  const played = applyAction(debugSetPlayer(state, { energy: 999 }), action, data);
  return { ...played, player: { ...played.player, energy } };
}

export type DebugErrorCode = 'json' | 'shape' | 'build' | 'level' | 'number' | 'creature' | 'bond' | 'size' | 'companions' | 'card' | 'hand' | 'start' | 'encounter' | 'event' | 'fisherman' | 'store';

/** What's wrong with a pasted scenario: the problem, and the field or value at fault. */
export interface DebugError {
  code: DebugErrorCode;
  detail: string;
}

/** The scenario in `json`, or what's wrong with it. */
export function parseScenario(json: string, data: GameData): { scenario: DebugScenario } | { error: DebugError } {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (e) {
    return { error: { code: 'json', detail: e instanceof Error ? e.message : String(e) } };
  }
  const error = validateScenario(value, data);
  return error ? { error } : { scenario: value as DebugScenario };
}

/** Null when `value` is a scenario that can start, else the first problem found. */
export function validateScenario(value: unknown, data: GameData): DebugError | null {
  const fail = (code: DebugErrorCode, detail: unknown): DebugError => ({ code, detail: String(detail) });
  if (!isObject(value)) return fail('shape', 'scenario');
  const s = value as Record<string, unknown>;
  if (typeof s.build !== 'string' || !data.builds[s.build]) return fail('build', s.build);
  if (!Number.isInteger(s.level) || (s.level as number) < 0 || (s.level as number) >= data.levels.length) return fail('level', s.level);
  for (const key of ['seed', 'fights', 'hp', 'coins', 'rerolls'] as const) {
    if (s[key] !== undefined && (!Number.isInteger(s[key]) || (s[key] as number) < 0)) return fail('number', key);
  }
  const creatures = (list: unknown, field: string, withBond: boolean): DebugError | null => {
    if (list === undefined) return null;
    if (!Array.isArray(list)) return fail('shape', field);
    for (const c of list) {
      if (!isObject(c) || typeof c.id !== 'string' || !data.enemies[c.id]) return fail('creature', isObject(c) ? c.id : field);
      if (!CATCH_SIZES.includes(c.size as CatchSize)) return fail('size', c.size);
      if (withBond && (!Number.isInteger(c.bond) || (c.bond as number) < 0 || (c.bond as number) > MAX_BOND_LEVEL)) return fail('bond', c.bond);
    }
    return null;
  };
  const listError = creatures(s.companions, 'companions', true) ?? creatures(s.bucket, 'bucket', false);
  if (listError) return listError;
  if (Array.isArray(s.companions) && s.companions.length > SESSION_SLOTS) return fail('companions', s.companions.length);
  for (const key of ['deck', 'hand'] as const) {
    if (s[key] === undefined) continue;
    if (!Array.isArray(s[key])) return fail('shape', key);
    const unknown = (s[key] as unknown[]).find((id) => typeof id !== 'string' || !data.cards[id]);
    if (unknown !== undefined) return fail('card', unknown);
  }
  if (Array.isArray(s.deck) && !s.deck.length) return fail('shape', 'deck');
  if (Array.isArray(s.hand)) {
    const left = [...((s.deck as string[] | undefined) ?? data.builds[s.build].starterDeck)];
    for (const id of s.hand as string[]) {
      const index = left.indexOf(id);
      if (index < 0) return fail('hand', id);
      left.splice(index, 1);
    }
  }
  const start = s.start as Record<string, unknown> | undefined;
  if (!isObject(start)) return fail('start', start);
  switch (start.type) {
    case 'creature':
      if (typeof start.id !== 'string' || !data.enemies[start.id]) return fail('creature', start.id);
      break;
    case 'encounter':
      if (!data.encounters.some((e) => e.id === start.id)) return fail('encounter', start.id);
      break;
    case 'event':
      if (typeof start.id !== 'string' || !data.events[start.id] || data.events[start.id].treasure) return fail('event', start.id);
      break;
    case 'fisherman':
      if (typeof start.id !== 'string' || !data.fishermen[start.id]) return fail('fisherman', start.id);
      break;
    case 'shop':
      if (start.store !== undefined && !STORE_KINDS.includes(start.store as StoreKind)) return fail('store', start.store);
      break;
    case 'miniBoss':
    case 'boss':
    case 'treasure':
      break;
    default:
      return fail('start', start.type);
  }
  if (s.profile !== undefined) {
    const p = s.profile as Record<string, unknown>;
    if (!isObject(p) || !Array.isArray(p.unlocked) || !Array.isArray(p.fishermenMet) || !Array.isArray(p.home)) return fail('shape', 'profile');
    const build = p.unlocked.find((id) => !data.builds[id as string]);
    if (build !== undefined) return fail('build', build);
    const fisherman = p.fishermenMet.find((id) => !data.fishermen[id as string]);
    if (fisherman !== undefined) return fail('fisherman', fisherman);
    const homeError = creatures(p.home, 'profile.home', true);
    if (homeError) return homeError;
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
