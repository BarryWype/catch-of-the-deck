import type { EnemyMove, IntentPattern } from '../engine';

/**
 * Shared move sets. A creature in creatures.ts picks one by name, so
 * rebalancing e.g. every predator happens here, in one place.
 *
 * Every move has a `tag`:
 * - 'strike': it wears down the angler's Grit (a `dealDamage` effect: a tiring
 *   fight, a stinky squirt, pinched fingers…).
 * - 'pull': it drags on the line to get away (a `pull` effect, raising its own
 *   escape bar: a run, a dive, wedging under a rock…).
 * - quiet moves, never scaled to the fight (only Strikes and Pulls are):
 *   'rest' (nothing; add `skipWillRise: true` so its Will doesn't rise that turn),
 *   'feed' (a `healPercent` effect, and `skipWillRise`), 'windUp' (applies `windUp`
 *   to itself: its next move's Strike or Pull is 50% bigger), 'guard' (Block only),
 *   'buff' (Strength only).
 * The player's Hold soaks Strikes and Pulls; what gets past it lands. Moves can add
 * other effects (statuses, Block: the creature holding on), but keep to one tag.
 * Strength from moves is kept to the predators, Pike, Red piranha, and mini-bosses
 * and bosses (whose Wind-ups also give 1), MAX_MOVE_STRENGTH per fight at most.
 * From a creature's point of view, `target` (the default) is the player and
 * `self` is itself.
 * Patterns: 'sequence' plays moves in order (looping from `loopFrom`);
 * 'weighted' picks randomly by weight, never more than `maxConsecutive` in a row
 * (`maxRepeat` sets it for one move).
 */
export interface Behavior {
  moves: EnemyMove[];
  pattern: IntentPattern;
}

export const WIND_UP = { type: 'applyStatus', status: 'windUp', amount: 1, target: 'self' } as const;
/** Catch Breath and other plain rests: nothing happens, and the Will doesn't rise. */
const rest = (id: string, name: string): EnemyMove => ({ id, name, tag: 'rest', skipWillRise: true, effects: [] });

export const behaviors = {
  /** Small, colourful, more annoying than dangerous. */
  reefFish: {
    moves: [
      { id: 'nibble', name: 'Steal the Bait', tag: 'strike', effects: [{ type: 'dealDamage', amount: 5 }] },
      { id: 'dartAway', name: 'Dart for Cover', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 4 }] },
      { id: 'flashColors', name: 'Flashy Zigzag', tag: 'pull', effects: [{ type: 'pull', amount: 4 }, { type: 'applyStatus', status: 'weak', amount: 1 }] },
      rest('catchBreath', 'Catch Breath'),
    ],
    pattern: {
      type: 'weighted',
      firstMove: 'nibble',
      weights: { nibble: 35, dartAway: 25, flashColors: 15, catchBreath: 25 },
      maxConsecutive: 2,
      maxRepeat: { catchBreath: 1 },
    },
  },

  /** Tiny fish that attack in many small hits. */
  schooling: {
    moves: [
      { id: 'swarm', name: 'Nibble Frenzy', tag: 'strike', effects: [{ type: 'dealDamage', amount: 2, hits: 3 }] },
      { id: 'scatter', name: 'Scatter', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 3 }] },
      { id: 'regroup', name: 'Regroup', tag: 'rest', skipWillRise: true, effects: [{ type: 'gainBlock', amount: 3 }] },
    ],
    pattern: { type: 'sequence', moves: ['swarm', 'scatter', 'regroup'] },
  },

  /** Hunters: they size up the lure, then shake hard and run. */
  predator: {
    moves: [
      {
        id: 'lunge',
        name: 'Jolt the Rod',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 7 },
          { type: 'applyStatus', status: 'vulnerable', amount: 1 },
        ],
      },
      { id: 'sizeUp', name: 'Size Up the Lure', tag: 'windUp', effects: [WIND_UP] },
      { id: 'bite', name: 'Head Shake', tag: 'strike', effects: [{ type: 'dealDamage', amount: 11 }] },
      {
        id: 'circle',
        name: 'Screaming Run',
        tag: 'pull',
        effects: [
          { type: 'pull', amount: 9 },
          { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
        ],
      },
    ],
    pattern: { type: 'sequence', moves: ['lunge', 'sizeUp', 'bite', 'circle'] },
  },

  /** Spines and venom: weakens you, then lies still. */
  venomous: {
    moves: [
      {
        id: 'sting',
        name: 'Spiny Flick',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 5 },
          { type: 'applyStatus', status: 'weak', amount: 1 },
        ],
      },
      rest('lieStill', 'Lie Still'),
      { id: 'raiseSpines', name: 'Dive for the Rocks', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 6 }] },
      { id: 'bristle', name: 'Bristle', tag: 'guard', effects: [{ type: 'gainBlock', amount: 6 }] },
      {
        id: 'venomStrike',
        name: 'Prickly Thrash',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 9 },
          { type: 'applyStatus', status: 'vulnerable', amount: 1 },
        ],
      },
    ],
    pattern: { type: 'sequence', moves: ['sting', 'lieStill', 'raiseSpines', 'bristle', 'venomStrike', 'lieStill'] },
  },

  /** Inflates and digs in, pokes, then has to deflate. */
  puffer: {
    moves: [
      { id: 'puffUp', name: 'Puff Up', tag: 'pull', effects: [{ type: 'pull', amount: 5 }, { type: 'gainBlock', amount: 8 }] },
      { id: 'spikeJab', name: 'Grumpy Spines', tag: 'strike', effects: [{ type: 'dealDamage', amount: 7 }] },
      rest('deflate', 'Deflate'),
      {
        id: 'bump',
        name: 'Water Splash',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 4 },
          { type: 'applyStatus', status: 'weak', amount: 1 },
        ],
      },
    ],
    pattern: { type: 'sequence', moves: ['puffUp', 'spikeJab', 'deflate', 'bump'] },
  },

  /** Hides, waits, then strikes hard. Hit it while it's hiding! */
  ambusher: {
    moves: [
      { id: 'lurk', name: 'Into the Weed', tag: 'pull', effects: [{ type: 'pull', amount: 8 }, { type: 'gainBlock', amount: 4 }] },
      { id: 'lieInWait', name: 'Lie in Wait', tag: 'windUp', effects: [WIND_UP] },
      { id: 'ambush', name: 'Ambush the Lure', tag: 'strike', effects: [{ type: 'dealDamage', amount: 14 }] },
    ],
    pattern: { type: 'sequence', moves: ['lurk', 'lieInWait', 'ambush'] },
  },

  /** Game fish that put up a fight on the line, and need to catch their breath. */
  fighter: {
    moves: [
      { id: 'tailSlap', name: 'Tail Hit', tag: 'strike', effects: [{ type: 'dealDamage', amount: 8 }] },
      { id: 'leap', name: 'Leap Out', tag: 'pull', effects: [{ type: 'pull', amount: 8 }, { type: 'gainBlock', amount: 4 }] },
      { id: 'thrash', name: 'Water Splash', tag: 'strike', effects: [{ type: 'dealDamage', amount: 4, hits: 2 }] },
      rest('catchBreath', 'Catch Breath'),
    ],
    pattern: { type: 'weighted', weights: { tailSlap: 30, leap: 25, thrash: 20, catchBreath: 25 }, maxConsecutive: 1 },
  },

  /** Huge and slow: sounds deep, drifts, heaves, then wears you out. */
  giant: {
    moves: [
      { id: 'dive', name: 'Sound Deep', tag: 'pull', effects: [{ type: 'pull', amount: 12 }, { type: 'gainBlock', amount: 6 }] },
      rest('drift', 'Drift'),
      { id: 'heave', name: 'Heave', tag: 'windUp', effects: [WIND_UP] },
      { id: 'ram', name: 'Dead Weight', tag: 'strike', effects: [{ type: 'dealDamage', amount: 15 }] },
      {
        id: 'bodySlam',
        name: 'Boring Fight',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 10 },
          { type: 'applyStatus', status: 'weak', amount: 1 },
        ],
      },
    ],
    pattern: { type: 'sequence', moves: ['dive', 'drift', 'heave', 'ram', 'bodySlam', 'drift'] },
  },

  /** Wriggles, hides in the rocks, coils, then wriggles again. */
  eel: {
    moves: [
      { id: 'doubleBite', name: 'Slimy Wriggle', tag: 'strike', effects: [{ type: 'dealDamage', amount: 4, hits: 2 }] },
      { id: 'coil', name: 'Hide in the Rocks', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 4 }] },
      { id: 'coilUp', name: 'Coil', tag: 'windUp', effects: [WIND_UP] },
    ],
    pattern: { type: 'sequence', moves: ['doubleBite', 'coil', 'coilUp', 'doubleBite'] },
  },

  /** Shells: very hard to crack, weak attacks. */
  armored: {
    moves: [
      { id: 'clampShut', name: 'Bury in the Sand', tag: 'pull', effects: [{ type: 'pull', amount: 5 }, { type: 'gainBlock', amount: 10 }] },
      rest('restOnRocks', 'Rest on the Rocks'),
      { id: 'snap', name: 'Clamp the Fingers', tag: 'strike', effects: [{ type: 'dealDamage', amount: 6 }] },
      {
        id: 'spit',
        name: 'Squirt',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 3 },
          { type: 'applyStatus', status: 'weak', amount: 1 },
        ],
      },
    ],
    pattern: { type: 'sequence', moves: ['clampShut', 'restOnRocks', 'snap', 'spit'] },
  },

  /** Drifting stingers that leave you exposed. */
  jellyfish: {
    moves: [
      {
        id: 'sting',
        name: 'Stinging Tendrils',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 4 },
          { type: 'applyStatus', status: 'vulnerable', amount: 1 },
        ],
      },
      { id: 'drift', name: 'Drift Away', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 3 }] },
      { id: 'tangle', name: 'Tangle the Line', tag: 'pull', effects: [{ type: 'pull', amount: 4 }, { type: 'applyStatus', status: 'weak', amount: 1 }] },
      rest('pulse', 'Pulse'),
    ],
    pattern: { type: 'weighted', firstMove: 'sting', weights: { sting: 35, drift: 20, tangle: 15, pulse: 30 }, maxConsecutive: 1 },
  },

  /** Octopus and squid: ink, many suckers, a change of colour, then anchored to a rock. */
  cephalopod: {
    moves: [
      {
        id: 'inkCloud',
        name: 'Ink Cloud',
        tag: 'pull',
        effects: [
          { type: 'pull', amount: 5 },
          { type: 'applyStatus', status: 'weak', amount: 2 },
          { type: 'gainBlock', amount: 3 },
        ],
      },
      { id: 'tentacles', name: 'Suction Grip', tag: 'strike', effects: [{ type: 'dealDamage', amount: 3, hits: 3 }] },
      { id: 'changeColour', name: 'Change Colour', tag: 'windUp', effects: [WIND_UP] },
      { id: 'squeeze', name: 'Rock Anchor', tag: 'pull', effects: [{ type: 'pull', amount: 9 }] },
    ],
    pattern: { type: 'sequence', moves: ['inkCloud', 'tentacles', 'changeColour', 'squeeze'] },
  },

  /** Crabs, lobsters and other crustaceans: pinch, wedge in, raise the claws, pinch, back off, breathe. */
  clawed: {
    moves: [
      { id: 'pinch', name: 'Pinch the Fingers', tag: 'strike', effects: [{ type: 'dealDamage', amount: 7 }] },
      { id: 'shellUp', name: 'Wedge Under a Rock', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 6 }] },
      { id: 'brandishClaws', name: 'Raise the Claws', tag: 'windUp', effects: [WIND_UP] },
      { id: 'raiseClaws', name: 'Scuttle Backwards', tag: 'pull', effects: [{ type: 'pull', amount: 5 }] },
      rest('catchBreath', 'Catch Breath'),
    ],
    pattern: { type: 'sequence', moves: ['pinch', 'shellUp', 'brandishClaws', 'pinch', 'raiseClaws', 'catchBreath'] },
  },

  /** Slugs, stars, worms and other things on the sea floor: they also stop to graze. */
  bottomDweller: {
    moves: [
      {
        id: 'ooze',
        name: 'Slimy Ooze',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 2 },
          { type: 'applyStatus', status: 'weak', amount: 1 },
        ],
      },
      { id: 'prickle', name: 'Stinky Squirt', tag: 'strike', effects: [{ type: 'dealDamage', amount: 5 }] },
      { id: 'harden', name: 'Stick to the Bottom', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 5 }] },
      { id: 'graze', name: 'Graze', tag: 'feed', skipWillRise: true, effects: [{ type: 'healPercent', percent: 8, target: 'self' }] },
    ],
    pattern: { type: 'weighted', weights: { prickle: 30, harden: 25, ooze: 15, graze: 30 }, maxConsecutive: 1 },
  },
} satisfies Record<string, Behavior>;

export type BehaviorId = keyof typeof behaviors;
