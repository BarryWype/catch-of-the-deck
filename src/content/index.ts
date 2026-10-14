import { buildGameData, type ContentSource } from '../engine';
import { builds } from './builds';
import { cards } from './cards';
import { companionBonuses } from './companions';
import { character } from './character';
import { coast } from './coast';
import { creatureTypes } from './creatureTypes';
import { encounters } from './encounters';
import { enemies } from './enemies';
import { equipment } from './equipment';
import { events } from './events';
import { families } from './families';
import { levels } from './levels';
import { shop } from './shop';
import { spots } from './spots';

export const contentSource: ContentSource = {
  character,
  cards,
  enemies,
  encounters,
  builds,
  creatureTypes: [...creatureTypes],
  equipment,
  events,
  shop,
  companionBonuses,
  families,
  spots,
  levels,
  coast,
};

/** Validated, id-indexed content. Throws at startup if any data is inconsistent. */
export const gameData = buildGameData(contentSource);
