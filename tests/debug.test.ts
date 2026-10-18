import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyWithInfiniteEnergy,
  bondLevel,
  debugAddToHand,
  debugCatch,
  debugDraw,
  debugSetCreature,
  debugSetHand,
  debugSetIntent,
  debugSetPlayer,
  debugSetStatus,
  findNode,
  parseScenario,
  PLAYER_ID,
  SECOND_WIND_ID,
  startScenario,
  validateScenario,
  type DebugScenario,
} from '../src/engine';
import { gameData } from '../src/content';
import { fromScenario, repeat, setup, testData } from './fixtures';

describe('in-fight debug tools', () => {
  it('set the player’s Grit, Hold, Patience and energy, without touching the state given', () => {
    const state = setup(repeat('strike', 10));
    const next = debugSetPlayer(state, { hp: 12, block: 7, patience: 3, energy: 5 });
    expect(next.player).toMatchObject({ hp: 12, block: 7, patience: 3, energy: 5 });
    expect(state.player.hp).toBe(80);
  });

  it('Grit at 0 loses the fight', () => {
    expect(debugSetPlayer(setup(repeat('strike', 10)), { hp: 0 }).phase).toBe('lost');
  });

  it('set a creature’s Health and Will; a full Will lets it get away', () => {
    const state = setup(repeat('strike', 10));
    const next = debugSetCreature(state, 'e0', { hp: 40, escape: 300 });
    expect(next.enemies[0]).toMatchObject({ hp: 40, escape: 300 });
    expect(next.phase).toBe('playerTurn');
    expect(debugSetCreature(state, 'e0', { escape: 1000 }).phase).toBe('fled');
  });

  it('catch a creature now, by Health or by Will', () => {
    const state = setup(repeat('strike', 10), { enemies: ['dummy', 'cycler'] });
    const byHealth = debugCatch(state, 'e0', 'health');
    expect(byHealth.enemies[0].hp).toBe(0);
    expect(byHealth.phase).toBe('playerTurn');
    const both = debugCatch(byHealth, 'e1', 'will');
    expect(both.enemies[1].escape).toBe(0);
    expect(both.phase).toBe('won');
  });

  it('add and remove a status, on a creature or the player', () => {
    const state = setup(repeat('strike', 10));
    const weak = debugSetStatus(state, 'e0', 'weak', 3);
    expect(weak.enemies[0].statuses.weak).toBe(3);
    expect(debugSetStatus(weak, 'e0', 'weak', 0).enemies[0].statuses.weak).toBeUndefined();
    expect(debugSetStatus(state, PLAYER_ID, 'strength', -2).player.statuses.strength).toBe(-2);
  });

  it('choose a creature’s next move, which shows even when inked; unknown moves throw', () => {
    const state = setup(repeat('strike', 10), { enemies: ['cycler'] });
    expect(state.enemies[0].intent).toBe('a');
    const next = debugSetIntent({ ...state, enemies: [{ ...state.enemies[0], intentHidden: true }] }, 'e0', 'c', testData);
    expect(next.enemies[0]).toMatchObject({ intent: 'c', intentHidden: false });
    expect(debugSetIntent(state, 'e0', SECOND_WIND_ID, testData).enemies[0].intent).toBe(SECOND_WIND_ID);
    expect(() => debugSetIntent(state, 'e0', 'nope', testData)).toThrow();
  });

  it('add any card to the hand, with a new uid', () => {
    const state = setup(repeat('strike', 10));
    const next = debugAddToHand(state, 'heavy', testData);
    const added = next.piles.hand.at(-1)!;
    expect(added.defId).toBe('heavy');
    expect([...state.piles.draw, ...state.piles.hand].some((c) => c.uid === added.uid)).toBe(false);
  });

  it('draw cards', () => {
    const state = setup(repeat('strike', 10));
    expect(debugDraw(state, 2).piles.hand).toHaveLength(state.piles.hand.length + 2);
  });

  it('set the hand from the deck, putting the old hand back on the draw pile', () => {
    const state = setup([...repeat('strike', 8), 'heavy', 'bash']);
    const next = debugSetHand(state, ['heavy', 'bash']);
    expect(next.piles.hand.map((c) => c.defId)).toEqual(['heavy', 'bash']);
    expect(next.piles.draw).toHaveLength(8);
    expect(() => debugSetHand(state, ['twin'])).toThrow();
  });

  it('infinite energy: cards are played whatever they cost, and the energy stays', () => {
    let state = setup(repeat('heavy', 10));
    expect(state.player.energy).toBe(3);
    for (let i = 0; i < 3; i++) {
      const card = state.piles.hand[0];
      state = applyWithInfiniteEnergy(state, { type: 'playCard', cardUid: card.uid, targetId: 'e0' }, testData);
    }
    expect(state.player.energy).toBe(3);
    expect(state.enemies[0].hp).toBe(40);
  });
});

describe('starting a debug scenario', () => {
  const base: DebugScenario = { seed: 7, build: 'basic', level: 0, start: { type: 'boss' } };

  it('starts the age’s boss, from the node before it', () => {
    const { run, combat, kind } = startScenario(base, testData);
    expect(kind).toBe('fight');
    expect(run.position).toBe('4');
    expect(run.visited).toEqual(['start', '3a', '4']);
    expect(combat!.enemies.map((e) => e.defId)).toEqual(['dummy']);
    expect(combat!.enemies[0].boss).toBe(true);
  });

  it('sets the run: age, fights played, Grit, coins, rerolls, deck, companions with bond levels and sizes, bucket', () => {
    const scenario: DebugScenario = {
      ...base,
      build: 'angler',
      level: 1,
      fights: 10,
      hp: 30,
      coins: 99,
      rerolls: 4,
      deck: ['heavy', 'heavy', 'strike'],
      companions: [{ id: 'shellA', bond: 2, size: 'large' }, { id: 'shellB', bond: 0, size: 'trophy' }],
      bucket: [{ id: 'dummy', size: 'small' }],
      start: { type: 'creature', id: 'cycler' },
    };
    const { run, combat } = startScenario(scenario, testData);
    expect(run).toMatchObject({ build: 'angler', level: 1, fights: 11, hp: 30, coins: 99, rewardRerolls: 4, deck: ['heavy', 'heavy', 'strike'] });
    expect(run.bucket).toEqual([{ id: 'shellA', size: 'large' }, { id: 'shellB', size: 'trophy' }, { id: 'dummy', size: 'small' }]);
    expect(run.companions.map((c) => bondLevel(c, testData))).toEqual([2, 0]);
    expect(combat!.enemies.map((e) => e.defId)).toEqual(['cycler']);
    expect(combat!.piles.draw.length + combat!.piles.hand.length).toBe(3);
  });

  it('more fights played make the fight tougher', () => {
    const fresh = startScenario({ ...base, start: { type: 'creature', id: 'cycler' } }, testData).combat!;
    const late = startScenario({ ...base, fights: 20, start: { type: 'creature', id: 'cycler' } }, testData).combat!;
    expect(late.enemies[0].damageScale!).toBeGreaterThan(fresh.enemies[0].damageScale!);
  });

  it('a fixed opening hand', () => {
    const { combat } = startScenario({ ...base, deck: [...repeat('strike', 8), 'heavy', 'bash'], hand: ['bash', 'heavy'] }, testData);
    expect(combat!.piles.hand.map((c) => c.defId)).toEqual(['bash', 'heavy']);
  });

  it('the same scenario is the same fight', () => {
    expect(startScenario(base, testData)).toEqual(startScenario(base, testData));
  });

  it('starts on an event, a shop, a treasure or a fisherman of the chosen age (real content)', () => {
    const real = { seed: 3, build: 'rod', level: 2 };
    const event = fromScenario({ ...real, start: { type: 'event', id: 'picnic' } });
    expect(event).toMatchObject({ kind: 'event', eventId: 'picnic' });
    expect(event.run.level).toBe(2);
    expect(findNode(event.run.map, event.run.position)?.kind).toBe('event');
    expect(fromScenario({ ...real, start: { type: 'shop' } }).kind).toBe('shop');
    const treasure = fromScenario({ ...real, start: { type: 'treasure' } });
    expect(gameData.events[treasure.eventId!].treasure).toBe(true);
    const fisherman = fromScenario({ ...real, start: { type: 'fisherman', id: 'silas' } });
    expect(findNode(fisherman.run.map, fisherman.run.position)?.fisherman).toBe('silas');
  });

  it('an encounter of several creatures (real content)', () => {
    const { combat } = fromScenario({ seed: 1, build: 'net', level: 1, start: { type: 'encounter', id: 'pilchardShoal' } });
    expect(combat!.enemies.map((e) => e.defId)).toEqual(['europeanPilchard', 'europeanPilchard', 'europeanPilchard']);
  });

  it('a fisherman sees the scenario’s bucket for his quest (real content)', () => {
    const { run } = fromScenario({
      seed: 1,
      build: 'rod',
      level: 2,
      bucket: [{ id: 'progenetica', size: 'trophy' }],
      start: { type: 'fisherman', id: 'silas' },
    });
    expect(run.questsShown).toEqual(['fly']);
  });
});

describe('scenario JSON', () => {
  const valid: DebugScenario = {
    seed: 1,
    build: 'basic',
    level: 0,
    companions: [{ id: 'shellA', bond: 3, size: 'normal' }],
    deck: ['strike', 'strike'],
    hand: ['strike'],
    start: { type: 'creature', id: 'dummy' },
    profile: { unlocked: ['angler'], fishermenMet: [], home: [{ id: 'shellB', bond: 1, size: 'small' }] },
  };

  it('a valid scenario round-trips', () => {
    expect(validateScenario(valid, testData)).toBeNull();
    expect(parseScenario(JSON.stringify(valid), testData)).toEqual({ scenario: valid });
  });

  it.each([
    ['not JSON', '{', 'json'],
    ['an array', '[]', 'shape'],
    ['an unknown build', JSON.stringify({ ...valid, build: 'nope' }), 'build'],
    ['an age out of range', JSON.stringify({ ...valid, level: 5 }), 'level'],
    ['a negative number', JSON.stringify({ ...valid, coins: -1 }), 'number'],
    ['an unknown companion', JSON.stringify({ ...valid, companions: [{ id: 'nope', bond: 0, size: 'normal' }] }), 'creature'],
    ['a bond over 3', JSON.stringify({ ...valid, companions: [{ id: 'shellA', bond: 4, size: 'normal' }] }), 'bond'],
    ['an unknown size', JSON.stringify({ ...valid, bucket: [{ id: 'dummy', size: 'huge' }] }), 'size'],
    ['four companions', JSON.stringify({ ...valid, companions: repeat('x', 4).map(() => ({ id: 'shellA', bond: 0, size: 'normal' })) }), 'companions'],
    ['an unknown card', JSON.stringify({ ...valid, deck: ['strike', 'nope'] }), 'card'],
    ['a hand card not in the deck', JSON.stringify({ ...valid, hand: ['strike', 'strike', 'strike'] }), 'hand'],
    ['an unknown start', JSON.stringify({ ...valid, start: { type: 'nap' } }), 'start'],
    ['an unknown encounter', JSON.stringify({ ...valid, start: { type: 'encounter', id: 'nope' } }), 'encounter'],
    ['an unknown fisherman', JSON.stringify({ ...valid, start: { type: 'fisherman', id: 'nope' } }), 'fisherman'],
    ['a malformed profile', JSON.stringify({ ...valid, profile: { unlocked: [] } }), 'shape'],
  ])('rejects %s, saying why', (_, json, code) => {
    const result = parseScenario(json, testData);
    expect('error' in result && result.error.code).toBe(code);
  });

  it('names what is at fault', () => {
    expect(parseScenario(JSON.stringify({ ...valid, deck: ['strike', 'nope'] }), testData)).toEqual({ error: { code: 'card', detail: 'nope' } });
  });

  it('the README’s example is valid, and starts', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    const json = readme.split('## Debug panel')[1].match(/```json\n([\s\S]*?)```/)![1];
    const result = parseScenario(json, gameData);
    expect(result).not.toHaveProperty('error');
    expect(fromScenario((result as { scenario: DebugScenario }).scenario).kind).toBe('fisherman');
  });
});
