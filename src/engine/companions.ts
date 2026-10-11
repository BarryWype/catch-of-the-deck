import { ESCAPE_BAR_NAME } from './constants';
import { describeEffect } from './describe';
import type { CompanionBonusDef, CompanionEffect, CompanionTrigger, GameData } from './types';

/**
 * Creatures brought from the home aquarium (`RunState.companions`) give their temperament's
 * bonus for the run. Creatures captured along the way are angry and give nothing.
 *
 * Only different species count: two Clownfish are one reef fish. With n species of a
 * temperament, each `amount` is multiplied by min(n, COMPANION_SCALE_CAP), and at
 * FULL_SCHOOL species its `fullSchool` effects are added too.
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

function scale(effect: CompanionEffect, factor: number): CompanionEffect {
  if (effect.type === 'trigger') return { ...effect, effect: { ...effect.effect, amount: effect.effect.amount * factor } };
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
    const factor = Math.min(ids.size, COMPANION_SCALE_CAP);
    const effects = def.effects.map((e) => scale(e, factor));
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

const TRIGGER_TEXT: Record<CompanionTrigger, string> = {
  combatStart: 'At the start of each fight',
  firstAttackEachTurn: 'Your first attack each turn',
  firstAttackEachFight: 'Your first attack each fight',
  fullBlock: 'When you fully block an attack',
  hitByEnemy: 'When an enemy hits you',
  firstBelowHalfHp: 'The first time you drop below 50% HP in a fight',
};

/** Rules text for one companion effect. */
export function describeCompanionEffect(effect: CompanionEffect): string {
  const a = 'amount' in effect ? effect.amount : 0;
  switch (effect.type) {
    case 'bonusBlock':
      return `Whenever you gain Block, gain ${a} more.`;
    case 'keepBlock':
      return `Keep up to ${a} Block for your next turn.`;
    case 'bonusDamage':
      return `+${a} damage on every hit.`;
    case 'firstAttackDamage':
      return `Your first attack each fight deals ${a}% more damage.`;
    case 'dodgeAttacks':
      return a === 1 ? 'The first attack against you each fight deals 0 damage.' : `The first ${a} attacks against you each fight deal 0 damage.`;
    case 'bonusEscapeReduction':
      return `Cards that lower ${ESCAPE_BAR_NAME} lower it by ${a} more.`;
    case 'slowEscape':
      return `Enemies' ${ESCAPE_BAR_NAME} rises ${a}% slower.`;
    case 'bonusMaxHp':
      return `+${a} max HP.`;
    case 'healAfterFight':
      return `Heal ${a} HP after each fight.`;
    case 'sellBonus':
      return `Creatures sell for ${a}% more.`;
    case 'trigger': {
      const text = describeEffect(effect.effect);
      // "Deal 2 damage." reads as "…: deal 2 damage." after the trigger.
      return `${TRIGGER_TEXT[effect.on]}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
  }
}
