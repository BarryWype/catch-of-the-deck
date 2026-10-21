import type { BuildDef } from '../engine';
import type { BehaviorId } from './behaviors';

/** The temperaments of Old Ned's quest. */
export const FORAGING_TARGETS: BehaviorId[] = ['armored', 'clawed', 'bottomDweller'];

/** Different species of FORAGING_TARGETS Old Ned wants in the home aquarium before teaching Foraging. */
const FORAGING_QUEST_SPECIES = 4;
/** Different schooling species Gus wants in the bucket before teaching Net fishing. */
const NET_QUEST_SPECIES = 3;

const STARTER_DECK = ['tug', 'tug', 'tug', 'tug', 'holdTight', 'holdTight', 'holdTight', 'holdTight', 'steadyHand', 'reelIn'];
/** Wears creatures out instead of hitting them: Drain and Slow, with Brace to hold against Strikes and Drain on Pulls. */
const FORAGING_DECK = ['reelIn', 'reelIn', 'reelIn', 'reelIn', 'brace', 'brace', 'brace', 'brace', 'playTheLine', 'slackLine'];
/** Hits every creature at once: made for group fights. */
const NET_DECK = ['tug', 'tug', 'tug', 'reelIn', 'reelIn', 'holdTight', 'holdTight', 'holdTight', 'throwTheNet', 'drawTheNet'];
/** Saves Patience to slow the Will, then spends it on one Perfect Cast. */
const FLY_DECK = ['tug', 'tug', 'tug', 'reelIn', 'reelIn', 'holdTight', 'holdTight', 'holdTight', 'waitForTheRise', 'perfectCast'];

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
    sprite: { sheet: 'gear', index: 1 },
  },
  {
    id: 'foraging',
    name: 'Foraging',
    description: 'Rock pools and tide lines. Gathers everything with a shell or a claw.',
    starterDeck: FORAGING_DECK,
    sprite: { sheet: 'gear', index: 25 },
    character: 'Woodcutter',
    unlock: {
      fisherman: 'oldNed',
      name: 'Shells and claws',
      quest: { type: 'speciesAtHome', count: FORAGING_QUEST_SPECIES, temperaments: FORAGING_TARGETS },
    },
  },
  {
    id: 'net',
    name: 'Net fishing',
    description: 'One throw, the whole school. Hits every creature at once, at its best in a crowd.',
    starterDeck: NET_DECK,
    sprite: { sheet: 'gear', index: 23 },
    character: 'SteamMan',
    unlock: {
      fisherman: 'gus',
      name: 'A full school',
      quest: { type: 'inBucket', count: NET_QUEST_SPECIES, temperament: 'schooling' },
    },
  },
  {
    id: 'fly',
    name: 'Fly fishing',
    description: 'Stand still and wait for the rise. Save Patience to slow the Will, then spend it on one perfect cast.',
    starterDeck: FLY_DECK,
    sprite: { sheet: 'gear', index: 9 },
    character: 'GraveRobber',
    unlock: {
      fisherman: 'silas',
      name: 'Fresh from the creek',
      quest: { type: 'inBucket', count: 1, water: 'fresh', size: 'trophy' },
    },
  },
];
