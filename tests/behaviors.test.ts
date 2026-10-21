import { describe, expect, it } from 'vitest';
import { gameData } from '../src/content';
import { behaviors, bossMoveSets, move, WIND_UP } from '../src/content/behaviors';
import { creatures } from '../src/content/creatures';
import {
  applyAction,
  cardCost,
  createCombat,
  createRun,
  finishCombat,
  previewIntent,
  resolveEffect,
  turnAverage,
  validateAction,
  type CombatState,
  type EnemyDef,
  type EnemyMove,
  type GameData,
  type IntentPattern,
} from '../src/engine';
import { repeat } from './fixtures';

const MOVES: EnemyMove[] = [
  move('hit', 'Hit', 'strike', 'normal'),
  move('plain', 'Plain', 'pull', 'light'),
  move('big', 'Big', 'strike', 'heavy', { role: 'heavy' }),
  move('wind', 'Wind', 'pull', 'light', { role: 'windUp', followUp: 'big', extras: [WIND_UP] }),
  move('windHit', 'Wind', 'pull', 'light', { role: 'windUp', followUp: 'hit', extras: [WIND_UP] }),
  move('pace', 'Pace', 'pull', 'light', { role: 'pace' }),
  move('ink', 'Ink', 'pull', 'light', { role: 'special', extras: [{ type: 'ink' }] }),
  move('kick', 'Kick', 'pull', 'light', { role: 'special', extras: [{ type: 'addJunk', card: 'pebbleInTheBoot' }] }),
  move('sting', 'Sting', 'strike', 'light', { role: 'special', extras: [{ type: 'applyStatus', status: 'venom', amount: 2 }] }),
  move('steal', 'Steal', 'strike', 'light', { role: 'special', extras: [{ type: 'stealPatience', amount: 1 }] }),
  move('startle', 'Startle', 'pull', 'light', { role: 'special', extras: [{ type: 'applyStatus', status: 'skittish', amount: 1 }] }),
  move('numb', 'Numb', 'strike', 'light', { role: 'special', extras: [{ type: 'applyStatus', status: 'numbFingers', amount: 1 }] }),
  move('shake', 'Shake', 'pull', 'light', { role: 'special', heavyIfNoHold: true }),
  move('flex', 'Flex', 'pull', 'light', { extras: [{ type: 'applyStatus', status: 'strength', amount: 2, target: 'self' }] }),
];

/** A fight with the real cards against one creature with these moves (no fight scaling unless `damage`). */
function fight(pattern: IntentPattern, opts: { deck?: string[]; damage?: number; bosses?: boolean } = {}): { s: CombatState; data: GameData } {
  const creature: EnemyDef = { ...gameData.enemies.clownfish, id: 'creature', hp: [40, 40], escapeAt: 100, escapeStart: 50, escapeRate: 10, moves: MOVES, pattern, startingStatuses: {} };
  const data = { ...gameData, enemies: { ...gameData.enemies, creature } };
  const s = createCombat(
    { seed: 1, deck: opts.deck ?? repeat('tug', 10), enemies: ['creature'], playerHp: 80, playerMaxHp: 80, damage: opts.damage, bosses: opts.bosses },
    data,
  );
  return { s, data };
}
const seq = (...moves: string[]): IntentPattern => ({ type: 'sequence', moves });
/** End the turn without leftover energy (so no Patience is gained). */
const endTurn = (s: CombatState, data: GameData) => applyAction({ ...s, player: { ...s.player, energy: 0 } }, { type: 'endTurn' }, data);
const play = (s: CombatState, data: GameData, defId: string) => {
  const card = s.piles.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`No ${defId} in hand`);
  return applyAction(s, { type: 'playCard', cardUid: card.uid, targetId: 'e0' }, data);
};
/** `n` turns, the player healed and the creature's Will set back before each, so the fight goes on. */
const turns = (s: CombatState, data: GameData, n: number) =>
  Array.from({ length: n }).reduce<CombatState>(
    (acc) => endTurn({ ...acc, player: { ...acc.player, hp: 80 }, enemies: acc.enemies.map((e) => ({ ...e, escape: 50 })) }, data),
    s,
  );

describe('scaling and pacing', () => {
  it('averages every move as often as it comes, the heavy turn after each Wind-up included', () => {
    // Hit 12, Wind 6, then Big after it: 16.8 heavy × 1.3.
    const pattern: IntentPattern = { type: 'weighted', weights: { hit: 1, wind: 1 } };
    const average = (12 + 6 + 16.8 * 1.3) / 3;
    expect(turnAverage(MOVES, pattern)).toBeCloseTo(average);
    expect(fight(pattern, { damage: 5.5 }).s.enemies[0].damageScale).toBeCloseTo(5.5 / average);
  });

  it('a pace move makes its Will rise half as much that turn', () => {
    // Both Pull 6; only the Will's own rise changes.
    const rise = (moveId: string) => {
      const { s, data } = fight(seq(moveId));
      return endTurn(s, data).enemies[0].escape - 50 - 6;
    };
    expect(rise('pace')).toBe(Math.ceil(rise('plain') / 2));
  });
});

describe('Wind-up and heavy moves', () => {
  it('heavy moves come only right after their Wind-up, and always then', () => {
    const { s, data } = fight({ type: 'weighted', weights: { hit: 1, wind: 1 } });
    const history = turns(s, data, 40).enemies[0].moveHistory;
    history.forEach((id, i) => {
      if (id === 'big') expect(history[i - 1]).toBe('wind');
      if (id === 'wind' && i + 1 < history.length) expect(history[i + 1]).toBe('big');
    });
    expect(history).toContain('big');
  });

  it('the move after a Wind-up is played heavy and 30% bigger, shown in its intent', () => {
    // A normal Hit of 12 becomes 12 × 1.4 × 1.3 = 21.84 → 21.
    let { s, data } = fight(seq('windHit', 'hit'));
    s = endTurn(s, data);
    expect(previewIntent(s, s.enemies[0], data)?.damage).toBe(21);
    expect(80 - endTurn(s, data).player.hp).toBe(21);
  });

  it('a mini-boss or boss Wind-up also gives 1 Strength, 3 at most from moves', () => {
    const boss = fight(seq('wind', 'big'), { bosses: true });
    expect(endTurn(boss.s, boss.data).enemies[0].statuses.strength).toBe(1);
    const ordinary = fight(seq('wind', 'big'));
    expect(endTurn(ordinary.s, ordinary.data).enemies[0].statuses.strength).toBeUndefined();
    const flexing = fight(seq('flex'));
    expect(turns(flexing.s, flexing.data, 4).enemies[0].statuses.strength).toBe(3);
  });

  it('Strength is added after the fight scaling: +1 per hit, whatever the fight', () => {
    const { s, data } = fight(seq('hit'), { damage: 30 });
    const strong = { ...s, enemies: [{ ...s.enemies[0], statuses: { strength: 1 } }] };
    expect(previewIntent(strong, strong.enemies[0], data)!.damage! - previewIntent(s, s.enemies[0], data)!.damage!).toBe(1);
  });
});

describe('special moves', () => {
  it('never two in a row, and no Wind-up right after Ink', () => {
    const { s, data } = fight({ type: 'weighted', weights: { ink: 100, kick: 100, wind: 100, hit: 1 } });
    const history = turns(s, data, 60).enemies[0].moveHistory;
    const special = (id: string) => id === 'ink' || id === 'kick';
    history.forEach((id, i) => {
      if (i === 0) return;
      expect(special(id) && special(history[i - 1])).toBe(false);
      if (id === 'wind') expect(history[i - 1]).not.toBe('ink');
    });
  });

  it('Ink hides the next move ("?"), but cards still read the real one', () => {
    let { s, data } = fight(seq('ink', 'hit', 'hit'));
    s = endTurn(s, data);
    expect(previewIntent(s, s.enemies[0], data)).toMatchObject({ hidden: true, moveName: '?' });
    const checked = structuredClone(s);
    resolveEffect(checked, { type: 'ifIntent', tag: 'strike', then: [{ type: 'gainBlock', amount: 7 }] }, { sourceId: 'player', targetId: 'e0', data });
    expect(checked.player.block).toBe(7);
    s = endTurn(s, data);
    expect(previewIntent(s, s.enemies[0], data)?.hidden).toBeUndefined();
  });

  it('junk goes into the discard pile, 3 at most, and never into the run deck', () => {
    let { s, data } = fight(seq('kick'));
    s = endTurn(s, data);
    expect(s.piles.discard.filter((c) => c.defId === 'pebbleInTheBoot')).toHaveLength(1);
    s = turns(s, data, 5);
    const all = [...s.piles.draw, ...s.piles.hand, ...s.piles.discard];
    expect(all.filter((c) => c.defId === 'pebbleInTheBoot')).toHaveLength(3);
    // Pebble in the Boot can't be played.
    const withPebble = { ...s, piles: { ...s.piles, hand: [...s.piles.hand, { uid: 'p', defId: 'pebbleInTheBoot' }] } };
    expect(validateAction(withPebble, { type: 'playCard', cardUid: 'p' }, data)).toBe("This card can't be played.");
    // The fight's piles are its own: the run's deck stays as it was.
    const run = createRun(1, gameData, 'rod');
    expect(finishCombat(run, { ...s, phase: 'won' }, gameData).deck).toEqual(run.deck);
  });

  it('Slimy Seaweed costs 2 Grit if still in hand at the end of the turn; playing it (1 energy) clears it', () => {
    const { s, data } = fight(seq('plain'));
    const kept = { ...s, piles: { ...s.piles, hand: [...s.piles.hand, { uid: 'w', defId: 'slimySeaweed' }] } };
    expect(80 - endTurn(kept, data).player.hp).toBe(2);
    const cleared = applyAction(kept, { type: 'playCard', cardUid: 'w' }, data);
    expect(cleared.piles.exhaust.map((c) => c.defId)).toEqual(['slimySeaweed']);
    expect(cleared.player.energy).toBe(2);
    expect(endTurn(cleared, data).player.hp).toBe(80);
  });

  it('Tangled Line in hand and Pinched Hand: Hold cards give less', () => {
    const { s, data } = fight(seq('plain'), { deck: repeat('holdTight', 10) });
    const tangled = { ...s, piles: { ...s.piles, hand: [...s.piles.hand, { uid: 't', defId: 'tangledLine' }] } };
    expect(play(tangled, data, 'holdTight').player.block).toBe(4);
    const pinched = { ...s, player: { ...s.player, statuses: { pinchedHand: 1 } } };
    expect(play(pinched, data, 'holdTight').player.block).toBe(3);
  });

  it('taxes last the player’s next turn: Numb Fingers makes Attack cards cost 1 more, Tangled Drain cards', () => {
    let { s, data } = fight(seq('numb', 'plain'));
    s = endTurn(s, data);
    expect(cardCost(s, gameData.cards.tug)).toBe(2);
    expect(cardCost(s, gameData.cards.reelIn)).toBe(1);
    expect(cardCost(endTurn(s, data), gameData.cards.tug)).toBe(1);
    const tangled = { ...s, player: { ...s.player, statuses: { tangled: 1 } } };
    expect(cardCost(tangled, gameData.cards.reelIn)).toBe(2);
    expect(cardCost(tangled, gameData.cards.tug)).toBe(1);
  });

  it('Venom on the player: Grit lost at the start of their turn, then a charge less', () => {
    const { s, data } = fight(seq('sting', 'plain'));
    const after = endTurn(s, data);
    expect(80 - after.player.hp).toBe(6 + 2); // the light Strike, then 2 Venom
    expect(after.player.statuses.venom).toBe(1);
  });

  it('Steal the Bait takes 1 Patience, none below 0', () => {
    const { s, data } = fight(seq('steal'));
    expect(endTurn({ ...s, player: { ...s.player, patience: 2 } }, data).player.patience).toBe(1);
    expect(endTurn(s, data).player.patience).toBe(0);
  });

  it('Skittish: the third card played that turn raises the creature’s Will by 6', () => {
    let { s, data } = fight(seq('startle', 'plain'));
    s = endTurn(s, data);
    expect(s.player.statuses.skittish).toBe(1);
    const before = s.enemies[0].escape;
    s = play(play(s, data, 'tug'), data, 'tug');
    expect(s.enemies[0].escape).toBe(before);
    expect(play(s, data, 'tug').enemies[0].escape).toBe(before + 6);
  });

  it('Spines: each hit of an attack card costs 1 Grit, for 2 turns', () => {
    const { s, data } = fight(seq('plain'));
    const spiny = { ...s, player: { ...s.player, statuses: { spines: 2 } } };
    expect(80 - play(spiny, data, 'tug').player.hp).toBe(1);
    expect(endTurn(spiny, data).player.statuses.spines).toBe(1);
  });

  it('Burrow: attacks deal 50% less until its next turn; Drain works normally', () => {
    const { s, data } = fight(seq('plain'), { deck: ['tug', 'reelIn', 'tug', 'reelIn', 'tug', 'reelIn', 'tug', 'reelIn'] });
    const burrowed = { ...s, enemies: [{ ...s.enemies[0], statuses: { burrowed: 1 } }] };
    expect(40 - play(burrowed, data, 'tug').enemies[0].hp).toBe(2); // 5 halved
    expect(50 - play(burrowed, data, 'reelIn').enemies[0].escape).toBe(7);
    expect(endTurn(burrowed, data).enemies[0].statuses.burrowed).toBeUndefined();
  });

  it('Grab the Bait: after drawing next turn, a random card is dropped', () => {
    const { s, data } = fight(seq('plain'));
    const after = endTurn({ ...s, player: { ...s.player, statuses: { baitGrabbed: 1 } } }, data);
    expect(after.piles.hand).toHaveLength(4);
    expect(after.player.statuses.baitGrabbed).toBeUndefined();
  });

  it('Shake the Hook: a light Pull, heavy if the player has no Hold', () => {
    const { s, data } = fight(seq('shake'));
    expect(previewIntent(s, s.enemies[0], data)?.pull).toBe(16); // 6 × 1.4 / 0.5
    expect(previewIntent({ ...s, player: { ...s.player, block: 3 } }, s.enemies[0], data)?.pull).toBe(6);
  });
});

describe('Second Wind', () => {
  it('a mini-boss or boss brought below 25% telegraphs it once, then moves 15 points into the low bar', () => {
    let { s, data } = fight(seq('plain'), { bosses: true });
    s = play({ ...s, enemies: [{ ...s.enemies[0], hp: 12 }] }, data, 'tug');
    expect(s.enemies[0]).toMatchObject({ hp: 7, intent: 'secondWind', secondWindUsed: true });
    expect(previewIntent(s, s.enemies[0], data)).toMatchObject({ tag: 'secondWind', special: { key: 'secondWind' } });
    s = endTurn(s, data);
    // 15 points from its Will (the fuller bar) into its health.
    expect(s.enemies[0].hp).toBe(22);
    expect(s.enemies[0].escape).toBeLessThan(50);
    // Only once a fight.
    s = play({ ...s, enemies: [{ ...s.enemies[0], hp: 6 }] }, data, 'tug');
    expect(s.enemies[0].intent).not.toBe('secondWind');
  });

  it('ordinary creatures have none', () => {
    const { s, data } = fight(seq('plain'));
    expect(play({ ...s, enemies: [{ ...s.enemies[0], hp: 12 }] }, data, 'tug').enemies[0].intent).toBe('plain');
  });
});

describe('the move sets', () => {
  const sets: [string, EnemyMove[]][] = [
    ...Object.entries(behaviors).map(([id, b]): [string, EnemyMove[]] => [id, b.moves]),
    ...creatures.filter((c) => c.moves).map((c): [string, EnemyMove[]] => [c.id, c.moves!.moves]),
    ...Object.entries(bossMoveSets).map(([id, b]): [string, EnemyMove[]] => [`${id} (boss)`, b.moves]),
  ];

  it.each(sets)('%s: one pace, at most two specials, all light like its Wind-up', (_, moves) => {
    expect(moves.filter((m) => m.role === 'pace')).toHaveLength(1);
    expect(moves.filter((m) => m.role === 'special').length).toBeLessThanOrEqual(2);
    for (const m of moves.filter((m) => m.role === 'pace' || m.role === 'special' || m.role === 'windUp')) expect(m.intensity, m.id).toBe('light');
  });

  it('only predators (the Mako as a boss too), Pike and Red piranha gain Strength from their moves', () => {
    const givesStrength = (moves: EnemyMove[]) => moves.some((m) => m.effects.some((e) => e.type === 'applyStatus' && e.status === 'strength' && e.target === 'self'));
    expect(sets.filter(([, moves]) => givesStrength(moves)).map(([id]) => id).sort()).toEqual(['pike', 'predator', 'redPiranha', 'shortfinMakoShark (boss)']);
  });
});
