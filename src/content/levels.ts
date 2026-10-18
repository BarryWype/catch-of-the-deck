import type { LevelDef } from '../engine';

/**
 * The three acts of a run, played in order on the same coast (assets/coast/map.png, 1300×450,
 * drawn by scripts/draw-coast.mjs). Each map is generated per run from the coast's places
 * (coast.ts): 7 columns from the house to the mini-boss, 7 more to the boss.
 *
 * To edit a level:
 * - `height`: how much of the art it shows, from the top (300 = the land and the shallows).
 * - `miniBoss`, `boss`: where they are, who they are (`enemies`), and why they're let go after the
 *   fight (`releaseReason`: "<creature> is <reason>, so you let it go.").
 * - `escape`: the leave node offered right after the mini-boss (ends the run, bucket brought home).
 * - `firstColumn`: fights that make up column 1 every run, instead of the coast's places.
 * - `eventBand`: the band of the art (top, bottom) where events fill in when a column runs short of places.
 * What each age does at each place (and at which tier) is in coast.ts.
 * The game checks the levels on startup (validateLevels in engine/data.ts) and explains any mistake.
 */

/** The grandparents' house on the coast art, where every level starts. */
const HOME = { x: 37, y: 88 };
/** On the shore just past the river delta. */
const ESCAPE = { x: 794, y: 188 };

export const levels: LevelDef[] = [
  {
    id: 'kid',
    name: 'Kid · the shore',
    tier: 1,
    start: HOME,
    height: 300,
    miniBoss: { x: 692, y: 206, label: 'Estuary', enemies: ['blueCrab'], releaseReason: 'too feisty to keep' },
    boss: { x: 1262, y: 230, label: 'Lighthouse Point', enemies: ['giantPacificOctopus'], releaseReason: 'a protected species here' },
    escape: ESCAPE,
    // The base map's own spots by the house: its rocks, the sea beside them, and its creek.
    firstColumn: [
      { x: 68, y: 214, spot: 'RP', label: 'Rocks below the house' },
      { x: 34, y: 238, spot: 'BE', label: 'Shallows by the rocks' },
      { x: 106, y: 130, spot: 'ST', label: 'Creek by the house' },
    ],
    eventBand: [30, 280],
  },
  {
    id: 'adult',
    name: 'Adult · the bay and the lake',
    tier: 2,
    start: HOME,
    height: 375,
    miniBoss: { x: 692, y: 330, label: 'Middle of the bay', enemies: ['commonOctopus'], releaseReason: 'a protected species' },
    boss: { x: 1250, y: 340, label: 'Reef edge', enemies: ['giantMorayEel'], releaseReason: 'far too aggressive to keep' },
    escape: ESCAPE,
    eventBand: [30, 360],
  },
  {
    id: 'elder',
    name: 'Elder · big water',
    tier: 3,
    start: HOME,
    height: 450,
    miniBoss: { x: 692, y: 206, label: 'Estuary crossing', enemies: ['starrySturgeon'], releaseReason: 'a protected species' },
    boss: { x: 1240, y: 430, label: 'The drop-off', enemies: ['atlanticGiantSquid'], releaseReason: 'far too big to keep' },
    escape: ESCAPE,
    eventBand: [30, 435],
  },
];
