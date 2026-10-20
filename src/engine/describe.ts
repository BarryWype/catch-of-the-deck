import { calculateDamage } from './damage';
import { WIND_UP_PERCENT } from './constants';
import { statusName } from './statuses';
import { hasText, text } from './text';
import type { CardDef, Effect, Statuses } from './types';

export interface DescribeOptions {
  /** If given, damage numbers include the attacker's modifiers (Strength, Weak). */
  attacker?: Statuses;
  /** If given, single-target damage includes the defender's modifiers (Vulnerable). */
  defender?: Statuses;
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
      const perStacks = effect.perStatus && defender ? effect.perStatus.amount * (defender[effect.perStatus.status] ?? 0) : 0;
      const real = calculateDamage(effect.amount + perStacks + (opts.bonusDamage ?? 0), opts.attacker, defender);
      // The printed amount, then the real one in brackets when modifiers change it.
      const dmg = real === effect.amount ? `${real}` : `${effect.amount} (${real})`;
      const hits = effect.hits ?? 1;
      const times = hits > 1 ? text('describe.times', { n: hits }) : '';
      // Always named, so a bracketed real number never appears without its reason.
      const extra = effect.perStatus ? text('describe.perStatus', { n: effect.perStatus.amount, status: statusName(effect.perStatus.status) }) : '';
      const params = { dmg, times, extra };
      if (effect.fromHold) return text('describe.dealHold', params);
      if (target === 'allEnemies') return text('describe.dealAll', params);
      if (target === 'randomEnemy') return text('describe.dealRandom', params);
      if (target === 'self') return text('describe.loseGrit', params);
      if (opts.byCreature) return text('describe.strike', params);
      return text('describe.deal', params);
    }
    case 'gainBlock':
      return text(opts.byCreature ? 'describe.gainBlock' : 'describe.gainHold', { n: effect.amount });
    case 'pull':
      return text('describe.pull', { n: effect.amount }) + (effect.heavyIfNoHold ? ` ${text('describe.heavyIfNoHold')}` : '');
    case 'ink':
      return text('describe.ink');
    case 'addJunk':
      return text('describe.addJunk', { card: text(`describe.junkName.${effect.card}`) });
    case 'stealPatience':
      return text('describe.stealPatience', { n: effect.amount });
    case 'secondWind':
      return text('describe.secondWind');
    case 'applyStatus': {
      const params = { n: Math.abs(effect.amount), status: statusName(effect.status), windUpPercent: WIND_UP_PERCENT };
      const target = effect.target ?? 'target';
      // Statuses that change the next move say what they do (`describe.statusText.<status>.<target>`).
      const own = `describe.statusText.${effect.status}.${target}`;
      if (effect.amount > 0 && hasText(own)) return text(own, params);
      if (target === 'self') return text(effect.amount >= 0 ? 'describe.gainStatus' : 'describe.loseStatus', params);
      return text(`describe.${effect.amount >= 0 ? 'applyStatus' : 'removeStatus'}.${target}`, params);
    }
    case 'drawCards':
      return text('describe.draw', { n: effect.amount });
    case 'gainEnergy':
      return text('describe.energy', { n: effect.amount });
    case 'slowCap':
      return text('describe.slowCap', { n: effect.amount });
    case 'gainPatience':
      return text('describe.gainPatience', { n: effect.amount });
    case 'loseHold':
      return text(effect.share === 0.5 ? 'describe.loseHalfHold' : 'describe.loseHold', { n: Math.round(effect.share * 100) });
    case 'patienceToHold':
      return text('describe.patienceToHold', { n: effect.per });
    case 'keepHold':
      return text('describe.keepHold');
    case 'delayed': {
      const rules = describeEffects(effect.effects, opts);
      return text('describe.delayed', { n: effect.turns, rules: rules.charAt(0).toLowerCase() + rules.slice(1) });
    }
    case 'ifIntent': {
      const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
      const then = text(`describe.if.${effect.tag}`, { rules: lower(describeEffects(effect.then, opts)) });
      return effect.else?.length ? `${then} ${text('describe.if.otherwise', { rules: lower(describeEffects(effect.else, opts)) })}` : then;
    }
    case 'ifStatus': {
      const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
      const then = text('describe.ifStatus', { status: statusName(effect.status), rules: lower(describeEffects(effect.then, opts)) });
      return effect.else?.length ? `${then} ${text('describe.if.otherwise', { rules: lower(describeEffects(effect.else, opts)) })}` : then;
    }
    case 'ifNoAttack': {
      const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
      const then = text('describe.ifNoAttack', { rules: lower(describeEffects(effect.then, opts)) });
      return effect.else?.length ? `${then} ${text('describe.if.otherwise', { rules: lower(describeEffects(effect.else, opts)) })}` : then;
    }
    case 'coil':
      return text('describe.coil');
    case 'venomNow':
      return text('describe.venomNow');
    case 'power':
      return text(`describe.power.${effect.power}`, { n: effect.amount ?? 1 });
    case 'swapHealthAndWill':
      return text('describe.swap');
    case 'venomBonus':
      return text('describe.venomBonus', { n: effect.amount });
    case 'venomCoating':
      return text('describe.venomCoating', { n: effect.amount });
    case 'flipIntent':
      return text('describe.flipIntent');
    case 'rerollIntent':
      return text('describe.rerollIntent');
    case 'delayMove':
      return text(`describe.delayMove.${effect.target ?? 'target'}`);
    case 'holdFromIntent':
      return text('describe.holdFromIntent', { n: effect.max });
    case 'echoDamage':
      return text(effect.share === 0.5 ? 'describe.echoHalf' : 'describe.echo', { n: Math.round(effect.share * 100) });
    case 'heal':
      return text(`describe.heal.${effect.target ?? 'target'}`, { n: effect.amount });
    case 'healPercent':
      return text('describe.healPercent', { n: effect.percent });
    case 'changeEscape':
      if (effect.perStatus && effect.amount === 0) {
        return text('describe.drainPer', { n: Math.abs(effect.perStatus.amount), status: statusName(effect.perStatus.status) });
      }
      return text(`describe.${effect.amount >= 0 ? 'raise' : 'drain'}.${effect.target ?? 'target'}`, { n: Math.abs(effect.amount) });
    case 'multiplyStatus':
      return text(effect.max === undefined ? 'describe.multiply' : 'describe.multiplyMax', {
        status: statusName(effect.status),
        times: effect.factor,
        max: effect.max ?? 0,
      });
  }
}

export function describeEffects(effects: Effect[], opts: DescribeOptions = {}): string {
  return effects.map((e) => describeEffect(e, opts)).join(' ');
}

/** Card rules text: the explicit `description` override, or generated from effects. */
export function describeCard(card: CardDef, opts: DescribeOptions = {}): string {
  if (card.description) return card.description;
  const parts = card.effects.map((e) => describeEffect(e, opts));
  if (card.unplayable) parts.push(text('describe.unplayable'));
  if (card.inHand?.gritAtEndOfTurn) parts.push(text('describe.inHandGrit', { n: card.inHand.gritAtEndOfTurn }));
  if (card.inHand?.holdLess) parts.push(text('describe.inHandHold', { n: card.inHand.holdLess }));
  if (card.target === 'random') parts.push(text('describe.onRandom'));
  if (card.exhaust) parts.push(text(card.type === 'junk' ? 'describe.clearJunk' : 'describe.exhaust'));
  if (card.bait) parts.push(text('describe.bait'));
  return parts.join(' ');
}
