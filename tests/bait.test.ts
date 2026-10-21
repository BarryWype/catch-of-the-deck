import { describe, expect, it } from 'vitest';
import { gameData } from '../src/content';
import {
  applyAction,
  baitCards,
  baitCatch,
  companionEffects,
  createRun,
  describeCard,
  finishCombat,
  keepCatch,
  MAX_HAND_SIZE,
  previewIntent,
  startingBuilds,
  useAsBait,
  useAsBaitInFight,
  type CombatState,
  type RunState,
} from '../src/engine';
import { homeCreature, ids, repeat, setup } from './fixtures';

/** A fight with the real content, `cards` as the deck. */
function fight(cards: string[], enemies = ['perch']): CombatState {
  return setup(cards, { enemies, data: gameData });
}

/** The creatures, about to play `intent` (after `history`), with their Will held still. */
function about(s: CombatState, intent: string, history: string[] = []): CombatState {
  return { ...s, enemies: s.enemies.map((e) => ({ ...e, intent, moveHistory: history, escapeRate: 0 })) };
}

function playCard(s: CombatState, id: string, targetId: string | undefined = 'e0'): CombatState {
  const card = s.piles.hand.find((c) => c.defId === id);
  if (!card) throw new Error(`No ${id} in hand`);
  const next = applyAction(s, { type: 'playCard', cardUid: card.uid, targetId: gameData.cards[id].target === 'enemy' ? targetId : undefined }, gameData);
  if (next === s) throw new Error(`${id} could not be played`);
  return next;
}

const endTurn = (s: CombatState) => applyAction({ ...s, player: { ...s.player, energy: 0 } }, { type: 'endTurn' }, gameData);

/** A run with the first starting build, `bucket` caught, and `brought` companions first. */
function run(bucket: RunState['bucket'] = [], brought: string[] = []): RunState {
  const r = createRun(1, gameData, startingBuilds(gameData)[0].id, brought.map((id) => homeCreature(id)));
  return { ...r, bucket: [...r.bucket, ...bucket] };
}

describe('bait cards', () => {
  it('cost 0, are never offered, and say what they do', () => {
    for (const id of ['bait', 'cutBait', 'bigLure']) {
      expect(gameData.cards[id].cost).toBe(0);
      expect(gameData.cards[id].family).toBeUndefined();
    }
    expect(describeCard(gameData.cards.bait)).toBe(
      "15 drain. The creature's next move becomes a Pace: the move it planned comes a turn later. Bait: gone from your deck once played.",
    );
    expect(describeCard(gameData.cards.cutBait)).toContain('10 drain to ALL creatures.');
    expect(describeCard(gameData.cards.bigLure)).toContain('30 drain.');
  });

  it('Bait drains 15 and puts the creature’s move off a turn, behind its Pace', () => {
    const s0 = about(fight(repeat('bait', 10)), 'lunge');
    const s = playCard(s0, 'bait');
    expect(s0.enemies[0].escape - s.enemies[0].escape).toBe(15);
    expect(s.enemies[0]).toMatchObject({ intent: 'circleLure', delayedIntent: 'lunge' });
    expect(previewIntent(s, s.enemies[0], gameData)).toMatchObject({ moveName: 'Circle the Lure', role: 'pace', delayed: 'Jolt the Rod' });
    const next = endTurn(s);
    expect(next.enemies[0].intent).toBe('lunge');
    expect(next.enemies[0].delayedIntent).toBeUndefined();
    expect(next.enemies[0].moveHistory).toEqual([]);
  });

  it('a second bait on the same creature changes nothing more', () => {
    const s = playCard(playCard(about(fight(repeat('bait', 10)), 'lunge'), 'bait'), 'bait');
    expect(s.enemies[0]).toMatchObject({ intent: 'circleLure', delayedIntent: 'lunge' });
  });

  it('a heavy move put off keeps its Wind-up, and lands a turn later', () => {
    const s0 = about(fight(repeat('bait', 10)), 'bite', ['sizeUp']);
    s0.enemies[0].statuses.windUp = 1;
    const paced = endTurn(playCard(s0, 'bait'));
    expect(paced.player.hp).toBe(s0.player.hp);
    expect(paced.enemies[0]).toMatchObject({ intent: 'bite', moveHistory: ['sizeUp'], statuses: { windUp: 1 } });
    const hit = endTurn(paced);
    expect(hit.player.hp).toBeLessThan(paced.player.hp);
    expect(hit.enemies[0].statuses.windUp).toBeUndefined();
    expect(hit.enemies[0].moveHistory).toEqual(['sizeUp', 'bite']);
  });

  it('a Wind-up put off is still followed by its heavy move', () => {
    const paced = endTurn(playCard(about(fight(repeat('bait', 10)), 'sizeUp'), 'bait'));
    expect(paced.enemies[0].intent).toBe('sizeUp');
    const wound = endTurn(paced);
    expect(wound.enemies[0]).toMatchObject({ intent: 'bite', moveHistory: ['sizeUp'] });
  });

  it('Cut Bait drains 10 from every creature and puts each one’s move off', () => {
    const s0 = about(fight(repeat('cutBait', 10), ['guppy', 'guppy']), 'nibble');
    const s = playCard(s0, 'cutBait');
    s.enemies.forEach((e, i) => {
      expect(s0.enemies[i].escape - e.escape).toBe(10);
      expect(e).toMatchObject({ intent: 'regroup', delayedIntent: 'nibble' });
    });
  });

  it('is gone from the deck for the rest of the run once played', () => {
    const r = { ...run(), deck: ['bait', 'bait', 'tug'] };
    const s = playCard(fight(r.deck), 'bait');
    expect(s.piles.exhaust.map((c) => c.defId)).toEqual(['bait']);
    expect(finishCombat(r, s, gameData).deck).toEqual(['bait', 'tug']);
  });
});

describe('using a creature as bait', () => {
  it('makes its tier’s bait card, two for a trophy', () => {
    expect(baitCards({ id: 'perch', size: 'normal' }, gameData)).toEqual(['bait']);
    expect(baitCards({ id: 'catfish', size: 'large' }, gameData)).toEqual(['cutBait']);
    expect(baitCards({ id: 'taimen', size: 'small' }, gameData)).toEqual(['bigLure']);
    expect(baitCards({ id: 'perch', size: 'trophy' }, gameData)).toEqual(['bait', 'bait']);
  });

  it('outside a fight: the creature is gone, its cards join the deck', () => {
    const r = run([{ id: 'perch', size: 'trophy' }, { id: 'guppy', size: 'normal' }]);
    const next = useAsBait(r, 0, gameData);
    expect(ids(next.bucket)).toEqual(['guppy']);
    expect(next.deck).toEqual([...r.deck, 'bait', 'bait']);
  });

  it('a companion loses its bonus and its bond', () => {
    const r = run([], ['clownfish']);
    expect(companionEffects(r.companions, gameData)).not.toEqual([]);
    const next = useAsBait(r, 0, gameData);
    expect(next.companions).toEqual([]);
    expect(next.bucket).toEqual([]);
  });

  it('bucket full: the new catch as bait, or a bucket creature as bait to keep it', () => {
    const r = { ...run([{ id: 'perch', size: 'normal' }]), waiting: [{ id: 'catfish', size: 'normal' as const }] };
    const baited = baitCatch(r, gameData);
    expect(baited).toMatchObject({ waiting: [], deck: [...r.deck, 'cutBait'], coins: r.coins });
    const kept = keepCatch(useAsBait(r, 0, gameData));
    expect(kept).toMatchObject({ waiting: [], deck: [...r.deck, 'bait'], coins: r.coins });
    expect(ids(kept.bucket)).toEqual(['catfish']);
  });

  describe('during a fight', () => {
    it('the card goes into the hand, and stays in the deck if it isn’t played', () => {
      const r = run([{ id: 'perch', size: 'normal' }]);
      const c = fight(r.deck);
      const made = useAsBaitInFight(r, c, 0, gameData);
      expect(made.run.bucket).toEqual([]);
      expect(made.combat.piles.hand.at(-1)).toEqual({ uid: `c${r.deck.length}`, defId: 'bait' });
      expect(finishCombat(made.run, made.combat, gameData).deck).toEqual([...r.deck, 'bait']);
      const played = playCard(made.combat, 'bait');
      expect(finishCombat(made.run, played, gameData).deck).toEqual(r.deck);
    });

    it('with a full hand, on top of the draw pile, drawn first next turn', () => {
      const r = { ...run([{ id: 'perch', size: 'normal' }]), deck: repeat('holdTight', 20) };
      const c = fight(r.deck);
      c.piles.hand.push(...c.piles.draw.splice(0, MAX_HAND_SIZE - c.piles.hand.length));
      const made = useAsBaitInFight(r, c, 0, gameData).combat;
      expect(made.piles.hand).toHaveLength(MAX_HAND_SIZE);
      expect(made.piles.draw.at(-1)?.defId).toBe('bait');
      expect(endTurn(made).piles.hand[0].defId).toBe('bait');
    });

    it('a trophy fills the hand first, the rest goes on top of the draw pile', () => {
      const r = { ...run([{ id: 'perch', size: 'trophy' }]), deck: repeat('holdTight', 20) };
      const c = fight(r.deck);
      c.piles.hand.push(...c.piles.draw.splice(0, MAX_HAND_SIZE - 1 - c.piles.hand.length));
      const made = useAsBaitInFight(r, c, 0, gameData).combat;
      expect(made.piles.hand.filter((card) => card.defId === 'bait')).toHaveLength(1);
      expect(made.piles.draw.at(-1)?.defId).toBe('bait');
    });

    it('a companion’s bonus stops at once', () => {
      const r = run([], ['clownfish']);
      const c = setup(r.deck, { enemies: ['perch'], data: gameData, bonuses: companionEffects(r.companions, gameData) });
      expect(useAsBaitInFight(r, c, 0, gameData).combat.bonuses).toEqual([]);
    });
  });
});
