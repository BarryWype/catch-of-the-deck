import type { FamilyDef } from '../engine';
import type { BehaviorId } from './behaviors';

/**
 * Creature families: temperaments (behaviors.ts) grouped by a shared identity. A temperament can be
 * in several families. A card's `family` (cards.ts) makes it one that creatures of that family can
 * offer, and a bait shop's aquarium buys one family's creatures. Families are an internal grouping
 * only: the player never sees one, only its temperaments (a card's crest, the aquarium's sign).
 * Their names are for the debug panel. `identity` and `focus` are design notes; `emblem` is the
 * creature on its cards' crest.
 */
export const families: Array<FamilyDef & { temperaments: BehaviorId[] }> = [
  { id: 'venom', emblem: 'lionfish', name: 'Venom', temperaments: ['venomous', 'jellyfish'], identity: 'Damage over time (Venom)', focus: 'health bar' },
  { id: 'shell', emblem: 'greatScallop', name: 'Shell', temperaments: ['armored', 'clawed'], identity: 'Defense: Hold', focus: 'hold' },
  { id: 'swift', emblem: 'cardinalTetra', name: 'Swift', temperaments: ['schooling', 'reefFish'], identity: 'Cheap cards and draw', focus: 'support and flexibility' },
  { id: 'hunter', emblem: 'shortfinMakoShark', name: 'Hunter', temperaments: ['predator', 'ambusher', 'eel'], identity: 'Heavy attacks, finishers', focus: 'health bar' },
  { id: 'endurance', emblem: 'sockeyeSalmon', name: 'Endurance', temperaments: ['predator', 'fighter', 'giant'], identity: 'Tiring: Drain, stop the escape', focus: 'Will bar' },
  { id: 'patient', emblem: 'greenSeaTurtle', name: 'Patient', temperaments: ['armored', 'fighter', 'giant', 'bottomDweller'], identity: 'Generate and spend Patience', focus: 'patience' },
  { id: 'trickster', emblem: 'commonOctopus', name: 'Trickster', temperaments: ['schooling', 'cephalopod', 'puffer'], identity: 'Control, trade-offs and rhythm', focus: 'support' },
  { id: 'flashy', emblem: 'clownfish', name: 'Flashy', temperaments: ['reefFish', 'puffer'], identity: "Dazzle: change or weaken the creature's next move", focus: 'support' },
  { id: 'camo', emblem: 'hairyFrogfish', name: 'Camo', temperaments: ['clawed', 'cephalopod', 'venomous', 'ambusher'], identity: 'Quiet turns, ambush', focus: 'hold and burst' },
  { id: 'slimy', emblem: 'seaCucumber', name: 'Slimy', temperaments: ['jellyfish', 'eel', 'bottomDweller'], identity: 'Slow, protection against Pulls', focus: 'Will bar' },
];
