import { describe, expect, it } from 'vitest';
import { contentSource, gameData } from '../src/content';
import { buildGameData, chooseIntent, createCombat, escalationPercent, NO_FEATURES, type GameData } from '../src/engine';
import { repeat } from './fixtures';

const data: GameData = buildGameData({ ...contentSource, features: { ...NO_FEATURES, escalation: true } });

/** The fighter's next moves over many seeds, after `played` Tail Hits. */
function nextMoves(played: number, d: GameData, bosses = false): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let seed = 1; seed <= 400; seed++) {
    const s = createCombat({ seed, deck: repeat('tug', 10), enemies: ['sockeyeSalmon'], playerHp: 60, playerMaxHp: 60, bosses }, d);
    const enemy = { ...s.enemies[0], moveHistory: repeat('tailSlap', played) };
    chooseIntent(s, enemy, d);
    counts[enemy.intent!] = (counts[enemy.intent!] ?? 0) + 1;
  }
  return counts;
}

describe('escalating intents', () => {
  it('start with its 5th move, 10% more each move, never for bosses or with the flag off', () => {
    const s = createCombat({ seed: 1, deck: repeat('tug', 10), enemies: ['sockeyeSalmon'], playerHp: 60, playerMaxHp: 60 }, data);
    const after = (n: number) => escalationPercent({ ...s.enemies[0], moveHistory: repeat('tailSlap', n) }, data);
    expect(after(3)).toBe(0);
    expect(after(4)).toBe(10);
    expect(after(8)).toBe(50);
    expect(escalationPercent({ ...s.enemies[0], moveHistory: repeat('tailSlap', 8), boss: true }, data)).toBe(0);
    expect(escalationPercent({ ...s.enemies[0], moveHistory: repeat('tailSlap', 8) }, gameData)).toBe(0);
  });

  it('a long fight brings no rest and more normal Pulls', () => {
    const late = nextMoves(14, data);
    const before = nextMoves(14, gameData);
    expect(late.catchBreath).toBeUndefined();
    expect(before.catchBreath).toBeGreaterThan(0);
    expect(late.leap).toBeGreaterThan(before.leap);
  });
});
