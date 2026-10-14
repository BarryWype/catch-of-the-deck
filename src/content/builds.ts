import type { BuildDef } from '../engine';
import type { CreatureType } from './creatureTypes';

/**
 * Creature types each build specialises in. Build cards in cards.ts use these
 * in their damage `bonus`, so changing a list here retargets the whole build.
 */
export const ROD_TARGETS: CreatureType[] = ['sportFish', 'smallFish', 'deepSea'];
export const SPEAR_TARGETS: CreatureType[] = ['rockFish', 'bigFish', 'tentacled'];
export const FORAGING_TARGETS: CreatureType[] = ['crustacean', 'shellfish', 'critter'];

/** Every fishing style starts with the same deck for now. */
const STARTER_DECK = ['tug', 'tug', 'tug', 'tug', 'holdTight', 'holdTight', 'holdTight', 'holdTight', 'steadyHand', 'reelIn'];

/**
 * Starting builds, chosen before the first fight. Each sets the starter deck and offers starting
 * items to pick one from (`startingItems`, equipment.ts). A build with a `level` can only be picked
 * from that level on; runs start on the first level (Kid), so those aren't offered yet.
 */
export const builds: BuildDef[] = [
  {
    id: 'rod',
    name: 'Rod fishing',
    description: 'Patience and a good cast. Lands fish that bite on a line.',
    starterDeck: STARTER_DECK,
    strongAgainst: ROD_TARGETS,
    sprite: { sheet: 'gear', index: 1 },
    startingItems: ['reliableReel', 'strongRod', 'handline'],
  },
  {
    id: 'spear',
    name: 'Spear fishing',
    description: 'Dive in and strike. Hunts the big, the rocky and the tentacled.',
    starterDeck: STARTER_DECK,
    strongAgainst: SPEAR_TARGETS,
    sprite: { sheet: 'gear', index: 29 },
    startingItems: ['sharpSpear'],
    level: 'adult',
  },
  {
    id: 'foraging',
    name: 'Foraging',
    description: 'Nets and crab nets along the shore. Scoops up everything with a shell.',
    starterDeck: STARTER_DECK,
    strongAgainst: FORAGING_TARGETS,
    sprite: { sheet: 'gear', index: 23 },
    startingItems: ['rubberDuck', 'softNet', 'crabHook'],
  },
];
