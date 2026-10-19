import { describe, expect, it } from 'vitest';
import { applyAction, isAlive, isAttackCard, previewIntent, validateAction, type CombatState } from '../src/engine';
import { endTurn, play, repeat, setup, testData } from './fixtures';

describe('turn structure', () => {
  it('starts with 5 cards in hand and 3 energy', () => {
    const s = setup(repeat('strike', 10));
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('playerTurn');
    expect(s.piles.hand).toHaveLength(5);
    expect(s.piles.draw).toHaveLength(5);
    expect(s.player.energy).toBe(3);
  });

  it('every enemy shows an intent from the start', () => {
    const s = setup(repeat('strike', 5));
    expect(s.enemies[0].intent).toBe('hit');
  });

  it('end turn discards the hand, enemies act, and a new hand is drawn', () => {
    let s = setup(repeat('strike', 10));
    s = play(s, 'strike');
    s = endTurn(s);
    expect(s.turn).toBe(2);
    expect(s.player.hp).toBe(70);
    expect(s.player.energy).toBe(3);
    expect(s.piles.hand).toHaveLength(5);
    expect(s.piles.discard).toHaveLength(5);
  });
});

describe('playing cards', () => {
  it('Strike deals 6 damage, costs 1 energy and goes to the discard pile', () => {
    const s = play(setup(repeat('strike', 5)), 'strike');
    expect(s.enemies[0].hp).toBe(94);
    expect(s.player.energy).toBe(2);
    expect(s.piles.hand).toHaveLength(4);
    expect(s.piles.discard).toHaveLength(1);
  });

  it('cannot play a card without enough energy (state is returned unchanged)', () => {
    const s1 = play(setup(repeat('heavy', 5)), 'heavy');
    expect(s1.player.energy).toBe(0);
    const s2 = play(s1, 'heavy');
    expect(s2).toBe(s1);
    expect(validateAction(s1, { type: 'playCard', cardUid: s1.piles.hand[0].uid, targetId: 'e0' }, testData)).toBe(
      'Too much tension.',
    );
  });

  it('targeted cards require a living target', () => {
    const s = setup(repeat('strike', 5));
    const action = { type: 'playCard' as const, cardUid: s.piles.hand[0].uid, targetId: 'nope' };
    expect(applyAction(s, action, testData)).toBe(s);
  });

  it('multi-hit attacks apply Strength on every hit', () => {
    let s = setup(['flex', ...repeat('twin', 4)]);
    s = play(s, 'flex');
    expect(s.player.statuses.strength).toBe(2);
    s = play(s, 'twin');
    expect(s.enemies[0].hp).toBe(100 - 2 * (5 + 2));
  });

  it('powers and exhaust cards go to the exhaust pile', () => {
    let s = setup(['flex', 'adrenaline', ...repeat('strike', 3)]);
    s = play(s, 'flex');
    s = play(s, 'adrenaline');
    expect(s.piles.exhaust.map((c) => c.defId).sort()).toEqual(['adrenaline', 'flex']);
    expect(s.piles.discard).toHaveLength(0);
    expect(s.player.energy).toBe(3 - 1 + 1);
  });
});

describe('creature types', () => {
  it('enemies carry their tags into the fight', () => {
    expect(setup(['strike']).enemies[0].tags).toEqual(['fish']);
  });
});

describe('block', () => {
  it('absorbs enemy damage and resets at the start of the next turn', () => {
    let s = setup(repeat('defend', 10));
    s = play(s, 'defend');
    s = play(s, 'defend');
    expect(s.player.block).toBe(10);
    s = endTurn(s); // Dummy hits for 10, fully blocked
    expect(s.player.hp).toBe(80);
    expect(s.player.block).toBe(0);
  });

  it('partially absorbs damage', () => {
    let s = setup(repeat('defend', 10));
    s = play(s, 'defend');
    s = endTurn(s);
    expect(s.player.hp).toBe(75);
  });

  it('enemy block resets at the start of its own turn', () => {
    let s = setup(repeat('defend', 10), { enemies: ['cycler'] });
    s = endTurn(s); // cycler: A (strength)
    s = endTurn(s); // cycler: B (block 5)
    expect(s.enemies[0].block).toBe(5);
    s = endTurn(s); // cycler: C, block cleared first
    expect(s.enemies[0].block).toBe(0);
  });
});

describe('status effects', () => {
  it('Bash applies Vulnerable, making the next attack deal 50% more', () => {
    let s = setup(['bash', ...repeat('strike', 4)]);
    s = play(s, 'bash');
    expect(s.enemies[0].hp).toBe(92);
    expect(s.enemies[0].statuses.vulnerable).toBe(2);
    s = play(s, 'strike');
    expect(s.enemies[0].hp).toBe(92 - 9);
  });

  it('Weak on an enemy reduces its attack damage', () => {
    let s = setup(['weaken', ...repeat('defend', 4)]);
    s = play(s, 'weaken');
    s = endTurn(s);
    expect(s.player.hp).toBe(80 - 7);
  });

  it('Vulnerable on the player increases damage taken', () => {
    const s0 = setup(repeat('strike', 10));
    // 2 stacks: one is lost at the end of the player's turn, one remains for the hit.
    const s: CombatState = { ...s0, player: { ...s0.player, statuses: { vulnerable: 2 } } };
    expect(endTurn(s).player.hp).toBe(80 - 15);
  });

  it('Vulnerable and Weak decay at the end of their owner’s turn; Strength does not', () => {
    let s = setup(['bash', 'flex', 'weaken', 'defend', 'defend']);
    s = play(s, 'bash');
    s = play(s, 'flex');
    s = play(s, 'weaken');
    s = endTurn(s);
    expect(s.enemies[0].statuses).toEqual({ vulnerable: 1, weak: 1 });
    expect(s.player.statuses).toEqual({ strength: 2 });
    s = endTurn(s);
    expect(s.enemies[0].statuses).toEqual({});
  });

  it('intent preview shows damage after modifiers', () => {
    const s0 = setup(repeat('strike', 5));
    const s: CombatState = {
      ...s0,
      player: { ...s0.player, statuses: { vulnerable: 1 } },
      enemies: [{ ...s0.enemies[0], statuses: { strength: 2 } }],
    };
    expect(previewIntent(s, s.enemies[0], testData)).toMatchObject({ kinds: ['attack'], damage: 18, hits: 1 });
  });
});

describe('piles', () => {
  it('reshuffles the discard pile into the draw pile when it runs out', () => {
    let s = setup(repeat('strike', 7));
    expect(s.piles.draw).toHaveLength(2);
    s = endTurn(s);
    // 2 drawn from the draw pile, then 5 discards reshuffled and 3 more drawn.
    expect(s.piles.hand).toHaveLength(5);
    expect(s.piles.draw).toHaveLength(2);
    expect(s.piles.discard).toHaveLength(0);
    const all = [...s.piles.hand, ...s.piles.draw, ...s.piles.discard].map((c) => c.uid).sort();
    expect(new Set(all).size).toBe(7);
  });

  it('a card being played is not shuffled back in by its own draw effect', () => {
    const s0 = setup(repeat('strike', 5));
    const [ponder, a, b, c] = [{ uid: 'p', defId: 'ponder' }, ...s0.piles.hand];
    const s: CombatState = { ...s0, piles: { draw: [], hand: [ponder], discard: [a, b, c], exhaust: [] } };
    const next = play(s, 'ponder');
    expect(next.piles.hand).toHaveLength(2);
    expect(next.piles.draw).toHaveLength(1);
    expect(next.piles.discard.map((x) => x.uid)).toEqual(['p']);
  });

  it('drawing with empty draw and discard piles draws nothing', () => {
    let s = setup(['ponder', ...repeat('strike', 4)]);
    s = play(s, 'ponder');
    expect(s.piles.hand).toHaveLength(4);
    expect(s.piles.draw).toHaveLength(0);
  });

  it('the hand is capped at 10 cards', () => {
    const s0 = setup(repeat('strike', 10));
    const ponders = Array.from({ length: 9 }, (_, i) => ({ uid: `p${i}`, defId: 'ponder' }));
    let s: CombatState = { ...s0, piles: { draw: repeat('strike', 10).map((defId, i) => ({ uid: `s${i}`, defId })), hand: ponders, discard: [], exhaust: [] } };
    s = play(s, 'ponder'); // 8 + 2
    expect(s.piles.hand).toHaveLength(10);
    s = play(s, 'ponder'); // 9 + 1, then the hand is full
    expect(s.piles.hand).toHaveLength(10);
    expect(s.piles.draw).toHaveLength(7);
  });
});

describe('enemy intents', () => {
  it('sequence patterns loop from `loopFrom`', () => {
    let s = setup(repeat('defend', 10), { enemies: ['cycler'] });
    for (let i = 0; i < 5; i++) s = endTurn(s);
    expect(s.enemies[0].moveHistory).toEqual(['a', 'b', 'c', 'b', 'c']);
  });

  it('weighted patterns respect maxConsecutive', () => {
    let s = setup(repeat('defend', 10), { enemies: ['gambler'] });
    for (let i = 0; i < 40; i++) s = endTurn(s);
    const history = s.enemies[0].moveHistory;
    expect(history).toHaveLength(40);
    for (let i = 1; i < history.length; i++) expect(history[i]).not.toBe(history[i - 1]);
  });
});

describe('win / lose', () => {
  it('killing the last enemy wins, after which actions are ignored', () => {
    const s0 = setup(repeat('strike', 5));
    const s: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], hp: 5 }] };
    const won = play(s, 'strike');
    expect(won.phase).toBe('won');
    expect(won.enemies[0].hp).toBe(0);
    expect(endTurn(won)).toBe(won);
  });

  it('dropping to 0 HP loses', () => {
    const lost = endTurn(setup(repeat('strike', 5), { hp: 5 }));
    expect(lost.phase).toBe('lost');
    expect(lost.player.hp).toBe(0);
  });
});

describe('tug of war', () => {
  it('the escape bar starts at escapeStart and rises by escapeRate each enemy turn', () => {
    const s0 = setup(repeat('defend', 10), { enemies: ['gambler'] });
    expect(s0.enemies[0]).toMatchObject({ escape: 4, escapeAt: 1000, escapeRate: 1 });
    const s: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], escapeRate: 10 }] };
    // No energy left over, so no Patience to slow it.
    const noPatience = (state: CombatState) => endTurn({ ...state, player: { ...state.player, energy: 0 } });
    expect(noPatience(noPatience(s)).enemies[0].escape).toBe(24);
  });

  it('a creature that pulls the line all the way escapes, ending the fight', () => {
    const s0 = setup(repeat('defend', 10), { enemies: ['gambler'] });
    const s: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], escapeRate: 10, escape: 995 }] };
    const fled = endTurn(s);
    expect(fled.phase).toBe('fled');
    expect(fled.enemies[0].escape).toBe(1000);
    expect(endTurn(fled)).toBe(fled);
  });

  it('cards move the escape bar: raising it to the top makes it flee, lowering it to 0 captures it', () => {
    const s0 = setup(repeat('calm', 3).concat(repeat('spook', 2)), { enemies: ['gambler'] });
    const s: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], escape: 25, escapeAt: 30 }] };
    expect(play(s, 'calm').enemies[0].escape).toBe(15);
    expect(play(s, 'spook')).toMatchObject({ phase: 'fled', enemies: [{ escape: 30 }] });
    expect(play(play(play(s, 'calm'), 'calm'), 'calm')).toMatchObject({ phase: 'won', enemies: [{ escape: 0 }] });
  });

  it('each stack of Slow cuts the rise by 20%, and one wears off each turn; a snare stops it for a turn', () => {
    const s0 = setup(['pin', 'pin', 'snare', 'defend', 'defend'], { enemies: ['gambler'] });
    const s: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], escapeRate: 10 }] };
    // No energy left over, so no Patience adds to the Slow.
    const noPatience = (state: CombatState) => endTurn({ ...state, player: { ...state.player, energy: 0 } });
    const once = play(s, 'pin');
    expect(once.enemies[0].statuses.slow).toBe(1);
    expect(noPatience(once).enemies[0].escape).toBe(4 + 8);
    const twice = play(once, 'pin');
    expect(noPatience(twice).enemies[0].escape).toBe(4 + 6);
    // One stack wears off at the end of the creature's turn, after slowing that turn's rise.
    expect(noPatience(twice).enemies[0].statuses.slow).toBe(1);
    expect(noPatience(once).enemies[0].statuses.slow).toBeUndefined();
    const snared = play(s, 'snare');
    expect(endTurn(snared).enemies[0].escape).toBe(4);
  });

  it('Slow and Patience add up, but slow the rise by 80% at most', () => {
    const s0 = setup(repeat('defend', 10), { enemies: ['gambler'] });
    const s: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], escapeRate: 10, statuses: { slow: 2 } }] };
    // 2 Slow (40%) + 3 Patience from unused energy (30%) = 70%.
    expect(endTurn(s).enemies[0].escape).toBe(4 + 3);
    // 5 Slow (100%) + 30% is capped at 80%: +2 instead of +10.
    const capped: CombatState = { ...s, enemies: [{ ...s.enemies[0], statuses: { slow: 5 } }] };
    expect(endTurn(capped).enemies[0].escape).toBe(4 + 2);
  });

  it('a slowCap card raises the cap for the rest of the fight, never lowers it', () => {
    const data = {
      ...testData,
      cards: {
        ...testData.cards,
        steady: { id: 'steady', name: 'Steady', type: 'support' as const, rarity: 'normal' as const, cost: 0, target: 'none' as const, effects: [{ type: 'slowCap' as const, amount: 90 }] },
        loose: { id: 'loose', name: 'Loose', type: 'support' as const, rarity: 'normal' as const, cost: 0, target: 'none' as const, effects: [{ type: 'slowCap' as const, amount: 50 }] },
      },
    };
    const s0 = setup(repeat('steady', 3).concat(repeat('loose', 2)), { enemies: ['gambler'], data });
    const raised = play(play(s0, 'steady', 'e0', data), 'loose', 'e0', data);
    expect(raised.slowCap).toBe(90);
    const s: CombatState = { ...raised, enemies: [{ ...raised.enemies[0], escapeRate: 10, statuses: { slow: 5 } }] };
    expect(applyAction(s, { type: 'endTurn' }, data).enemies[0].escape).toBe(4 + 1);
  });

  it('a creature whose escape bar is pushed to 0 is captured like a beaten one', () => {
    const s0 = setup(repeat('strike', 5));
    const s: CombatState = { ...s0, enemies: [{ ...s0.enemies[0], escape: 0 }] };
    expect(isAlive(s.enemies[0])).toBe(false);
    expect(validateAction(s, { type: 'playCard', cardUid: s.piles.hand[0].uid, targetId: 'e0' }, testData)).not.toBeNull();
  });
});

describe('patience', () => {
  const withRate = (s: CombatState, escapeRate: number): CombatState => ({ ...s, enemies: [{ ...s.enemies[0], escapeRate }] });

  it('energy left unused at the end of a turn becomes Patience, kept for the fight', () => {
    let s = setup(repeat('strike', 10), { enemies: ['gambler'] });
    expect(s.player.patience).toBe(0);
    s = endTurn(play(s, 'strike')); // 2 energy left
    expect(s.player.patience).toBe(2);
    s = endTurn(play(play(play(s, 'strike'), 'strike'), 'strike')); // none left
    expect(s.player.patience).toBe(2);
  });

  it('each point slows the escape bar by 10% of the rate, rounded up, from the turn it is gained', () => {
    const s = withRate(setup(repeat('defend', 10), { enemies: ['gambler'] }), 10);
    // 3 energy unused: 30% slower, so +7 instead of +10.
    expect(endTurn(s).enemies[0].escape).toBe(4 + 7);
    // At the cap of 5, it rises half as fast.
    expect(endTurn({ ...s, player: { ...s.player, patience: 5 } }).enemies[0].escape).toBe(4 + 5);
  });

  it('Hold left after the creatures act becomes Patience, 3 for 1, up to 5', () => {
    const s = setup(repeat('defend', 10), { enemies: ['gambler'] });
    // Gambler opens with a 1-damage strike or a 0 pull: 2 Defends leave 9 or 10 Hold → 3 Patience, on top of 1 unused energy.
    const after = endTurn(play(play(s, 'defend'), 'defend'));
    expect(after.player.patience).toBe(4);
    expect(after.player.block).toBe(0);
    expect(endTurn({ ...s, player: { ...s.player, block: 30 } }).player.patience).toBe(5);
  });

  it('cards with a patienceCost need, and spend, that much Patience', () => {
    const data = {
      ...testData,
      cards: { ...testData.cards, wait: { id: 'wait', name: 'Wait', type: 'support' as const, rarity: 'normal' as const, cost: 0, patienceCost: 2, target: 'none' as const, effects: [{ type: 'gainBlock' as const, amount: 1 }] } },
    };
    const s = setup(repeat('wait', 10), { data });
    const card = s.piles.hand[0].uid;
    expect(validateAction(s, { type: 'playCard', cardUid: card }, data)).toBe('Not enough patience.');
    const patient = { ...s, player: { ...s.player, patience: 3 } };
    expect(applyAction(patient, { type: 'playCard', cardUid: card }, data).player.patience).toBe(1);
  });
});

describe('strikes and pulls', () => {
  const data = {
    ...testData,
    enemies: {
      ...testData.enemies,
      tugger: {
        ...testData.enemies.dummy,
        id: 'tugger',
        moves: [{ id: 'tug', name: 'Tug', tag: 'pull' as const, intensity: 'normal' as const, effects: [{ type: 'pull' as const, amount: 8 }] }],
        pattern: { type: 'sequence' as const, moves: ['tug'] },
      },
    },
  };
  const fight = (block: number) => {
    const s = setup(repeat('ponder', 10), { enemies: ['tugger'], data });
    // Rate 0, so only the pull moves the bar; no energy left over, so no Patience either.
    const ready: CombatState = { ...s, player: { ...s.player, energy: 0, block }, enemies: [{ ...s.enemies[0], escapeRate: 0 }] };
    return applyAction(ready, { type: 'endTurn' }, data);
  };

  it('a pull the Hold takes in full leaves the escape bar alone', () => {
    expect(fight(10).enemies[0].escape).toBe(4);
  });

  it('what gets past the Hold raises the escape bar', () => {
    expect(fight(3).enemies[0].escape).toBe(4 + 5);
    expect(fight(0).enemies[0].escape).toBe(4 + 8);
  });

  it('a strike past the Hold wears down Grit', () => {
    const s = setup(repeat('ponder', 10));
    const hit = endTurn({ ...s, player: { ...s.player, energy: 0, block: 4 } });
    expect(hit.player.hp).toBe(80 - 6);
  });

  it('the intent shows the tag and how hard it pulls', () => {
    const s = setup(repeat('ponder', 10), { enemies: ['tugger'], data });
    expect(previewIntent(s, s.enemies[0], data)).toMatchObject({ tag: 'pull', kinds: ['pull'], pull: 8 });
  });
});

describe('venom', () => {
  it('hits at the start of its bearer\'s turn, ignoring Hold, then loses a charge', () => {
    const s0 = setup(repeat('defend', 10), { enemies: ['gambler'] });
    const s: CombatState = { ...s0, player: { ...s0.player, statuses: { venom: 3 }, energy: 0 } };
    const next = endTurn(s);
    // Gambler hits for 1 or blocks; the Venom adds 3 at the start of turn 2.
    expect(80 - next.player.hp - 3).toBeLessThanOrEqual(1);
    expect(80 - next.player.hp).toBeGreaterThanOrEqual(3);
    expect(next.player.statuses.venom).toBe(2);
  });
});

describe('cards played on a random creature', () => {
  const data = {
    ...testData,
    cards: {
      ...testData.cards,
      numb: {
        id: 'numb', name: 'Numb', type: 'support' as const, rarity: 'normal' as const, cost: 0, target: 'random' as const,
        effects: [{ type: 'applyStatus' as const, status: 'venom' as const, amount: 2 }, { type: 'applyStatus' as const, status: 'slow' as const, amount: 2 }],
      },
    },
  };

  it('need no target, and put all their effects on the same living creature', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = setup(repeat('numb', 10), { enemies: ['dummy', 'cycler'], seed, data });
      const card = s.piles.hand[0].uid;
      expect(validateAction(s, { type: 'playCard', cardUid: card }, data)).toBeNull();
      const after = applyAction(s, { type: 'playCard', cardUid: card }, data);
      const hit = after.enemies.filter((e) => e.statuses.venom);
      expect(hit).toHaveLength(1);
      expect(hit[0].statuses).toMatchObject({ venom: 2, slow: 2 });
    }
  });

  it('Drain cards count as attacks', () => {
    expect(isAttackCard({ ...testData.cards.calm, type: 'drain' })).toBe(true);
    expect(isAttackCard(testData.cards.defend)).toBe(false);
  });
});
