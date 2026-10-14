import { describeEffect } from './describe';
import { text } from './text';
import type { CompanionBonusDef, CompanionEffect, GameData } from './types';

/**
 * Creatures brought from the home aquarium (`RunState.companions`) give their temperament's
 * bonus for the run. Creatures captured along the way are angry and give nothing.
 *
 * Only different species count: two Clownfish are one reef fish. With n species of a
 * temperament, each `amount` is multiplied by min(n, COMPANION_SCALE_CAP) (or read from the
 * effect's `bySpecies`), and at FULL_SCHOOL species its `fullSchool` effects are added too.
 */
export const COMPANION_SCALE_CAP = 2;
export const FULL_SCHOOL = 3;

export interface ActiveBonus {
  def: CompanionBonusDef;
  /** Distinct species of this temperament brought. */
  species: number;
  /** Scaled, plus `fullSchool` when reached. */
  effects: CompanionEffect[];
}

function scale(effect: CompanionEffect, species: number): CompanionEffect {
  if ('bySpecies' in effect && effect.bySpecies?.length) {
    return { ...effect, amount: effect.bySpecies[Math.min(species, effect.bySpecies.length) - 1] };
  }
  const factor = Math.min(species, COMPANION_SCALE_CAP);
  if (effect.type === 'trigger') {
    const inner = effect.effect;
    return { ...effect, effect: 'amount' in inner && typeof inner.amount === 'number' ? { ...inner, amount: inner.amount * factor } : inner };
  }
  return { ...effect, amount: effect.amount * factor };
}

/** The bonuses these companions give, in order of first appearance. */
export function activeBonuses(companions: readonly { id: string }[], data: GameData): ActiveBonus[] {
  const species = new Map<string, Set<string>>();
  for (const { id } of companions) {
    const temperament = data.enemies[id]?.temperament;
    if (!temperament || !data.companionBonuses[temperament]) continue;
    if (!species.has(temperament)) species.set(temperament, new Set());
    species.get(temperament)!.add(id);
  }
  return [...species].map(([temperament, ids]) => {
    const def = data.companionBonuses[temperament];
    const effects = def.effects.map((e) => scale(e, ids.size));
    if (ids.size >= FULL_SCHOOL) effects.push(...def.fullSchool);
    return { def, species: ids.size, effects };
  });
}

export function companionEffects(companions: readonly { id: string }[], data: GameData): CompanionEffect[] {
  return activeBonuses(companions, data).flatMap((b) => b.effects);
}

/** Total `amount` of every effect of this type. */
export function bonusTotal(effects: readonly CompanionEffect[], type: Exclude<CompanionEffect['type'], 'trigger'>): number {
  return effects.reduce((sum, e) => (e.type === type ? sum + e.amount : sum), 0);
}

/** Rules text for one companion effect. */
export function describeCompanionEffect(effect: CompanionEffect): string {
  if (effect.type === 'trigger') {
    const rule = describeEffect(effect.effect);
    // "Deal 2 damage." reads as "…: deal 2 damage." after the trigger.
    return text('companion.trigger', { when: text(`companion.when.${effect.on}`), rule: rule.charAt(0).toLowerCase() + rule.slice(1) });
  }
  // `dodgeAttacks` → `companion.dodgeAttacks`, and so on.
  return text(`companion.${effect.type}`, { n: effect.amount });
}
