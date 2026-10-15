import { MAX_SLOW_PERCENT, PATIENCE_ESCAPE_PERCENT, SLOW_PERCENT, WIND_UP_PERCENT } from './constants';
import { escapeRateReduction } from './equipment';
import { text } from './text';
import type { Combatant, EnemyState, MoveTag, StatusId } from './types';

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
  // Venom counts down by itself, right after it hits (`tickVenom`).
  venom: { kind: 'debuff', decays: false },
  // Each stack slows the escape bar (see `escapeRise`); one wears off each turn.
  slow: { kind: 'debuff', decays: true },
  // Used up by the creature's next move of the kind they change (see `nextMoveMods`).
  cowed: { kind: 'debuff', decays: false },
  intimidated: { kind: 'debuff', decays: false },
  lured: { kind: 'debuff', decays: false },
  distracted: { kind: 'debuff', decays: false },
  // Lasts its stacks in turns.
  dazzled: { kind: 'debuff', decays: true },
  snared: { kind: 'debuff', decays: true },
  // Used up by the creature's next move (see `nextMoveMods`).
  windUp: { kind: 'buff', decays: false },
};

export const statusName = (id: StatusId) => text(`status.${id}.name`);
export const statusDescription = (id: StatusId) => text(`status.${id}.description`, { slowPercent: SLOW_PERCENT, maxSlowPercent: MAX_SLOW_PERCENT });

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

/** End-of-turn upkeep for one combatant: durations count down. */
export function tickStatuses(combatant: Combatant, keep: readonly StatusId[] = []): void {
  for (const id of Object.keys(combatant.statuses) as StatusId[]) {
    if (STATUS_META[id].decays && !keep.includes(id)) addStatus(combatant, id, -1);
  }
}


/** Dazzled creatures' escape bars rise this much faster, in percent. */
export const DAZZLE_PERCENT = 50;

/**
 * How a creature's next move is changed by its statuses: the share of its total Strike damage or
 * Pull that lands (`scale`, rounded down), how much less a Strike deals (`less`), and which
 * statuses it uses up.
 */
export function nextMoveMods(enemy: Combatant, tag: MoveTag): { scale: number; less: number; used: StatusId[] } {
  const has = (id: StatusId) => getStatus(enemy, id) > 0;
  const used: StatusId[] = [];
  let scale = 1;
  let less = 0;
  if (has('windUp')) {
    scale *= 1 + WIND_UP_PERCENT / 100;
    used.push('windUp');
  }
  if (has('cowed')) {
    scale *= 0.5;
    used.push('cowed');
  }
  if (tag === 'strike') {
    if (has('intimidated')) {
      scale *= 0.5;
      used.push('intimidated');
    }
    if (has('dazzled')) scale *= 1 - DAZZLE_PERCENT / 100;
    if (has('distracted')) {
      less = getStatus(enemy, 'distracted');
      used.push('distracted');
    }
  } else if (has('lured')) {
    scale *= 0.5;
    used.push('lured');
  }
  return { scale, less, used };
}

export function isDebuff(id: StatusId, amount: number): boolean {
  return STATUS_META[id].kind === 'debuff' || amount < 0;
}

/**
 * How much the escape bar rises on the creature's next turn: its `escapeRate`, slowed by its Slow
 * (`SLOW_PERCENT` per stack) and the player's Patience (`PATIENCE_ESCAPE_PERCENT` per point),
 * added up, but never by more than `cap` percent (`CombatState.slowCap`).
 */
export function escapeRise(enemy: EnemyState, patience = 0, cap = MAX_SLOW_PERCENT): number {
  if (getStatus(enemy, 'snared') > 0) return 0;
  const percent = Math.min(cap, getStatus(enemy, 'slow') * SLOW_PERCENT + patience * PATIENCE_ESCAPE_PERCENT);
  const rise = percent ? enemy.escapeRate - escapeRateReduction(enemy.escapeRate, percent) : enemy.escapeRate;
  // Dazzled: faster, after the slowing.
  return getStatus(enemy, 'dazzled') > 0 ? Math.floor((rise * (100 + DAZZLE_PERCENT)) / 100) : rise;
}
