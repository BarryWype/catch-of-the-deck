import type { LevelDef } from '../engine';

/**
 * The three acts of a run, played in order on the same coast (assets/map/basemap.png, 1000×150,
 * with the open sea below it for the older ages). Each map is generated per run from the coast
 * features (coast.ts): 7 columns from the house to the mini-boss, 7 more to the boss.
 *
 * To edit a level:
 * - `height`: how much of the art it shows, from the top (150 = the coast only).
 * - `miniBoss`, `boss`: where they are, who they are (`enemies`), and why they're let go after the
 *   fight (`releaseReason`: "<creature> is <reason>, so you let it go.").
 * - `escape`: the leave node offered right after the mini-boss (ends the run, bucket brought home).
 * - `firstColumn`: fights that make up column 1 every run, instead of coast features.
 * - `eventBand`: the band of the art (top, bottom) where events fill in when a column runs short of features.
 * What each age does at each feature (and at which tier) is in coast.ts.
 * The game checks the levels on startup (validateLevels in engine/data.ts) and explains any mistake.
 */

/** The grandparents' house on the coast art, where every level starts. */
const HOME = { x: 34, y: 52 };
/** On the shore just past the river delta. */
const ESCAPE = { x: 604, y: 96 };

export const levels: LevelDef[] = [
  {
    id: 'kid',
    name: 'Kid · the shore',
    tier: 1,
    start: HOME,
    height: 150,
    miniBoss: { x: 530, y: 104, label: 'Estuary', enemies: ['blueCrab'], releaseReason: 'too feisty to keep' },
    boss: { x: 978, y: 72, label: 'Lighthouse Point', enemies: ['commonLobster'], releaseReason: 'a protected species here' },
    escape: ESCAPE,
    // The base map's own spots by the house: its rocks, the sea beside them, and its creek.
    firstColumn: [
      { x: 67, y: 112, spot: 'RP', label: 'Rocks below the house' },
      { x: 32, y: 106, spot: 'BE', label: 'Shallows by the rocks' },
      { x: 96, y: 66, spot: 'ST', label: 'Creek by the house' },
    ],
    eventBand: [14, 98],
  },
  {
    id: 'adult',
    name: 'Adult · the bay and the lake',
    tier: 2,
    start: HOME,
    height: 225,
    miniBoss: { x: 530, y: 170, label: 'Middle of the bay', enemies: ['commonOctopus'], releaseReason: 'a protected species' },
    boss: { x: 968, y: 192, label: 'Reef edge', enemies: ['giantMorayEel'], releaseReason: 'far too aggressive to keep' },
    escape: ESCAPE,
    eventBand: [14, 200],
  },
  {
    id: 'elder',
    name: 'Elder · big water',
    tier: 3,
    start: HOME,
    height: 300,
    miniBoss: { x: 530, y: 104, label: 'Estuary crossing', enemies: ['starrySturgeon'], releaseReason: 'a protected species' },
    boss: { x: 962, y: 276, label: 'The drop-off', enemies: ['atlanticGiantSquid'], releaseReason: 'far too big to keep' },
    escape: ESCAPE,
    eventBand: [14, 285],
  },
];
