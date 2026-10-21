import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { gear } from '../src/content/gear';
import {
  applyAction,
  buildGameData,
  createCombat,
  createRun,
  FEATURES,
  finishCombat,
  rollRelicChoices,
  runBonuses,
  takeRelic,
  travelTo,
  type CombatState,
  type GameData,
  type RunState,
} from '../src/engine';
import { repeat } from './fixtures';

const data: GameData = buildGameData({ ...contentSource, features: FEATURES });

/** A fight against a creature that always plays `move`, with these relics' bonuses. */
function fight(relics: string[], deck = repeat('tug', 10)): CombatState {
  const run = { ...createRun(1, data, 'rod'), equipment: relics };
  return createCombat({ seed: 3, deck, enemies: ['clownfish'], playerHp: 60, playerMaxHp: 60, bonuses: runBonuses(run, data) }, data);
}
const playFirst = (s: CombatState, defId: string) =>
  applyAction(s, { type: 'playCard', cardUid: s.piles.hand.find((c) => c.defId === defId)!.uid, targetId: 'e0' }, data);

describe('relics in a fight', () => {
  it('Spinner lure: the first attack each turn applies 1 Weak, only the first', () => {
    const s = playFirst(fight(['spinnerLure']), 'tug');
    expect(s.enemies[0].statuses.weak).toBe(1);
    expect(playFirst(s, 'tug').enemies[0].statuses.weak).toBe(1);
  });

  it('Crab trap: a turn without an attack ends with 1 more Hold', () => {
    const s = fight(['crabTrap'], repeat('holdTight', 10));
    const quiet = applyAction({ ...s, enemies: [{ ...s.enemies[0], intent: 'flashColors' }] }, { type: 'endTurn' }, data);
    const plain = fight([], repeat('holdTight', 10));
    const without = applyAction({ ...plain, enemies: [{ ...plain.enemies[0], intent: 'flashColors' }] }, { type: 'endTurn' }, data);
    expect(quiet.log.join('\n')).toContain('gained 1 Hold');
    expect(without.log.join('\n')).not.toContain('gained 1 Hold');
  });

  it('Cork bobber: the first Pull against you is halved, the next ones are not', () => {
    const s = fight(['corkBobber']);
    const pulling = { ...s, player: { ...s.player, energy: 0 }, enemies: [{ ...s.enemies[0], intent: 'dartAway', escape: 30 }] };
    const once = applyAction(pulling, { type: 'endTurn' }, data);
    const plain = fight([]);
    const full = applyAction({ ...plain, player: { ...plain.player, energy: 0 }, enemies: [{ ...plain.enemies[0], intent: 'dartAway', escape: 30 }] }, { type: 'endTurn' }, data);
    expect(once.enemies[0].escape).toBeLessThan(full.enemies[0].escape);
    expect(once.bonusTracker.firstPullDone).toBe(true);
  });

  it('Fishing sonar: each creature shows its move after next, and plays it then', () => {
    let s = fight(['fishingSonar']);
    const coming = s.enemies[0].foresight;
    expect(coming).toBeDefined();
    s = applyAction(s, { type: 'endTurn' }, data);
    expect(s.enemies[0].intent).toBe(coming);
    expect(s.enemies[0].foresight).toBeDefined();
    expect(fight([]).enemies[0].foresight).toBeUndefined();
  });

  it('Handline: with gear relics on, a fight can start with a bait card in hand; never with them off', () => {
    let seen = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const run = { ...createRun(seed, data, 'rod'), equipment: ['handline'] };
      const { combat } = travelTo(run, run.map.columns[1][0].id, data);
      if (combat.piles.hand.some((c) => data.cards[c.defId].bait)) seen++;
      const off = travelTo({ ...run }, run.map.columns[1][0].id, gameData).combat;
      expect(off.piles.hand.some((c) => gameData.cards[c.defId].bait)).toBe(false);
    }
    expect(seen).toBeGreaterThan(0);
    expect(seen).toBeLessThan(20);
  });
});

describe('relic choices', () => {
  const run = createRun(5, data, 'rod');

  it('are seeded: the same run offers the same 3 relics, all different, none already carried', () => {
    const first = rollRelicChoices(run, data).relicChoices!;
    expect(rollRelicChoices(run, data).relicChoices).toEqual(first);
    expect(new Set(first).size).toBe(3);
    const owned = rollRelicChoices({ ...run, equipment: [...run.equipment, ...first] }, data).relicChoices!;
    expect(owned.some((id) => first.includes(id))).toBe(false);
    for (const id of first) expect(data.equipment[id].rarity).toBeDefined();
  });

  it('taking one adds it to the equipment and clears the offer', () => {
    const offered = rollRelicChoices(run, data);
    const taken = takeRelic(offered, offered.relicChoices![1]);
    expect(taken.equipment).toContain(offered.relicChoices![1]);
    expect(taken.relicChoices).toBeUndefined();
    expect(() => takeRelic(run, 'sinker')).toThrow();
  });

  it('rarer relics come more often in later levels', () => {
    const rares = (level: number) =>
      Array.from({ length: 200 }, (_, seed) => rollRelicChoices({ ...run, rng: seed, level } as RunState, data, 1).relicChoices![0]).filter(
        (id) => data.equipment[id].rarity === 'rare',
      ).length;
    expect(rares(2)).toBeGreaterThan(rares(0));
  });

  it('a mini-boss beaten offers them with the feature on, not with it off', () => {
    const miniBoss = run.map.columns.flat().find((n) => n.kind === 'miniBoss')!;
    const at = { ...run, position: miniBoss.id };
    const combat = { ...fight([]), phase: 'won' as const };
    expect(finishCombat(at, combat, data).relicChoices).toHaveLength(3);
    expect(finishCombat(at, combat, gameData).relicChoices).toBeUndefined();
  });

  it('every relic is a piece of the gear catalogue, under the same id, with its art', () => {
    const relics = Object.values(data.equipment).filter((e) => e.rarity);
    expect(relics.length).toBeGreaterThanOrEqual(20);
    for (const relic of relics) {
      const piece = gear.find((g) => g.id === relic.id);
      expect(piece, relic.id).toBeDefined();
      expect(relic.sprite).toEqual({ sheet: 'gear', index: piece!.no });
    }
  });
});
