/**
 * The fishing gear catalogue: every piece of gear with art in the gear sheet.
 *
 * Gear the player earns during a run is a relic: an equipment entry (equipment.ts) with a
 * `rarity`, under the same id, its art this catalogue's cell. The pieces without a relic yet
 * are here waiting for an effect.
 *
 * - `no`: number in assets/gear_names.pdf = position in assets/fishing_gear.png
 *   (left to right, top to bottom, 6 per row).
 */
export type GearCategory = 'rod' | 'tackle' | 'bait' | 'float' | 'tool' | 'trap' | 'spear' | 'storage';

export interface GearDef {
  no: number;
  id: string;
  name: string;
  category: GearCategory;
  /** Free text for now: what you'd like this item to do. */
  description: string;
}

export const gear: GearDef[] = [
  // Row 1: rods (and line)
  { no: 1, id: 'woodenRod', name: 'Wooden fishing rod', category: 'rod', description: '' },
  { no: 2, id: 'bambooRod', name: 'Bamboo fishing rod', category: 'rod', description: '' },
  { no: 3, id: 'steelRod', name: 'Steel fishing rod', category: 'rod', description: '' },
  { no: 4, id: 'glassFiberRod', name: 'Glass fiber fishing rod', category: 'rod', description: '' },
  { no: 5, id: 'carbonFiberRod', name: 'Carbon fiber fishing rod', category: 'rod', description: '' },
  { no: 6, id: 'fishingLine', name: 'Fishing line', category: 'tackle', description: '' },
  // Row 2: hooks and lures
  { no: 7, id: 'fishingHook', name: 'Fishing hook', category: 'tackle', description: '' },
  { no: 8, id: 'jigLure', name: 'Jig lure', category: 'tackle', description: '' },
  { no: 9, id: 'flyLure', name: 'Fly lure', category: 'tackle', description: '' },
  { no: 10, id: 'crankbait', name: 'Crankbait', category: 'tackle', description: '' },
  { no: 11, id: 'spinnerLure', name: 'Spinner lure', category: 'tackle', description: '' },
  { no: 12, id: 'fishingMagnet', name: 'Fishing magnet', category: 'tackle', description: '' },
  // Row 3: sinker and bait
  { no: 13, id: 'sinker', name: 'Fishing lead / Sinker', category: 'tackle', description: '' },
  { no: 14, id: 'meatBait', name: 'Meat bait', category: 'bait', description: '' },
  { no: 15, id: 'wormBait', name: 'Worm bait', category: 'bait', description: '' },
  { no: 16, id: 'fruitBait', name: 'Fruit bait', category: 'bait', description: '' },
  { no: 17, id: 'garlicBait', name: 'Garlic bait', category: 'bait', description: '' },
  { no: 18, id: 'seafoodBait', name: 'Seafood bait', category: 'bait', description: '' },
  // Row 4: floats, thrower, scale, net and traps
  { no: 19, id: 'baitCatapult', name: 'Bait catapult', category: 'tool', description: '' },
  { no: 20, id: 'corkBobber', name: 'Cork bobber', category: 'float', description: '' },
  { no: 21, id: 'plasticBobber', name: 'Plastic bobber', category: 'float', description: '' },
  { no: 22, id: 'fishScale', name: 'Fish weight machine', category: 'tool', description: '' },
  { no: 23, id: 'fishingNet', name: 'Fishing net', category: 'trap', description: '' },
  { no: 24, id: 'fishTrap', name: 'Fish trap', category: 'trap', description: '' },
  // Row 5: crab trap and spears
  { no: 25, id: 'crabTrap', name: 'Crab trap', category: 'trap', description: '' },
  { no: 26, id: 'spearGun', name: 'Harpoon gun / Spear gun', category: 'spear', description: '' },
  { no: 27, id: 'harpoon', name: 'Harpoon', category: 'spear', description: '' },
  { no: 28, id: 'forkHarpoon', name: 'Fork harpoon', category: 'spear', description: '' },
  { no: 29, id: 'fishingSpear', name: 'Fishing spear', category: 'spear', description: '' },
  { no: 30, id: 'trident', name: 'Trident', category: 'spear', description: '' },
  // Row 6: bags, coolers and electronics
  { no: 31, id: 'bucket', name: 'Bucket', category: 'storage', description: '' },
  { no: 32, id: 'fishingBag', name: 'Fishing bag', category: 'storage', description: '' },
  { no: 33, id: 'portableFridge', name: 'Portable fridge', category: 'storage', description: '' },
  { no: 34, id: 'tackleBox', name: 'Tackle box', category: 'storage', description: '' },
  { no: 35, id: 'fishingMarker', name: 'Fishing marker', category: 'tool', description: '' },
  { no: 36, id: 'fishingSonar', name: 'Fishing sonar', category: 'tool', description: '' },
];
