import { calculateDamage, isStrongAgainst } from './damage';
import { ESCAPE_BAR_NAME, STRONG_BONUS_PERCENT } from './constants';
import { STATUS_META } from './statuses';
import type { CardDef, Effect, EffectTarget, Statuses } from './types';

export interface DescribeOptions {
  /** If given, damage numbers include the attacker's modifiers (Strength, Weak). */
  attacker?: Statuses;
  /** If given, single-target damage includes the defender's modifiers (Vulnerable). */
  defender?: Statuses;
  /** If given, single-target damage includes type bonuses that apply to this defender. */
  defenderTags?: string[];
  /** Display names for tags (creature types) in bonus text. */
  tagNames?: Record<string, string>;
  /** Extra damage per hit from companion bonuses (`bonusDamage`). */
  bonusDamage?: number;
}

/** Human-readable rules text for one effect primitive. */
export function describeEffect(effect: Effect, opts: DescribeOptions = {}): string {
  switch (effect.type) {
    case 'dealDamage': {
      const target = effect.target ?? 'target';
      const defender = target === 'target' ? opts.defender : undefined;
      const strong = isStrongAgainst(effect.bonus, target === 'target' ? opts.defenderTags : undefined);
      const real = calculateDamage(effect.amount + (opts.bonusDamage ?? 0), opts.attacker, defender, strong);
      // The printed amount, then the real one in brackets when modifiers change it.
      const dmg = real === effect.amount ? `${real}` : `${effect.amount} (${real})`;
      const times = (effect.hits ?? 1) > 1 ? ` ${effect.hits} times` : '';
      // Always named, so a bracketed real number never appears without its reason.
      const extra = effect.bonus
        ? ` (+${STRONG_BONUS_PERCENT}% vs ${effect.bonus.against.map((t) => opts.tagNames?.[t] ?? t).join(', ')})`
        : '';
      if (target === 'allEnemies') return `Deal ${dmg} damage to ALL enemies${times}${extra}.`;
      if (target === 'randomEnemy') return `Deal ${dmg} damage to a random enemy${times}${extra}.`;
      if (target === 'self') return `Take ${dmg} damage${times}.`;
      return `Deal ${dmg} damage${times}${extra}.`;
    }
    case 'gainBlock':
      return `Gain ${effect.amount} Block.`;
    case 'applyStatus': {
      const name = STATUS_META[effect.status].name;
      const n = Math.abs(effect.amount);
      const target = effect.target ?? 'target';
      if (target === 'self') return effect.amount >= 0 ? `Gain ${n} ${name}.` : `Lose ${n} ${name}.`;
      const who = target === 'allEnemies' ? 'ALL enemies' : target === 'randomEnemy' ? 'a random enemy' : '';
      if (effect.amount >= 0) return `Apply ${n} ${name}${who ? ` to ${who}` : ''}.`;
      return `${who ? who.charAt(0).toUpperCase() + who.slice(1) : 'Enemy'} loses ${n} ${name}.`;
    }
    case 'drawCards':
      return `Draw ${effect.amount} card${effect.amount === 1 ? '' : 's'}.`;
    case 'gainEnergy':
      return `Gain ${effect.amount} Energy.`;
    case 'changeEscape': {
      const verb = effect.amount >= 0 ? 'Raise' : 'Lower';
      return `${verb} ${whose(effect.target)} ${ESCAPE_BAR_NAME} by ${Math.abs(effect.amount)}.`;
    }
    case 'changeEscapeRate': {
      const who = whose(effect.target);
      const speed = effect.amount >= 0 ? 'faster' : 'slower';
      return `${who.charAt(0).toUpperCase() + who.slice(1)} ${ESCAPE_BAR_NAME} rises ${Math.abs(effect.amount)} ${speed} each turn.`;
    }
  }
}

function whose(target: EffectTarget = 'target'): string {
  if (target === 'allEnemies') return "ALL enemies'";
  if (target === 'randomEnemy') return "a random enemy's";
  return 'its';
}

export function describeEffects(effects: Effect[], opts: DescribeOptions = {}): string {
  return effects.map((e) => describeEffect(e, opts)).join(' ');
}

/** Does any of the card's damage get a type bonus against an enemy with these tags? */
export function isCardEffectiveAgainst(card: CardDef, tags: readonly string[]): boolean {
  return card.effects.some((e) => e.type === 'dealDamage' && isStrongAgainst(e.bonus, tags));
}

/** Card rules text: the explicit `description` override, or generated from effects. */
export function describeCard(card: CardDef, opts: DescribeOptions = {}): string {
  if (card.description) return card.description;
  const parts = card.effects.map((e) => describeEffect(e, opts));
  if (card.exhaust) parts.push('Exhaust.');
  return parts.join(' ');
}
