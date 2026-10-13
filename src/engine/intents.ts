import { PLAYER_ID } from './constants';
import { calculateDamage } from './damage';
import { describeEffects } from './describe';
import { resolveEffect } from './effects';
import { pickWeighted } from './rng';
import type { CombatState, EnemyMove, EnemyState, GameData, MoveTag } from './types';
import { text } from './text';
import { addLog } from './util';

export type IntentKind = 'attack' | 'pull' | 'defend' | 'buff' | 'debuff';

/** What the UI shows above an enemy: icons plus the numbers they'll really deal. */
export interface IntentPreview {
  moveName: string;
  tag: MoveTag;
  description: string;
  kinds: IntentKind[];
  damage?: number;
  hits?: number;
  /** How hard it pulls on the line (before the player's Hold). */
  pull?: number;
  block?: number;
}

export function getIntentMove(enemy: EnemyState, data: GameData): EnemyMove | undefined {
  return data.enemies[enemy.defId]?.moves.find((m) => m.id === enemy.intent);
}

/** Decide (and store) the enemy's next move from its intent pattern. */
export function chooseIntent(state: CombatState, enemy: EnemyState, data: GameData): void {
  const pattern = data.enemies[enemy.defId].pattern;
  const history = enemy.moveHistory;

  if (pattern.type === 'sequence') {
    const loopFrom = pattern.loopFrom ?? 0;
    const n = history.length;
    const loopLength = pattern.moves.length - loopFrom;
    const index = n < pattern.moves.length ? n : loopFrom + ((n - loopFrom) % loopLength);
    enemy.intent = pattern.moves[index];
    return;
  }

  if (history.length === 0 && pattern.firstMove) {
    enemy.intent = pattern.firstMove;
    return;
  }
  const max = pattern.maxConsecutive ?? Infinity;
  const recent = history.slice(-max);
  const exhausted = (id: string) => recent.length >= max && recent.every((m) => m === id);
  let entries = Object.entries(pattern.weights).filter(([id, w]) => w > 0 && !exhausted(id));
  if (entries.length === 0) entries = Object.entries(pattern.weights);
  enemy.intent = pickWeighted(state, entries);
}

export function executeIntent(state: CombatState, enemy: EnemyState, data: GameData): void {
  const move = getIntentMove(enemy, data);
  if (!move) return;
  addLog(state, text('log.uses', { name: enemy.name, move: move.name }));
  for (const effect of move.effects) {
    resolveEffect(state, effect, { sourceId: enemy.id, targetId: PLAYER_ID });
    if (state.player.hp <= 0) break;
  }
  enemy.moveHistory.push(move.id);
}

export function previewIntent(state: CombatState, enemy: EnemyState, data: GameData): IntentPreview | null {
  const move = getIntentMove(enemy, data);
  if (!move) return null;
  const preview: IntentPreview = {
    moveName: move.name,
    tag: move.tag,
    description: describeEffects(move.effects, { byCreature: true }),
    kinds: [],
  };
  const addKind = (k: IntentKind) => {
    if (!preview.kinds.includes(k)) preview.kinds.push(k);
  };
  for (const effect of move.effects) {
    switch (effect.type) {
      case 'dealDamage':
        addKind('attack');
        preview.damage ??= calculateDamage(effect.amount, enemy.statuses, state.player.statuses);
        preview.hits ??= effect.hits ?? 1;
        break;
      case 'pull':
        addKind('pull');
        preview.pull = (preview.pull ?? 0) + effect.amount;
        break;
      case 'gainBlock':
        addKind('defend');
        preview.block = (preview.block ?? 0) + effect.amount;
        break;
      case 'applyStatus':
        addKind((effect.target ?? 'target') === 'self' && effect.amount > 0 ? 'buff' : 'debuff');
        break;
      case 'drawCards':
      case 'gainEnergy':
        addKind('buff');
        break;
    }
  }
  return preview;
}
