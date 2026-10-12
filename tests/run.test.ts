import { describe, expect, it } from 'vitest';
import {
  addCardToDeck,
  applyEventChoice,
  buyShopItem,
  EVENT_FIGHT_CHANCE,
  eventChoiceBlocked,
  escapeRateReduction,
  availableDestinations,
  bringCatchHome,
  layEggs,
  SESSION_SLOTS,
  takeFromHome,
  createRun,
  enterNextLevel,
  isLastLevel,
  isReleaseFight,
  recordEncounter,
  START_NODE_ID,
  visitTreasure,
  finishCombat,
  isMapComplete,
  rollCardRewards,
  sellCreature,
  shopItemBlocked,
  travelTo,
  visitEvent,
  visitLeave,
  visitShop,
  type RunState,
} from '../src/engine';
import { play, repeat, setup, testData, withNodeKind } from './fixtures';

describe('run', () => {
  it('starts with the starter deck at full HP, on the map start', () => {
    const run = createRun(5, testData, 'basic');
    expect(run.deck).toEqual(['strike', 'defend']);
    expect(run.hp).toBe(run.maxHp);
    expect(run.position).toBe(START_NODE_ID);
    expect(run.visited).toEqual([START_NODE_ID]);
    expect(run.level).toBe(0);
  });

  it('offers 3 distinct non-starter cards, deterministically', () => {
    const run = createRun(5, testData, 'basic');
    const { choices } = rollCardRewards(run, testData);
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    for (const id of choices) expect(testData.cards[id].rarity).not.toBe('starter');
    expect(rollCardRewards(run, testData).choices).toEqual(choices);
  });

  it('build cards are only offered to their build', () => {
    const offered = (build: string) =>
      new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((seed) => rollCardRewards(createRun(seed, testData, build), testData, 99).choices));
    expect(offered('angler').has('lure')).toBe(true);
    expect(offered('basic').has('lure')).toBe(false);
  });

  it('carries HP out of combat and adds the chosen card', () => {
    const start = createRun(5, testData, 'basic');
    const { run, combat } = travelTo(start, availableDestinations(start)[0].id, testData);
    const hurt = { ...combat, phase: 'won' as const, player: { ...combat.player, hp: 50 } };
    const after = finishCombat(run, hurt, testData);
    expect(after).toMatchObject({ hp: 50, floor: 2, bucket: ['dummy'] });
    expect(run.bucket).toEqual([]); // input untouched
    expect(addCardToDeck(after, 'twin', testData).deck).toEqual(['strike', 'defend', 'twin']);
  });
});

describe('starting builds', () => {
  it('the build sets the starter deck; the map is the first level’s', () => {
    const basic = createRun(5, testData, 'basic');
    const angler = createRun(5, testData, 'angler');
    expect(angler.build).toBe('angler');
    expect(angler.deck).toEqual(['hook', 'defend']);
    expect(angler.map).toEqual(basic.map);
  });

  it('rejects an unknown build', () => {
    expect(() => createRun(5, testData, 'nope')).toThrow();
  });
});

describe('capture record', () => {
  it('starts empty and only records creatures from won fights, in order', () => {
    let run = createRun(5, testData, 'basic');
    expect(run.bucket).toEqual([]);
    const fight = travelTo(run, availableDestinations(run)[0].id, testData);
    run = finishCombat(fight.run, { ...fight.combat, phase: 'lost' }, testData);
    expect(run.bucket).toEqual([]);
    run = finishCombat(run, { ...fight.combat, phase: 'won' }, testData);
    run = finishCombat(run, { ...fight.combat, phase: 'won' }, testData);
    expect(run.bucket).toEqual(['dummy', 'dummy']);
  });

  it('a won run brings its bucket home, on top of what is already there', () => {
    const run = { ...createRun(5, testData, 'basic'), bucket: ['dummy', 'cycler'] };
    const home = [{ id: 'gambler', bond: 7 }];
    expect(bringCatchHome(home, run, testData)).toEqual([
      { id: 'gambler', bond: 7 },
      { id: 'dummy', bond: 0 },
      { id: 'cycler', bond: 0 },
    ]);
    expect(run.bucket).toEqual(['dummy', 'cycler']); // input untouched
  });

  it('the creature book marks the creatures of a fight seen, then captured once it is won', () => {
    const run = createRun(5, testData, 'basic');
    const { combat } = travelTo(run, availableDestinations(run)[0].id, testData);
    const ids = combat.enemies.map((e) => e.defId);
    const seen = recordEncounter({}, combat);
    expect(Object.keys(seen).sort()).toEqual([...new Set(ids)].sort());
    expect(Object.values(seen).every((s) => s === 'seen')).toBe(true);
    expect(recordEncounter(seen, combat)).toBe(seen); // nothing new
    const captured = recordEncounter(seen, { ...combat, phase: 'won' });
    expect(Object.values(captured).every((s) => s === 'captured')).toBe(true);
    expect(recordEncounter(captured, { ...combat, phase: 'fled' })).toBe(captured); // never downgraded
  });

  it('only species with at least two in the home aquarium lay eggs, at their breed chance', () => {
    const data = { ...testData, enemies: { ...testData.enemies, dummy: { ...testData.enemies.dummy, breedChance: 0.1 } } };
    const home = ['dummy', 'dummy', 'dummy', 'cycler', 'cycler'].map((id) => ({ id, bond: 0 }));
    let eggs = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const laid = layEggs(home, createRun(seed, data, 'basic'), data);
      expect(laid.every((id) => id === 'dummy')).toBe(true); // cycler has no breed chance
      expect(laid.length).toBeLessThanOrEqual(1);
      eggs += laid.length;
    }
    expect(eggs / 2000).toBeCloseTo(0.1, 1);
  });

  it('creatures brought from the home aquarium start the run in the bucket', () => {
    const home = [
      { id: 'dummy', bond: 1 },
      { id: 'cycler', bond: 2 },
      { id: 'dummy', bond: 3 },
    ];
    // Picks a specific creature, not just a species: the second dummy, with its bond.
    expect(takeFromHome(home, [2, 1])).toEqual({ home: [{ id: 'dummy', bond: 1 }], brought: [home[2], home[1]] });
    expect(home).toHaveLength(3); // input untouched
    expect(() => takeFromHome(home, [5])).toThrow();
    const run = createRun(5, testData, 'basic', [home[2], home[1]]);
    expect(run.bucket).toEqual(['dummy', 'cycler']);
    expect(run.companions).toEqual([home[2], home[1]]);
    expect(() => createRun(5, testData, 'basic', Array(SESSION_SLOTS + 1).fill(home[0]))).toThrow();
  });

  it('creatures caught before another one got away still reach the bucket', () => {
    const run = createRun(5, testData, 'basic');
    const fight = travelTo(run, '1a', testData);
    const caught = { ...fight.combat.enemies[0], hp: 0 };
    const escaped = { ...fight.combat.enemies[0], id: 'e1', defId: 'cycler', escape: 1000 };
    const fled = { ...fight.combat, phase: 'fled' as const, enemies: [caught, escaped] };
    expect(finishCombat(fight.run, fled, testData).bucket).toEqual(['dummy']);
    expect(recordEncounter({}, fled)).toEqual({ dummy: 'captured', cycler: 'seen' });
  });

  it('a creature that got away is not captured', () => {
    const run = createRun(5, testData, 'basic');
    const fight = travelTo(run, availableDestinations(run)[0].id, testData);
    expect(finishCombat(fight.run, { ...fight.combat, phase: 'fled' }, testData)).toMatchObject({ bucket: [], floor: 1 });
  });

  it('selling a creature removes it and adds its sell value to the coins', () => {
    let run = createRun(5, testData, 'basic');
    expect(run.coins).toBe(0);
    const fight = travelTo(run, availableDestinations(run)[0].id, testData);
    run = finishCombat(fight.run, { ...fight.combat, phase: 'won' }, testData);
    const sold = sellCreature(run, 0, testData);
    expect(sold).toMatchObject({ bucket: [], coins: 5 });
    expect(run.bucket).toEqual(['dummy']); // input untouched
    expect(() => sellCreature(sold, 0, testData)).toThrow();
  });
});

describe('travelling the map', () => {
  it('moves to the chosen node and starts its encounter', () => {
    const start = createRun(5, testData, 'basic');
    const { run, combat } = travelTo(start, '1a', testData);
    expect(run.position).toBe('1a');
    expect(run.visited).toEqual([START_NODE_ID, '1a']);
    expect(combat.enemies.map((e) => e.defId)).toEqual(['dummy']);
    expect(start.position).toBe(START_NODE_ID); // input untouched
  });

  it('fixed enemies are met as they are: the mini-boss, the boss, any fight', () => {
    const start = createRun(5, testData, 'basic');
    expect(travelTo(start, '1b', testData).combat.enemies.map((e) => e.defId)).toEqual(['cycler']);
    const atOne = travelTo(start, '1a', testData).run;
    expect(travelTo(atOne, '2', testData).combat.enemies.map((e) => e.defId)).toEqual(['gambler']);
  });

  it('refuses nodes that are not adjacent to the current position', () => {
    const start = createRun(5, testData, 'basic');
    expect(() => travelTo(start, '2', testData)).toThrow();
    expect(() => travelTo(start, START_NODE_ID, testData)).toThrow();
  });

  it('can walk to the boss, which ends the level', () => {
    let run: RunState = createRun(11, testData, 'basic');
    for (const id of ['1a', '2', '3a', '4']) run = travelTo(run, id, testData).run;
    expect(isMapComplete(run)).toBe(true);
  });
});

describe('levels', () => {
  it('after a boss, the next level starts at its house; the last one wins the run', () => {
    const run = { ...createRun(5, testData, 'basic'), position: '4', visited: ['start', '1a', '2', '3a', '4'], coins: 9, bucket: ['dummy'] };
    expect(isLastLevel(run, testData)).toBe(false);
    const next = enterNextLevel(run, testData);
    expect(next).toMatchObject({ level: 1, position: START_NODE_ID, visited: [START_NODE_ID], coins: 9, bucket: ['dummy'] });
    expect(availableDestinations(next).map((n) => n.id)).toEqual(['two-1']);
    expect(next.map.columns[1][0].tier).toBe(2);
    expect(isLastLevel(next, testData)).toBe(true);
    expect(() => enterNextLevel(next, testData)).toThrow();
  });

  it('mini-bosses and bosses are let go: never in the bucket, never sold, only seen', () => {
    const atOne = travelTo({ ...createRun(5, testData, 'basic'), equipment: ['spear'] }, '1a', testData).run;
    const miniBoss = travelTo(atOne, '2', testData);
    expect(isReleaseFight(miniBoss.run)).toBe(true);
    expect(isReleaseFight(atOne)).toBe(false);
    const won = { ...miniBoss.combat, phase: 'won' as const };
    expect(finishCombat(miniBoss.run, won, testData)).toMatchObject({ bucket: [], coins: 0, floor: 2 });
    expect(recordEncounter({}, won, true)).toEqual({ gambler: 'seen' });
    expect(recordEncounter({}, won)).toEqual({ gambler: 'captured' });
  });

  it('the leave node after the mini-boss is a dead end', () => {
    const run = travelTo(travelTo(createRun(5, testData, 'basic'), '1a', testData).run, '2', testData).run;
    const left = visitLeave(run, '3b');
    expect(left.position).toBe('3b');
    expect(isMapComplete(left)).toBe(true);
    expect(() => visitLeave(run, '3a')).toThrow();
  });
});

describe('equipment', () => {
  it('the run starts with the starting item picked, the build’s first by default', () => {
    expect(createRun(5, testData, 'angler').equipment).toEqual(['reel']);
    expect(createRun(5, testData, 'basic').equipment).toEqual([]);
    expect(() => createRun(5, testData, 'angler', [], 'spear')).toThrow();
  });

  const withItems = {
    ...testData,
    equipment: {
      ...testData.equipment,
      rod: { id: 'rod', name: 'Rod', description: '', effects: [{ type: 'strongerPull' as const, percent: 25 }] },
      net: { id: 'net', name: 'Net', description: '', effects: [{ type: 'bondOnCapture' as const, amount: 30 }] },
      hook: { id: 'hook', name: 'Hook', description: '', effects: [{ type: 'extraCatch' as const, percent: 100, types: ['shell'], spots: ['sea'] }] },
    },
    encounters: [...testData.encounters, { id: 'cycler', name: 'Cycler', enemies: ['cycler'] }],
  };

  it('strongerPull makes calming cards lower Panic more, rounded up', () => {
    const combat = setup(['calm', ...repeat('strike', 4)], { enemies: ['shellA'], equipment: ['rod'], data: withItems });
    expect(play(combat, 'calm', 'e0', withItems).enemies[0].escape).toBe(50 - 10 - 3);
  });

  it('bondOnCapture: catches come home with that bond, companions keep theirs', () => {
    const run = { ...createRun(5, withItems, 'basic', [{ id: 'dummy', bond: 7 }]), equipment: ['net'], bucket: ['dummy', 'cycler'] };
    expect(bringCatchHome([], run, withItems)).toEqual([
      { id: 'dummy', bond: 7 },
      { id: 'cycler', bond: 30 },
    ]);
  });

  it('extraCatch drags one more creature of its types into ordinary fights at its spots only', () => {
    const run = { ...createRun(5, withItems, 'basic'), equipment: ['hook'] };
    expect(travelTo(run, '1a', withItems).combat.enemies.map((e) => e.defId)).toEqual(['dummy', 'cycler']);
    const atMiniBoss = travelTo(travelTo(run, '1a', withItems).run, '2', withItems);
    expect(atMiniBoss.combat.enemies.map((e) => e.defId)).toEqual(['gambler']);
    // Only at its spots: 1b has fixed enemies and no spot.
    expect(travelTo(run, '1b', withItems).combat.enemies.map((e) => e.defId)).toEqual(['cycler']);
  });

  it('a slowEscape cuts the escape rate by its share, at least 1, rounded up', () => {
    expect([10, 6, 2, 1, 0].map((rate) => escapeRateReduction(rate, 20))).toEqual([2, 2, 1, 1, 0]);
    const run = createRun(5, testData, 'angler');
    const { combat } = travelTo(run, availableDestinations(run)[0].id, testData);
    expect(combat.enemies[0].escapeRate).toBe(0);
  });

  it('sellOnCapture sells captures on the spot for more, instead of the aquarium', () => {
    const run = { ...createRun(5, testData, 'basic'), equipment: ['spear'] };
    const fight = travelTo(run, availableDestinations(run)[0].id, testData);
    expect(finishCombat(fight.run, { ...fight.combat, phase: 'won' }, testData)).toMatchObject({ bucket: [], coins: 6 });
    expect(finishCombat(fight.run, { ...fight.combat, phase: 'fled' }, testData)).toMatchObject({ bucket: [], coins: 0 });
  });
});

describe('events', () => {
  const data = {
    ...testData,
    events: {
      spot: {
        id: 'spot', name: 'Spot', description: '',
        choices: [
          { label: 'Rest', effects: [{ type: 'heal' as const, percent: 25 }] },
          { label: 'Tip', effects: [{ type: 'coinsPerCreature' as const, amount: 2 }] },
          { label: 'Dig', effects: [{ type: 'loseHp' as const, amount: 5 }, { type: 'gainCoins' as const, amount: 7 }, { type: 'cardReward' as const }] },
        ],
      },
    },
    equipment: { ...testData.equipment, duck: { id: 'duck', name: 'Duck', description: '', effects: [{ type: 'passerbyBonus' as const, bonusPercent: 50 }] } },
  };
  const eventNode = (run: RunState) => withNodeKind(run, '1a', 'event');

  it('visiting an event moves there and draws one; fights refuse event nodes and vice versa', () => {
    const run = eventNode(createRun(5, data, 'basic'));
    const target = run.map.columns[1][0];
    const visit = visitEvent(run, target.id, data);
    expect(visit).toMatchObject({ eventId: 'spot', run: { position: target.id } });
    expect(() => travelTo(run, target.id, data)).toThrow();
    const fight = run.map.columns[1].find((n) => n.kind === 'fight');
    if (fight) expect(() => visitEvent(run, fight.id, data)).toThrow();
  });

  it('applies the choice: heal (capped), coins per creature (+ passerby bonus), lose HP + coins + card', () => {
    const run = { ...createRun(5, data, 'basic'), hp: 70, bucket: ['dummy', 'dummy'] };
    expect(applyEventChoice(run, 'spot', 0, data).run.hp).toBe(80);
    expect(applyEventChoice(run, 'spot', 1, data)).toMatchObject({ run: { coins: 4, bucket: ['dummy', 'dummy'] }, cardReward: false });
    expect(applyEventChoice({ ...run, equipment: ['duck'] }, 'spot', 1, data).run.coins).toBe(6);
    expect(applyEventChoice({ ...run, bucket: [] }, 'spot', 1, data).run.coins).toBe(0);
    expect(applyEventChoice(run, 'spot', 2, data)).toMatchObject({ run: { hp: 65, coins: 7 }, cardReward: true });
  });

  it('only draws events allowed at the node\'s column', () => {
    const late = { ...data.events.spot, id: 'late', minColumn: 5 };
    const run = eventNode(createRun(5, data, 'basic'));
    const target = run.map.columns[1][0];
    for (let seed = 1; seed <= 40; seed++) {
      const withLate = { ...data, events: { spot: data.events.spot, late } };
      const visit = visitEvent({ ...run, rng: seed }, target.id, withLate);
      if (!visit.combat) expect(visit.eventId).toBe('spot');
      // With nothing allowed here, only the surprise fight can happen.
      const onlyLate = () => visitEvent({ ...run, rng: seed }, target.id, { ...data, events: { late } });
      if (!visit.combat) expect(onlyLate).toThrow();
    }
  });

  it('about 10% of events turn out to be an ordinary fight', () => {
    const run = eventNode(createRun(5, data, 'basic'));
    const target = run.map.columns[1][0];
    const visits = Array.from({ length: 1000 }, (_, seed) => visitEvent({ ...run, rng: seed }, target.id, data));
    const fights = visits.filter((v) => v.combat);
    expect(fights.length / visits.length).toBeGreaterThan(EVENT_FIGHT_CHANCE - 0.03);
    expect(fights.length / visits.length).toBeLessThan(EVENT_FIGHT_CHANCE + 0.03);
    // Any creature of the level's tier.
    for (const v of fights) expect(v.combat!.enemies.map((e) => e.defId)).toEqual(['dummy']);
    expect(visits.every((v) => v.run.position === target.id)).toBe(true);
  });

  it('blocks choices that cannot be paid for', () => {
    const run = { ...createRun(5, data, 'basic'), hp: 5 };
    expect(eventChoiceBlocked(data.events.spot.choices[2], run)).toBe('Not enough Grit.');
    expect(() => applyEventChoice(run, 'spot', 2, data)).toThrow();
  });
});

describe('shop', () => {
  const data = {
    ...testData,
    shop: [
      { id: 'heart', name: 'Heart', price: 10, effect: { type: 'heal' as const, amount: 30 } },
      { id: 'cut', name: 'Cut', price: 20, effect: { type: 'removeCard' as const }, limit: 1 },
    ],
  };
  const [heart, cut] = data.shop;

  it('only a shop can be visited as one', () => {
    const run = withNodeKind(createRun(5, data, 'basic'), '1a', 'shop');
    expect(visitShop(run, '1a').position).toBe('1a');
    expect(() => visitShop(run, '1b')).toThrow();
    expect(() => travelTo(run, '1a', data)).toThrow();
  });

  it('a heart costs coins and heals up to max HP, as often as you can pay', () => {
    const run = { ...createRun(5, data, 'basic'), hp: 40, coins: 25 };
    let { run: after, visit } = buyShopItem(run, { bought: {} }, 'heart', data);
    expect(after).toMatchObject({ hp: 70, coins: 15 });
    ({ run: after, visit } = buyShopItem(after, visit, 'heart', data));
    expect(after).toMatchObject({ hp: 80, coins: 5 });
    expect(shopItemBlocked(heart, after, visit)).toBe('Already at full Grit.');
    expect(shopItemBlocked(heart, { ...after, hp: 50 }, visit)).toBe('Not enough coins.');
  });

  it('removing a card takes the chosen one, once per visit', () => {
    const run = { ...createRun(5, data, 'basic'), coins: 50 };
    const { run: after, visit } = buyShopItem(run, { bought: {} }, 'cut', data, 0);
    expect(after).toMatchObject({ deck: ['defend'], coins: 30 });
    expect(shopItemBlocked(cut, { ...after, deck: ['a', 'b'] }, visit)).toBe('Sold out.');
    expect(() => buyShopItem(run, { bought: {} }, 'cut', data)).toThrow();
  });
});

describe('treasure', () => {
  const chest = { id: 'chest', name: 'Chest', description: '', treasure: true, choices: [{ label: 'Take', effects: [{ type: 'gainCoins' as const, amount: 25 }] }] };
  const rest = { id: 'rest', name: 'Rest', description: '', choices: [{ label: 'Rest', effects: [] }] };
  const data = { ...testData, events: { chest, rest } };

  it('treasure nodes draw treasure events, which never happen on event nodes', () => {
    const run = withNodeKind(withNodeKind(createRun(5, data, 'basic'), '1a', 'treasure'), '1b', 'event');
    expect(visitTreasure(run, '1a', data)).toMatchObject({ eventId: 'chest', run: { position: '1a' } });
    expect(() => visitTreasure(run, '1b', data)).toThrow();
    for (let seed = 0; seed < 30; seed++) {
      const visit = visitEvent({ ...run, rng: seed }, '1b', data);
      if (!visit.combat) expect(visit.eventId).toBe('rest');
    }
  });
});
