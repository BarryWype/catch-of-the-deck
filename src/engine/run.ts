import { addBond, bondPerFight, bondToFull, type HomeCreature } from './bond';
import { createCombat } from './combat';
import { BOSS_DAMAGE, ENCOUNTER_TURN_AVERAGE, ENCOUNTER_GROWTH_PERCENT, ENCOUNTER_HP_POOL, GROUP_DAMAGE_PERCENT, MINI_BOSS_DAMAGE } from './constants';
import { bonusTotal, companionEffects } from './companions';
import { equipmentEffects, instantSaleValue, saleValue } from './equipment';
import { buildLevelMap, encountersFor, encounterTier, findNode, START_NODE_ID, type GameMap, type MapNode } from './map';
import { nextFloat, nextInt } from './rng';
import { rollSize, type Catch } from './sizes';
import { isAlive } from './effects';
import { creatureFamilies } from './families';
import { questsShownTo } from './unlocks';
import type { ShopVisit } from './shop';
import type { BuildDef, CardDef, CombatState, CompanionEffect, EnemyState, GameData } from './types';
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
  /** Fights started this run (won, fled or lost): each makes the next one tougher (`ENCOUNTER_GROWTH_PERCENT`). */
  fights: number;
  /** Index in `GameData.levels` of the level being played (an act of the run). */
  level: number;
  /** That level's map. */
  map: GameMap;
  /** Id of the map node the player is standing on. */
  position: string;
  /** Node ids travelled through, starting point included. */
  visited: string[];
  /**
   * The bucket: the creatures caught this run and not sold, in order, at most `BUCKET_SIZE`
   * (companions included). It only reaches the home aquarium if the run is won (`bringCatchHome`).
   */
  bucket: Catch[];
  /**
   * Catches that didn't fit in the bucket, waiting for the player to make room (`keepCatch`) or
   * sell them (`sellCatch`), first one first. The run can't go on until it's empty.
   */
  waiting: Catch[];
  /**
   * The creatures brought from the home aquarium, which give their companion bonus. Always the
   * first entries of `bucket`, in the same order (captures are added after them, and selling one
   * removes it from both). Their bond grows with every fight (`bondPerFight`).
   */
  companions: HomeCreature[];
  coins: number;
  /** Equipment ids carried this run. */
  equipment: string[];
  /** Card rewards skipped and rerolled on this level with companion bonuses (see `rewardOptions`). */
  rewardSkipsUsed: number;
  rewardRerollsUsed: number;
  /** Card reward rerolls left for the rest of the run, besides the companions' (`REWARD_REROLLS_AT_START`, `REWARD_REROLLS_PER_BOSS`). */
  rewardRerolls: number;
  /** A free card removal is on offer: a boss was just beaten (`enterNextLevel`), until it's used or the player moves on. */
  bossRemoval: boolean;
  /** Chance, in percent, that the next card reward slot is rare (`RARE_CHANCE`, raised by `RARE_PITY_STEP` per slot that wasn't). */
  rarePity: number;
  /** The families the card reward on offer draws from (the creatures of the fight it follows); none = every family. */
  rewardFamilies: string[];
  /** Fishermen standing on this run's maps (`fishermenToMeet` when it started). */
  fishermen: string[];
  /** Builds whose bucket quest the bucket met when the player met their fisherman (`questsShownTo`). */
  questsShown: string[];
  /** How many creatures the bucket holds, companions included: `BUCKET_SIZE`, plus any bucket extensions. */
  bucketSize: number;
  /** Store effects lasting a few fights (espresso, blessings). */
  boons: Boon[];
  /** Creatures posted home with a parcel: they join the home aquarium when the run ends, however it ends. */
  sentHome: HomeCreature[];
  /** The next card reward has at least one rare card (a lucky lure). */
  luckyLure: boolean;
  /** The next card reward offers this many more cards (spare hooks). */
  spareHooks: number;
}

/**
 * Something bought that lasts the next `fightsLeft` fights: a `bonus` each fight gets, as a
 * companion's, or `maxHp` added to the run's until it wears off (then Grit is capped to it).
 * Each fight that ends without losing the run uses one up (`finishCombat`).
 */
export interface Boon {
  fightsLeft: number;
  bonus?: CompanionEffect;
  maxHp?: number;
  /** What gave it, for its icon and text: the store item, and the blessing for a release. */
  item?: string;
  blessing?: string;
}

export const CARD_REWARD_COUNT = 3;
/** Chance, in percent, that a card reward slot is rare, after a rare was offered (and at the start of a run). */
export const RARE_CHANCE = 10;
/** How much that chance rises for every slot that wasn't rare. */
export const RARE_PITY_STEP = 2;
/** Card reward rerolls a run starts with, and how many each mini-boss and boss beaten adds. Unused ones carry over. */
export const REWARD_REROLLS_AT_START = 1;
export const REWARD_REROLLS_PER_BOSS = 1;
/** Chance that an event turns out to be an ordinary fight. */
export const EVENT_FIGHT_CHANCE = 0.1;
/** How many home-aquarium creatures the player can bring along in the bucket. */
export const SESSION_SLOTS = 3;
/** How many creatures the bucket holds, the brought ones included. */
export const BUCKET_SIZE = 7;

/**
 * Start a run on the first level, with the chosen build's starter deck, its chosen starting
 * `item`, and `brought` (creatures taken from the home aquarium, see `takeFromHome`) already in
 * the bucket. `fishermen` (`fishermenToMeet`) stand on the maps of their levels.
 */
export function createRun(
  seed: number,
  data: GameData,
  buildId: string,
  brought: readonly HomeCreature[] = [],
  item: string | undefined = data.builds[buildId]?.startingItems?.[0],
  fishermen: readonly string[] = [],
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
    fights: 0,
    level: 0,
    map: { columns: [] },
    position: START_NODE_ID,
    visited: [START_NODE_ID],
    bucket: brought.map(({ id, size }) => ({ id, size })),
    waiting: [],
    companions: brought.map((c) => ({ ...c })),
    coins: 0,
    equipment: item === undefined ? [] : [item],
    rewardSkipsUsed: 0,
    rewardRerollsUsed: 0,
    rewardRerolls: REWARD_REROLLS_AT_START,
    bossRemoval: false,
    rarePity: RARE_CHANCE,
    rewardFamilies: [],
    fishermen: [...fishermen],
    questsShown: [],
    bucketSize: BUCKET_SIZE,
    boons: [],
    sentHome: [],
    luckyLure: false,
    spareHooks: 0,
  };
  run.map = buildLevelMap(data, 0, run, run.fishermen);
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

/**
 * After a level's boss: the next level, back at the start of its map, with a free card removal on
 * offer (`removeCardAfterBoss`). Everything else carries over.
 */
export function enterNextLevel(run: RunState, data: GameData): RunState {
  if (isLastLevel(run, data)) throw new Error('There is no level after this one.');
  const next = {
    ...clone(run),
    level: run.level + 1,
    position: START_NODE_ID,
    visited: [START_NODE_ID],
    rewardSkipsUsed: 0,
    rewardRerollsUsed: 0,
    bossRemoval: true,
  };
  next.map = buildLevelMap(data, next.level, next, next.fishermen);
  return next;
}

/**
 * Has the run just beaten a level's boss? It then stands at the start of the next level, before
 * moving on: the card reward there can also remove a card (`bossRemoval`) or end the run.
 */
export function justBeatBoss(run: RunState): boolean {
  return run.level > 0 && run.position === START_NODE_ID;
}

/** Remove the deck card at `cardIndex`, for free, after a boss (`bossRemoval`). Throws when none is on offer or the deck would be empty. */
export function removeCardAfterBoss(run: RunState, cardIndex: number): RunState {
  if (!run.bossRemoval) throw new Error('No card removal on offer.');
  if (run.deck.length <= 1 || !run.deck[cardIndex]) throw new Error('Choose a card to remove.');
  return { ...clone(run), deck: run.deck.filter((_, i) => i !== cardIndex), bossRemoval: false };
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
  next.bossRemoval = false;
  return { next, node };
}

/** Move to an adjacent fight (mini-boss and boss included) and start it. Throws if the node isn't a reachable fight. */
export function travelTo(run: RunState, nodeId: string, data: GameData): { run: RunState; combat: CombatState } {
  const { next, node } = moveTo(run, nodeId, 'fight', 'miniBoss', 'boss');
  return { run: next, combat: startFight(next, node, data) };
}

/**
 * Start the fight at `node` (advancing `next`'s RNG): an encounter from its fishing spot at its
 * tier (`encountersFor`), only decided on arrival. Its creatures get at least `ENCOUNTER_HP_POOL`
 * Health together and deal `ENCOUNTER_TURN_AVERAGE` per turn on average, both growing with every fight before it
 * (a mini-boss and a boss roll their own damage instead); a group splits the damage
 * (`GROUP_DAMAGE_PERCENT` of a share each).
 */
function startFight(next: RunState, node: MapNode, data: GameData): CombatState {
  const pool = encountersFor(node, data);
  const encounter = pool[nextInt(next, 0, pool.length - 1)];
  const combatSeed = nextInt(next, 0, 0x7fffffff);
  const bond = bondPerFight(data.levels[next.level].tier, node.kind !== 'fight');
  next.companions = next.companions.map((c) => addBond(c, bond, data));
  const enemies = [...encounter.enemies, ...extraCatch(next, node, data)];
  const growth = 100 + ENCOUNTER_GROWTH_PERCENT * next.fights;
  next.fights++;
  const bossDamage = node.kind === 'miniBoss' ? MINI_BOSS_DAMAGE : node.kind === 'boss' ? BOSS_DAMAGE : null;
  const damage = bossDamage ? nextInt(next, bossDamage[0], bossDamage[1]) : (ENCOUNTER_TURN_AVERAGE * growth) / 100;
  return createCombat(
    {
      seed: combatSeed,
      deck: next.deck,
      enemies,
      playerHp: next.hp,
      playerMaxHp: next.maxHp,
      equipment: next.equipment,
      bonuses: [...companionEffects(next.companions, data), ...next.boons.flatMap((b) => (b.bonus ? [b.bonus] : []))],
      hpPool: Math.ceil((ENCOUNTER_HP_POOL * growth) / 100),
      damage: enemies.length > 1 ? (damage / enemies.length) * (GROUP_DAMAGE_PERCENT / 100) : damage,
      bosses: !!bossDamage,
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

/** Move to an adjacent fisherman (`MapNode.fisherman`): he talks, and sees the bucket for his bucket quests. */
export function visitFisherman(run: RunState, nodeId: string, data: GameData): RunState {
  const next = moveTo(run, nodeId, 'fisherman').next;
  const fisherman = findNode(next.map, nodeId)?.fisherman;
  const shown = fisherman ? questsShownTo(data, fisherman, next.bucket).filter((id) => !next.questsShown.includes(id)) : [];
  return shown.length ? { ...next, questsShown: [...next.questsShown, ...shown] } : next;
}

/**
 * Move to an adjacent shop, and open its store for this visit. The Bait shop draws, on arrival, the
 * blessing a release gives and the family its keeper's aquarium buys.
 */
export function visitShop(run: RunState, nodeId: string, data: GameData): { run: RunState; visit: ShopVisit } {
  const { next, node } = moveTo(run, nodeId, 'shop');
  const store = node.store ?? 'tackle';
  if (store !== 'bait') return { run: next, visit: { store, bought: {} } };
  const families = Object.keys(data.families);
  const blessing = data.blessings[nextInt(next, 0, data.blessings.length - 1)]?.id;
  const family = families[nextInt(next, 0, families.length - 1)];
  return { run: next, visit: { store, bought: {}, blessing, family } };
}

/**
 * The creatures `combat` caught, even in a fight another creature then fled, with their sizes
 * (`rollSize`, after the run's earlier fights; drained of Will rolls twice). None in a lost fight
 * or a release fight (`isReleaseFight`). Rolled from a copy of the fight's RNG, so calling this
 * again gives the same sizes.
 */
export function catchesOf(run: RunState, combat: CombatState): Catch[] {
  if (combat.phase === 'lost' || isReleaseFight(run)) return [];
  const rng = { rng: combat.rng };
  return combat.enemies
    .filter((e) => combat.phase === 'won' || !isAlive(e))
    .map((e) => ({ id: e.defId, size: rollSize(rng, run.fights - 1, e.hp > 0) }));
}

/**
 * Carry the fight's outcome into the run: HP, floor and, after a mini-boss or boss, a card reward
 * reroll (on a win), and the creatures captured (`catchesOf`): they go into the bucket unless
 * equipment sells them on the spot. Those that don't fit (`BUCKET_SIZE`) wait for the player's
 * choice (`waiting`).
 */
export function finishCombat(run: RunState, combat: CombatState, data: GameData): RunState {
  const next = { ...clone(run), hp: Math.max(0, combat.player.hp) };
  if (combat.phase === 'lost') return next;
  next.hp = Math.min(next.maxHp, next.hp + bonusTotal(combat.bonuses, 'healAfterFight'));
  if (combat.phase === 'won') next.floor++;
  if (combat.phase === 'won' && isReleaseFight(run)) next.rewardRerolls += REWARD_REROLLS_PER_BOSS;
  const sellBonus = bonusTotal(combat.bonuses, 'sellBonus');
  for (const caught of catchesOf(run, combat)) {
    const sale = instantSaleValue(caught.id, run.equipment, data, sellBonus);
    if (sale !== null) next.coins += sale;
    else if (next.bucket.length < next.bucketSize) next.bucket.push(caught);
    else next.waiting.push(caught);
  }
  return wearBoons(next);
}

/** One fight less on every boon; those used up are dropped, and a max Grit boon takes its Grit back off the cap. */
function wearBoons(run: RunState): RunState {
  for (const boon of run.boons) {
    boon.fightsLeft--;
    if (boon.fightsLeft <= 0 && boon.maxHp) {
      run.maxHp -= boon.maxHp;
      run.hp = Math.min(run.hp, run.maxHp);
    }
  }
  run.boons = run.boons.filter((b) => b.fightsLeft > 0);
  return run;
}

/** The first waiting catch goes into the bucket, in place of the creature at `slot`, which is sold (`sellCreature`). */
export function keepCatch(run: RunState, slot: number, data: GameData): RunState {
  const [caught, ...rest] = run.waiting;
  if (!caught) throw new Error('No catch is waiting.');
  const sold = sellCreature(run, slot, data);
  return { ...sold, bucket: [...sold.bucket, caught], waiting: rest };
}

/** Sell the first waiting catch, as `sellCreature` would. */
export function sellCatch(run: RunState, data: GameData): RunState {
  const [caught, ...rest] = run.waiting;
  if (!caught) throw new Error('No catch is waiting.');
  const sellBonus = bonusTotal(companionEffects(run.companions, data), 'sellBonus');
  return { ...clone(run), waiting: rest, coins: run.coins + saleValue(caught.id, sellBonus, data) };
}

/** Sell the bucket's creature at index `slot` for its sell value (plus companion sell bonuses). */
export function sellCreature(run: RunState, slot: number, data: GameData): RunState {
  const id = run.bucket[slot]?.id;
  if (id === undefined) throw new Error(`Nothing captured at slot ${slot}`);
  const sellBonus = bonusTotal(companionEffects(run.companions, data), 'sellBonus');
  return { ...withoutCreature(run, slot), coins: run.coins + saleValue(id, sellBonus, data) };
}

/** A copy of the run without the bucket's creature at `slot` (and its companion entry, if it's one). */
export function withoutCreature(run: RunState, slot: number): RunState {
  if (!run.bucket[slot]) throw new Error(`Nothing captured at slot ${slot}`);
  return { ...clone(run), bucket: run.bucket.filter((_, i) => i !== slot), companions: run.companions.filter((_, i) => i !== slot) };
}

/**
 * The bucket's creature at `slot` as it would live at home: a companion with the bond it gained,
 * a catch with its own bond (a blessing's) plus `bondOnCapture` equipment's share, capped at full.
 */
export function asHomeCreature(run: RunState, slot: number, data: GameData): HomeCreature {
  if (slot < run.companions.length) return { ...run.companions[slot] };
  const { id, size, bond = 0 } = run.bucket[slot];
  const percent = equipmentEffects(run.equipment, data).reduce((sum, e) => (e.type === 'bondOnCapture' ? sum + e.percent : sum), 0);
  return { id, size, bond: Math.min(bondToFull(id, data), bond + Math.round((bondToFull(id, data) * percent) / 100)) };
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
 * The home aquarium when a run ends. After a successful run (boss beaten, or the session finished
 * at a leave node) everything still in the bucket joins it, as `asHomeCreature`; after a lost run
 * only the creatures wearing a life jacket do. Creatures posted home with a parcel (`sentHome`)
 * join it either way. An abandoned run never calls this, so its bucket, companions included, is lost.
 */
export function bringCatchHome(home: readonly HomeCreature[], run: RunState, data: GameData, success = true): HomeCreature[] {
  const kept = run.bucket.flatMap((c, slot) => (success || c.lifeJacket ? [asHomeCreature(run, slot, data)] : []));
  return [...home, ...kept, ...run.sentHome.map((c) => ({ ...c }))];
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

/** The families of the creatures in a fight, each once: what its card reward draws from. */
export function fightFamilies(combat: CombatState, data: GameData): string[] {
  return [...new Set(combat.enemies.flatMap((e) => creatureFamilies(e.defId, data).map((f) => f.id)))];
}

export interface CardRewardOptions {
  /** Families to draw from (`fightFamilies`); the run's `rewardFamilies` if omitted (a reroll). None = every family. */
  families?: readonly string[];
  count?: number;
  /** Cards to leave out (the ones just offered, on a reroll), as long as enough others are left. */
  exclude?: readonly string[];
}

/** Rare cards are only offered from the run's first mini-boss on (its own reward included). */
export function raresUnlocked(run: RunState): boolean {
  return run.level > 0 || run.visited.some((id) => findNode(run.map, id)?.kind === 'miniBoss');
}

/**
 * Offer `count` distinct cards from the families' cards (never starter cards), topped up from every
 * family's when they run short. Each slot is rare with the run's `rarePity` chance: back to
 * `RARE_CHANCE` when a rare card is offered, `RARE_PITY_STEP` higher for every slot that isn't.
 * Before `raresUnlocked`, only normal cards are offered, and the chance doesn't grow. A mini-boss's
 * reward always has at least one rare card: the last slot is rare if none of the others were. A
 * lucky lure does the same for any reward, rares unlocked or not; spare hooks add to `count`.
 * Both are used up by this roll.
 */
export function rollCardRewards(run: RunState, data: GameData, opts: CardRewardOptions = {}): { run: RunState; choices: string[] } {
  const { count = CARD_REWARD_COUNT + run.spareHooks, exclude = [] } = opts;
  const next = clone(run);
  const families = [...(opts.families ?? run.rewardFamilies)];
  next.rewardFamilies = families;
  next.luckyLure = false;
  next.spareHooks = 0;
  const rares = raresUnlocked(run);
  const miniBoss = rares && findNode(run.map, run.position)?.kind === 'miniBoss';
  const offerable = Object.values(data.cards).filter(
    (c) => c.family !== undefined && (c.build === undefined || c.build === run.build) && (rares || run.luckyLure || c.rarity !== 'rare'),
  );
  const fresh = offerable.filter((c) => !exclude.includes(c.id));
  const everyFamily = fresh.length >= count ? fresh : offerable;
  const theirs = families.length ? everyFamily.filter((c) => families.includes(c.family!)) : everyFamily;

  const choices: string[] = [];
  for (let slot = 0; slot < count; slot++) {
    const rolled = rares && nextFloat(next) * 100 < next.rarePity ? 'rare' : 'normal';
    const noRareYet = !choices.some((id) => data.cards[id].rarity === 'rare');
    const rarity = (miniBoss || run.luckyLure) && slot === count - 1 && noRareYet ? 'rare' : rolled;
    const left = (pool: CardDef[]) => pool.filter((c) => !choices.includes(c.id));
    const candidates = [
      left(theirs).filter((c) => c.rarity === rarity),
      left(everyFamily).filter((c) => c.rarity === rarity),
      left(theirs),
      left(everyFamily),
    ].find((pool) => pool.length);
    if (!candidates) break;
    const card = candidates[nextInt(next, 0, candidates.length - 1)];
    choices.push(card.id);
    if (rares) next.rarePity = card.rarity === 'rare' ? RARE_CHANCE : next.rarePity + RARE_PITY_STEP;
  }
  return { run: next, choices };
}

/**
 * Card rewards must be taken, unless companion bonuses allow skipping (`rewardSkips`) them, this
 * many times per level. Rerolls are the run's own (`rewardRerolls`) plus the companions'
 * (`rewardRerolls` bonus, per level). These are the ones left.
 */
export function rewardOptions(run: RunState, data: GameData): { skips: number; rerolls: number } {
  const effects = companionEffects(run.companions, data);
  return {
    skips: Math.max(0, bonusTotal(effects, 'rewardSkips') - run.rewardSkipsUsed),
    rerolls: companionRerolls(run, data) + run.rewardRerolls,
  };
}

function companionRerolls(run: RunState, data: GameData) {
  return Math.max(0, bonusTotal(companionEffects(run.companions, data), 'rewardRerolls') - run.rewardRerollsUsed);
}

/** Leave a card reward without taking a card. Throws when no skip is left this level. */
export function skipReward(run: RunState, data: GameData): RunState {
  if (!rewardOptions(run, data).skips) throw new Error('No reward skip left this level.');
  return { ...clone(run), rewardSkipsUsed: run.rewardSkipsUsed + 1 };
}

/**
 * Other cards to choose from instead of `offered`. Uses a companion reroll first, as those don't
 * outlast the level, then one of the run's. Throws when none is left.
 */
export function rerollReward(run: RunState, data: GameData, offered: readonly string[]): { run: RunState; choices: string[] } {
  if (!rewardOptions(run, data).rerolls) throw new Error('No reward reroll left.');
  const used = companionRerolls(run, data)
    ? { ...run, rewardRerollsUsed: run.rewardRerollsUsed + 1 }
    : { ...run, rewardRerolls: run.rewardRerolls - 1 };
  return rollCardRewards(used, data, { exclude: offered, count: offered.length });
}

export function addCardToDeck(run: RunState, cardId: string, data: GameData): RunState {
  if (!data.cards[cardId]) throw new Error(`Unknown card "${cardId}"`);
  return { ...clone(run), deck: [...run.deck, cardId] };
}
