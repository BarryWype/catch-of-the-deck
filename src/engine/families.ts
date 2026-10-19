import { text } from './text';
import type { CardDef, FamilyDef, GameData } from './types';

/**
 * Families pick a fight's card rewards. They are internal: the player only ever sees temperaments,
 * so a family is shown as its temperaments (`temperamentList`).
 */

/** The families a temperament belongs to, in content order. */
export function familiesOf(temperament: string | undefined, data: GameData): FamilyDef[] {
  if (!temperament) return [];
  return Object.values(data.families).filter((f) => f.temperaments.includes(temperament));
}

/** The families of a creature (an enemy id), through its temperament. */
export function creatureFamilies(enemyId: string, data: GameData): FamilyDef[] {
  return familiesOf(data.enemies[enemyId]?.temperament, data);
}

/** The cards a creature can offer: those of any of its families. */
export function cardsOfferedBy(enemyId: string, data: GameData): CardDef[] {
  const families = new Set(creatureFamilies(enemyId, data).map((f) => f.id));
  return Object.values(data.cards).filter((c) => c.family !== undefined && families.has(c.family));
}

/** Temperaments as the player reads them, icon and name: "🐚 Armored, 🦀 Clawed or ⭐ Bottom dweller". */
export function temperamentList(ids: readonly string[], data: GameData, last: 'or' | 'and'): string {
  const names = ids.map((id) => {
    const bonus = data.companionBonuses[id];
    return bonus ? `${bonus.icon ?? ''} ${bonus.temperamentName}`.trim() : id;
  });
  return names.length > 1 ? `${names.slice(0, -1).join(', ')}${text(`list.${last}`)}${names.at(-1)}` : names.join('');
}
