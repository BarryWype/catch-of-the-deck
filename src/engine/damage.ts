import { STRONG_BONUS_PERCENT, VULNERABLE_MULTIPLIER, WEAK_MULTIPLIER } from './constants';
import type { Combatant, DamageBonus, Statuses } from './types';

/** Does a damage bonus apply against a defender with these tags? */
export function isStrongAgainst(bonus: DamageBonus | undefined, defenderTags: readonly string[] | undefined): boolean {
  return !!bonus && !!defenderTags && bonus.against.some((tag) => defenderTags.includes(tag));
}

/** Tags of a combatant (only enemies carry creature types). */
export function tagsOf(combatant: Combatant): string[] {
  return 'tags' in combatant && Array.isArray(combatant.tags) ? (combatant.tags as string[]) : [];
}

/**
 * Damage of a single attack hit:
 *   (base + attacker Strength) × 0.75 if attacker is Weak × 1.5 if defender is Vulnerable,
 * rounded down, never below 0; then, if the attacker is `strong` against the defender (a card's
 * type `bonus`), STRONG_BONUS_PERCENT more, rounded.
 */
export function calculateDamage(base: number, attacker?: Statuses, defender?: Statuses, strong = false): number {
  let damage = base + (attacker?.strength ?? 0);
  if ((attacker?.weak ?? 0) > 0) damage *= WEAK_MULTIPLIER;
  if ((defender?.vulnerable ?? 0) > 0) damage *= VULNERABLE_MULTIPLIER;
  damage = Math.max(0, Math.floor(damage));
  return strong ? Math.round((damage * (100 + STRONG_BONUS_PERCENT)) / 100) : damage;
}

/** Block soaks damage first; the rest comes off HP. Mutates `target`. */
export function applyDamage(target: Combatant, amount: number): { blocked: number; hpLost: number } {
  const blocked = Math.min(target.block, amount);
  target.block -= blocked;
  const hpLost = Math.min(target.hp, amount - blocked);
  target.hp -= hpLost;
  return { blocked, hpLost };
}
