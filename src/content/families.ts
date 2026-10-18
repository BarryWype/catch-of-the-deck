import type { FamilyDef } from '../engine';
import type { BehaviorId } from './behaviors';

/**
 * Creature families: temperaments (behaviors.ts) grouped by a shared identity. A temperament can be
 * in several families. A card's `family` (cards.ts) makes it one that creatures of that family can
 * offer. `identity` and `focus` are design notes for now. `icon` is shown next to a creature's name;
 * `emblem` is the creature on its cards' crest.
 */
export const families: Array<FamilyDef & { temperaments: BehaviorId[] }> = [
  { id: 'venom', emblem: 'lionfish', name: 'Venom', icon: '☠️', temperaments: ['venomous', 'jellyfish'], identity: 'Damage over time (Venom)', focus: 'health bar' },
  { id: 'shell', emblem: 'greatScallop', name: 'Shell', icon: '🐚', temperaments: ['armored', 'clawed'], identity: 'Defense: Hold', focus: 'hold' },
  { id: 'swift', emblem: 'cardinalTetra', name: 'Swift', icon: '🏃', temperaments: ['schooling', 'reefFish'], identity: 'Cheap cards and draw', focus: 'support and flexibility' },
  { id: 'hunter', emblem: 'shortfinMakoShark', name: 'Hunter', icon: '🦈', temperaments: ['predator', 'ambusher', 'eel'], identity: 'Heavy attacks, finishers', focus: 'health bar' },
  { id: 'endurance', emblem: 'sockeyeSalmon', name: 'Endurance', icon: '🐢', temperaments: ['predator', 'fighter', 'giant'], identity: 'Tiring: Drain, stop the escape', focus: 'Will bar' },
  { id: 'patient', emblem: 'greenSeaTurtle', name: 'Patient', icon: '⏳', temperaments: ['armored', 'fighter', 'giant', 'bottomDweller'], identity: 'Generate and spend Patience', focus: 'patience' },
  { id: 'trickster', emblem: 'commonOctopus', name: 'Trickster', icon: '🎭', temperaments: ['schooling', 'cephalopod', 'puffer'], identity: 'Control: debuffs and trade-offs', focus: 'support' },
  { id: 'flashy', emblem: 'clownfish', name: 'Flashy', icon: '✨', temperaments: ['reefFish', 'puffer'], identity: "Dazzle: change or weaken the creature's next move", focus: 'support' },
  { id: 'camo', emblem: 'hairyFrogfish', name: 'Camo', icon: '🍃', temperaments: ['clawed', 'cephalopod', 'venomous', 'ambusher'], identity: 'Quiet turns, ambush', focus: 'hold and burst' },
  { id: 'slimy', emblem: 'seaCucumber', name: 'Slimy', icon: '🪼', temperaments: ['jellyfish', 'eel', 'bottomDweller'], identity: 'Slow, protection against Pulls', focus: 'Will bar' },
];
