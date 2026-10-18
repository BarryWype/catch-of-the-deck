import type { BuildDef } from '../engine';
import type { CreatureType } from './creatureTypes';

/**
 * Creature types each build specialises in. Build cards in cards.ts use these
 * in their damage `bonus`, so changing a list here retargets the whole build.
 */
export const ROD_TARGETS: CreatureType[] = ['sportFish', 'smallFish', 'deepSea'];
export const SPEAR_TARGETS: CreatureType[] = ['rockFish', 'bigFish', 'tentacled'];
export const FORAGING_TARGETS: CreatureType[] = ['crustacean', 'shellfish', 'critter'];

/** Different species of FORAGING_TARGETS Old Ned wants in the home aquarium before teaching Foraging. */
const FORAGING_QUEST_SPECIES = 4;

const STARTER_DECK = ['tug', 'tug', 'tug', 'tug', 'holdTight', 'holdTight', 'holdTight', 'holdTight', 'steadyHand', 'reelIn'];
/** Wears creatures out instead of hitting them: Drain and Slow. */
const FORAGING_DECK = ['reelIn', 'reelIn', 'reelIn', 'reelIn', 'holdTight', 'holdTight', 'holdTight', 'holdTight', 'playTheLine', 'slackLine'];

/**
 * Starting builds. Each sets the starter deck, and can offer starting items to pick one from
 * (`startingItems`, equipment.ts). A build with a `level` can only start from that level on.
 * A build with an `unlock` is locked until its fisherman's (fishermen.ts) quest is done.
 * The player picks one of the unlocked builds on the build screen, before choosing companions.
 */
export const builds: BuildDef[] = [
  {
    id: 'rod',
    name: 'Rod fishing',
    description: 'Patience and a good cast. Lands fish that bite on a line.',
    starterDeck: STARTER_DECK,
    strongAgainst: ROD_TARGETS,
    sprite: { sheet: 'gear', index: 1 },
  },
  {
    id: 'spear',
    name: 'Spear fishing',
    description: 'Dive in and strike. Hunts the big, the rocky and the tentacled.',
    starterDeck: STARTER_DECK,
    strongAgainst: SPEAR_TARGETS,
    sprite: { sheet: 'gear', index: 29 },
    level: 'adult',
  },
  {
    id: 'foraging',
    name: 'Foraging',
    description: 'Nets and crab nets along the shore. Scoops up everything with a shell.',
    starterDeck: FORAGING_DECK,
    strongAgainst: FORAGING_TARGETS,
    sprite: { sheet: 'gear', index: 23 },
    unlock: {
      fisherman: 'oldNed',
      name: 'Shells and claws',
      quest: { type: 'speciesAtHome', count: FORAGING_QUEST_SPECIES, creatureTypes: FORAGING_TARGETS },
    },
  },
];
