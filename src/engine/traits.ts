import { hasFeature } from './features';
import type { AffixRule, EnemyMove, EnemyState, GameData, TraitRule } from './types';

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

/** The moves a creature plays this fight: a boss's own set (`bossMoves`) while it plays its gimmick, its usual set otherwise. */
export function movesOf(enemy: EnemyState, data: GameData): EnemyMove[] {
  const def = data.enemies[enemy.defId];
  return (enemy.gimmick && def?.bossMoves?.moves) || def?.moves || [];
}
