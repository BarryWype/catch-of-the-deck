import type { EnemyDef, Habitat } from '../engine';
import { behaviors, type BehaviorId } from './behaviors';
import { BOND_BY_TIER, creatures, type CreatureDef } from './creatures';

/** Default aquarium movement per temperament (anything not listed swims). */
const HABITAT_BY_TEMPERAMENT: Partial<Record<BehaviorId, Habitat>> = {
  jellyfish: 'drift',
  armored: 'bottom',
  clawed: 'bottom',
  bottomDweller: 'bottom',
};

/** Turns a creature entry into an engine enemy. Edit creatures.ts / behaviors.ts, not this. */
function toEnemy(creature: CreatureDef): EnemyDef {
  // Its own move set when it has one, otherwise its temperament's.
  const behavior = creature.moves ?? behaviors[creature.temperament];
  return {
    id: creature.id,
    name: creature.name,
    tier: creature.tier,
    hp: creature.hp,
    sellValue: creature.sellValue,
    bondToFull: creature.bondToFull ?? BOND_BY_TIER[creature.tier],
    escapeAt: creature.escapeAt,
    escapeStart: creature.escapeStart,
    escapeRate: creature.escapeRate,
    moves: behavior.moves,
    pattern: behavior.pattern,
    ...('bossPattern' in behavior && behavior.bossPattern ? { bossPattern: behavior.bossPattern } : {}),
    ...(creature.bossMoves ? { bossMoves: { moves: creature.bossMoves.moves, pattern: creature.bossMoves.pattern } } : {}),
    tags: [creature.type],
    startingStatuses: { ...creature.statuses, ...(creature.strength ? { strength: creature.strength } : {}) },
    sprite: creature.sprite ?? { sheet: 'fishes', index: creature.no },
    habitat: creature.habitat ?? HABITAT_BY_TEMPERAMENT[creature.temperament] ?? 'swim',
    temperament: creature.temperament,
    // The trait is the temperament's, even with a move set of its own.
    ...(behaviors[creature.temperament].trait ? { trait: behaviors[creature.temperament].trait } : {}),
    water: creature.water,
  };
}

export const enemies: EnemyDef[] = creatures.map(toEnemy);
