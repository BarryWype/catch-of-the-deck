import { describe, expect, it } from 'vitest';
import { gameData } from '../src/content';
import { addStatus, applyAction, createCombat, takeReport, type CombatState, type Effect, type GameData } from '../src/engine';

/** A fight against one creature whose single move plays `effects`, with the player's Hold set. */
function fightWith(effects: Effect[], hold: number): { state: CombatState; data: GameData } {
  const creature = {
    ...gameData.enemies.progenetica,
    id: 'creature',
    tier: 2,
    hp: [20, 20] as [number, number],
    escapeAt: 100,
    escapeStart: 50,
    escapeRate: 5,
    moves: [{ id: 'move', name: 'Move', tag: 'strike' as const, intensity: 'light' as const, effects }],
    pattern: { type: 'sequence' as const, moves: ['move'] },
  };
  const data = { ...gameData, enemies: { ...gameData.enemies, creature } };
  const state = createCombat(
    { seed: 1, deck: [...gameData.builds.rod.starterDeck], enemies: ['creature'], playerHp: 80, playerMaxHp: 80 },
    data,
  );
  state.player.block = hold;
  state.enemies[0].intent = 'move';
  return { state, data };
}

describe('the combat report', () => {
  it('reports a Strike the Hold fully soaks', () => {
    const { state, data } = fightWith([{ type: 'dealDamage', amount: 6 }], 10);
    applyAction(state, { type: 'endTurn' }, data);
    expect(takeReport()).toEqual([{ kind: 'strike', blocked: 6, hpLost: 0 }]);
  });

  it('reports a Strike that wears the Hold down', () => {
    const { state, data } = fightWith([{ type: 'dealDamage', amount: 6 }], 3);
    applyAction(state, { type: 'endTurn' }, data);
    expect(takeReport()).toEqual([{ kind: 'strike', blocked: 3, hpLost: 3 }]);
  });

  it('reports a Pull the Hold fully holds', () => {
    const { state, data } = fightWith([{ type: 'pull', amount: 6 }], 6);
    applyAction(state, { type: 'endTurn' }, data);
    expect(takeReport()).toEqual([{ kind: 'pull', blocked: 6, raised: 0 }]);
  });

  it('reports a Pull that partly gets away', () => {
    const { state, data } = fightWith([{ type: 'pull', amount: 6 }], 2);
    applyAction(state, { type: 'endTurn' }, data);
    expect(takeReport()).toEqual([{ kind: 'pull', blocked: 2, raised: 4 }]);
  });

  it('reports Venom and Slow put on, but not stacks lost', () => {
    const target = { id: 'e', name: 'E', hp: 5, maxHp: 5, block: 0, statuses: {} };
    addStatus(target, 'venom', 2);
    addStatus(target, 'slow', 1);
    addStatus(target, 'venom', -1);
    expect(takeReport()).toEqual([
      { kind: 'status', status: 'venom' },
      { kind: 'status', status: 'slow' },
    ]);
  });

  it('holds only the last action’s events when the previous report was unread', () => {
    const { state, data } = fightWith([{ type: 'dealDamage', amount: 6 }], 50);
    const after = applyAction(applyAction(state, { type: 'endTurn' }, data), { type: 'endTurn' }, data);
    expect(after.phase).toBe('playerTurn');
    const report = takeReport();
    expect(report).toHaveLength(1);
    expect(report[0].kind).toBe('strike');
  });
});
