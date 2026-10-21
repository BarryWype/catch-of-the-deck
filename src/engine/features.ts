import type { FeatureId } from './constants';
import type { GameData } from './types';

/** Is this fight-variety feature on for the game being played? */
export function hasFeature(data: GameData, id: FeatureId): boolean {
  return !!data.features?.[id];
}
