import { PATIENCE_ESCAPE_PERCENT } from './constants';
import { escapeRateReduction } from './equipment';
import { text } from './text';
import type { Combatant, EnemyState, StatusId } from './types';

/** How a status behaves. Its name and description are text (`status.<id>` in a language file). */
export interface StatusMeta {
  kind: 'buff' | 'debuff';
  /** Loses 1 stack at the end of its owner's turn. */
  decays: boolean;
}

export const STATUS_META: Record<StatusId, StatusMeta> = {
  strength: { kind: 'buff', decays: false },
  vulnerable: { kind: 'debuff', decays: true },
  weak: { kind: 'debuff', decays: true },
  poison: { kind: 'debuff', decays: true },
  snared: { kind: 'debuff', decays: true },
};

export const statusName = (id: StatusId) => text(`status.${id}.name`);
export const statusDescription = (id: StatusId) => text(`status.${id}.description`);

export function getStatus(combatant: Combatant, id: StatusId): number {
  return combatant.statuses[id] ?? 0;
}

export function addStatus(combatant: Combatant, id: StatusId, amount: number): void {
  const next = getStatus(combatant, id) + amount;
  // Decaying statuses are durations, so they can't go negative. Strength can.
  if (next === 0 || (STATUS_META[id].decays && next < 0)) {
    delete combatant.statuses[id];
  } else {
    combatant.statuses[id] = next;
  }
}

/** End-of-turn upkeep for one combatant: Poison hits, then durations count down. */
export function tickStatuses(combatant: Combatant): void {
  combatant.hp = Math.max(0, combatant.hp - getStatus(combatant, 'poison'));
  for (const id of Object.keys(combatant.statuses) as StatusId[]) {
    if (STATUS_META[id].decays) addStatus(combatant, id, -1);
  }
}

export function isDebuff(id: StatusId, amount: number): boolean {
  return STATUS_META[id].kind === 'debuff' || amount < 0;
}

/**
 * How much the escape bar rises on the creature's next turn: its `escapeRate`, slowed by the
 * player's Patience (`PATIENCE_ESCAPE_PERCENT` per point).
 */
export function escapeRise(enemy: EnemyState, patience = 0): number {
  if (getStatus(enemy, 'snared') > 0) return 0;
  const percent = Math.min(100, patience * PATIENCE_ESCAPE_PERCENT);
  return percent ? enemy.escapeRate - escapeRateReduction(enemy.escapeRate, percent) : enemy.escapeRate;
}
