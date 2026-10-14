import type { CardDef, FamilyDef, GameData } from './types';

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
