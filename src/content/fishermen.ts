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
  {
    id: 'gus',
    name: 'Gus the Netmaker',
    icon: 'net-blue',
    sprite: 'SteamMan',
    level: 'adult',
    greeting:
      "Thirty years mending nets in this harbour, and you still go after them one at a time? Try Net fishing: one good throw hits the whole school, and the bigger the crowd, the better it works.",
  },
  {
    id: 'silas',
    name: 'Silent Silas',
    icon: 'lure1',
    sprite: 'GraveRobber',
    level: 'elder',
    greeting:
      "Shh. All your life you've splashed about. Try Fly fishing: stand still and let your Patience build, so their Will rises slower. Then spend it all on one perfect cast.",
  },
];
