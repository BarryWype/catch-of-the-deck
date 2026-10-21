import { hasFeature } from './features';
import type { EnemyState, GameData, TraitRule } from './types';

/**
 * A creature's trait rule, while `traits` is on. Each rule acts where its hook is: hits and Drain
 * taken in `resolveEffect` (effects.ts), the player's Grit after a creature's hit (`afterEnemyHit`),
 * its turn start, Block and Will in `endTurn` (combat.ts), its moves in `chooseIntent` (intents.ts).
 */
export function traitOf(enemy: EnemyState, data: GameData | undefined): TraitRule | undefined {
  if (!data || !hasFeature(data, 'traits')) return undefined;
  return data.enemies[enemy.defId]?.trait?.rule;
}
