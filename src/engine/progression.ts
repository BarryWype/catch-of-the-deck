import { findNode } from './map';
import { text } from './text';
import type { RunState } from './run';
import type { CombatState, GameData, ProgressionEffect, ProgressionNodeDef, ShopItemDef } from './types';

/**
 * The Logbook: nodes bought between runs with golden shells, earned by beating mini-bosses and
 * bosses. The profile keeps the shells and the nodes bought; a run starts with the nodes bought
 * (`createRun`, kept in `RunState.progression`) and each effect is read where its number is used:
 * the run's start (rerolls, coins, bucket), the stores (`storeItems`), sale values (`runSellBonus`),
 * card rewards (`rollCardRewards`), companion stars (`runCompanionEffects`) and, between runs, the
 * creatures resting at home (`restAtHome`).
 */

/** Golden shells for beating a mini-boss, and a boss. */
export const GOLDEN_SHELLS = { miniBoss: 1, boss: 2 } as const;

/** What the player keeps for the Logbook. */
export interface Logbook {
  shells: number;
  /** Node ids bought. */
  unlocked: string[];
}

/** Golden shells `combat`, fought where the run stands, earns: a won mini-boss or boss only. */
export function shellsEarned(run: RunState, combat: CombatState): number {
  const kind = findNode(run.map, run.position)?.kind;
  return combat.phase === 'won' && (kind === 'miniBoss' || kind === 'boss') ? GOLDEN_SHELLS[kind] : 0;
}

/** The effects of the nodes bought, in content order. */
export function progressionEffects(unlocked: readonly string[], data: GameData): ProgressionEffect[] {
  return data.progression.filter((n) => unlocked.includes(n.id)).map((n) => n.effect);
}

/** Total `amount` of the bought nodes' effects of this type. */
export function progressionTotal(unlocked: readonly string[], data: GameData, type: Extract<ProgressionEffect, { amount: number }>['type']): number {
  return progressionEffects(unlocked, data).reduce((sum, e) => (e.type === type ? sum + e.amount : sum), 0);
}

/** The bond level creatures resting at home grow to: 1, or the highest a bought node gives. */
export function restingBondLevel(unlocked: readonly string[], data: GameData): number {
  return progressionEffects(unlocked, data).reduce((level, e) => (e.type === 'restingBondLevel' ? Math.max(level, e.level) : level), 1);
}

/** Is the store item sold? Items a node unlocks (`shopItem`) are only sold once it's bought. */
export function isShopItemUnlocked(item: ShopItemDef, unlocked: readonly string[], data: GameData): boolean {
  const unlocks = (n: ProgressionNodeDef) => n.effect.type === 'shopItem' && n.effect.item === item.id;
  return !data.progression.some(unlocks) || data.progression.some((n) => unlocks(n) && unlocked.includes(n.id));
}

/** A store price after the bought discounts, rounded down. */
export function discountedPrice(price: number, unlocked: readonly string[], data: GameData): number {
  return Math.floor((price * (100 - progressionTotal(unlocked, data, 'shopDiscount'))) / 100);
}

/** Why the node can't be bought now, or null if it can. */
export function nodeBlocked(id: string, logbook: Logbook, data: GameData): string | null {
  const node = data.progression.find((n) => n.id === id);
  if (!node) return text('logbook.unknown');
  if (logbook.unlocked.includes(id)) return text('logbook.bought');
  if (!node.requires.every((r) => logbook.unlocked.includes(r))) return text('logbook.locked');
  if (logbook.shells < node.cost) return text('logbook.notEnoughShells');
  return null;
}

/** Buy a node: its cost in shells is spent. Throws when `nodeBlocked`. */
export function buyNode(logbook: Logbook, id: string, data: GameData): Logbook {
  const blocked = nodeBlocked(id, logbook, data);
  if (blocked) throw new Error(blocked);
  const node = data.progression.find((n) => n.id === id)!;
  return { shells: logbook.shells - node.cost, unlocked: [...logbook.unlocked, id] };
}

/**
 * The Logbook's layout: one column per track, in order of first appearance, and each node's row,
 * one below the deepest node it requires (0 with none).
 */
export function progressionLayout(data: GameData): { tracks: string[]; nodes: { node: ProgressionNodeDef; column: number; row: number }[] } {
  const tracks = [...new Set(data.progression.map((n) => n.track))];
  const rows = new Map<string, number>();
  const rowOf = (node: ProgressionNodeDef): number => {
    if (!rows.has(node.id)) {
      const required = data.progression.filter((n) => node.requires.includes(n.id));
      rows.set(node.id, required.length ? 1 + Math.max(...required.map(rowOf)) : 0);
    }
    return rows.get(node.id)!;
  };
  return { tracks, nodes: data.progression.map((node) => ({ node, column: tracks.indexOf(node.track), row: rowOf(node) })) };
}
