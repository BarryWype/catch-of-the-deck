import type { Habitat, Statuses } from '../engine';
import type { Behavior, BehaviorId } from './behaviors';
import type { CreatureType } from './creatureTypes';

/**
 * Every creature you can meet, one line each. They become enemies (and
 * single-creature encounters) automatically.
 *
 * - `no`: number in assets/fish_names.pdf = position in assets/fishes.png
 *   (left to right, top to bottom, 12 per row).
 * - `type`: small fish, sport fish, crustacean… (creatureTypes.ts).
 * - `water`: where it lives. 'brackish' covers estuary dwellers and fish that migrate
 *   between rivers and the sea (salmon, sturgeon, lamprey).
 * - `tier`: 1 = shallow water near the start of the map, 3 = the deep end.
 * - `hp`: [min, max], rolled each fight.
 * - `sellValue`: coins it sells for from the aquarium (2 for the commonest, 20 for the rarest).
 * - `bondToFull` (optional): bond points to be fully bonded. Defaults from its tier (BOND_BY_TIER).
 * - `breedChance`: 0–1, after each run, chance that a pair of it in the home aquarium lays an egg.
 * - `escapeStart` / `escapeRate` / `escapeAt`: the tug of war. The bar starts at
 *   `escapeStart`, rises by `escapeRate` (how vigorous it is) each enemy turn, and the
 *   creature flees once it reaches `escapeAt` (50–200). Pushed down to 0, it's captured.
 * - `temperament`: the archetype whose shared move set it uses (behaviors.ts).
 * - `moves` (optional): this creature's own `{ moves, pattern }`, used instead of
 *   its temperament's (see Pike and Red piranha below).
 * - `strength` (optional): Strength it starts every fight with.
 * - `habitat` (optional): 'swim' | 'drift' | 'bottom', how it moves in the aquarium.
 */
/** Bond points to be fully bonded, by tier, for creatures without their own `bondToFull`. */
export const BOND_BY_TIER: Record<CreatureDef['tier'], number> = { 1: 100, 2: 200, 3: 400 };

/** Fresh water, salt water, or in between. */
export type Water = 'fresh' | 'salt' | 'brackish';

export interface CreatureDef {
  no: number;
  id: string;
  name: string;
  scientific: string;
  /** Creature type (creatureTypes.ts). Build cards deal bonus damage to some types. */
  type: CreatureType;
  water: Water;
  tier: 1 | 2 | 3;
  hp: [number, number];
  sellValue: number;
  breedChance: number;
  bondToFull?: number;
  escapeAt: number;
  escapeStart: number;
  escapeRate: number;
  temperament: BehaviorId;
  moves?: Behavior;
  strength?: number;
  /** Any other statuses it starts with, e.g. { vulnerable: 2 }. */
  statuses?: Statuses;
  /** How it moves in the aquarium. Defaults from its temperament (see enemies.ts). */
  habitat?: Habitat;
}

export const creatures: CreatureDef[] = [
  // --- Fish (rows 1–8) -------------------------------------------------------
  { no: 1, id: 'progenetica', name: 'Progenetica', scientific: 'Paedocypris progenetica', type: 'smallFish', water: 'fresh', tier: 1, hp: [12, 15], sellValue: 2, breedChance: 0.1, escapeAt: 55, escapeStart: 31, escapeRate: 5, temperament: 'schooling' },
  { no: 2, id: 'clownfish', name: 'Clownfish', scientific: 'Amphiprion ocellaris', type: 'smallFish', water: 'salt', tier: 1, hp: [16, 20], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 41, escapeRate: 5, temperament: 'reefFish' },
  { no: 3, id: 'blueTang', name: 'Blue tang', scientific: 'Paracanthurus hepatus', type: 'smallFish', water: 'salt', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 41, escapeRate: 5, temperament: 'reefFish' },
  { no: 4, id: 'yellowTang', name: 'Yellow tang', scientific: 'Zebrasoma flavescens', type: 'smallFish', water: 'salt', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 41, escapeRate: 5, temperament: 'reefFish' },
  { no: 5, id: 'gemTang', name: 'Gem tang', scientific: 'Zebrasoma gemmatum', type: 'smallFish', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 42, escapeRate: 6, temperament: 'reefFish' },
  { no: 6, id: 'sailfinTang', name: 'Sailfin tang', scientific: 'Zebrasoma velifer', type: 'smallFish', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 42, escapeRate: 6, temperament: 'reefFish' },
  { no: 7, id: 'angelfish', name: 'Angelfish', scientific: 'Pterophyllum scalare', type: 'smallFish', water: 'fresh', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 41, escapeRate: 5, temperament: 'reefFish' },
  { no: 8, id: 'queenAngelfish', name: 'Queen angelfish', scientific: 'Holacanthus ciliaris', type: 'smallFish', water: 'salt', tier: 1, hp: [22, 26], sellValue: 5, breedChance: 0.1, escapeAt: 75, escapeStart: 35, escapeRate: 6, temperament: 'reefFish' },
  { no: 9, id: 'frenchAngelfish', name: 'French angelfish', scientific: 'Pomacanthus paru', type: 'smallFish', water: 'salt', tier: 1, hp: [22, 26], sellValue: 5, breedChance: 0.1, escapeAt: 75, escapeStart: 35, escapeRate: 6, temperament: 'reefFish' },
  { no: 10, id: 'goldfish', name: 'Goldfish', scientific: 'Carassius auratus', type: 'smallFish', water: 'fresh', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 40, escapeRate: 4, temperament: 'reefFish' },
  { no: 11, id: 'fightingFish', name: 'Fighting fish', scientific: 'Betta splendens', type: 'smallFish', water: 'fresh', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 37, escapeRate: 6, temperament: 'predator' },
  { no: 12, id: 'catfish', name: 'Catfish', scientific: 'Silurus glanis', type: 'sportFish', water: 'fresh', tier: 2, hp: [40, 46], sellValue: 10, breedChance: 0.1, escapeAt: 135, escapeStart: 57, escapeRate: 10, temperament: 'ambusher' },
  { no: 13, id: 'porcupinefish', name: 'Porcupinefish', scientific: 'Diodon holocanthus', type: 'rockFish', water: 'salt', tier: 2, hp: [32, 38], sellValue: 8, breedChance: 0.1, escapeAt: 100, escapeStart: 65, escapeRate: 6, temperament: 'puffer' },
  { no: 14, id: 'spottedPufferfish', name: 'Spotted pufferfish', scientific: 'Dichotomyctere nigroviridis', type: 'smallFish', water: 'brackish', tier: 1, hp: [24, 28], sellValue: 6, breedChance: 0.1, escapeAt: 80, escapeStart: 44, escapeRate: 5, temperament: 'puffer' },
  { no: 15, id: 'oceanSunfish', name: 'Ocean sunfish', scientific: 'Mola mola', type: 'bigFish', water: 'salt', tier: 3, hp: [70, 80], sellValue: 18, breedChance: 0.1, escapeAt: 185, escapeStart: 94, escapeRate: 10, temperament: 'giant' },
  { no: 16, id: 'mahiMahi', name: 'Mahi mahi', scientific: 'Coryphaena hippurus', type: 'sportFish', water: 'salt', tier: 2, hp: [38, 44], sellValue: 10, breedChance: 0.1, escapeAt: 135, escapeStart: 60, escapeRate: 20, temperament: 'predator' },
  { no: 17, id: 'roulesGoby', name: 'Roule’s goby', scientific: 'Gobius roulei', type: 'smallFish', water: 'salt', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 31, escapeRate: 5, temperament: 'reefFish' },
  {
    no: 18, id: 'redPiranha', name: 'Red piranha', scientific: 'Pygocentrus nattereri', type: 'sportFish', water: 'fresh', tier: 2, hp: [28, 32], sellValue: 7, breedChance: 0.1, escapeAt: 110, escapeStart: 65, escapeRate: 12,
    temperament: 'predator',
    moves: {
      moves: [
        { id: 'frenzy', name: 'Shred the Bait', tag: 'strike', effects: [{ type: 'dealDamage', amount: 3, hits: 3 }] },
        { id: 'smellBlood', name: 'Smell Blood', tag: 'pull', effects: [{ type: 'pull', amount: 4 }, { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] },
      ],
      pattern: { type: 'sequence', moves: ['frenzy', 'frenzy', 'smellBlood'] },
    },
  },
  { no: 19, id: 'lionfish', name: 'Lionfish', scientific: 'Pterois volitans', type: 'rockFish', water: 'salt', tier: 2, hp: [34, 40], sellValue: 9, breedChance: 0.1, escapeAt: 105, escapeStart: 63, escapeRate: 6, temperament: 'venomous' },
  { no: 20, id: 'redScorpionfish', name: 'Red scorpionfish', scientific: 'Scorpaena scrofa', type: 'rockFish', water: 'salt', tier: 2, hp: [36, 42], sellValue: 9, breedChance: 0.1, escapeAt: 110, escapeStart: 68, escapeRate: 6, temperament: 'venomous' },
  { no: 21, id: 'stonefish', name: 'Stonefish', scientific: 'Synanceia horrida', type: 'rockFish', water: 'salt', tier: 3, hp: [52, 58], sellValue: 13, breedChance: 0.1, escapeAt: 145, escapeStart: 103, escapeRate: 5, temperament: 'venomous', strength: 1 },
  { no: 22, id: 'flyingFish', name: 'Flying fish', scientific: 'Exocoetus volitans', type: 'smallFish', water: 'salt', tier: 1, hp: [16, 20], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 25, escapeRate: 8, temperament: 'schooling' },
  { no: 23, id: 'guppy', name: 'Guppy', scientific: 'Poecilia reticula', type: 'smallFish', water: 'fresh', tier: 1, hp: [10, 14], sellValue: 2, breedChance: 0.1, escapeAt: 50, escapeStart: 30, escapeRate: 4, temperament: 'schooling' },
  { no: 24, id: 'sailfinMolly', name: 'Sailfin molly', scientific: 'Poecilia velifera', type: 'smallFish', water: 'brackish', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 36, escapeRate: 5, temperament: 'reefFish' },
  { no: 25, id: 'greaterWeever', name: 'Greater weever', scientific: 'Trachinus draco', type: 'rockFish', water: 'salt', tier: 1, hp: [24, 28], sellValue: 6, breedChance: 0.1, escapeAt: 80, escapeStart: 38, escapeRate: 6, temperament: 'venomous' },
  { no: 26, id: 'sockeyeSalmon', name: 'Sockeye salmon', scientific: 'Oncorhynchus nerka', type: 'sportFish', water: 'brackish', tier: 2, hp: [38, 44], sellValue: 10, breedChance: 0.1, escapeAt: 135, escapeStart: 63, escapeRate: 19, temperament: 'fighter' },
  { no: 27, id: 'taimen', name: 'Taimen', scientific: 'Hucho taimen', type: 'sportFish', water: 'fresh', tier: 3, hp: [58, 64], sellValue: 15, breedChance: 0.1, escapeAt: 175, escapeStart: 85, escapeRate: 24, temperament: 'predator' },
  { no: 28, id: 'atlanticSalmon', name: 'Atlantic salmon', scientific: 'Salmo salar', type: 'sportFish', water: 'brackish', tier: 2, hp: [40, 46], sellValue: 10, breedChance: 0.1, escapeAt: 135, escapeStart: 63, escapeRate: 19, temperament: 'fighter' },
  { no: 29, id: 'masu', name: 'Masu', scientific: 'Oncorhynchus masou', type: 'sportFish', water: 'brackish', tier: 2, hp: [34, 40], sellValue: 9, breedChance: 0.1, escapeAt: 125, escapeStart: 65, escapeRate: 16, temperament: 'fighter' },
  { no: 30, id: 'europeanAngler', name: 'European angler', scientific: 'Lophius piscatorius', type: 'deepSea', water: 'salt', tier: 3, hp: [56, 62], sellValue: 14, breedChance: 0.1, escapeAt: 150, escapeStart: 90, escapeRate: 10, temperament: 'ambusher' },
  { no: 31, id: 'humpbackAnglerfish', name: 'Humpback anglerfish', scientific: 'Melanocetus johnsonii', type: 'deepSea', water: 'salt', tier: 3, hp: [52, 58], sellValue: 13, breedChance: 0.1, escapeAt: 145, escapeStart: 100, escapeRate: 7, temperament: 'ambusher' },
  { no: 32, id: 'hairyFrogfish', name: 'Hairy frogfish', scientific: 'Antennarius striatus', type: 'rockFish', water: 'salt', tier: 2, hp: [32, 38], sellValue: 8, breedChance: 0.1, escapeAt: 100, escapeStart: 64, escapeRate: 5, temperament: 'ambusher' },
  { no: 33, id: 'commonCarp', name: 'Common carp', scientific: 'Cyprinus carpio', type: 'sportFish', water: 'fresh', tier: 2, hp: [40, 46], sellValue: 10, breedChance: 0.1, escapeAt: 135, escapeStart: 63, escapeRate: 19, temperament: 'fighter' },
  { no: 34, id: 'tench', name: 'Tench', scientific: 'Tinca tinca', type: 'sportFish', water: 'fresh', tier: 1, hp: [26, 30], sellValue: 6, breedChance: 0.1, escapeAt: 105, escapeStart: 45, escapeRate: 12, temperament: 'fighter' },
  { no: 35, id: 'koiCarp', name: 'Koi carp', scientific: 'Cyprinus carpio', type: 'sportFish', water: 'fresh', tier: 1, hp: [26, 30], sellValue: 6, breedChance: 0.1, escapeAt: 105, escapeStart: 45, escapeRate: 12, temperament: 'fighter' },
  { no: 36, id: 'barracuda', name: 'Barracuda', scientific: 'Sphyraena', type: 'sportFish', water: 'salt', tier: 3, hp: [54, 60], sellValue: 14, breedChance: 0.1, escapeAt: 170, escapeStart: 74, escapeRate: 26, temperament: 'predator', strength: 1 },
  { no: 37, id: 'cardinalTetra', name: 'Cardinal tetra', scientific: 'Paracheirodon axelrodi', type: 'smallFish', water: 'fresh', tier: 1, hp: [10, 14], sellValue: 2, breedChance: 0.1, escapeAt: 50, escapeStart: 26, escapeRate: 5, temperament: 'schooling' },
  { no: 38, id: 'emperorTetra', name: 'Emperor tetra', scientific: 'Nematobrycon palmeri', type: 'smallFish', water: 'fresh', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 27, escapeRate: 6, temperament: 'schooling' },
  { no: 39, id: 'zebrafish', name: 'Zebrafish', scientific: 'Danio rerio', type: 'smallFish', water: 'fresh', tier: 1, hp: [10, 14], sellValue: 2, breedChance: 0.1, escapeAt: 50, escapeStart: 26, escapeRate: 5, temperament: 'schooling' },
  { no: 40, id: 'petticoatTetra', name: 'Petticoat tetra', scientific: 'Gymnocorymbus ternetzi', type: 'smallFish', water: 'fresh', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 27, escapeRate: 6, temperament: 'schooling' },
  { no: 41, id: 'perch', name: 'Perch', scientific: 'Perca fluviatilis', type: 'sportFish', water: 'fresh', tier: 1, hp: [24, 28], sellValue: 6, breedChance: 0.1, escapeAt: 100, escapeStart: 40, escapeRate: 12, temperament: 'predator' },
  { no: 42, id: 'starrySturgeon', name: 'Starry sturgeon', scientific: 'Acipenser stellatus', type: 'bigFish', water: 'brackish', tier: 3, hp: [64, 72], sellValue: 17, breedChance: 0.1, escapeAt: 170, escapeStart: 85, escapeRate: 14, temperament: 'giant' },
  { no: 43, id: 'lakeSturgeon', name: 'Lake sturgeon', scientific: 'Acipenser fulvescens', type: 'bigFish', water: 'fresh', tier: 3, hp: [68, 76], sellValue: 18, breedChance: 0.1, escapeAt: 180, escapeStart: 90, escapeRate: 14, temperament: 'giant' },
  { no: 44, id: 'stripedMarlin', name: 'Striped marlin', scientific: 'Kajikia audax', type: 'sportFish', water: 'salt', tier: 3, hp: [62, 70], sellValue: 16, breedChance: 0.1, escapeAt: 185, escapeStart: 80, escapeRate: 28, temperament: 'predator', strength: 1 },
  { no: 45, id: 'swordfish', name: 'Swordfish', scientific: 'Xiphias gladius', type: 'sportFish', water: 'salt', tier: 3, hp: [64, 72], sellValue: 17, breedChance: 0.1, escapeAt: 190, escapeStart: 88, escapeRate: 27, temperament: 'predator', strength: 2 },
  { no: 46, id: 'garfish', name: 'Garfish', scientific: 'Belone belone', type: 'sportFish', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 90, escapeStart: 22, escapeRate: 14, temperament: 'predator' },
  { no: 47, id: 'europeanPilchard', name: 'European pilchard', scientific: 'Sardina pilchardus', type: 'smallFish', water: 'salt', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 27, escapeRate: 6, temperament: 'schooling' },
  { no: 48, id: 'atlanticHerring', name: 'Atlantic herring', scientific: 'Clupea harengus', type: 'smallFish', water: 'salt', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 32, escapeRate: 6, temperament: 'schooling' },
  { no: 49, id: 'blackspotSeabream', name: 'Blackspot seabream', scientific: 'Pagellus bogaraveo', type: 'sportFish', water: 'salt', tier: 1, hp: [24, 28], sellValue: 6, breedChance: 0.1, escapeAt: 100, escapeStart: 36, escapeRate: 13, temperament: 'fighter' },
  { no: 50, id: 'silverSeabream', name: 'Silver seabream', scientific: 'Sparus aurata', type: 'sportFish', water: 'salt', tier: 1, hp: [26, 30], sellValue: 6, breedChance: 0.1, escapeAt: 105, escapeStart: 37, escapeRate: 14, temperament: 'fighter' },
  { no: 51, id: 'atlanticCod', name: 'Atlantic cod', scientific: 'Gadus morhua', type: 'sportFish', water: 'salt', tier: 2, hp: [40, 46], sellValue: 10, breedChance: 0.1, escapeAt: 135, escapeStart: 63, escapeRate: 14, temperament: 'fighter' },
  { no: 52, id: 'hake', name: 'Hake', scientific: 'Merluccius', type: 'sportFish', water: 'salt', tier: 2, hp: [34, 40], sellValue: 9, breedChance: 0.1, escapeAt: 125, escapeStart: 68, escapeRate: 15, temperament: 'predator' },
  { no: 53, id: 'bluefinTuna', name: 'Bluefin tuna', scientific: 'Thunnus thynnus', type: 'bigFish', water: 'salt', tier: 3, hp: [72, 80], sellValue: 19, breedChance: 0.1, escapeAt: 190, escapeStart: 70, escapeRate: 24, temperament: 'giant', strength: 1 },
  {
    no: 54, id: 'pike', name: 'Pike', scientific: 'Esox lucius', type: 'sportFish', water: 'fresh', tier: 2, hp: [40, 44], sellValue: 10, breedChance: 0.1, escapeAt: 135, escapeStart: 72, escapeRate: 17,
    temperament: 'predator',
    moves: {
      moves: [
        { id: 'snap', name: 'Snap the Lure', tag: 'strike', effects: [{ type: 'dealDamage', amount: 11 }] },
        { id: 'thrash', name: 'Tail Hit', tag: 'strike', effects: [{ type: 'dealDamage', amount: 7 }, { type: 'gainBlock', amount: 5 }] },
        { id: 'lurk', name: 'Lurk in the Reeds', tag: 'pull', effects: [{ type: 'pull', amount: 7 }, { type: 'applyStatus', status: 'strength', amount: 3, target: 'self' }, { type: 'gainBlock', amount: 4 }] },
      ],
      pattern: { type: 'weighted', firstMove: 'snap', weights: { snap: 25, thrash: 30, lurk: 45 }, maxConsecutive: 1 },
    },
  },
  { no: 55, id: 'commonBarbel', name: 'Common barbel', scientific: 'Barbus barbus', type: 'sportFish', water: 'fresh', tier: 1, hp: [26, 30], sellValue: 6, breedChance: 0.1, escapeAt: 105, escapeStart: 37, escapeRate: 14, temperament: 'fighter' },
  { no: 56, id: 'tigerBarb', name: 'Tiger barb', scientific: 'Puntigus tetrazona', type: 'smallFish', water: 'fresh', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 31, escapeRate: 5, temperament: 'reefFish' },
  { no: 57, id: 'cherryBarb', name: 'Cherry barb', scientific: 'Puntius titteya', type: 'smallFish', water: 'fresh', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 31, escapeRate: 5, temperament: 'reefFish' },
  { no: 58, id: 'opah', name: 'Opah', scientific: 'Lampris guttatus', type: 'deepSea', water: 'salt', tier: 3, hp: [60, 68], sellValue: 16, breedChance: 0.1, escapeAt: 165, escapeStart: 85, escapeRate: 16, temperament: 'giant' },
  { no: 59, id: 'blueDiscus', name: 'Blue discus', scientific: 'Symphysodon aequifasciatus', type: 'smallFish', water: 'fresh', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 41, escapeRate: 5, temperament: 'reefFish' },
  { no: 60, id: 'rainbowTrout', name: 'Rainbow trout', scientific: 'Oncorhynchus mykiss', type: 'sportFish', water: 'fresh', tier: 2, hp: [34, 40], sellValue: 9, breedChance: 0.1, escapeAt: 125, escapeStart: 62, escapeRate: 17, temperament: 'fighter' },
  { no: 61, id: 'ribbonEel', name: 'Ribbon eel', scientific: 'Rhinomuraena quaesita', type: 'rockFish', water: 'salt', tier: 1, hp: [22, 26], sellValue: 5, breedChance: 0.1, escapeAt: 75, escapeStart: 43, escapeRate: 6, temperament: 'eel' },
  { no: 62, id: 'giantMorayEel', name: 'Giant moray eel', scientific: 'Gymnothorax javanicus', type: 'rockFish', water: 'salt', tier: 3, hp: [56, 62], sellValue: 14, breedChance: 0.1, escapeAt: 150, escapeStart: 90, escapeRate: 16, temperament: 'eel', strength: 1 },
  { no: 63, id: 'europeanConger', name: 'European conger', scientific: 'Conger conger', type: 'rockFish', water: 'salt', tier: 2, hp: [40, 46], sellValue: 10, breedChance: 0.1, escapeAt: 115, escapeStart: 70, escapeRate: 12, temperament: 'eel' },
  { no: 64, id: 'harlequinSnakeEel', name: 'Harlequin snake eel', scientific: 'Myrichthys colubrinus', type: 'rockFish', water: 'salt', tier: 2, hp: [30, 36], sellValue: 7, breedChance: 0.1, escapeAt: 95, escapeStart: 62, escapeRate: 9, temperament: 'eel' },
  { no: 65, id: 'oarfish', name: 'Oarfish', scientific: 'Regalecus glesne', type: 'deepSea', water: 'salt', tier: 3, hp: [76, 86], sellValue: 20, breedChance: 0.1, escapeAt: 200, escapeStart: 102, escapeRate: 11, temperament: 'giant' },
  { no: 66, id: 'africanCoelacanth', name: 'African coelacanth', scientific: 'Latimeria chalumnae', type: 'deepSea', water: 'salt', tier: 3, hp: [66, 74], sellValue: 17, breedChance: 0.1, escapeAt: 175, escapeStart: 103, escapeRate: 10, temperament: 'giant' },
  { no: 67, id: 'longnoseGar', name: 'Longnose gar', scientific: 'Lepisosteus osseus', type: 'sportFish', water: 'fresh', tier: 2, hp: [38, 44], sellValue: 10, breedChance: 0.1, escapeAt: 135, escapeStart: 66, escapeRate: 18, temperament: 'predator' },
  { no: 68, id: 'saddledBichir', name: 'Saddled bichir', scientific: 'Polypterus endlicheri', type: 'sportFish', water: 'fresh', tier: 2, hp: [30, 36], sellValue: 7, breedChance: 0.1, escapeAt: 115, escapeStart: 67, escapeRate: 13, temperament: 'predator' },
  { no: 69, id: 'senegalBichir', name: 'Senegal bichir', scientific: 'Polypterus senegalus', type: 'sportFish', water: 'fresh', tier: 1, hp: [24, 28], sellValue: 6, breedChance: 0.1, escapeAt: 100, escapeStart: 44, escapeRate: 11, temperament: 'predator' },
  { no: 70, id: 'turbot', name: 'Turbot', scientific: 'Scophthalmus maximus', type: 'rockFish', water: 'salt', tier: 2, hp: [36, 42], sellValue: 9, breedChance: 0.1, escapeAt: 110, escapeStart: 70, escapeRate: 6, temperament: 'ambusher' },
  { no: 71, id: 'europeanSeabass', name: 'European seabass', scientific: 'Dicentrarchus labrax', type: 'sportFish', water: 'salt', tier: 2, hp: [36, 42], sellValue: 9, breedChance: 0.1, escapeAt: 130, escapeStart: 64, escapeRate: 18, temperament: 'predator' },
  { no: 72, id: 'europeanAnchovy', name: 'European anchovy', scientific: 'Engraulis encrasicolus', type: 'smallFish', water: 'salt', tier: 1, hp: [10, 14], sellValue: 2, breedChance: 0.1, escapeAt: 50, escapeStart: 22, escapeRate: 6, temperament: 'schooling' },
  { no: 73, id: 'humpheadWrasse', name: 'Humphead wrasse', scientific: 'Cheilinus undulatus', type: 'bigFish', water: 'salt', tier: 3, hp: [60, 68], sellValue: 16, breedChance: 0.1, escapeAt: 165, escapeStart: 90, escapeRate: 12, temperament: 'giant' },
  { no: 74, id: 'commonStingray', name: 'Common stingray', scientific: 'Dasyatis pastinaca', type: 'bigFish', water: 'salt', tier: 3, hp: [52, 58], sellValue: 13, breedChance: 0.1, escapeAt: 145, escapeStart: 89, escapeRate: 11, temperament: 'venomous' },
  { no: 75, id: 'shortfinMakoShark', name: 'Shortfin mako shark', scientific: 'Isurus oxyrinchus', type: 'bigFish', water: 'salt', tier: 3, hp: [70, 78], sellValue: 18, breedChance: 0.1, escapeAt: 185, escapeStart: 77, escapeRate: 29, temperament: 'predator', strength: 2 },
  { no: 76, id: 'riverLamprey', name: 'River lamprey', scientific: 'Lampetra fluviatilis', type: 'rockFish', water: 'brackish', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 38, escapeRate: 6, temperament: 'eel' },
  { no: 77, id: 'racoonButterfish', name: 'Racoon butterfish', scientific: 'Chaetodon lunula', type: 'smallFish', water: 'salt', tier: 1, hp: [16, 20], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 41, escapeRate: 5, temperament: 'reefFish' },
  { no: 78, id: 'atlanticTrumpetfish', name: 'Atlantic trumpetfish', scientific: 'Aulostomus strigosus', type: 'rockFish', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 30, escapeRate: 8, temperament: 'predator' },
  { no: 79, id: 'bartlettsAnthias', name: 'Bartlett’s anthias', scientific: 'Pseudanthias bartlettorum', type: 'smallFish', water: 'salt', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 36, escapeRate: 5, temperament: 'reefFish' },
  { no: 80, id: 'fireGoby', name: 'Fire goby', scientific: 'Nemateleotris magnifica', type: 'smallFish', water: 'salt', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 31, escapeRate: 5, temperament: 'reefFish' },
  { no: 81, id: 'atlanticSpadefish', name: 'Atlantic spadefish', scientific: 'Chaetodipterus faber', type: 'smallFish', water: 'salt', tier: 1, hp: [22, 26], sellValue: 5, breedChance: 0.1, escapeAt: 75, escapeStart: 35, escapeRate: 6, temperament: 'reefFish' },
  { no: 82, id: 'blueAcara', name: 'Blue acara', scientific: 'Andinoacara pulcher', type: 'smallFish', water: 'fresh', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 41, escapeRate: 5, temperament: 'reefFish' },
  { no: 83, id: 'oscar', name: 'Oscar', scientific: 'Astronotus ocellatus', type: 'smallFish', water: 'fresh', tier: 1, hp: [24, 28], sellValue: 6, breedChance: 0.1, escapeAt: 80, escapeStart: 36, escapeRate: 9, temperament: 'predator' },
  { no: 84, id: 'dwarfGourami', name: 'Dwarf gourami', scientific: 'Trichogaster lalius', type: 'smallFish', water: 'fresh', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 40, escapeRate: 4, temperament: 'reefFish' },
  { no: 85, id: 'clownLoach', name: 'Clown loach', scientific: 'Chromobotia macracanthus', type: 'smallFish', water: 'fresh', tier: 1, hp: [16, 20], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 45, escapeRate: 4, temperament: 'bottomDweller' },
  { no: 86, id: 'arapaima', name: 'Arapaima', scientific: 'Arapaima gigas', type: 'bigFish', water: 'fresh', tier: 3, hp: [74, 82], sellValue: 19, breedChance: 0.1, escapeAt: 195, escapeStart: 80, escapeRate: 18, temperament: 'giant' },
  { no: 87, id: 'asianArowana', name: 'Asian arowana', scientific: 'Scleropages formosus', type: 'sportFish', water: 'fresh', tier: 2, hp: [36, 42], sellValue: 9, breedChance: 0.1, escapeAt: 130, escapeStart: 61, escapeRate: 18, temperament: 'predator' },
  { no: 88, id: 'moorishIdol', name: 'Moorish idol', scientific: 'Zanclus cornutus', type: 'smallFish', water: 'salt', tier: 1, hp: [16, 20], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 41, escapeRate: 5, temperament: 'reefFish' },
  { no: 89, id: 'banggaiCardinalfish', name: 'Banggai cardinalfish', scientific: 'Pterapogon kauderni', type: 'smallFish', water: 'salt', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 40, escapeRate: 4, temperament: 'reefFish' },
  { no: 90, id: 'longhornCowfish', name: 'Longhorn cowfish', scientific: 'Lactoria cornuta', type: 'smallFish', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 46, escapeRate: 3, temperament: 'puffer' },
  { no: 91, id: 'hogfish', name: 'Hogfish', scientific: 'Lachnolaimus maximus', type: 'sportFish', water: 'salt', tier: 1, hp: [24, 28], sellValue: 6, breedChance: 0.1, escapeAt: 100, escapeStart: 44, escapeRate: 11, temperament: 'fighter' },
  { no: 92, id: 'blueheadWrasse', name: 'Bluehead wrasse', scientific: 'Thalassoma bifasciatum', type: 'smallFish', water: 'salt', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 32, escapeRate: 6, temperament: 'reefFish' },
  { no: 93, id: 'lumpfish', name: 'Lumpfish', scientific: 'Cyclopterus lumpus', type: 'rockFish', water: 'salt', tier: 2, hp: [30, 36], sellValue: 7, breedChance: 0.1, escapeAt: 95, escapeStart: 67, escapeRate: 6, temperament: 'puffer' },
  { no: 94, id: 'boesemansRainbowfish', name: 'Boeseman’s rainbowfish', scientific: 'Melanotaenia boesemani', type: 'smallFish', water: 'fresh', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 36, escapeRate: 5, temperament: 'reefFish' },
  { no: 95, id: 'hillstreamLoach', name: 'Hillstream loach', scientific: 'Beaufortia kweichowensis', type: 'smallFish', water: 'fresh', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 40, escapeRate: 2, temperament: 'bottomDweller' },
  { no: 96, id: 'seahorse', name: 'Seahorse', scientific: 'Hippocampus hippocampus', type: 'smallFish', water: 'salt', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 43, escapeRate: 2, temperament: 'reefFish' },

  // --- Shellfish, jellyfish, cephalopods, crustaceans & co. (rows 9–12) ------
  { no: 97, id: 'pacificOyster', name: 'Pacific oyster', scientific: 'Crassostrea gigas', type: 'shellfish', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 46, escapeRate: 2, temperament: 'armored' },
  { no: 98, id: 'pearlOyster', name: 'Pearl oyster', scientific: 'Pinctada margaritifera', type: 'shellfish', water: 'salt', tier: 2, hp: [30, 36], sellValue: 7, breedChance: 0.1, escapeAt: 95, escapeStart: 67, escapeRate: 3, temperament: 'armored' },
  { no: 99, id: 'hardClam', name: 'Hard clam', scientific: 'Mercenaria mercenaria', type: 'shellfish', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 46, escapeRate: 3, temperament: 'armored' },
  { no: 100, id: 'giantClam', name: 'Giant clam', scientific: 'Tridacna gigas', type: 'shellfish', water: 'salt', tier: 3, hp: [60, 70], sellValue: 16, breedChance: 0.1, escapeAt: 165, escapeStart: 123, escapeRate: 5, temperament: 'armored', strength: 2 },
  { no: 101, id: 'mediterraneanMussel', name: 'Mediterranean mussel', scientific: 'Mytilus galloprovincialis', type: 'shellfish', water: 'salt', tier: 1, hp: [16, 20], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 47, escapeRate: 2, temperament: 'armored' },
  { no: 102, id: 'greatScallop', name: 'Great scallop', scientific: 'Pecten maximus', type: 'shellfish', water: 'salt', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 37, escapeRate: 6, temperament: 'armored' },
  { no: 103, id: 'spinyCockle', name: 'Spiny cockle', scientific: 'Acanthocardia aculeata', type: 'shellfish', water: 'salt', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 45, escapeRate: 3, temperament: 'armored' },
  { no: 104, id: 'mediterraneanJelly', name: 'Mediterranean jelly', scientific: 'Cotylorhiza tuberculata', type: 'tentacled', water: 'salt', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 45, escapeRate: 3, temperament: 'jellyfish' },
  { no: 105, id: 'nomadJellyfish', name: 'Nomad jellyfish', scientific: 'Rhopilema nomadica', type: 'tentacled', water: 'salt', tier: 2, hp: [28, 34], sellValue: 7, breedChance: 0.1, escapeAt: 90, escapeStart: 65, escapeRate: 4, temperament: 'jellyfish' },
  { no: 106, id: 'portugueseManOWar', name: 'Portuguese man o’ war', scientific: 'Physalia physalis', type: 'tentacled', water: 'salt', tier: 3, hp: [48, 54], sellValue: 12, breedChance: 0.1, escapeAt: 135, escapeStart: 105, escapeRate: 5, temperament: 'jellyfish', strength: 1 },
  { no: 107, id: 'commonJellyfish', name: 'Common jellyfish', scientific: 'Aurelia aurita', type: 'tentacled', water: 'salt', tier: 1, hp: [16, 20], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 45, escapeRate: 3, temperament: 'jellyfish' },
  { no: 108, id: 'flameJellyfish', name: 'Flame jellyfish', scientific: 'Rhopilema esculentum', type: 'tentacled', water: 'salt', tier: 2, hp: [30, 36], sellValue: 7, breedChance: 0.1, escapeAt: 95, escapeStart: 65, escapeRate: 5, temperament: 'jellyfish' },
  { no: 109, id: 'commonOctopus', name: 'Common octopus', scientific: 'Octopus vulgaris', type: 'tentacled', water: 'salt', tier: 2, hp: [38, 44], sellValue: 10, breedChance: 0.1, escapeAt: 115, escapeStart: 67, escapeRate: 13, temperament: 'cephalopod' },
  { no: 110, id: 'flapjackOctopus', name: 'Flapjack octopus', scientific: 'Opisthoteuthis californiana', type: 'tentacled', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 46, escapeRate: 5, temperament: 'cephalopod' },
  { no: 111, id: 'atlanticGiantSquid', name: 'Atlantic giant squid', scientific: 'Architeuthis dux', type: 'tentacled', water: 'salt', tier: 3, hp: [70, 80], sellValue: 18, breedChance: 0.1, escapeAt: 185, escapeStart: 89, escapeRate: 19, temperament: 'cephalopod', strength: 2 },
  { no: 112, id: 'commonSquid', name: 'Common squid', scientific: 'Loligo vulgaris', type: 'tentacled', water: 'salt', tier: 2, hp: [30, 36], sellValue: 7, breedChance: 0.1, escapeAt: 95, escapeStart: 50, escapeRate: 12, temperament: 'cephalopod' },
  { no: 113, id: 'cushionStar', name: 'Cushion star', scientific: 'Culcita novaeguineae', type: 'critter', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 46, escapeRate: 3, temperament: 'bottomDweller' },
  { no: 114, id: 'commonStarfish', name: 'Common starfish', scientific: 'Asterias rubens', type: 'critter', water: 'salt', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 45, escapeRate: 3, temperament: 'bottomDweller' },
  { no: 115, id: 'seaSponge', name: 'Sea sponge', scientific: 'Spongia officinalis', type: 'critter', water: 'salt', tier: 1, hp: [22, 26], sellValue: 5, breedChance: 0.1, escapeAt: 75, escapeStart: 51, escapeRate: 2, temperament: 'bottomDweller' },
  { no: 116, id: 'seaUrchin', name: 'Sea urchin', scientific: 'Paracentrotus lividus', type: 'critter', water: 'salt', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 47, escapeRate: 2, temperament: 'venomous' },
  { no: 117, id: 'redKingCrab', name: 'Red king crab', scientific: 'Paralithodes camtschaticus', type: 'crustacean', water: 'salt', tier: 3, hp: [56, 64], sellValue: 15, breedChance: 0.1, escapeAt: 155, escapeStart: 111, escapeRate: 9, temperament: 'clawed', strength: 1 },
  { no: 118, id: 'commonHermitCrab', name: 'Common hermit crab', scientific: 'Pagurus bernhardus', type: 'crustacean', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 45, escapeRate: 4, temperament: 'clawed' },
  { no: 119, id: 'blueCrab', name: 'Blue crab', scientific: 'Callinectes sapidus', type: 'crustacean', water: 'brackish', tier: 2, hp: [32, 38], sellValue: 8, breedChance: 0.1, escapeAt: 100, escapeStart: 64, escapeRate: 10, temperament: 'clawed' },
  { no: 120, id: 'yetiCrab', name: 'Yeti crab', scientific: 'Kiwa hirsuta', type: 'crustacean', water: 'salt', tier: 2, hp: [30, 36], sellValue: 7, breedChance: 0.1, escapeAt: 95, escapeStart: 67, escapeRate: 6, temperament: 'clawed' },
  { no: 121, id: 'atlanticHorseshoeCrab', name: 'Atlantic horseshoe crab', scientific: 'Limulus polyphemus', type: 'crustacean', water: 'salt', tier: 2, hp: [36, 42], sellValue: 9, breedChance: 0.1, escapeAt: 110, escapeStart: 75, escapeRate: 6, temperament: 'clawed' },
  { no: 122, id: 'atlanticCrayfish', name: 'Atlantic crayfish', scientific: 'Austropotamobius pallipes', type: 'crustacean', water: 'fresh', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 38, escapeRate: 6, temperament: 'clawed' },
  { no: 123, id: 'commonLobster', name: 'Common lobster', scientific: 'Homarus gammarus', type: 'crustacean', water: 'salt', tier: 2, hp: [42, 48], sellValue: 11, breedChance: 0.1, escapeAt: 120, escapeStart: 72, escapeRate: 10, temperament: 'clawed' },
  { no: 124, id: 'spinyLobster', name: 'Spiny lobster', scientific: 'Palinurus elephas', type: 'crustacean', water: 'salt', tier: 2, hp: [40, 46], sellValue: 10, breedChance: 0.1, escapeAt: 115, escapeStart: 67, escapeRate: 10, temperament: 'clawed' },
  { no: 125, id: 'shrimp', name: 'Shrimp', scientific: 'Parapenaeus longirostris', type: 'crustacean', water: 'salt', tier: 1, hp: [10, 14], sellValue: 2, breedChance: 0.1, escapeAt: 50, escapeStart: 18, escapeRate: 6, temperament: 'schooling' },
  { no: 126, id: 'greenSeaTurtle', name: 'Green sea turtle', scientific: 'Chelonia mydas', type: 'critter', water: 'salt', tier: 2, hp: [44, 50], sellValue: 11, breedChance: 0.1, escapeAt: 125, escapeStart: 50, escapeRate: 12, temperament: 'armored' },
  { no: 127, id: 'axolotl', name: 'Axolotl', scientific: 'Ambystoma mexicanum', type: 'critter', water: 'fresh', tier: 1, hp: [18, 22], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 45, escapeRate: 3, temperament: 'bottomDweller' },
  { no: 128, id: 'chamberedNautilus', name: 'Chambered nautilus', scientific: 'Nautilus pompilius', type: 'tentacled', water: 'salt', tier: 2, hp: [32, 38], sellValue: 8, breedChance: 0.1, escapeAt: 100, escapeStart: 68, escapeRate: 6, temperament: 'cephalopod' },
  { no: 129, id: 'gooseBarnacle', name: 'Goose barnacle', scientific: 'Pollicipes pollicipes', type: 'crustacean', water: 'salt', tier: 1, hp: [16, 20], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 51, escapeRate: 2, temperament: 'armored' },
  { no: 130, id: 'blueSeaDragon', name: 'Blue sea dragon', scientific: 'Glaucus atlanticus', type: 'critter', water: 'salt', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 45, escapeRate: 2, temperament: 'venomous' },
  { no: 131, id: 'seaButterfly', name: 'Sea butterfly', scientific: 'Thecosomata', type: 'tentacled', water: 'salt', tier: 1, hp: [10, 14], sellValue: 2, breedChance: 0.1, escapeAt: 50, escapeStart: 38, escapeRate: 2, temperament: 'jellyfish' },
  { no: 132, id: 'giantCuttlefish', name: 'Giant cuttlefish', scientific: 'Sepia apama', type: 'tentacled', water: 'salt', tier: 2, hp: [38, 44], sellValue: 10, breedChance: 0.1, escapeAt: 115, escapeStart: 70, escapeRate: 12, temperament: 'cephalopod' },
  { no: 133, id: 'seaCucumber', name: 'Sea cucumber', scientific: 'Holothuria tubulosa', type: 'critter', water: 'salt', tier: 1, hp: [20, 24], sellValue: 5, breedChance: 0.1, escapeAt: 70, escapeStart: 46, escapeRate: 3, temperament: 'bottomDweller' },
  { no: 134, id: 'commonSeaSlug', name: 'Common sea slug', scientific: 'Aeolidia papillosa', type: 'critter', water: 'salt', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 44, escapeRate: 3, temperament: 'bottomDweller' },
  { no: 135, id: 'emeraldSeaSlug', name: 'Emerald sea slug', scientific: 'Elysia chlorotica', type: 'critter', water: 'brackish', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 44, escapeRate: 3, temperament: 'bottomDweller' },
  { no: 136, id: 'leafSlug', name: 'Leaf slug', scientific: 'Costasiella kuroshimae', type: 'critter', water: 'salt', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 43, escapeRate: 2, temperament: 'bottomDweller' },
  { no: 137, id: 'seaBunny', name: 'Sea bunny', scientific: 'Jorunna parva', type: 'critter', water: 'salt', tier: 1, hp: [12, 16], sellValue: 3, breedChance: 0.1, escapeAt: 55, escapeStart: 43, escapeRate: 2, temperament: 'bottomDweller' },
  { no: 138, id: 'giantIsopod', name: 'Giant isopod', scientific: 'Bathynomus giganteus', type: 'crustacean', water: 'salt', tier: 2, hp: [34, 40], sellValue: 9, breedChance: 0.1, escapeAt: 105, escapeStart: 70, escapeRate: 6, temperament: 'clawed' },
  { no: 139, id: 'queenConch', name: 'Queen conch', scientific: 'Aliger gigas', type: 'shellfish', water: 'salt', tier: 2, hp: [30, 36], sellValue: 7, breedChance: 0.1, escapeAt: 95, escapeStart: 59, escapeRate: 5, temperament: 'armored' },
  { no: 140, id: 'purpleConeSnail', name: 'Purple cone snail', scientific: 'Conus purpurascens', type: 'shellfish', water: 'salt', tier: 2, hp: [28, 32], sellValue: 7, breedChance: 0.1, escapeAt: 90, escapeStart: 66, escapeRate: 3, temperament: 'venomous' },
  { no: 141, id: 'fireworm', name: 'Fireworm', scientific: 'Hermodice carunculata', type: 'critter', water: 'salt', tier: 1, hp: [16, 20], sellValue: 4, breedChance: 0.1, escapeAt: 65, escapeStart: 45, escapeRate: 3, temperament: 'venomous' },
  { no: 142, id: 'spoonWorm', name: 'Spoon worm', scientific: 'Bonellia viridis', type: 'critter', water: 'salt', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 36, escapeRate: 5, temperament: 'bottomDweller' },
  { no: 143, id: 'planaria', name: 'Planaria', scientific: 'Planaria torva', type: 'critter', water: 'fresh', tier: 1, hp: [10, 14], sellValue: 2, breedChance: 0.1, escapeAt: 50, escapeStart: 38, escapeRate: 2, temperament: 'bottomDweller' },
  { no: 144, id: 'medicinalLeech', name: 'Medicinal leech', scientific: 'Hirudo medicinalis', type: 'critter', water: 'fresh', tier: 1, hp: [14, 18], sellValue: 3, breedChance: 0.1, escapeAt: 60, escapeStart: 36, escapeRate: 5, temperament: 'eel' },
];
