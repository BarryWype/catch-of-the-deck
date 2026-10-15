import { describe, expect, it } from 'vitest';
import { gameData } from '../src/content';
import { applyAction, describeCard, resolveEffect, type CombatState, type Effect } from '../src/engine';
import { repeat, setup } from './fixtures';

/** A fight with the real cards: `cards` in hand (repeated), against `enemies`. */
function fight(cards: string[], enemies = ['clownfish'], seed = 1): CombatState {
  return setup(cards.length >= 5 ? cards : repeat(cards[0], 10), { enemies, data: gameData, seed });
}

/** Play the first card with this id in hand. */
function playCard(s: CombatState, id: string, targetId: string | undefined = 'e0'): CombatState {
  const card = s.piles.hand.find((c) => c.defId === id);
  if (!card) throw new Error(`No ${id} in hand`);
  const target = gameData.cards[id].target === 'enemy' ? targetId : undefined;
  const next = applyAction(s, { type: 'playCard', cardUid: card.uid, targetId: target }, gameData);
  if (next === s) throw new Error(`${id} could not be played`);
  return next;
}

describe('Patience and healing cards', () => {
  it('Still as a Stone: 6 Hold and 1 Patience, never above 5', () => {
    const s = playCard(fight(['stillAsAStone']), 'stillAsAStone');
    expect(s.player).toMatchObject({ block: 6, patience: 1 });
    const full = playCard({ ...fight(['stillAsAStone']), player: { ...fight(['stillAsAStone']).player, patience: 5 } }, 'stillAsAStone');
    expect(full.player.patience).toBe(5);
  });

  it('Dangling Lure: 4 Slow on a random creature, and 1 Patience', () => {
    const s = playCard(fight(['danglingLure'], ['clownfish', 'guppy']), 'danglingLure');
    expect(s.enemies.filter((e) => e.statuses.slow === 4)).toHaveLength(1);
    expect(s.player.patience).toBe(1);
  });

  it('Tickle: Drain 10, and the creature heals 6 but never above its max health', () => {
    const s0 = fight(['tickle']);
    const hurt: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], hp: s0.enemies[0].maxHp - 4 }] };
    const s = playCard(hurt, 'tickle');
    expect(s.enemies[0].escape).toBe(s0.enemies[0].escape - 10);
    expect(s.enemies[0].hp).toBe(s0.enemies[0].maxHp);
    expect(describeCard(gameData.cards.tickle)).toBe('Drain 10. The creature heals 6.');
  });
});

describe('cards that scale with statuses', () => {
  it('Seize the Lull: 6 damage, +2 per Slow on the creature', () => {
    const s0 = fight(['seizeTheLull']);
    const slowed: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], statuses: { slow: 3 } }] };
    expect(playCard(slowed, 'seizeTheLull').enemies[0].hp).toBe(s0.enemies[0].hp - 12);
    expect(playCard(s0, 'seizeTheLull').enemies[0].hp).toBe(s0.enemies[0].hp - 6);
    expect(describeCard(gameData.cards.seizeTheLull)).toBe('Deal 6 damage, +2 for each Slow on the creature.');
    expect(describeCard(gameData.cards.seizeTheLull, { defender: { slow: 3 } })).toBe('Deal 6 (12) damage, +2 for each Slow on the creature.');
  });

  it('Wear Them Out: Drain 3 per Slow; nothing without Slow', () => {
    const s0 = fight(['wearThemOut']);
    const slowed: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], statuses: { slow: 4 } }] };
    expect(playCard(slowed, 'wearThemOut').enemies[0].escape).toBe(s0.enemies[0].escape - 12);
    expect(playCard(s0, 'wearThemOut').enemies[0].escape).toBe(s0.enemies[0].escape);
    expect(describeCard(gameData.cards.wearThemOut)).toBe('Drain 3 for each Slow on the creature.');
  });

  it('Bogged Down: doubles a random creature’s Slow, which gains 5 Will', () => {
    const s0 = fight(['boggedDown']);
    const slowed: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], statuses: { slow: 3 } }] };
    const s = playCard(slowed, 'boggedDown');
    expect(s.enemies[0].statuses.slow).toBe(6);
    expect(s.enemies[0].escape).toBe(s0.enemies[0].escape + 5);
    expect(describeCard(gameData.cards.boggedDown)).toBe("Double the creature's Slow. The creature gains 5 Will. Targets a random creature.");
  });
});

describe('Hold cards', () => {
  const endTurn = (s: CombatState) => applyAction(s, { type: 'endTurn' }, gameData);

  it('From Nowhere: damage equal to your Hold, then half the Hold is lost (rounded down)', () => {
    const s0 = fight(['fromNowhere']);
    const ready: CombatState = { ...s0, player: { ...s0.player, block: 9, patience: 1 } };
    const s = playCard(ready, 'fromNowhere');
    expect(s.enemies[0].hp).toBe(s0.enemies[0].hp - 9);
    expect(s.player.block).toBe(5);
    expect(describeCard(gameData.cards.fromNowhere)).toBe('Deal damage equal to your Hold. Lose half your Hold.');
  });

  it('Be Prepared: all your Patience becomes 4 Hold each', () => {
    const s0 = fight(['bePrepared']);
    const s = playCard({ ...s0, player: { ...s0.player, patience: 3 } }, 'bePrepared');
    expect(s.player).toMatchObject({ patience: 0, block: 12 });
  });

  it('Shell Up: the Hold stays at the start of your next turn, and none of it becomes Patience', () => {
    const s0 = fight(['shellUp']);
    // No energy left over (so no Patience from it), and the creature does nothing this turn.
    const shell = playCard(s0, 'shellUp');
    const played: CombatState = { ...shell, player: { ...shell.player, energy: 0 }, enemies: [{ ...shell.enemies[0], intent: null }] };
    const next = endTurn(played);
    expect(next.player).toMatchObject({ block: 6, patience: 0 });
    // And only for one turn.
    expect(endTurn({ ...next, player: { ...next.player, energy: 0 } }).player.block).toBe(0);
  });
});

describe('delayed cards', () => {
  /** End the turn with the creature doing nothing and no energy left over. */
  const quietTurn = (s: CombatState) =>
    applyAction({ ...s, player: { ...s.player, energy: 0 }, enemies: s.enemies.map((e) => ({ ...e, intent: null })) }, { type: 'endTurn' }, gameData);

  it('Mussel Bait: Drain 6 at the start of each of your next 3 turns, on the creature it was played on', () => {
    let s = playCard(fight(['musselBait'], ['clownfish', 'guppy']), 'musselBait', 'e1');
    const escapes = [s.enemies[1].escape];
    for (let turn = 0; turn < 4; turn++) {
      s = { ...s, enemies: s.enemies.map((e) => ({ ...e, escapeRate: 0 })) };
      s = quietTurn(s);
      escapes.push(s.enemies[1].escape);
    }
    expect(escapes.slice(1).map((e, i) => escapes[i] - e)).toEqual([6, 6, 6, 0]);
    expect(describeCard(gameData.cards.musselBait)).toBe('At the start of each of your next 3 turns: drain 6.');
  });

  it('Thick Shell: 4 Hold now and at the start of your next 2 turns', () => {
    let s = playCard({ ...fight(['thickShell']), player: { ...fight(['thickShell']).player, patience: 1 } }, 'thickShell');
    expect(s.player.block).toBe(4);
    const holds = [];
    for (let turn = 0; turn < 3; turn++) holds.push((s = quietTurn(s)).player.block);
    expect(holds).toEqual([4, 4, 0]);
  });

  it('Call a Mate and Weather the Storm: Hold next turn', () => {
    const mate = playCard({ ...fight(['callAMate']), player: { ...fight(['callAMate']).player, patience: 2 } }, 'callAMate');
    expect(mate.player.block).toBe(0);
    expect(quietTurn(mate).player.block).toBe(8);
    const storm = playCard({ ...fight(['weatherTheStorm']), player: { ...fight(['weatherTheStorm']).player, patience: 4 } }, 'weatherTheStorm');
    expect(storm.player.block).toBe(10);
    expect(quietTurn(storm).player.block).toBe(10);
  });

  it('Severe Bite: half the health it took, again next turn; nothing if the creature is gone', () => {
    const s0 = fight(['severeBite'], ['commonOctopus']);
    // 3 Block on the creature: 8 damage takes 5 health, so 2 more next turn.
    const s = playCard({ ...s0, enemies: [{ ...s0.enemies[0], block: 3 }] }, 'severeBite');
    expect(s.enemies[0].hp).toBe(s0.enemies[0].hp - 5);
    expect(quietTurn(s).enemies[0].hp).toBe(s0.enemies[0].hp - 7);
    expect(describeCard(gameData.cards.severeBite)).toBe('Deal 8 damage. At the start of your next turn, deal half the damage dealt again.');
  });
});

describe('cards that read or change the next move', () => {
  // Clownfish (reef fish), unscaled: `nip` is a Strike of 12, `nibble` (Steal the Bait) a light Strike of 6, `dartAway` a Pull of 12 (+4 Block), `flashColors` a light Pull of 6.
  const about = (s: CombatState, intent: string): CombatState => ({ ...s, enemies: s.enemies.map((e) => ({ ...e, intent, escapeRate: 0 })) });
  const endTurn = (s: CombatState) => applyAction({ ...s, player: { ...s.player, energy: 0 } }, { type: 'endTurn' }, gameData);
  const grit = (s: CombatState) => s.player.hp;

  it('Duck and Jab: 12 damage and +6 Will before a Strike, 4 damage otherwise', () => {
    const s0 = fight(['duckAndJab']);
    const strike = playCard(about(s0, 'nibble'), 'duckAndJab');
    expect(s0.enemies[0].hp - strike.enemies[0].hp).toBe(12);
    expect(strike.enemies[0].escape - s0.enemies[0].escape).toBe(6);
    const pull = playCard(about(s0, 'dartAway'), 'duckAndJab');
    expect(s0.enemies[0].hp - pull.enemies[0].hp).toBe(4);
    expect(describeCard(gameData.cards.duckAndJab)).toBe(
      'If the creature is about to Strike: deal 12 damage. The creature gains 6 Will. Otherwise: deal 4 damage.',
    );
  });

  it('Let It Run and Adaptation follow the next move', () => {
    const s0 = fight(['letItRun']);
    const hurt: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], hp: s0.enemies[0].hp - 8 }] };
    const pull = playCard(about(hurt, 'dartAway'), 'letItRun');
    expect(hurt.enemies[0].escape - pull.enemies[0].escape).toBe(14);
    expect(pull.enemies[0].hp - hurt.enemies[0].hp).toBe(6);
    expect(hurt.enemies[0].escape - playCard(about(hurt, 'nibble'), 'letItRun').enemies[0].escape).toBe(5);
    const a0 = fight(['adaptation']);
    expect(a0.enemies[0].hp - playCard(about(a0, 'nibble'), 'adaptation').enemies[0].hp).toBe(10);
    expect(a0.enemies[0].escape - playCard(about(a0, 'dartAway'), 'adaptation').enemies[0].escape).toBe(10);
  });

  it('Menacing Presence halves every creature’s next Strike or Pull, once', () => {
    const s0 = about(fight(['menacingPresence']), 'nibble');
    const s = playCard({ ...s0, player: { ...s0.player, patience: 2 } }, 'menacingPresence');
    expect(s.enemies[0].statuses.cowed).toBe(1);
    const after = endTurn(s);
    expect(grit(s) - grit(after)).toBe(3); // 6 halved
    expect(after.enemies[0].statuses.cowed).toBeUndefined();
    expect(describeCard(gameData.cards.menacingPresence)).toBe('The next Strike or Pull of every creature is halved.');
  });

  it('Bare Teeth halves the next Strike only; Spinner Lure the next Pull only', () => {
    const teeth = playCard(about(fight(['bareTeeth']), 'nibble'), 'bareTeeth');
    expect(teeth.player.block).toBe(3);
    // 6 halved = 3, all soaked by the 3 Hold.
    expect(grit(teeth) - grit(endTurn(teeth))).toBe(0);
    const pulled = playCard(about(fight(['bareTeeth']), 'dartAway'), 'bareTeeth');
    expect(endTurn(pulled).enemies[0].statuses.intimidated).toBe(1);
    const lure = playCard(about(fight(['spinnerLure']), 'dartAway'), 'spinnerLure');
    // Pull of 12 halved to 6.
    expect(endTurn(lure).enemies[0].escape - lure.enemies[0].escape).toBe(6);
  });

  it('Flash of Colour: the next Strike deals 4 less, and draw a card', () => {
    const s0 = about(fight(['flashOfColour']), 'nibble');
    const s = playCard(s0, 'flashOfColour');
    expect(s.piles.hand).toHaveLength(s0.piles.hand.length);
    expect(grit(s) - grit(endTurn(s))).toBe(2); // 6 − 4
  });

  it('Dazzle: for 2 turns, Strikes deal half, and the Will rises 50% faster (not Pulls)', () => {
    const s0 = about(fight(['dazzle']), 'nibble');
    const s = { ...playCard(s0, 'dazzle'), enemies: playCard(s0, 'dazzle').enemies.map((e) => ({ ...e, escapeRate: 10 })) };
    const after = endTurn(s);
    expect(grit(s) - grit(after)).toBe(3);
    expect(after.enemies[0].escape - s.enemies[0].escape).toBe(15);
    expect(after.enemies[0].statuses.dazzled).toBe(1);
  });

  it('Glitter Burst swaps a Strike for a Pull; Colour Shift picks another move', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const flipped = playCard(about(fight(['glitterBurst'], ['clownfish'], seed), 'nibble'), 'glitterBurst');
      expect(['dartAway', 'flashColors']).toContain(flipped.enemies[0].intent);
      expect(playCard(about(fight(['glitterBurst'], ['clownfish'], seed), 'dartAway'), 'glitterBurst').enemies[0].intent).toMatch(/^(nip|nibble)$/);
      expect(playCard(about(fight(['colourShift'], ['clownfish'], seed), 'nibble'), 'colourShift').enemies[0].intent).not.toBe('nibble');
    }
  });

  it('Shadow the Fish: Hold equal to the next Strike or Pull, 12 at most', () => {
    expect(playCard(about(fight(['shadowTheFish']), 'nibble'), 'shadowTheFish').player.block).toBe(6);
    expect(playCard(about(fight(['shadowTheFish']), 'dartAway'), 'shadowTheFish').player.block).toBe(12);
    const big = fight(['shadowTheFish'], ['bluefinTuna']);
    expect(playCard(about(big, 'ram'), 'shadowTheFish').player.block).toBe(12);
  });
});

describe('cards that last until the end of your turn', () => {
  const rich = (s: CombatState): CombatState => ({ ...s, player: { ...s.player, energy: 9 } });

  it('Coiled doubles the next Attack or Drain card this turn, once', () => {
    const s0 = rich(fight(['coiled', 'tug', 'tug', 'reelIn', 'holdTight']));
    const coiled = playCard(s0, 'coiled');
    const once = playCard(coiled, 'tug');
    expect(s0.enemies[0].hp - once.enemies[0].hp).toBe(10);
    expect(once.enemies[0].hp - playCard(once, 'tug').enemies[0].hp).toBe(5);
    // A Defense card doesn't use it up; a Drain card is doubled.
    const drained = playCard(playCard(coiled, 'holdTight'), 'reelIn');
    expect(coiled.enemies[0].escape - drained.enemies[0].escape).toBe(14);
    expect(describeCard(gameData.cards.coiled)).toBe('Your next Attack or Drain card this turn has its numbers doubled.');
  });

  it('Toxic Dread doubles the Venom (+10 at most); attacks then deal +3 per hit to Venomed creatures', () => {
    const s0 = rich(fight(['toxicDread', 'tug', 'dartingBites', 'tug', 'tug']));
    const venomed: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], statuses: { venom: 4 } }] };
    const dread = playCard(venomed, 'toxicDread');
    expect(dread.enemies[0].statuses.venom).toBe(8);
    expect(dread.enemies[0].hp - playCard(dread, 'tug').enemies[0].hp).toBe(8);
    // Per hit: Darting Bites is 2 × 3.
    expect(dread.enemies[0].hp - playCard(dread, 'dartingBites').enemies[0].hp).toBe(15);
    const lots: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], statuses: { venom: 15 } }] };
    expect(playCard(lots, 'toxicDread').enemies[0].statuses.venom).toBe(25);
  });

  it('Toxic Coating: every hit of an attack this turn also applies 2 Venom, a Drain included', () => {
    const s0 = rich(fight(['toxicCoating', 'dartingBites', 'reelIn', 'holdTight', 'tug']));
    const coated = playCard(s0, 'toxicCoating');
    expect(playCard(coated, 'dartingBites').enemies[0].statuses.venom).toBe(6);
    expect(playCard(coated, 'reelIn').enemies[0].statuses.venom).toBe(2);
    // Only this turn.
    const nextTurn = applyAction({ ...coated, enemies: coated.enemies.map((e) => ({ ...e, intent: null })) }, { type: 'endTurn' }, gameData);
    expect(nextTurn.thisTurn).toEqual({});
  });

  it('Lie Low and Unseen Approach check for attacks played earlier this turn', () => {
    const s0 = rich(fight(['lieLow', 'unseenApproach', 'tug', 'tug', 'tug']));
    expect(playCard(s0, 'lieLow').enemies[0].statuses.slow).toBe(2);
    const attacked = playCard(s0, 'tug');
    expect(playCard(attacked, 'lieLow').enemies[0].statuses.slow).toBeUndefined();
    // Unseen Approach is itself a Drain card: only the cards before it count.
    expect(s0.enemies[0].escape - playCard(s0, 'unseenApproach').enemies[0].escape).toBe(10);
    expect(attacked.enemies[0].escape - playCard(attacked, 'unseenApproach').enemies[0].escape).toBe(5);
    expect(describeCard(gameData.cards.unseenApproach)).toBe("If you haven't played an attack this turn: drain 10. Otherwise: drain 5.");
  });
});

describe('Venom and Will cards', () => {
  it('Pain Comes with the Tide: the Venom hits now and keeps its charges', () => {
    const s0 = fight(['painWithTheTide']);
    const venomed: CombatState = { ...s0, player: { ...s0.player, patience: 1 }, enemies: [{ ...s0.enemies[0], statuses: { venom: 4 } }] };
    const s = playCard(venomed, 'painWithTheTide');
    expect(s0.enemies[0].hp - s.enemies[0].hp).toBe(4);
    expect(s.enemies[0].statuses.venom).toBe(4);
  });

  it('Turn the Tables swaps health % and Will % (rounded down); full health means it flees', () => {
    const s0 = fight(['turnTheTables']);
    const e = s0.enemies[0];
    const half: CombatState = { ...s0, enemies: [{ ...e, hp: Math.floor(e.maxHp / 2), escape: Math.floor(e.escapeAt / 4) }] };
    const s = playCard(half, 'turnTheTables');
    expect(s.enemies[0].hp).toBe(Math.floor((Math.floor(e.escapeAt / 4) / e.escapeAt) * e.maxHp));
    expect(s.enemies[0].escape).toBe(Math.floor((Math.floor(e.maxHp / 2) / e.maxHp) * e.escapeAt));
    expect(playCard(s0, 'turnTheTables').phase).toBe('fled');
  });
});

describe('Powers', () => {
  const rich = (s: CombatState): CombatState => ({ ...s, player: { ...s.player, energy: 9, patience: 5 } });
  /** End the turn: the creatures act as planned (or not at all with `idle`), no energy left over. */
  const endTurn = (s: CombatState, idle = true) =>
    applyAction(
      { ...s, player: { ...s.player, energy: 0 }, enemies: s.enemies.map((e) => ({ ...e, intent: idle ? null : e.intent })) },
      { type: 'endTurn' },
      gameData,
    );

  it('go to the exhaust pile and stay in effect', () => {
    const s = playCard(rich(fight(['hardShell'])), 'hardShell');
    expect(s.piles.exhaust.map((c) => c.defId)).toEqual(['hardShell']);
    expect(s.powers).toEqual([{ power: 'hardShell', amount: 1 }]);
  });

  it('Hard Shell: Hold stays between turns and never turns into Patience', () => {
    const s0 = rich(fight(['hardShell', 'holdTight', 'holdTight', 'holdTight', 'holdTight']));
    const s = { ...playCard(playCard(playCard(s0, 'hardShell'), 'holdTight'), 'holdTight'), player: { ...s0.player, block: 10, patience: 0 } };
    const next = endTurn(s);
    expect(next.player).toMatchObject({ block: 10, patience: 0 });
    expect(endTurn(next).player.block).toBe(10);
  });

  it('Stings and Spines: Venom drains twice its value from Will instead of damage, and still loses a charge', () => {
    const s0 = rich(fight(['stingsAndSpines']));
    const s = playCard({ ...s0, enemies: [{ ...s0.enemies[0], statuses: { venom: 3 }, escapeRate: 0 }] }, 'stingsAndSpines');
    const next = endTurn(s);
    expect(next.enemies[0].hp).toBe(s.enemies[0].hp);
    expect(s.enemies[0].escape - next.enemies[0].escape).toBe(6);
    expect(next.enemies[0].statuses.venom).toBe(2);
  });

  it('Envenomed Hooks: 1 Venom per hit of a card’s damage or Drain', () => {
    const s = playCard(rich(fight(['envenomedHooks', 'dartingBites', 'reelIn', 'tug', 'tug'])), 'envenomedHooks');
    expect(playCard(s, 'dartingBites').enemies[0].statuses.venom).toBe(3);
    expect(playCard(s, 'reelIn').enemies[0].statuses.venom).toBe(1);
  });

  it('Push the Limits: Slow no longer wears off', () => {
    const s0 = rich(fight(['pushTheLimits']));
    const s = playCard({ ...s0, enemies: [{ ...s0.enemies[0], statuses: { slow: 3 } }] }, 'pushTheLimits');
    expect(endTurn(s).enemies[0].statuses.slow).toBe(3);
  });

  it('Old as the River: 3 damage per Patience point spent, to a random creature', () => {
    const s = playCard(rich(fight(['oldAsTheRiver', 'steadyHand', 'tug', 'tug', 'tug'])), 'oldAsTheRiver');
    // Steady Hand: 10 damage, and its 2 Patience add 6.
    expect(s.enemies[0].hp - playCard(s, 'steadyHand').enemies[0].hp).toBe(16);
    expect(s.enemies[0].hp - playCard(s, 'tug').enemies[0].hp).toBe(5);
  });

  it('Bait Ball: every 0-cost card Drains 3 from a random creature', () => {
    const s = playCard(rich(fight(['baitBall', 'quickFlick', 'tug', 'tug', 'tug'])), 'baitBall');
    expect(s.enemies[0].escape - playCard(s, 'quickFlick').enemies[0].escape).toBe(3);
    expect(s.enemies[0].escape - playCard(s, 'tug').enemies[0].escape).toBe(0);
  });

  it('Dead Weight: each creature gains 1 Slow at the start of its turn, which slows that turn', () => {
    const s0 = rich(fight(['deadWeight']));
    const played = playCard({ ...s0, enemies: [{ ...s0.enemies[0], escapeRate: 10 }] }, 'deadWeight');
    const s = { ...played, player: { ...played.player, patience: 0 } };
    const next = endTurn(s);
    // Slow 1 (20%): +8 instead of +10, then the Slow wears off.
    expect(next.enemies[0].escape - s.enemies[0].escape).toBe(8);
    expect(next.enemies[0].statuses.slow).toBeUndefined();
  });

  it('Gooey Mess: every Pull loses 3 before reaching your Hold', () => {
    const s0 = rich(fight(['gooeyMess']));
    const s = playCard({ ...s0, enemies: [{ ...s0.enemies[0], intent: 'dartAway', escapeRate: 0 }] }, 'gooeyMess');
    // Dart for Cover pulls 12: 9 get through.
    expect(endTurn(s, false).enemies[0].escape - s.enemies[0].escape).toBe(9);
  });

  it('Perfect Disguise: a turn without attacks gives 6 Hold and 1 Slow on a random creature', () => {
    // The clownfish is about to Steal the Bait (a Strike of 6): the Hold takes it.
    const s0 = rich(fight(['perfectDisguise', 'tug', 'tug', 'tug', 'tug']));
    const s = playCard({ ...s0, enemies: [{ ...s0.enemies[0], intent: 'nibble' }] }, 'perfectDisguise');
    const quiet = endTurn(s, false);
    expect(quiet.player.hp).toBe(s.player.hp);
    expect(quiet.log.some((line) => line.includes('gained 1 Slow'))).toBe(true);
    const attacked = endTurn(playCard(s, 'tug'), false);
    expect(s.player.hp - attacked.player.hp).toBe(6);
  });
});

describe('attack cards from the Flashy, Patient and Endurance families', () => {
  const about = (s: CombatState, intent: string): CombatState => ({ ...s, enemies: s.enemies.map((e) => ({ ...e, intent, escapeRate: 0 })) });
  const endTurn = (s: CombatState) => applyAction({ ...s, player: { ...s.player, energy: 0 } }, { type: 'endTurn' }, gameData);
  const grit = (s: CombatState) => s.player.hp;

  it('Flash Strike: 6 damage, and the next Strike deals 3 less', () => {
    const s0 = about(fight(['flashStrike']), 'nibble');
    const s = playCard(s0, 'flashStrike');
    expect(s0.enemies[0].hp - s.enemies[0].hp).toBe(6);
    expect(grit(s) - grit(endTurn(s))).toBe(3); // 6 − 3
  });

  it('Lure and Lunge: 10 damage if the shown move is a Pull, 5 if it is a Strike', () => {
    const s0 = fight(['lureAndLunge']);
    const dealt = (move: string) => s0.enemies[0].hp - playCard(about(s0, move), 'lureAndLunge').enemies[0].hp;
    expect(dealt('dartAway')).toBe(10);
    expect(dealt('nibble')).toBe(5);
    expect(dealt('nip')).toBe(5);
    expect(describeCard(gameData.cards.lureAndLunge)).toBe('If the creature is about to Pull: deal 10 damage. Otherwise: deal 5 damage.');
  });

  it('Patient Strike and The Long Wait spend Patience for big hits', () => {
    const s0 = fight(['patientStrike', 'theLongWait', 'patientStrike', 'theLongWait', 'patientStrike'], ['blueCrab']);
    const patient = { ...s0, player: { ...s0.player, patience: 4 } };
    const strike = playCard(patient, 'patientStrike');
    expect(patient.enemies[0].hp - strike.enemies[0].hp).toBe(10);
    expect(strike.player).toMatchObject({ patience: 3, energy: 2 });
    const wait = playCard(strike, 'theLongWait');
    expect(strike.enemies[0].hp - wait.enemies[0].hp).toBe(15);
    expect(wait.player).toMatchObject({ patience: 0, energy: 2 });
    // No Patience, no play.
    expect(() => playCard(s0, 'patientStrike')).toThrow();
  });

  it('Steady Haul: 5 damage and Drain 5', () => {
    const s0 = fight(['steadyHaul']);
    const s = playCard(s0, 'steadyHaul');
    expect(s0.enemies[0].hp - s.enemies[0].hp).toBe(5);
    expect(s0.enemies[0].escape - s.enemies[0].escape).toBe(5);
  });

  it('Tiring Blow: 10 damage, Drain 8, or Drain 12 if the creature is Slowed', () => {
    const s0 = fight(['tiringBlow']);
    const plain = playCard(s0, 'tiringBlow');
    expect(s0.enemies[0].hp - plain.enemies[0].hp).toBe(10);
    expect(s0.enemies[0].escape - plain.enemies[0].escape).toBe(8);
    const slowed: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], statuses: { slow: 1 } }] };
    expect(slowed.enemies[0].escape - playCard(slowed, 'tiringBlow').enemies[0].escape).toBe(12);
    expect(describeCard(gameData.cards.tiringBlow)).toBe('Deal 10 damage. If the creature has Slow: drain 12. Otherwise: drain 8.');
  });

  it('ifStatus checks the target, and does nothing without an `else`', () => {
    const s0 = fight(['tug']);
    const effect: Effect = { type: 'ifStatus', status: 'venom', then: [{ type: 'dealDamage', amount: 4 }] };
    const venomed = structuredClone(s0);
    venomed.enemies[0].statuses.venom = 2;
    resolveEffect(venomed, effect, { sourceId: 'player', targetId: 'e0', data: gameData });
    expect(s0.enemies[0].hp - venomed.enemies[0].hp).toBe(4);
    const clean = structuredClone(s0);
    resolveEffect(clean, effect, { sourceId: 'player', targetId: 'e0', data: gameData });
    expect(clean.enemies[0].hp).toBe(s0.enemies[0].hp);
  });
});
