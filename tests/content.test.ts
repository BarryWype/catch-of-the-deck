import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { creatures } from '../src/content/creatures';
import { gear } from '../src/content/gear';
import { describeCard, startingBuilds, validateContent, type ContentSource } from '../src/engine';

describe('game content', () => {
  it('passes validation', () => {
    expect(validateContent(contentSource)).toEqual([]);
  });

  it('every fishing style starts with the same 10-card deck', () => {
    for (const build of Object.values(gameData.builds)) {
      const counts: Record<string, number> = {};
      for (const id of build.starterDeck) counts[id] = (counts[id] ?? 0) + 1;
      expect(counts, build.id).toEqual({ tug: 4, holdTight: 4, steadyHand: 1, reelIn: 1 });
    }
  });

  it('starter cards have no family, so they are never offered; every other card has one', () => {
    const starters = new Set(Object.values(gameData.builds).flatMap((b) => b.starterDeck));
    for (const card of Object.values(gameData.cards)) expect(card.family === undefined, card.id).toBe(starters.has(card.id));
  });

  it('every creature type is the specialty of exactly one build', () => {
    const covered = Object.values(gameData.builds).flatMap((b) => b.strongAgainst);
    expect([...covered].sort()).toEqual(Object.keys(gameData.creatureTypes).sort());
  });

  it('every card has rules text', () => {
    for (const card of Object.values(gameData.cards)) expect(describeCard(card)).not.toBe('');
  });

  it('generates readable rules text', () => {
    expect(describeCard(gameData.cards.tug)).toBe('Deal 5 damage.');
    expect(describeCard(gameData.cards.reelIn)).toBe('Drain 7.');
    expect(describeCard(gameData.cards.sting)).toBe('Deal 2 damage. Apply 3 Venom.');
    expect(describeCard(gameData.cards.dartingNips)).toBe('Deal 2 damage 4 times to random creatures.');
    expect(describeCard(gameData.cards.cheapShot)).toBe('Deal 5 damage. The creature gains 5 Will.');
    expect(describeCard(gameData.cards.numbingSting)).toBe('Apply 2 Venom. Apply 2 Slow. Targets a random creature.');
    expect(describeCard(gameData.cards.stickySlime)).toBe('Gain 4 Hold. Apply 3 Slow. Targets a random creature.');
    // With modifiers, the real number follows in brackets.
    expect(describeCard(gameData.cards.tug, { attacker: { strength: 1 } })).toBe('Deal 5 (6) damage.');
    expect(describeCard(gameData.cards.tug, { attacker: { weak: 1 } })).toBe('Deal 5 (3) damage.');
  });
});

describe('creatures', () => {
  it('has one entry per sprite (1–144), with unique ids', () => {
    expect(creatures.map((c) => c.no)).toEqual(Array.from({ length: 144 }, (_, i) => i + 1));
    expect(new Set(creatures.map((c) => c.id)).size).toBe(creatures.length);
  });

  it('escapeAt is 50–200 and the bar starts part way up it', () => {
    for (const c of creatures) {
      expect(c.escapeAt).toBeGreaterThanOrEqual(50);
      expect(c.escapeAt).toBeLessThanOrEqual(200);
      expect(c.escapeStart).toBeGreaterThan(0);
      expect(c.escapeStart).toBeLessThan(c.escapeAt);
    }
  });

  it('small fish pull gently', () => {
    const average = (list: typeof creatures) => list.reduce((sum, c) => sum + c.escapeRate, 0) / list.length;
    expect(average(creatures.filter((c) => c.type === 'smallFish'))).toBeLessThan(average(creatures));
  });

  it('sell values range from 2 to 20 and deeper tiers are worth more', () => {
    const values = creatures.map((c) => c.sellValue);
    expect(Math.min(...values)).toBe(2);
    expect(Math.max(...values)).toBe(20);
    for (const tier of [1, 2] as const) {
      const highest = Math.max(...creatures.filter((c) => c.tier === tier).map((c) => c.sellValue));
      const lowestDeeper = Math.min(...creatures.filter((c) => c.tier === tier + 1).map((c) => c.sellValue));
      expect(highest).toBeLessThan(lowestDeeper);
    }
  });

  it('every creature is an enemy with its sprite, and a solo encounter at its tier', () => {
    for (const c of creatures) {
      expect(gameData.enemies[c.id].sprite).toEqual({ sheet: 'fishes', index: c.no });
      expect(gameData.encounters.find((e) => e.id === c.id)).toMatchObject({ tier: c.tier, enemies: [c.id] });
    }
  });

  it('every tier has creatures', () => {
    for (const tier of [1, 2, 3]) expect(creatures.some((c) => c.tier === tier)).toBe(true);
  });

  it('every creature has a valid type, used as its enemy tag', () => {
    for (const c of creatures) {
      expect(gameData.creatureTypes[c.type]).toBeDefined();
      expect(gameData.enemies[c.id].tags).toEqual([c.type]);
    }
  });

  it('starting strength is applied', () => {
    expect(gameData.enemies.swordfish.startingStatuses).toEqual({ strength: 2 });
    expect(gameData.enemies.clownfish.startingStatuses).toEqual({});
  });
});

describe('equipment', () => {
  it('each build offers its starting items; only Kid builds can start a run', () => {
    expect(Object.fromEntries(Object.values(gameData.builds).map((b) => [b.id, b.startingItems]))).toEqual({
      rod: ['reliableReel', 'strongRod', 'handline'],
      spear: ['sharpSpear'],
      foraging: ['rubberDuck', 'softNet', 'crabHook'],
    });
    expect(startingBuilds(gameData).map((b) => b.id)).toEqual(['rod', 'foraging']);
  });

  it('catches unknown starting items and levels', () => {
    const bad = { ...contentSource, builds: contentSource.builds.map((b, i) => (i ? b : { ...b, startingItems: ['ghost'], level: 'teen' })) };
    expect(validateContent(bad)).toHaveLength(2);
  });
});

describe('gear', () => {
  it('has one entry per sprite (1–36), with unique ids', () => {
    expect(gear.map((g) => g.no)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
    expect(new Set(gear.map((g) => g.id)).size).toBe(gear.length);
  });
});

describe('content validation', () => {
  const base: ContentSource = {
    character: { name: 'C', maxHp: 10, home: { name: 'Home' } },
    cards: [{ id: 'a', name: 'A', type: 'attack', rarity: 'normal', cost: 1, target: 'enemy', effects: [{ type: 'dealDamage', amount: 1 }] }],
    enemies: [{ id: 'e', name: 'E', hp: [5, 5], escapeAt: 50, escapeStart: 25, escapeRate: 10, moves: [{ id: 'm', name: 'M', tag: 'pull', effects: [{ type: 'pull', amount: 1 }] }], pattern: { type: 'sequence', moves: ['m'] } }],
    encounters: [{ id: 'x', name: 'X', enemies: ['e'] }],
    builds: [{ id: 'b', name: 'B', description: '', starterDeck: ['a'], strongAgainst: [] }],
    creatureTypes: [{ id: 't', name: 'T' }],
    equipment: [],
    events: [],
    shop: [],
    companionBonuses: [],
    families: [],
    spots: [],
    levels: [
      {
        id: 'l', name: 'L', tier: 1, start: { x: 0, y: 0 }, height: 100,
        nodes: [
          { id: 'm', column: 1, x: 0, y: 0, kind: 'miniBoss', enemies: ['e'], next: ['out', 'f'] },
          { id: 'out', column: 2, x: 0, y: 0, kind: 'leave', next: [] },
          { id: 'f', column: 2, x: 0, y: 0, kind: 'fight', enemies: ['e'], next: ['b'] },
          { id: 'b', column: 3, x: 0, y: 0, kind: 'boss', enemies: ['e'], next: [] },
        ],
      },
    ],
    coast: { features: [], reserved: [] },
  };

  it('accepts valid content', () => {
    expect(validateContent(base)).toEqual([]);
  });

  it('catches moves whose tag doesn\'t match their effects, and cards that pull', () => {
    const strikeWithoutDamage = { ...base.enemies[0], moves: [{ id: 'm', name: 'M', tag: 'strike' as const, effects: [{ type: 'pull' as const, amount: 1 }] }] };
    expect(validateContent({ ...base, enemies: [strikeWithoutDamage] })).toEqual([expect.stringContaining('a strike move needs a "dealDamage" effect')]);
    const pullingCard = { ...base.cards[0], effects: [...base.cards[0].effects, { type: 'pull' as const, amount: 1 }] };
    expect(validateContent({ ...base, cards: [pullingCard] })).toEqual([expect.stringContaining('only creature moves can pull')]);
  });

  it('catches untargeted cards with targeted effects', () => {
    const bad = { ...base, cards: [{ ...base.cards[0], target: 'none' as const }] };
    expect(validateContent(bad)).toHaveLength(1);
  });

  it('catches unknown references', () => {
    const bad: ContentSource = {
      ...base,
      builds: [{ ...base.builds[0], starterDeck: ['missing'] }],
      encounters: [{ id: 'x', name: 'X', enemies: ['ghost'] }],
      enemies: [{ ...base.enemies[0], pattern: { type: 'sequence', moves: ['nope'] } }],
    };
    expect(validateContent(bad)).toHaveLength(3);
  });

  it('catches unknown creature types in tags, bonuses and builds', () => {
    const bad: ContentSource = {
      ...base,
      enemies: [{ ...base.enemies[0], tags: ['ghostType'] }],
      cards: [{ ...base.cards[0], effects: [{ type: 'dealDamage', amount: 1, bonus: { against: ['typo'] } }] }],
      builds: [{ ...base.builds[0], strongAgainst: ['nope'] }],
    };
    expect(validateContent(bad)).toHaveLength(3);
  });

  it('catches an invalid character', () => {
    expect(validateContent({ ...base, character: { ...base.character, maxHp: 0 } })).toHaveLength(1);
  });
});
