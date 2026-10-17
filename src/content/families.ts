import type { FamilyDef } from '../engine';
import type { BehaviorId } from './behaviors';

/**
 * Creature families: temperaments (behaviors.ts) grouped by a shared identity. A temperament can be
 * in several families. A card's `family` (cards.ts) makes it one that creatures of that family can
 * offer. `identity` and `focus` are design notes for now. `icon` is shown next to a creature's name.
 */
export const families: Array<FamilyDef & { temperaments: BehaviorId[] }> = [
  { id: 'venom', name: 'Venom', icon: '☠️', temperaments: ['venomous', 'jellyfish'], identity: 'Damage over time (Venom)', focus: 'health bar' },
  { id: 'shell', name: 'Shell', icon: '🐚', temperaments: ['armored', 'clawed'], identity: 'Defense: Hold', focus: 'hold' },
  { id: 'swift', name: 'Swift', icon: '🏃', temperaments: ['schooling', 'reefFish'], identity: 'Cheap cards and draw', focus: 'support and flexibility' },
  { id: 'hunter', name: 'Hunter', icon: '🦈', temperaments: ['predator', 'ambusher', 'eel'], identity: 'Heavy attacks, finishers', focus: 'health bar' },
  { id: 'endurance', name: 'Endurance', icon: '🐢', temperaments: ['predator', 'fighter', 'giant'], identity: 'Tiring: Drain, stop the escape', focus: 'Will bar' },
  { id: 'patient', name: 'Patient', icon: '⏳', temperaments: ['armored', 'fighter', 'giant', 'bottomDweller'], identity: 'Generate and spend Patience', focus: 'patience' },
  { id: 'trickster', name: 'Trickster', icon: '🎭', temperaments: ['schooling', 'cephalopod', 'puffer'], identity: 'Control: debuffs and trade-offs', focus: 'support' },
  { id: 'flashy', name: 'Flashy', icon: '✨', temperaments: ['reefFish', 'puffer'], identity: "Dazzle: change or weaken the creature's next move", focus: 'support' },
  { id: 'camo', name: 'Camo', icon: '🍃', temperaments: ['clawed', 'cephalopod', 'venomous', 'ambusher'], identity: 'Quiet turns, ambush', focus: 'hold and burst' },
  { id: 'slimy', name: 'Slimy', icon: '🪼', temperaments: ['jellyfish', 'eel', 'bottomDweller'], identity: 'Slow, protection against Pulls', focus: 'Will bar' },
];
