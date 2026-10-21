import { MOVE_INTENSITY, type Effect, type EnemyMove, type IntentPattern, type MoveIntensity, type MoveRole, type MoveTag, type StatusId } from '../engine';

/**
 * Shared move sets. A creature in creatures.ts picks one by name, so
 * rebalancing e.g. every predator happens here, in one place.
 *
 * Every move is a Strike (wears down the angler's Grit) or a Pull (drags on the line,
 * raising its own Will), of an intensity: light, normal or heavy. Only the intensities
 * matter: each fight scales a creature's moves so they average ENCOUNTER_TURN_AVERAGE
 * per turn, as often as the pattern plays them (`turnAverage`). The player's Hold soaks
 * both. Moves can add extras (Block, Weak, Strength…).
 *
 * Roles (`role`): exactly one `pace` per set (light, its Will rises half as much that
 * turn); up to two `special`s (light tricks: Ink, junk cards, taxes…; never twice in a
 * row); a `windUp` (light) whose `followUp` is played heavy and WIND_UP_PERCENT bigger;
 * `heavy` moves only ever come right after their Wind-up.
 * Strength from moves is kept to the predators, Pike, Red piranha, and mini-bosses and
 * bosses (whose Wind-ups also give 1), MAX_MOVE_STRENGTH per fight at most.
 * Patterns: 'weighted' for ordinary creatures; `bossPattern`, a fixed 'sequence', when the
 * creature is a mini-boss or boss.
 */
export interface Behavior {
  moves: EnemyMove[];
  pattern: IntentPattern;
  /** Its pattern as a mini-boss or boss. */
  bossPattern?: IntentPattern;
}

/** A normal move's Strike or Pull before the fight scales it (only the ratios between moves matter). */
const POINTS = 12;

/** A move: its Strike (split over `hits`) or Pull at its intensity, then its extras. */
export function move(
  id: string,
  name: string,
  tag: MoveTag,
  intensity: MoveIntensity,
  opts: { hits?: number; role?: MoveRole; followUp?: string; extras?: Effect[]; heavyIfNoHold?: boolean } = {},
): EnemyMove {
  const amount = MOVE_INTENSITY[intensity] * POINTS;
  const main: Effect =
    tag === 'strike'
      ? { type: 'dealDamage', amount: amount / (opts.hits ?? 1), ...(opts.hits ? { hits: opts.hits } : {}) }
      : { type: 'pull', amount, ...(opts.heavyIfNoHold ? { heavyIfNoHold: true } : {}) };
  return {
    id,
    name,
    tag,
    intensity,
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.followUp ? { followUp: opts.followUp } : {}),
    effects: [main, ...(opts.extras ?? [])],
  };
}

export const WIND_UP: Effect = { type: 'applyStatus', status: 'windUp', amount: 1, target: 'self' };
const block = (amount: number): Effect => ({ type: 'gainBlock', amount });
const onYou = (status: StatusId, amount = 1): Effect => ({ type: 'applyStatus', status, amount });
const strength: Effect = { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' };
export const STEAL: Effect = { type: 'stealPatience', amount: 1 };
const INK: Effect = { type: 'ink' };
const BURROW: Effect = { type: 'applyStatus', status: 'burrowed', amount: 1, target: 'self' };
const junk = (card: string): Effect => ({ type: 'addJunk', card });
const special = { role: 'special' as const };
const pace = { role: 'pace' as const };
const windUp = (followUp: string, extras: Effect[] = []) => ({ role: 'windUp' as const, followUp, extras: [WIND_UP, ...extras] });

export const behaviors = {
  /** Small, colourful, more annoying than dangerous. */
  reefFish: {
    moves: [
      move('nip', 'Nip at the Lure', 'strike', 'normal'),
      move('dartAway', 'Dart for Cover', 'pull', 'normal', { extras: [block(4)] }),
      move('nibble', 'Steal the Bait', 'strike', 'light', { ...special, extras: [STEAL] }),
      move('flashColors', 'Flashy Zigzag', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { nip: 35, dartAway: 25, nibble: 20, flashColors: 20 } },
  },

  /** Tiny fish in a shoal: many small bites, and they get under your skin. */
  schooling: {
    moves: [
      move('swarm', 'Nibble Frenzy', 'strike', 'normal', { hits: 3 }),
      move('scatter', 'Scatter', 'pull', 'normal', { extras: [block(3)] }),
      move('regroup', 'Regroup', 'pull', 'light', pace),
      move('startle', 'Startle the School', 'pull', 'light', { ...special, extras: [onYou('skittish')] }),
      move('weave', 'Weave Through the Line', 'pull', 'light', { ...special, extras: [junk('tangledLine')] }),
    ],
    pattern: { type: 'weighted', weights: { swarm: 30, scatter: 25, regroup: 20, startle: 12, weave: 13 } },
  },

  /** Hunters: they size up the lure, then shake hard and run. */
  predator: {
    moves: [
      move('lunge', 'Jolt the Rod', 'strike', 'normal', { extras: [onYou('vulnerable')] }),
      move('circle', 'Screaming Run', 'pull', 'normal', { extras: [strength] }),
      move('sizeUp', 'Size Up the Lure', 'pull', 'light', windUp('bite')),
      move('bite', 'Head Shake', 'strike', 'heavy', { role: 'heavy' }),
      move('grab', 'Grab the Bait', 'strike', 'light', { ...special, extras: [onYou('baitGrabbed')] }),
      move('circleLure', 'Circle the Lure', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { lunge: 30, circle: 20, sizeUp: 15, grab: 15, circleLure: 20 } },
    bossPattern: { type: 'sequence', moves: ['lunge', 'circle', 'sizeUp', 'bite', 'grab', 'lunge', 'circleLure'] },
  },

  /** Spines and venom. */
  venomous: {
    moves: [
      move('venomStrike', 'Prickly Thrash', 'strike', 'normal', { extras: [onYou('vulnerable')] }),
      move('raiseSpines', 'Dive for the Rocks', 'pull', 'normal', { extras: [block(6)] }),
      move('sting', 'Spiny Flick', 'strike', 'light', { ...special, extras: [onYou('venom', 2)] }),
      move('bristle', 'Raise Spines', 'pull', 'light', { ...special, extras: [onYou('spines', 2)] }),
      move('lieStill', 'Lie Still', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { venomStrike: 25, raiseSpines: 25, sting: 15, bristle: 15, lieStill: 20 } },
    bossPattern: { type: 'sequence', moves: ['venomStrike', 'sting', 'raiseSpines', 'bristle', 'venomStrike', 'lieStill'] },
  },

  /** Inflates and pokes, then has to deflate. */
  puffer: {
    moves: [
      move('spikeJab', 'Grumpy Spines', 'strike', 'normal'),
      move('paddle', 'Paddle Away', 'pull', 'normal'),
      move('puffUp', 'Puff Up', 'pull', 'light', { ...special, extras: [block(6), onYou('spines', 2)] }),
      move('bump', 'Water Splash', 'strike', 'light', { extras: [onYou('weak')] }),
      move('deflate', 'Deflate', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { spikeJab: 30, paddle: 25, puffUp: 20, bump: 10, deflate: 15 } },
    bossPattern: { type: 'sequence', moves: ['spikeJab', 'puffUp', 'paddle', 'bump', 'spikeJab', 'deflate'] },
  },

  /** Hides, waits, then strikes hard. Hit it while it's hiding! */
  ambusher: {
    moves: [
      move('snap', 'Snap at the Lure', 'strike', 'normal'),
      move('lurk', 'Into the Weed', 'pull', 'normal', { extras: [block(4)] }),
      move('stirSilt', 'Stir the Silt', 'pull', 'light', { ...special, extras: [INK] }),
      move('lieInWait', 'Lie in Wait', 'pull', 'light', windUp('ambush')),
      move('ambush', 'Ambush the Lure', 'strike', 'heavy', { role: 'heavy' }),
      move('settle', 'Settle in the Sand', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { snap: 25, lurk: 25, stirSilt: 15, lieInWait: 15, settle: 20 } },
    bossPattern: { type: 'sequence', moves: ['snap', 'stirSilt', 'lurk', 'lieInWait', 'ambush', 'settle'] },
  },

  /** Game fish that put up a fight on the line, and need to catch their breath. */
  fighter: {
    moves: [
      move('tailSlap', 'Tail Hit', 'strike', 'normal'),
      move('leap', 'Leap Out', 'pull', 'normal', { extras: [block(4)] }),
      move('thrash', 'Water Splash', 'strike', 'light', { hits: 2 }),
      move('shake', 'Shake the Hook', 'pull', 'light', { ...special, heavyIfNoHold: true }),
      move('catchBreath', 'Catch Breath', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { tailSlap: 30, leap: 25, thrash: 10, shake: 15, catchBreath: 20 } },
    bossPattern: { type: 'sequence', moves: ['tailSlap', 'leap', 'shake', 'thrash', 'tailSlap', 'catchBreath'] },
  },

  /** Huge and slow: sounds deep, heaves, then hangs off the line like dead weight. */
  giant: {
    moves: [
      move('ram', 'Dead Weight', 'strike', 'normal'),
      move('longRun', 'Long Run', 'pull', 'normal'),
      move('dive', 'Sound Deep', 'pull', 'light', { ...special, extras: [BURROW] }),
      move('heave', 'Heave', 'strike', 'light', windUp('ram')),
      move('drift', 'Drift', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { ram: 25, longRun: 25, dive: 15, heave: 15, drift: 20 } },
    bossPattern: { type: 'sequence', moves: ['ram', 'longRun', 'dive', 'heave', 'ram', 'drift'] },
  },

  /** Wriggles, hides in the rocks, coils, then wriggles hard. */
  eel: {
    moves: [
      move('doubleBite', 'Slimy Wriggle', 'strike', 'normal', { hits: 4 }),
      move('coil', 'Hide in the Rocks', 'pull', 'normal', { extras: [block(4)] }),
      move('coilUp', 'Coil', 'pull', 'light', windUp('doubleBite')),
      move('slime', 'Slime the Line', 'strike', 'light', { ...special, extras: [junk('slimySeaweed')] }),
      move('crevice', 'Rest in the Crevice', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { doubleBite: 30, coil: 25, coilUp: 15, slime: 15, crevice: 15 } },
    bossPattern: { type: 'sequence', moves: ['doubleBite', 'slime', 'coil', 'coilUp', 'doubleBite', 'crevice'] },
  },

  /** Shells: very hard to crack. */
  armored: {
    moves: [
      move('spit', 'Squirt', 'strike', 'normal', { extras: [onYou('weak')] }),
      move('clampShut', 'Bury in the Sand', 'pull', 'normal', { extras: [block(8)] }),
      move('clampTight', 'Clamp Shut', 'pull', 'light', { ...special, extras: [BURROW] }),
      move('snap', 'Clamp the Fingers', 'strike', 'light', { ...special, extras: [onYou('pinchedHand')] }),
      move('restOnRocks', 'Rest on the Rocks', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { spit: 25, clampShut: 25, clampTight: 15, snap: 15, restOnRocks: 20 } },
    bossPattern: { type: 'sequence', moves: ['spit', 'clampShut', 'snap', 'clampTight', 'spit', 'restOnRocks'] },
  },

  /** Drifting stingers. */
  jellyfish: {
    moves: [
      move('wrap', 'Wrap Around', 'strike', 'normal'),
      move('drift', 'Drift Away', 'pull', 'normal', { extras: [block(3)] }),
      move('sting', 'Stinging Tendrils', 'strike', 'light', { ...special, extras: [onYou('venom', 2)] }),
      move('tangle', 'Tangle the Line', 'pull', 'light', { ...special, extras: [onYou('tangled')] }),
      move('pulse', 'Pulse', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { wrap: 25, drift: 25, sting: 15, tangle: 15, pulse: 20 } },
  },

  /** Octopus and squid: ink, many suckers, a change of colour, then anchored to a rock. */
  cephalopod: {
    moves: [
      move('tentacles', 'Suction Grip', 'strike', 'normal', { hits: 3 }),
      move('squeeze', 'Rock Anchor', 'pull', 'normal'),
      move('inkCloud', 'Ink Cloud', 'pull', 'light', { ...special, extras: [block(3), INK] }),
      move('venomBite', 'Venomous Bite', 'strike', 'light', { ...special, extras: [onYou('numbFingers')] }),
      move('changeColour', 'Change Colour', 'pull', 'light', windUp('tentacles')),
      move('hover', 'Hover', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { tentacles: 25, squeeze: 20, inkCloud: 15, venomBite: 10, changeColour: 15, hover: 15 } },
    bossPattern: { type: 'sequence', moves: ['tentacles', 'inkCloud', 'squeeze', 'venomBite', 'changeColour', 'tentacles', 'hover'] },
  },

  /** Crabs, lobsters and other crustaceans: pinch, wedge in, raise the claws, crush. */
  clawed: {
    moves: [
      move('pinch', 'Pinch the Fingers', 'strike', 'normal'),
      move('shellUp', 'Wedge Under a Rock', 'pull', 'normal', { extras: [block(6)] }),
      move('brandishClaws', 'Raise the Claws', 'strike', 'light', windUp('crush')),
      move('crush', 'Crushing Pinch', 'strike', 'heavy', { role: 'heavy' }),
      move('kickSand', 'Kick Up Sand', 'pull', 'light', { ...special, extras: [junk('pebbleInTheBoot')] }),
      move('raiseClaws', 'Scuttle Backwards', 'pull', 'light', pace),
    ],
    pattern: { type: 'weighted', weights: { pinch: 30, shellUp: 25, brandishClaws: 15, kickSand: 15, raiseClaws: 15 } },
    bossPattern: { type: 'sequence', moves: ['pinch', 'shellUp', 'kickSand', 'brandishClaws', 'crush', 'raiseClaws'] },
  },

  /** Slugs, stars, worms and other things on the sea floor: they also stop to graze. */
  bottomDweller: {
    moves: [
      move('prickle', 'Stinky Squirt', 'strike', 'normal'),
      move('harden', 'Stick to the Bottom', 'pull', 'normal', { extras: [block(5)] }),
      move('ooze', 'Slimy Ooze', 'strike', 'light', { ...special, extras: [junk('slimySeaweed')] }),
      move('stirSilt', 'Stir the Silt', 'pull', 'light', { ...special, extras: [INK] }),
      move('graze', 'Graze', 'pull', 'light', { ...pace, extras: [{ type: 'healPercent', percent: 5, target: 'self' }] }),
    ],
    pattern: { type: 'weighted', weights: { prickle: 30, harden: 25, ooze: 15, stirSilt: 10, graze: 20 } },
  },
} satisfies Record<string, Behavior>;

export type BehaviorId = keyof typeof behaviors;
