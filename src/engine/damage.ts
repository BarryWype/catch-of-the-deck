import { VULNERABLE_MULTIPLIER, WEAK_MULTIPLIER } from './constants';
import type { Combatant, Statuses } from './types';

/**
 * Damage of a single attack hit:
 *   (base + attacker Strength) × 0.75 if attacker is Weak × 1.5 if defender is Vulnerable,
 * rounded down, never below 0.
 */
export function calculateDamage(base: number, attacker?: Statuses, defender?: Statuses): number {
  let damage = base + (attacker?.strength ?? 0);
  if ((attacker?.weak ?? 0) > 0) damage *= WEAK_MULTIPLIER;
  if ((defender?.vulnerable ?? 0) > 0) damage *= VULNERABLE_MULTIPLIER;
  return Math.max(0, Math.floor(damage));
}

/** Block soaks damage first; the rest comes off HP. Mutates `target`. */
export function applyDamage(target: Combatant, amount: number): { blocked: number; hpLost: number } {
  const blocked = Math.min(target.block, amount);
  target.block -= blocked;
  const hpLost = Math.min(target.hp, amount - blocked);
  target.hp -= hpLost;
  return { blocked, hpLost };
}
