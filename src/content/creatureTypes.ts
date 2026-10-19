import type { CreatureTypeDef } from '../engine';

/**
 * Every creature has exactly one type (see creatures.ts): internal habitat data, never shown to the
 * player. Fishing spots list the types found there (spots.ts `types`, read by `encountersFor`), and
 * the Crab Hook's `extraCatch` names the types it catches. The player only ever sees temperaments.
 */
export const creatureTypes = [
  { id: 'smallFish', name: 'Small fish' }, // shallows
  { id: 'sportFish', name: 'Sport fish' }, // open water
  { id: 'bigFish', name: 'Big fish' }, // ocean swell
  { id: 'rockFish', name: 'Rock fish' }, // reef
  { id: 'deepSea', name: 'Deep sea' }, // abyss
  { id: 'crustacean', name: 'Crustacean' }, // boulders
  { id: 'shellfish', name: 'Shellfish' }, // sandbank
  { id: 'tentacled', name: 'Tentacled' }, // kelp
  { id: 'critter', name: 'Critter' }, // tide pool
] as const satisfies readonly CreatureTypeDef[];

export type CreatureType = (typeof creatureTypes)[number]['id'];
