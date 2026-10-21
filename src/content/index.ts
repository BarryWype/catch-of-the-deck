import { buildGameData, type ContentSource } from '../engine';
import { affixes } from './affixes';
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
import { fishermen } from './fishermen';
import { levels } from './levels';
import { progression } from './progression';
import { blessings, shop } from './shop';
import { spots } from './spots';

export const contentSource: ContentSource = {
  character,
  cards,
  enemies,
  encounters,
  builds,
  fishermen,
  creatureTypes: [...creatureTypes],
  equipment,
  events,
  shop,
  blessings,
  progression,
  companionBonuses,
  families,
  spots,
  levels,
  coast,
  affixes,
};

/** Validated, id-indexed content. Throws at startup if any data is inconsistent. */
export const gameData = buildGameData(contentSource);
