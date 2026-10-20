import { bondLevel, type HomeCreature } from './bond';
import { describeEffect } from './describe';
import { text } from './text';
import type { CompanionBonusDef, CompanionEffect, GameData } from './types';

/**
 * Creatures brought from the home aquarium (`RunState.companions`) give their temperament's
 * bonus for the run. Creatures captured along the way are angry and give nothing.
 *
 * Each companion has stars: its tier, plus one at bond level 2 and one more at level 3. A
 * temperament's stars add up its companions', counting each species once (the one with more
 * stars): two Clownfish are one reef fish. Its effects' amounts are read from their `byStars`
 * at that many stars, and at FULL_SCHOOL species its `fullSchool` effects are added too.
 * `extraStars` (the Logbook's, see `runCompanionEffects`) are added to every companion's.
 */
export const FULL_SCHOOL = 3;

export interface ActiveBonus {
  def: CompanionBonusDef;
  /** Distinct species of this temperament brought. */
  species: number;
  /** The temperament's stars. */
  stars: number;
  /** Scaled, plus `fullSchool` when reached. */
  effects: CompanionEffect[];
}

/** Stars of one companion: its tier, +1 at bond level 2, +1 more at level 3, plus `extraStars`. */
export function companionStars(creature: HomeCreature, data: GameData, extraStars = 0): number {
  const level = bondLevel(creature, data);
  return (data.enemies[creature.id]?.tier ?? 1) + (level >= 2 ? 1 : 0) + (level >= 3 ? 1 : 0) + extraStars;
}

function scale(effect: CompanionEffect, stars: number): CompanionEffect {
  if (!effect.byStars?.length) return effect;
  const amount = effect.byStars[Math.min(stars, effect.byStars.length) - 1];
  if (effect.type === 'trigger') return { ...effect, effect: { ...effect.effect, amount } as typeof effect.effect };
  return { ...effect, amount };
}

/** A temperament's effects at this many stars and species. */
export function bonusEffects(def: CompanionBonusDef, stars: number, species: number): CompanionEffect[] {
  const effects = def.effects.map((e) => scale(e, stars));
  return species >= FULL_SCHOOL ? [...effects, ...def.fullSchool] : effects;
}

/**
 * What more stars would change: the fewest stars to add (`more`) for an amount to change, and the
 * effects that change, at their new amounts. Null when no more stars change anything.
 */
export function nextStars(bonus: ActiveBonus): { more: number; effects: CompanionEffect[] } | null {
  const most = Math.max(0, ...bonus.def.effects.map((e) => e.byStars?.length ?? 0));
  for (let more = 1; bonus.stars + more <= most; more++) {
    const effects = bonus.def.effects.map((e) => scale(e, bonus.stars + more)).filter((e, i) => JSON.stringify(e) !== JSON.stringify(bonus.effects[i]));
    if (effects.length) return { more, effects };
  }
  return null;
}

/** The bonuses these companions give, in order of first appearance. */
export function activeBonuses(companions: readonly HomeCreature[], data: GameData, extraStars = 0): ActiveBonus[] {
  const byTemperament = new Map<string, Map<string, number>>();
  for (const creature of companions) {
    const temperament = data.enemies[creature.id]?.temperament;
    if (!temperament || !data.companionBonuses[temperament]) continue;
    if (!byTemperament.has(temperament)) byTemperament.set(temperament, new Map());
    const species = byTemperament.get(temperament)!;
    species.set(creature.id, Math.max(species.get(creature.id) ?? 0, companionStars(creature, data, extraStars)));
  }
  return [...byTemperament].map(([temperament, species]) => {
    const def = data.companionBonuses[temperament];
    const stars = [...species.values()].reduce((a, b) => a + b, 0);
    return { def, species: species.size, stars, effects: bonusEffects(def, stars, species.size) };
  });
}

export function companionEffects(companions: readonly HomeCreature[], data: GameData, extraStars = 0): CompanionEffect[] {
  return activeBonuses(companions, data, extraStars).flatMap((b) => b.effects);
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
