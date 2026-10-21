import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { applyAction, buildGameData, createCombat, createRun, enterNextLevel, NO_FEATURES, previewIntent, travelTo, type CombatState, type GameData } from '../src/engine';
import { repeat } from './fixtures';

const data: GameData = buildGameData({ ...contentSource, features: { ...NO_FEATURES, affixes: true } });
const fight = (id: string, affix: string | null, d: GameData = data, extra = {}): CombatState =>
  createCombat({ seed: 1, deck: repeat('tug', 10), enemies: [id], playerHp: 60, playerMaxHp: 60, damage: 5.5, affixes: [affix], ...extra }, d);
const endTurn = (s: CombatState, intent?: string) =>
  applyAction({ ...s, player: { ...s.player, energy: 0 }, enemies: [{ ...s.enemies[0], escape: 20, ...(intent ? { intent } : {}) }] }, { type: 'endTurn' }, data);

describe('creature affixes', () => {
  it('show as a prefix on the creature’s name', () => {
    expect(fight('perch', 'hungry').enemies[0]).toMatchObject({ name: 'Hungry Perch', affix: 'hungry' });
  });

  it('Old and Wily: its first move is hidden', () => {
    expect(fight('perch', 'oldAndWily').enemies[0].intentHidden).toBe(true);
    expect(fight('perch', null).enemies[0].intentHidden).toBe(false);
  });

  it('Hungry: each Wind-up gives 1 Strength', () => {
    expect(endTurn(fight('perch', 'hungry'), 'sizeUp').enemies[0].statuses.strength).toBe(1);
    expect(endTurn(fight('perch', null), 'sizeUp').enemies[0].statuses.strength).toBeUndefined();
  });

  it('Skittish: starts with 15% more Will', () => {
    expect(fight('perch', 'skittish').enemies[0].escape).toBe(Math.round(fight('perch', null).enemies[0].escape * 1.15));
  });

  it('Hook-scarred: its Will rises 25% slower, its Strikes deal 20% more', () => {
    const plain = fight('perch', null).enemies[0];
    const scarred = fight('perch', 'hookScarred');
    expect(scarred.enemies[0].escapeRate).toBe(plain.escapeRate - Math.ceil(plain.escapeRate / 4));
    const hit = (s: CombatState) => previewIntent({ ...s, enemies: [{ ...s.enemies[0], intent: 'lunge' }] }, { ...s.enemies[0], intent: 'lunge' }, data)!.damage!;
    expect(hit(scarred)).toBeGreaterThan(hit(fight('perch', null)));
  });

  it('Armored: starts the fight and each of its turns with 4 Block', () => {
    const s = fight('perch', 'armored');
    expect(s.enemies[0].block).toBe(4);
    expect(endTurn({ ...s, enemies: [{ ...s.enemies[0], block: 0 }] }, 'lunge').enemies[0].block).toBe(4);
  });

  it('Frenzied: no rest in its first 3 moves', () => {
    const resting: GameData = { ...data, enemies: { ...data.enemies, perch: { ...data.enemies.perch, pattern: { type: 'weighted', weights: { circleLure: 100, lunge: 1 } } } } };
    let s = createCombat({ seed: 1, deck: repeat('tug', 10), enemies: ['perch'], playerHp: 60, playerMaxHp: 60, affixes: ['frenzied'] }, resting);
    const moves: string[] = [s.enemies[0].intent!];
    for (let i = 0; i < 3; i++) {
      s = applyAction({ ...s, player: { ...s.player, energy: 0, hp: 60 }, enemies: [{ ...s.enemies[0], escape: 20 }] }, { type: 'endTurn' }, resting);
      moves.push(s.enemies[0].intent!);
    }
    expect(moves.slice(0, 3)).not.toContain('circleLure');
    expect(moves[3]).toBe('circleLure');
  });

  it('are rolled on adult and elder fights only (or trophies), and never with the feature off', () => {
    let affixed = 0;
    let kid = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const run = createRun(seed, data, 'rod');
      const firstFight = (r: typeof run) => r.map.columns[1].find((n) => n.kind === 'fight' && !n.trophy);
      kid += travelTo(run, firstFight(run)!.id, data).combat.enemies.filter((e) => e.affix).length;
      const adult = enterNextLevel(run, data);
      if (firstFight(adult)) affixed += travelTo(adult, firstFight(adult)!.id, data).combat.enemies.filter((e) => e.affix).length;
      const off = enterNextLevel(createRun(seed, gameData, 'rod'), gameData);
      if (firstFight(off)) expect(travelTo(off, firstFight(off)!.id, gameData).combat.enemies.some((e) => e.affix)).toBe(false);
    }
    expect(kid).toBe(0);
    expect(affixed).toBeGreaterThan(2);
    expect(affixed).toBeLessThan(20);
  });
});
