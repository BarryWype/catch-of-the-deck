import type { SpotDef } from '../engine';

/**
 * Fishing spots: the map legend. A fight node's spot decides who it can meet: creatures living
 * in one of its `waters` (`water` in creatures.ts), of one of its `types` when given, at the
 * level's tier (see `encountersFor` in engine/map.ts). `color` is the node's colour on the map.
 */
export const spots: SpotDef[] = [
  { id: 'RP', name: 'Rock pools', color: '#3E8C83', waters: ['salt'], types: ['smallFish', 'rockFish', 'crustacean', 'shellfish', 'critter'] },
  { id: 'JT', name: 'Jetty / pier', color: '#8A6A45', waters: ['salt'], types: ['smallFish', 'sportFish', 'rockFish', 'tentacled'] },
  { id: 'BE', name: 'Beach / surf', color: '#B8922C', waters: ['salt'], types: ['smallFish', 'sportFish', 'shellfish', 'crustacean', 'critter'] },
  { id: 'ST', name: 'Stream / creek', color: '#3F8F4F', waters: ['fresh', 'brackish'] },
  { id: 'PO', name: 'Pond', color: '#5E9F5A', waters: ['fresh'] },
  { id: 'ES', name: 'Estuary / mudflat', color: '#857A35', waters: ['brackish'] },
  { id: 'CL', name: 'Cliff rocks', color: '#6D675E', waters: ['salt'], types: ['rockFish', 'crustacean', 'shellfish', 'tentacled'] },
  { id: 'LK', name: 'Lake', color: '#2F7DA8', waters: ['fresh'], types: ['smallFish', 'sportFish', 'bigFish', 'crustacean'] },
  { id: 'RV', name: 'Big river', color: '#245A8A', waters: ['fresh', 'brackish'], types: ['sportFish', 'bigFish'] },
  { id: 'BY', name: 'Bay (boat)', color: '#3C93A8', waters: ['salt'], types: ['smallFish', 'sportFish', 'rockFish', 'tentacled'] },
  { id: 'RF', name: 'Reef', color: '#C9603F', waters: ['salt'], types: ['smallFish', 'rockFish', 'crustacean', 'tentacled', 'critter'] },
  { id: 'OS', name: 'Open sea', color: '#2B5D8A', waters: ['salt'], types: ['sportFish', 'bigFish', 'tentacled'] },
  { id: 'DP', name: 'Deep drop', color: '#16324A', waters: ['salt'], types: ['deepSea', 'bigFish', 'tentacled'] },
];
