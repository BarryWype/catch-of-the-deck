import { nextFloat } from './rng';

/**
 * Every caught creature rolls a size. It stays with the creature, in the bucket and at home, and
 * the creature book keeps the biggest of each species. Nothing else reads it yet.
 */
export type CatchSize = 'small' | 'normal' | 'large' | 'trophy';
/** A caught creature: its enemy definition id, and its size. */
export interface Catch {
  id: string;
  size: CatchSize;
  /** Bond points it will arrive home with (a Bait shop blessing); companions keep theirs in `RunState.companions`. */
  bond?: number;
  /** Wears a life jacket: it reaches the home aquarium even if the run is lost. */
  lifeJacket?: boolean;
}

/** Smallest first. */
export const CATCH_SIZES: readonly CatchSize[] = ['small', 'normal', 'large', 'trophy'];

/** Chances, in percent, on a run's first fight. */
export const SIZE_ODDS: Readonly<Record<CatchSize, number>> = { small: 30, normal: 50, large: 17, trophy: 3 };
/** Each fight played before moves this much of the small chance to large, and this much to trophy… */
export const SIZE_SHIFT_LARGE = 1;
export const SIZE_SHIFT_TROPHY = 0.5;
/** …until small is down to this; then the odds stop moving. */
export const SMALL_FLOOR = 5;

/** The size chances, in percent, after `fightsBefore` fights this run. */
export function sizeOdds(fightsBefore: number): Record<CatchSize, number> {
  const shift = SIZE_SHIFT_LARGE + SIZE_SHIFT_TROPHY;
  const moved = Math.min(fightsBefore * shift, SIZE_ODDS.small - SMALL_FLOOR);
  return {
    small: SIZE_ODDS.small - moved,
    normal: SIZE_ODDS.normal,
    large: SIZE_ODDS.large + (moved * SIZE_SHIFT_LARGE) / shift,
    trophy: SIZE_ODDS.trophy + (moved * SIZE_SHIFT_TROPHY) / shift,
  };
}

export function biggerSize(a: CatchSize, b: CatchSize): CatchSize {
  return CATCH_SIZES.indexOf(a) >= CATCH_SIZES.indexOf(b) ? a : b;
}

/** A size at `sizeOdds(fightsBefore)`. Caught by draining Will (`byWill`): rolls twice, keeps the bigger. */
export function rollSize(state: { rng: number }, fightsBefore: number, byWill: boolean): CatchSize {
  const odds = sizeOdds(fightsBefore);
  const roll = (): CatchSize => {
    let left = nextFloat(state) * 100;
    for (const size of CATCH_SIZES) {
      left -= odds[size];
      if (left < 0) return size;
    }
    return 'trophy';
  };
  const first = roll();
  return byWill ? biggerSize(first, roll()) : first;
}

/** The creature book's biggest catch of each species, with `caught` added. Returns `biggest` itself when nothing grew. */
export function recordSizes(
  biggest: Readonly<Record<string, CatchSize>>,
  caught: readonly Catch[],
): Readonly<Record<string, CatchSize>> {
  const updates = caught.filter((c) => !biggest[c.id] || biggerSize(c.size, biggest[c.id]) !== biggest[c.id]);
  if (!updates.length) return biggest;
  const next = { ...biggest };
  for (const c of updates) next[c.id] = next[c.id] ? biggerSize(next[c.id], c.size) : c.size;
  return next;
}
