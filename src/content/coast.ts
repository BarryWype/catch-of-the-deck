import type { CoastDef, CoastFeatureDef, CoastVisitDef } from '../engine';

/**
 * The pieces of coast laid out at random along the map each run (see `layoutCoast`), and what
 * each age does there. Each one keeps its height on the art and slides sideways within `range`.
 *
 * - `image`, `crop`: its art, in ui/assets/map (the elements are full-size layers cut from the
 *   coast art; sea/features.png is drawn by scripts/draw-sea.mjs).
 * - `y`: its top edge on the map. Shore features sit on the shoreline (y ≈ 108), sea ones below 150.
 * - `node`: where its map node sits, relative to its top-left.
 * - `visits`: kid, adult, elder: the fishing spot (spots.ts) and the node's name; null when that
 *   age doesn't stop there. A visit's own `node` moves it, e.g. out to sea by boat.
 * The level's tier sets the creatures' tier, so the same rocks hold bigger catches as you grow.
 */

/** Left edges keeping shore features on the straight shoreline, between the old harbour and the lagoon. */
const SHORE = (width: number): [number, number] => [212, 905 - width];
const INLAND = (width: number): [number, number] => [100, 945 - width];
const SEA = (width: number): [number, number] => [20, 940 - width];

const same = (spot: string, kid: string, adult: string, elder: string): CoastVisitDef[] => [
  { spot, label: kid },
  { spot, label: adult },
  { spot, label: elder },
];
const beach = same('BE', 'Beach', 'Surf beach', 'Surfcasting');
const pond = same('PO', 'Pond', 'Pond', 'Old pond');
const stream = same('ST', 'Creek', 'Creek', 'Creek mouth');
const rocks: CoastVisitDef[] = [
  { spot: 'RP', label: 'Rock pools' },
  { spot: 'CL', label: 'Rocky point' },
  { spot: 'CL', label: 'Rock ledge' },
];
const harbour: CoastVisitDef[] = [
  { spot: 'JT', label: 'Fishing from the wharf' },
  { spot: 'BY', label: 'Kayaking in the harbour', node: { x: 15, y: 52 } },
  { spot: 'OS', label: 'Boat out to sea', node: { x: 15, y: 150 } },
];

const features: CoastFeatureDef[] = [
  { id: 'beach1', image: 'elements/beach1.png', crop: { x: 214, y: 98, width: 48, height: 16 }, y: 98, range: SHORE(48), node: { x: 24, y: 5 }, visits: beach },
  { id: 'beach2', image: 'elements/beach2.png', crop: { x: 632, y: 95, width: 44, height: 14 }, y: 95, range: SHORE(44), node: { x: 22, y: 6 }, visits: beach },
  { id: 'harbour1', image: 'elements/harbour1.png', crop: { x: 329, y: 90, width: 31, height: 27 }, y: 90, range: SHORE(31), node: { x: 15, y: 10 }, visits: harbour },
  { id: 'harbour2', image: 'elements/harbour2.png', crop: { x: 743, y: 95, width: 31, height: 27 }, y: 95, range: SHORE(31), node: { x: 15, y: 8 }, visits: harbour },
  {
    id: 'jetty', image: 'elements/jetty1.png', crop: { x: 613, y: 107, width: 8, height: 13 }, y: 107, range: SHORE(8), node: { x: 4, y: 10 },
    visits: same('JT', 'Jetty', 'End of the jetty', 'Night fishing off the jetty'),
  },
  {
    id: 'lagoon', image: 'elements/lagoon.png', crop: { x: 905, y: 50, width: 56, height: 63 }, y: 50, range: SHORE(0), node: { x: 30, y: 30 },
    visits: same('ES', 'Lagoon', 'Lagoon flats', 'Lagoon channel'),
  },
  {
    id: 'lake', image: 'elements/lake1.png', crop: { x: 254, y: 0, width: 151, height: 69 }, y: 0, range: INLAND(151), node: { x: 60, y: 30 },
    visits: same('LK', 'Lake', 'Lake by canoe', 'Deep lake'),
  },
  {
    id: 'river', image: 'elements/lake1.png', crop: { x: 754, y: 0, width: 104, height: 117 }, y: 0, range: SHORE(104), node: { x: 50, y: 60 },
    visits: [
      { spot: 'ST', label: 'River bank' },
      { spot: 'RV', label: 'Big river' },
      { spot: 'RV', label: 'River mouth' },
    ],
  },
  { id: 'pond1', image: 'elements/pond1.png', crop: { x: 99, y: 20, width: 41, height: 49 }, y: 20, range: INLAND(41), node: { x: 20, y: 24 }, visits: pond },
  { id: 'pond2', image: 'elements/pond2.png', crop: { x: 232, y: 33, width: 24, height: 24 }, y: 33, range: INLAND(24), node: { x: 12, y: 12 }, visits: pond },
  { id: 'rocks1', image: 'elements/rocks1.png', crop: { x: 706, y: 96, width: 23, height: 15 }, y: 96, range: SHORE(23), node: { x: 11, y: 6 }, visits: rocks },
  { id: 'rocks2', image: 'elements/rocks2.png', crop: { x: 835, y: 92, width: 28, height: 19 }, y: 92, range: SHORE(28), node: { x: 14, y: 8 }, visits: rocks },
  { id: 'stream1', image: 'elements/steam1.png', crop: { x: 168, y: 36, width: 20, height: 80 }, y: 36, range: SHORE(20), node: { x: 10, y: 40 }, visits: stream },
  { id: 'stream2', image: 'elements/stream2.png', crop: { x: 384, y: 40, width: 73, height: 73 }, y: 40, range: SHORE(73), node: { x: 36, y: 36 }, visits: stream },
  { id: 'stream3', image: 'elements/stream3.png', crop: { x: 563, y: 0, width: 129, height: 139 }, y: 0, range: SHORE(129), node: { x: 50, y: 50 }, visits: stream },

  // Out at sea: near the shore for adults, further out for elders.
  {
    id: 'sandbar', image: 'sea/features.png', crop: { x: 321, y: 20, width: 56, height: 13 }, y: 118, range: SEA(56), node: { x: 28, y: 6 },
    visits: [null, { spot: 'BE', label: 'Sandbar' }, { spot: 'BE', label: 'Sandbar' }],
  },
  {
    id: 'kelp', image: 'sea/features.png', crop: { x: 4, y: 10, width: 40, height: 32 }, y: 128, range: SEA(40), node: { x: 20, y: 16 },
    visits: [null, { spot: 'BY', label: 'Kelp forest' }, { spot: 'BY', label: 'Kelp forest' }],
  },
  {
    id: 'coralReef', image: 'sea/features.png', crop: { x: 170, y: 13, width: 44, height: 21 }, y: 168, range: SEA(44), node: { x: 22, y: 10 },
    visits: [null, { spot: 'RF', label: 'Coral reef' }, { spot: 'RF', label: 'Coral reef' }],
  },
  {
    id: 'seaCliff', image: 'sea/features.png', crop: { x: 482, y: 12, width: 60, height: 40 }, y: 232, range: SEA(60), node: { x: 30, y: 14 },
    visits: [null, null, { spot: 'DP', label: 'Underwater cliffs' }],
  },
  {
    id: 'shipwreck', image: 'sea/features.png', crop: { x: 804, y: 2, width: 35, height: 33 }, y: 236, range: SEA(35), node: { x: 18, y: 22 },
    visits: [null, null, { spot: 'OS', label: 'Shipwreck' }],
  },
  {
    id: 'trench', image: 'sea/features.png', crop: { x: 641, y: 14, width: 72, height: 26 }, y: 262, range: SEA(72), node: { x: 36, y: 13 },
    visits: [null, null, { spot: 'DP', label: 'The deep' }],
  },
];

export const coast: CoastDef = {
  features,
  reserved: [
    // The house, its creek and the rocky shore below it.
    { x: 0, y: 0, width: 98, height: 125 },
    // The river delta, where the mini-bosses wait, down to the open sea.
    { x: 462, y: 0, width: 130, height: 300 },
    // The lighthouse and the waters off it, where the bosses wait.
    { x: 945, y: 30, width: 55, height: 270 },
  ],
};
