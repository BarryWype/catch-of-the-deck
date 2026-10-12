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
 * The player's Hold soaks both; what gets past it lands. Moves can add other
 * effects (statuses, Block: the creature holding on), but keep to one tag.
 * From a creature's point of view, `target` (the default) is the player and
 * `self` is itself.
 * Patterns: 'sequence' plays moves in order (looping from `loopFrom`);
 * 'weighted' picks randomly by weight, never more than `maxConsecutive` in a row.
 */
export interface Behavior {
  moves: EnemyMove[];
  pattern: IntentPattern;
}

export const behaviors = {
  /** Small, colourful, more annoying than dangerous. */
  reefFish: {
    moves: [
      { id: 'nibble', name: 'Steal the Bait', tag: 'strike', effects: [{ type: 'dealDamage', amount: 5 }] },
      { id: 'dartAway', name: 'Dart for Cover', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 4 }] },
      { id: 'flashColors', name: 'Flashy Zigzag', tag: 'pull', effects: [{ type: 'pull', amount: 4 }, { type: 'applyStatus', status: 'weak', amount: 1 }] },
    ],
    pattern: { type: 'weighted', firstMove: 'nibble', weights: { nibble: 50, dartAway: 25, flashColors: 25 }, maxConsecutive: 2 },
  },

  /** Tiny fish that attack in many small hits. */
  schooling: {
    moves: [
      { id: 'swarm', name: 'Nibble Frenzy', tag: 'strike', effects: [{ type: 'dealDamage', amount: 2, hits: 3 }] },
      { id: 'scatter', name: 'Scatter', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 3 }] },
      { id: 'regroup', name: 'Regroup', tag: 'pull', effects: [{ type: 'pull', amount: 3 }, { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' }] },
    ],
    pattern: { type: 'sequence', moves: ['swarm', 'scatter', 'swarm', 'regroup'] },
  },

  /** Hunters: hard shakes, and long runs that get stronger. */
  predator: {
    moves: [
      { id: 'bite', name: 'Head Shake', tag: 'strike', effects: [{ type: 'dealDamage', amount: 11 }] },
      {
        id: 'lunge',
        name: 'Jolt the Rod',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 7 },
          { type: 'applyStatus', status: 'vulnerable', amount: 1 },
        ],
      },
      {
        id: 'circle',
        name: 'Screaming Run',
        tag: 'pull',
        effects: [
          { type: 'pull', amount: 9 },
          { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' },
        ],
      },
    ],
    pattern: { type: 'weighted', firstMove: 'lunge', weights: { bite: 40, lunge: 35, circle: 25 }, maxConsecutive: 1 },
  },

  /** Spines and venom: weakens you. */
  venomous: {
    moves: [
      {
        id: 'sting',
        name: 'Spiny Flick',
        tag: 'strike',
        effects: [
          { type: 'dealDamage', amount: 5 },
          { type: 'applyStatus', status: 'weak', amount: 2 },
        ],
      },
      { id: 'raiseSpines', name: 'Dive for the Rocks', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 6 }] },
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
    pattern: { type: 'sequence', moves: ['sting', 'raiseSpines', 'venomStrike'] },
  },

  /** Inflates and digs in, then pokes. */
  puffer: {
    moves: [
      {
        id: 'puffUp',
        name: 'Puff Up',
        tag: 'pull',
        effects: [
          { type: 'pull', amount: 5 },
          { type: 'gainBlock', amount: 8 },
          { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
        ],
      },
      { id: 'spikeJab', name: 'Grumpy Spines', tag: 'strike', effects: [{ type: 'dealDamage', amount: 7 }] },
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
    pattern: { type: 'sequence', moves: ['puffUp', 'spikeJab', 'bump'] },
  },

  /** Hides, then strikes hard. Hit it while it's hiding! */
  ambusher: {
    moves: [
      {
        id: 'lurk',
        name: 'Into the Weed',
        tag: 'pull',
        effects: [
          { type: 'pull', amount: 8 },
          { type: 'gainBlock', amount: 4 },
          { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' },
        ],
      },
      { id: 'ambush', name: 'Ambush the Lure', tag: 'strike', effects: [{ type: 'dealDamage', amount: 14 }] },
    ],
    pattern: { type: 'sequence', moves: ['lurk', 'ambush'] },
  },

  /** Game fish that put up a fight on the line. */
  fighter: {
    moves: [
      { id: 'tailSlap', name: 'Tail Hit', tag: 'strike', effects: [{ type: 'dealDamage', amount: 8 }] },
      {
        id: 'leap',
        name: 'Leap Out',
        tag: 'pull',
        effects: [
          { type: 'pull', amount: 8 },
          { type: 'gainBlock', amount: 4 },
          { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
        ],
      },
      { id: 'thrash', name: 'Water Splash', tag: 'strike', effects: [{ type: 'dealDamage', amount: 4, hits: 2 }] },
    ],
    pattern: { type: 'weighted', weights: { tailSlap: 40, leap: 30, thrash: 30 }, maxConsecutive: 1 },
  },

  /** Huge and slow: sounds deep, then wears you out. */
  giant: {
    moves: [
      { id: 'dive', name: 'Sound Deep', tag: 'pull', effects: [{ type: 'pull', amount: 12 }, { type: 'gainBlock', amount: 6 }] },
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
    pattern: { type: 'sequence', moves: ['dive', 'ram', 'bodySlam'] },
  },

  /** Wriggles twice, then coils into the rocks. */
  eel: {
    moves: [
      { id: 'doubleBite', name: 'Slimy Wriggle', tag: 'strike', effects: [{ type: 'dealDamage', amount: 4, hits: 2 }] },
      {
        id: 'coil',
        name: 'Hide in the Rocks',
        tag: 'pull',
        effects: [
          { type: 'pull', amount: 6 },
          { type: 'gainBlock', amount: 4 },
          { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
        ],
      },
    ],
    pattern: { type: 'weighted', weights: { doubleBite: 55, coil: 45 }, maxConsecutive: 2 },
  },

  /** Shells: very hard to crack, weak attacks. */
  armored: {
    moves: [
      { id: 'clampShut', name: 'Bury in the Sand', tag: 'pull', effects: [{ type: 'pull', amount: 5 }, { type: 'gainBlock', amount: 10 }] },
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
    pattern: { type: 'sequence', moves: ['clampShut', 'snap', 'spit', 'snap'] },
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
      { id: 'tangle', name: 'Tangle the Line', tag: 'pull', effects: [{ type: 'pull', amount: 4 }, { type: 'applyStatus', status: 'weak', amount: 2 }] },
    ],
    pattern: { type: 'weighted', firstMove: 'sting', weights: { sting: 50, drift: 25, tangle: 25 }, maxConsecutive: 1 },
  },

  /** Octopus and squid: ink, many suckers, then anchored to a rock. */
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
      { id: 'squeeze', name: 'Rock Anchor', tag: 'pull', effects: [{ type: 'pull', amount: 9 }] },
    ],
    pattern: { type: 'sequence', moves: ['inkCloud', 'tentacles', 'squeeze', 'tentacles'] },
  },

  /** Crabs and lobsters: claws up and back off, then pinch. */
  crustacean: {
    moves: [
      {
        id: 'raiseClaws',
        name: 'Scuttle Backwards',
        tag: 'pull',
        effects: [
          { type: 'pull', amount: 5 },
          { type: 'applyStatus', status: 'strength', amount: 2, target: 'self' },
        ],
      },
      { id: 'pinch', name: 'Pinch the Fingers', tag: 'strike', effects: [{ type: 'dealDamage', amount: 7 }] },
      { id: 'shellUp', name: 'Wedge Under a Rock', tag: 'pull', effects: [{ type: 'pull', amount: 6 }, { type: 'gainBlock', amount: 6 }] },
    ],
    pattern: { type: 'weighted', firstMove: 'raiseClaws', weights: { pinch: 45, shellUp: 30, raiseClaws: 25 }, maxConsecutive: 1 },
  },

  /** Slugs, stars, worms and other things on the sea floor. */
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
    ],
    pattern: { type: 'weighted', weights: { prickle: 40, harden: 30, ooze: 30 }, maxConsecutive: 1 },
  },
} satisfies Record<string, Behavior>;

export type BehaviorId = keyof typeof behaviors;
