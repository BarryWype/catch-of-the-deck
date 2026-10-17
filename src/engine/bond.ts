import type { Catch } from './sizes';
import type { GameData } from './types';

/**
 * Bond between the player and a creature in the home aquarium. Points add up toward the
 * creature's `bondToFull` (set from its tier in content); the level comes from the share reached.
 *
 * - Brought along on a run: `bondPerFight` for every fight it meets. It keeps them only if the
 *   run succeeds (a lost run loses the whole bucket, companions included).
 * - Left at home: +BOND_AT_HOME after every run, but never past level 1.
 * - Hatched from an egg: starts at level 1.
 */
export const BOND_AT_HOME = 2;
/** Share of `bondToFull` needed for levels 1, 2 and 3. */
export const BOND_LEVELS = [0.2, 0.5, 1] as const;
export const MAX_BOND_LEVEL = BOND_LEVELS.length;

/** One creature living in the home aquarium. */
export interface HomeCreature extends Catch {
  /** Bond points, 0 to its `bondToFull`. */
  bond: number;
}

/** Bond a companion gains from a fight: the level's tier (kid 1, adult 2, elder 3), doubled against a mini-boss or boss. */
export function bondPerFight(levelTier: number, boss: boolean): number {
  return levelTier * (boss ? 2 : 1);
}

export function bondToFull(id: string, data: GameData): number {
  return data.enemies[id]?.bondToFull ?? 100;
}

/** Points needed to reach `level` (1–3), rounded up. */
export function bondThreshold(id: string, level: number, data: GameData): number {
  return Math.ceil(bondToFull(id, data) * BOND_LEVELS[level - 1]);
}

/** 0 (no bond yet) to MAX_BOND_LEVEL (fully bonded). */
export function bondLevel(creature: HomeCreature, data: GameData): number {
  let level = 0;
  while (level < MAX_BOND_LEVEL && creature.bond >= bondThreshold(creature.id, level + 1, data)) level++;
  return level;
}

/** `points` more bond, never past fully bonded. */
export function addBond(creature: HomeCreature, points: number, data: GameData): HomeCreature {
  return { ...creature, bond: Math.min(bondToFull(creature.id, data), creature.bond + points) };
}

/** After every run: creatures that stayed home grow a little closer, up to level 1. */
export function restAtHome(home: readonly HomeCreature[], data: GameData): HomeCreature[] {
  return home.map((c) => {
    const cap = Math.max(c.bond, bondThreshold(c.id, 1, data));
    return { ...c, bond: Math.min(cap, c.bond + BOND_AT_HOME) };
  });
}

/** A baby out of an egg: small, and already at level 1. */
export function hatchling(id: string, data: GameData): HomeCreature {
  return { id, bond: bondThreshold(id, 1, data), size: 'small' };
}

/**
 * Bond points moved to a new `bondToFull`, from `oldFull`: the same share of full bond (rounded),
 * and never a lower level than the creature had.
 */
export function rescaleBond(creature: HomeCreature, oldFull: number, data: GameData): HomeCreature {
  let oldLevel = 0;
  while (oldLevel < MAX_BOND_LEVEL && creature.bond >= Math.ceil(oldFull * BOND_LEVELS[oldLevel])) oldLevel++;
  const bond = Math.min(bondToFull(creature.id, data), Math.round((creature.bond / oldFull) * bondToFull(creature.id, data)));
  return { ...creature, bond: oldLevel ? Math.max(bond, bondThreshold(creature.id, oldLevel, data)) : bond };
}
