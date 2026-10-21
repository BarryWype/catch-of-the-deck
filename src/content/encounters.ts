import type { EncounterDef } from '../engine';
import { creatures } from './creatures';

/**
 * Hand-made fights with several creatures. Enemy ids are creature ids.
 * `tier` decides how deep in the map the group can appear (1–3). Left out of runs while
 * `MAX_CREATURES_PER_FIGHT` (engine/constants.ts) is 1; the debug panel can still start them.
 */
const groups: EncounterDef[] = [
  { id: 'pilchardShoal', name: 'Pilchard shoal', tier: 2, enemies: ['europeanPilchard', 'europeanPilchard', 'europeanPilchard'] },
  { id: 'crabPair', name: 'Crab pair', tier: 2, enemies: ['commonHermitCrab', 'atlanticCrayfish'] },
];

/** Every creature is also a one-on-one encounter at its own tier. */
const solo: EncounterDef[] = creatures.map((c) => ({ id: c.id, name: c.name, tier: c.tier, enemies: [c.id] }));

export const encounters: EncounterDef[] = [...solo, ...groups];
