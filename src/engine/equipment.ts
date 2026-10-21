import { TROPHY_SELL_PERCENT } from './constants';
import { hasFeature } from './features';
import type { CatchSize } from './sizes';
import type { EquipmentEffect, GameData } from './types';

/** Every effect of the given equipment, in order. */
export function equipmentEffects(equipment: readonly string[], data: GameData): EquipmentEffect[] {
  return equipment.flatMap((id) => data.equipment[id]?.effects ?? []);
}

/** How much a `slowEscape` of `percent` takes off an escape rate: at least 1, rounded up, never below 0. */
export function escapeRateReduction(rate: number, percent: number): number {
  if (rate <= 0) return 0;
  return Math.min(rate, Math.max(1, Math.ceil((rate * percent) / 100)));
}

/** A creature's sell value raised by `percent`, rounded up; a trophy-size one's `TROPHY_SELL_PERCENT` of that, with `trophyElites`. */
export function saleValue(defId: string, percent: number, data: GameData, size?: CatchSize): number {
  const trophy = size === 'trophy' && hasFeature(data, 'trophyElites') ? TROPHY_SELL_PERCENT : 100;
  return Math.ceil(((data.enemies[defId]?.sellValue ?? 0) * (100 + percent) * trophy) / 10000);
}

/**
 * Coins a captured creature sells for on the spot, or null if no equipment sells
 * on capture (it goes into the bucket instead). Bonuses, and `extraPercent` (companions), add up.
 */
export function instantSaleValue(defId: string, equipment: readonly string[], data: GameData, extraPercent = 0, size?: CatchSize): number | null {
  const bonuses = equipmentEffects(equipment, data).filter((e) => e.type === 'sellOnCapture');
  if (!bonuses.length) return null;
  const percent = bonuses.reduce((sum, e) => sum + e.bonusPercent, extraPercent);
  return saleValue(defId, percent, data, size);
}
