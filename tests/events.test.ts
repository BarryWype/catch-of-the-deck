import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import {
  applyAction,
  applyEventChoice,
  buildGameData,
  createRun,
  eventChoiceBlocked,
  finishCombat,
  FEATURES,
  travelTo,
  visitEvent,
  type GameData,
  type MapNode,
  type RunState,
} from '../src/engine';
import { caught } from './fixtures';

/** The real content with every fight-variety feature on. */
const data: GameData = buildGameData({ ...contentSource, features: FEATURES });

/** A run standing right before one of its event nodes (`event`), and that node. */
function beforeAnEvent(run: RunState): { run: RunState; event: MapNode } {
  for (const column of run.map.columns) {
    for (const node of column) {
      const event = node.next.map((id) => run.map.columns.flat().find((n) => n.id === id)!).find((n) => n.kind === 'event');
      if (event) return { run: { ...run, position: node.id }, event };
    }
  }
  throw new Error('No event on this map');
}

/** A test event with these choices, added to the content. */
function withEvent(...choices: GameData['events'][string]['choices']): GameData {
  return { ...data, events: { ...data.events, test: { id: 'test', name: 'Test', description: '', choices } } };
}

describe('event effects', () => {
  const run = { ...createRun(1, data, 'rod'), coins: 20, bucket: caught('clownfish', 'blueTang') };

  it('removeCard takes out the card picked; loseCard a random one', () => {
    const d = withEvent({ label: 'Remove', effects: [{ type: 'removeCard' }] }, { label: 'Lose', effects: [{ type: 'loseCard' }] });
    const removed = applyEventChoice(run, 'test', 0, d, 2).run;
    expect(removed.deck).toEqual(run.deck.filter((_, i) => i !== 2));
    expect(() => applyEventChoice(run, 'test', 0, d)).toThrow();
    expect(applyEventChoice(run, 'test', 1, d).run.deck).toHaveLength(run.deck.length - 1);
  });

  it('addJunk adds a junk card to the run deck for good; loseCoins pays, and is blocked without the coins', () => {
    const d = withEvent({ label: 'Junk', effects: [{ type: 'addJunk', card: 'pebbleInTheBoot' }, { type: 'loseCoins', amount: 15 }] });
    const after = applyEventChoice(run, 'test', 0, d).run;
    expect(after.deck.at(-1)).toBe('pebbleInTheBoot');
    expect(after.coins).toBe(5);
    expect(eventChoiceBlocked(d.events.test.choices[0], { ...run, coins: 10 })).toBe('Not enough coins.');
  });

  it('tradeCatch gives up the creature picked for a card reward with a rare (or a relic choice)', () => {
    const d = withEvent({ label: 'Trade', effects: [{ type: 'tradeCatch', reward: 'rareCard' }] });
    const result = applyEventChoice(run, 'test', 0, d, 0);
    expect(result.run.bucket.map((c) => c.id)).toEqual(['blueTang']);
    expect(result).toMatchObject({ cardReward: true, run: { luckyLure: true } });
    expect(eventChoiceBlocked(d.events.test.choices[0], { ...run, bucket: [] })).toBe('Your bucket is empty.');
  });

  it('freeNextFight: the next fight starts with a copy of the card in hand, free to play, once', () => {
    const d = withEvent({ label: 'Free', effects: [{ type: 'freeNextFight', cardId: 'breatheOut' }] });
    const after = applyEventChoice(run, 'test', 0, d).run;
    expect(after.freeCard).toBe('breatheOut');
    const first = after.map.columns[1][0];
    const { run: moved, combat } = travelTo({ ...after, position: 'start' }, first.id, d);
    const free = combat.piles.hand.find((c) => c.defId === 'breatheOut')!;
    expect(free).toBeDefined();
    expect(moved.freeCard).toBeUndefined();
    expect(moved.deck).toEqual(run.deck);
    const played = applyAction({ ...combat, player: { ...combat.player, energy: 0 } }, { type: 'playCard', cardUid: free.uid }, d);
    expect(played).not.toBe(combat);
  });

  it('a fight effect starts a fight against its creatures; winning it pays its coins and its reward', () => {
    const d = withEvent({ label: 'Fight', effects: [{ type: 'fight', enemies: ['garfish'], coins: 25, reward: 'rareCard' }] });
    const { run: at } = beforeAnEvent(run);
    const result = applyEventChoice({ ...at, position: at.map.columns[1][0].id }, 'test', 0, d);
    expect(result.combat?.enemies.map((e) => e.defId)).toEqual(['garfish']);
    const won = finishCombat(result.run, { ...result.combat!, phase: 'won' }, d);
    expect(won.coins).toBe(run.coins + 25);
    expect(won.luckyLure).toBe(true);
    expect(won.eventFight).toBeUndefined();
    expect(finishCombat(result.run, { ...result.combat!, phase: 'fled' }, d).coins).toBe(run.coins);
  });
});

describe('more events', () => {
  it('an event met this run doesn’t come back while unseen ones remain', () => {
    const { run, event } = beforeAnEvent(createRun(3, data, 'rod'));
    const eligible = Object.values(data.events).filter(
      (e) => !e.treasure && event.column >= (e.minColumn ?? 0) && (!e.levels || e.levels.includes('kid')),
    ).length;
    let seen: string[] = [];
    for (let seed = 1; seen.length < eligible; seed++) {
      const visit = visitEvent({ ...run, rng: seed, seenEvents: seen }, event.id, data);
      if (!visit.eventId) continue;
      expect(seen).not.toContain(visit.eventId);
      seen = visit.run.seenEvents!;
    }
    expect(new Set(seen).size).toBe(eligible);
    // All seen: any of them can come back.
    const again = Array.from({ length: 10 }, (_, seed) => visitEvent({ ...run, rng: seed, seenEvents: seen }, event.id, data).eventId);
    expect(again.some(Boolean)).toBe(true);
  });

  it('every level has at least 4 events of its own to draw from', () => {
    for (const level of data.levels) {
      const eligible = Object.values(data.events).filter((e) => !e.treasure && (!e.levels || e.levels.includes(level.id)));
      expect(eligible.length, level.id).toBeGreaterThanOrEqual(4);
      expect(eligible.filter((e) => e.levels).length, level.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('are left out with the feature off: the game draws from the old events only', () => {
    const { run, event } = beforeAnEvent(createRun(3, gameData, 'rod'));
    for (let seed = 0; seed < 40; seed++) {
      const id = visitEvent({ ...run, rng: seed }, event.id, gameData).eventId;
      if (id) expect(gameData.events[id].feature).toBeUndefined();
    }
  });
});
