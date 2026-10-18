import { describe, expect, it } from 'vitest';
import { previewCard, previewIntent, previewIntents, type CombatState, type GameData } from '../src/engine';
import { repeat, setup, testData } from './fixtures';

const uidOf = (s: CombatState, defId: string) => s.piles.hand.find((c) => c.defId === defId)!.uid;

describe('card preview', () => {
  it('shows the damage after the target\'s Block, Vulnerable and the player\'s Strength', () => {
    const s = setup(repeat('strike', 5));
    s.enemies[0].block = 4;
    s.enemies[0].statuses = { vulnerable: 1 };
    s.player.statuses = { strength: 2 };
    const next = previewCard(s, uidOf(s, 'strike'), 'e0', testData)!;
    // (6 + 2) × 1.5 = 12, 4 of it soaked by Block.
    expect(next.enemies[0]).toMatchObject({ hp: 92, block: 0 });
    expect(s.enemies[0]).toMatchObject({ hp: 100, block: 4 });
  });

  it('adds up every hit of a multi-hit attack, Weak included', () => {
    const s = setup(repeat('twin', 5));
    s.enemies[0].block = 3;
    s.player.statuses = { weak: 1 };
    // floor(5 × 0.75) = 3 per hit, twice: Block soaks the first.
    expect(previewCard(s, uidOf(s, 'twin'), 'e0', testData)!.enemies[0]).toMatchObject({ hp: 97, block: 0 });
    s.enemies[0].block = 0;
    expect(previewCard(s, uidOf(s, 'twin'), 'e0', testData)!.enemies[0].hp).toBe(94);
  });

  it('shows Drain on the Will bar and Hold on the player', () => {
    const s = setup(['calm', 'defend', 'strike', 'strike', 'strike']);
    s.enemies[0].escape = 30;
    expect(previewCard(s, uidOf(s, 'calm'), 'e0', testData)!.enemies[0].escape).toBe(20);
    expect(previewCard(s, uidOf(s, 'defend'), undefined, testData)!.player.block).toBe(5);
  });

  it('is null for a card that can\'t be played', () => {
    const s = setup(repeat('heavy', 5));
    s.player.energy = 2;
    expect(previewCard(s, uidOf(s, 'heavy'), 'e0', testData)).toBeNull();
  });

  it('keeps the creatures as they are when the play is random', () => {
    const data: GameData = {
      ...testData,
      cards: {
        ...testData.cards,
        gust: { id: 'gust', name: 'Gust', type: 'attack', rarity: 'normal', cost: 1, target: 'random', effects: [{ type: 'dealDamage', amount: 6 }, { type: 'gainBlock', amount: 3 }] },
      },
    };
    const s = setup(repeat('gust', 5), { enemies: ['dummy', 'dummy'], data });
    const next = previewCard(s, uidOf(s, 'gust'), undefined, data)!;
    expect(next.enemies.map((e) => e.hp)).toEqual([100, 100]);
    expect(next.player.block).toBe(3);
  });
});

describe('intent preview', () => {
  it('shows the Strike after the player\'s Hold and the creature\'s Weak', () => {
    const s = setup(repeat('strike', 5));
    s.player.block = 4;
    // The dummy's Hit deals 10.
    expect(previewIntents(s, testData).player).toMatchObject({ hp: 74, block: 0 });
    s.enemies[0].statuses = { weak: 1 };
    expect(previewIntents(s, testData).player).toMatchObject({ hp: 77, block: 0 });
    expect(s.player).toMatchObject({ hp: 80, block: 4 });
  });

  it('follows the card being played', () => {
    const s = setup(repeat('defend', 5));
    const afterCard = previewCard(s, uidOf(s, 'defend'), undefined, testData)!;
    expect(previewIntents(afterCard, testData).player).toMatchObject({ hp: 75, block: 0 });
  });

  it('shows a Pull raising the Will after Hold', () => {
    const data: GameData = {
      ...testData,
      enemies: {
        ...testData.enemies,
        dummy: { ...testData.enemies.dummy, moves: [{ id: 'hit', name: 'Tug', tag: 'pull', intensity: 'normal', effects: [{ type: 'pull', amount: 8 }] }] },
      },
    };
    const s = setup(repeat('strike', 5), { data });
    s.player.block = 3;
    expect(previewIntents(s, data).enemies[0].escape).toBe(4 + 8 - 3);
  });

  it('says what the arrows do: its own buffs and Block, and its debuffs', () => {
    const data: GameData = {
      ...testData,
      enemies: {
        ...testData.enemies,
        dummy: {
          ...testData.enemies.dummy,
          moves: [{ id: 'hit', name: 'Brace', tag: 'pull', intensity: 'normal', effects: [
            { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
            { type: 'gainBlock', amount: 4 },
            { type: 'applyStatus', status: 'weak', amount: 1 },
          ] }],
        },
      },
    };
    const s = setup(repeat('strike', 5), { data });
    const intent = previewIntent(s, s.enemies[0], data)!;
    expect(intent.buffText).toBe('Gain 1 Strength. Gain 4 Block. Strength: Adds damage to every hit of an attack.');
    expect(intent.debuffText).toBe('Apply 1 Weak. Weak: Deals 25% less damage with attacks. Decreases at end of turn.');
  });

  it('leaves out a hidden move', () => {
    const s = setup(repeat('strike', 5));
    s.enemies[0].intentHidden = true;
    expect(previewIntents(s, testData).player.hp).toBe(80);
  });
});
