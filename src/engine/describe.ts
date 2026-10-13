import { calculateDamage, isStrongAgainst } from './damage';
import { STRONG_BONUS_PERCENT } from './constants';
import { statusName } from './statuses';
import { text } from './text';
import type { CardDef, Effect, Statuses } from './types';

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
  /** The effects are a creature's move: its damage wears down the player's Grit. */
  byCreature?: boolean;
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
      const hits = effect.hits ?? 1;
      const times = hits > 1 ? text('describe.times', { n: hits }) : '';
      // Always named, so a bracketed real number never appears without its reason.
      const extra = effect.bonus
        ? text('describe.bonus', { percent: STRONG_BONUS_PERCENT, types: effect.bonus.against.map((t) => opts.tagNames?.[t] ?? t).join(', ') })
        : '';
      const params = { dmg, times, extra };
      if (target === 'allEnemies') return text('describe.dealAll', params);
      if (target === 'randomEnemy') return text('describe.dealRandom', params);
      if (target === 'self') return text('describe.loseGrit', params);
      if (opts.byCreature) return text('describe.strike', params);
      return text('describe.deal', params);
    }
    case 'gainBlock':
      return text(opts.byCreature ? 'describe.gainBlock' : 'describe.gainHold', { n: effect.amount });
    case 'pull':
      return text('describe.pull', { n: effect.amount });
    case 'applyStatus': {
      const params = { n: Math.abs(effect.amount), status: statusName(effect.status) };
      const target = effect.target ?? 'target';
      if (target === 'self') return text(effect.amount >= 0 ? 'describe.gainStatus' : 'describe.loseStatus', params);
      return text(`describe.${effect.amount >= 0 ? 'applyStatus' : 'removeStatus'}.${target}`, params);
    }
    case 'drawCards':
      return text('describe.draw', { n: effect.amount });
    case 'gainEnergy':
      return text('describe.energy', { n: effect.amount });
    case 'changeEscape':
      return text(`describe.${effect.amount >= 0 ? 'raise' : 'lower'}.${effect.target ?? 'target'}`, { n: Math.abs(effect.amount) });
    case 'changeEscapeRate':
      return text(`describe.${effect.amount >= 0 ? 'faster' : 'slower'}.${effect.target ?? 'target'}`, { n: Math.abs(effect.amount) });
  }
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
  if (card.exhaust) parts.push(text('describe.exhaust'));
  return parts.join(' ');
}
