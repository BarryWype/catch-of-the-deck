import type { FishermanDef } from '../engine';

/**
 * Experienced fishermen, met on the map while a build they teach is locked (`unlock` in
 * builds.ts). Each stands on his `level`, one node after its mini-boss, until the player has
 * unlocked every build he teaches. `sprite` names the art in ui/assets/character.
 */
export const fishermen: FishermanDef[] = [
  {
    id: 'oldNed',
    name: 'Old Ned',
    icon: 'rod3',
    sprite: 'Woodcutter',
    level: 'kid',
    greeting:
      "Fifty years I've worked this shore, kid. You yank them about too much. Try Foraging: the patient way, for bigger catches. Drain a creature's Will instead of wearing down its Health, and it comes to you.",
  },
];
