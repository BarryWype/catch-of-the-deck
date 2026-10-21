import { hasFeature } from './features';
import type { AffixRule, EnemyState, GameData, TraitRule } from './types';

/**
 * A creature's trait rule, while `traits` is on. Each rule acts where its hook is: hits and Drain
 * taken in `resolveEffect` (effects.ts), the player's Grit after a creature's hit (`afterEnemyHit`),
 * its turn start, Block and Will in `endTurn` (combat.ts), its moves in `chooseIntent` (intents.ts).
 */
export function traitOf(enemy: EnemyState, data: GameData | undefined): TraitRule | undefined {
  if (!data || !hasFeature(data, 'traits')) return undefined;
  return data.enemies[enemy.defId]?.trait?.rule;
}

/** A creature's affix rule this fight, while `affixes` is on. */
export function affixOf(enemy: EnemyState, data: GameData | undefined): AffixRule | undefined {
  if (!data || !enemy.affix || !hasFeature(data, 'affixes')) return undefined;
  return data.affixes?.[enemy.affix]?.rule;
}
