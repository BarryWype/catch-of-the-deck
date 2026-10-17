import type { CoastDef, CoastPlaceDef, CoastVisitDef } from '../engine';

/**
 * The places on the coast map (ui/assets/coast/map.png, drawn by scripts/draw-coast.mjs, which
 * prints them) where a fight may be, and what each age does there. Each run, every column of a
 * level's map draws 2–4 of the places within its stretch (see `generateLevelMap`).
 *
 * - `x`, `y`: where its node sits on the art. The coast is 1300×450: land down to the shoreline
 *   (around y 196, with bays, two headlands, a tidal island and a lagoon), the shallows, then
 *   the open sea from about y 300.
 * - `visits`: kid, adult, elder: the fishing spot (spots.ts) and the node's name; null when that
 *   age doesn't stop there. A visit's own `at` moves its node, e.g. out to sea by boat.
 * The level's tier sets the creatures' tier, so the same rocks hold bigger catches as you grow.
 */

const same = (spot: string, kid: string, adult: string, elder: string): CoastVisitDef[] => [
  { spot, label: kid },
  { spot, label: adult },
  { spot, label: elder },
];

// Inland.
const pond = same('PO', 'Pond', 'Pond', 'Old pond');
const lake = same('LK', 'Lake', 'Lake by canoe', 'Deep lake');
const stream = same('ST', 'Creek', 'Creek', 'Creek mouth');
const river: CoastVisitDef[] = [
  { spot: 'ST', label: 'River bank' },
  { spot: 'RV', label: 'Big river' },
  { spot: 'RV', label: 'River mouth' },
];
const lagoon = same('ES', 'Lagoon', 'Lagoon flats', 'Lagoon channel');
const channel = same('ES', 'Delta channel', 'Delta channel', 'Delta channel');
// On the shoreline.
const beach = same('BE', 'Beach', 'Surf beach', 'Surfcasting');
const jetty = same('JT', 'Jetty', 'End of the jetty', 'Night fishing off the jetty');
const harbour = (x: number): CoastVisitDef[] => [
  { spot: 'JT', label: 'Fishing from the wharf' },
  { spot: 'BY', label: 'Kayaking in the harbour', at: { x: x + 11, y: 238 } },
  { spot: 'OS', label: 'Boat out to sea', at: { x: x + 11, y: 318 } },
];
const rocks: CoastVisitDef[] = [
  { spot: 'RP', label: 'Rock pools' },
  { spot: 'CL', label: 'Rocky point' },
  { spot: 'CL', label: 'Rock ledge' },
];
// In the shallows, where a kid can wade out.
const tidePools: CoastVisitDef[] = [
  { spot: 'RP', label: 'Tide pools' },
  { spot: 'CL', label: 'Rock shelf' },
  { spot: 'CL', label: 'Rock shelf' },
];
const sandflat: CoastVisitDef[] = [
  { spot: 'BE', label: 'Sand flats' },
  { spot: 'BE', label: 'Sandbar' },
  { spot: 'BE', label: 'Sandbar' },
];
const island: CoastVisitDef[] = [
  { spot: 'RP', label: 'Tidal island' },
  { spot: 'CL', label: 'Tidal island' },
  { spot: 'CL', label: 'Tidal island' },
];
const outerRocks: CoastVisitDef[] = [
  { spot: 'CL', label: 'Wading out to the rocks' },
  { spot: 'CL', label: 'Offshore rocks' },
  { spot: 'CL', label: 'Offshore rocks' },
];
// Out at sea: near the shore for adults, further out for elders.
const kelp: (CoastVisitDef | null)[] = [null, { spot: 'BY', label: 'Kelp forest' }, { spot: 'BY', label: 'Kelp forest' }];
const reef: (CoastVisitDef | null)[] = [null, { spot: 'RF', label: 'Coral reef' }, { spot: 'RF', label: 'Coral reef' }];
const buoy: (CoastVisitDef | null)[] = [null, { spot: 'BY', label: 'Mooring buoy' }, { spot: 'OS', label: 'Mooring buoy' }];
const cliff: (CoastVisitDef | null)[] = [null, null, { spot: 'DP', label: 'Underwater cliffs' }];
const wreck: (CoastVisitDef | null)[] = [null, null, { spot: 'OS', label: 'Shipwreck' }];
const trench: (CoastVisitDef | null)[] = [null, null, { spot: 'DP', label: 'The deep' }];

/** From the house to the lighthouse, as the script draws them. */
const places: CoastPlaceDef[] = [
  { id: 'channel1', x: 640, y: 182, visits: channel },
  { id: 'channel2', x: 737, y: 178, visits: channel },
  { id: 'pond1', x: 150, y: 58, visits: pond },
  { id: 'rocks1', x: 150, y: 191, visits: rocks },
  { id: 'tidePools1', x: 140, y: 252, visits: tidePools },
  { id: 'reef1', x: 118, y: 324, visits: reef },
  { id: 'wreck1', x: 120, y: 414, visits: wreck },
  { id: 'lake1', x: 201, y: 58, visits: lake },
  { id: 'stream1', x: 191, y: 148, visits: stream },
  { id: 'beach1', x: 224, y: 171, visits: beach },
  { id: 'sandflat1', x: 206, y: 262, visits: sandflat },
  { id: 'kelp1', x: 236, y: 230, visits: kelp },
  { id: 'buoy1', x: 198, y: 342, visits: buoy },
  { id: 'trench1', x: 205, y: 420, visits: trench },
  { id: 'pond2', x: 302, y: 42, visits: pond },
  { id: 'stream2', x: 322, y: 133, visits: stream },
  { id: 'harbour1', x: 270, y: 173, visits: harbour(270) },
  { id: 'outerRocks1', x: 286, y: 254, visits: outerRocks },
  { id: 'reef2', x: 298, y: 322, visits: reef },
  { id: 'cliff1', x: 280, y: 398, visits: cliff },
  { id: 'river1', x: 380, y: 104, visits: river },
  { id: 'jetty1', x: 392, y: 207, visits: jetty },
  { id: 'tidePools2', x: 350, y: 264, visits: tidePools },
  { id: 'sandflat2', x: 400, y: 244, visits: sandflat },
  { id: 'buoy2', x: 370, y: 342, visits: buoy },
  { id: 'wreck2', x: 385, y: 422, visits: wreck },
  { id: 'pond3', x: 432, y: 64, visits: pond },
  { id: 'pond4', x: 462, y: 130, visits: pond },
  { id: 'island1', x: 472, y: 268, visits: island },
  { id: 'outerRocks2', x: 424, y: 252, visits: outerRocks },
  { id: 'reef3', x: 452, y: 330, visits: reef },
  { id: 'trench2', x: 444, y: 402, visits: trench },
  { id: 'pond5', x: 510, y: 70, visits: pond },
  { id: 'lagoon1', x: 530, y: 167, visits: lagoon },
  { id: 'tidePools3', x: 520, y: 240, visits: tidePools },
  { id: 'sandflat3', x: 546, y: 276, visits: sandflat },
  { id: 'buoy3', x: 522, y: 338, visits: buoy },
  { id: 'cliff2', x: 532, y: 412, visits: cliff },
  { id: 'pond6', x: 594, y: 54, visits: pond },
  { id: 'stream3', x: 575, y: 115, visits: stream },
  { id: 'rocks2', x: 600, y: 192, visits: rocks },
  { id: 'outerRocks3', x: 626, y: 252, visits: outerRocks },
  { id: 'reef4', x: 616, y: 338, visits: reef },
  { id: 'wreck3', x: 600, y: 422, visits: wreck },
  { id: 'pond7', x: 764, y: 62, visits: pond },
  { id: 'tidePools4', x: 762, y: 248, visits: tidePools },
  { id: 'buoy4', x: 756, y: 342, visits: buoy },
  { id: 'trench3', x: 766, y: 420, visits: trench },
  { id: 'lake2', x: 824, y: 72, visits: lake },
  { id: 'stream4', x: 805, y: 146, visits: stream },
  { id: 'sandflat4', x: 836, y: 258, visits: sandflat },
  { id: 'reef5', x: 842, y: 322, visits: reef },
  { id: 'cliff3', x: 830, y: 400, visits: cliff },
  { id: 'pond8', x: 904, y: 48, visits: pond },
  { id: 'pond9', x: 926, y: 138, visits: pond },
  { id: 'lagoon2', x: 896, y: 182, visits: lagoon },
  { id: 'outerRocks4', x: 912, y: 264, visits: outerRocks },
  { id: 'buoy5', x: 904, y: 346, visits: buoy },
  { id: 'wreck4', x: 916, y: 422, visits: wreck },
  { id: 'stream5', x: 998, y: 111, visits: stream },
  { id: 'pond10', x: 954, y: 150, visits: pond },
  { id: 'rocks3', x: 960, y: 184, visits: rocks },
  { id: 'tidePools5', x: 984, y: 242, visits: tidePools },
  { id: 'reef6', x: 976, y: 330, visits: reef },
  { id: 'trench4', x: 980, y: 418, visits: trench },
  { id: 'pond11', x: 1040, y: 60, visits: pond },
  { id: 'pond12', x: 1066, y: 150, visits: pond },
  { id: 'rocks4', x: 1060, y: 224, visits: rocks },
  { id: 'sandflat5', x: 1044, y: 270, visits: sandflat },
  { id: 'buoy6', x: 1050, y: 346, visits: buoy },
  { id: 'cliff4', x: 1052, y: 404, visits: cliff },
  { id: 'pond13', x: 1126, y: 44, visits: pond },
  { id: 'stream6', x: 1116, y: 140, visits: stream },
  { id: 'jetty2', x: 1142, y: 193, visits: jetty },
  { id: 'tidePools6', x: 1124, y: 256, visits: tidePools },
  { id: 'outerRocks5', x: 1092, y: 242, visits: outerRocks },
  { id: 'reef7', x: 1126, y: 328, visits: reef },
  { id: 'wreck5', x: 1112, y: 424, visits: wreck },
  { id: 'pond14', x: 1180, y: 96, visits: pond },
  { id: 'rocks5', x: 1172, y: 193, visits: rocks },
  { id: 'outerRocks6', x: 1194, y: 240, visits: outerRocks },
  { id: 'kelp2', x: 1166, y: 272, visits: kelp },
  { id: 'buoy7', x: 1182, y: 338, visits: buoy },
  { id: 'trench5', x: 1170, y: 412, visits: trench },
];

export const coast: CoastDef = { places };
