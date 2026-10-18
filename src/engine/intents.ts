import { MOVE_INTENSITY, PLAYER_ID, SECOND_WIND_PERCENT } from './constants';
import { calculateDamage } from './damage';
import { describeEffects } from './describe';
import { resolveEffect } from './effects';
import { pickWeighted } from './rng';
import { nextMoveMods, statusDescription, statusName } from './statuses';
import type { CombatState, Effect, EnemyMove, EnemyState, GameData, IntentPattern, MoveIntensity, MoveRole, MoveTag } from './types';
import { text } from './text';
import { addLog } from './util';

export type IntentKind = 'attack' | 'pull' | 'defend' | 'buff' | 'debuff';

/** What the UI shows above an enemy: icons plus the numbers they'll really deal. */
export interface IntentPreview {
  moveName: string;
  /** Strike or Pull; `secondWind` for a mini-boss's or boss's Second Wind. */
  tag: MoveTag | 'secondWind';
  role?: MoveRole;
  /** What its special does (`intent.special.<key>` in the UI), with the name of the junk card it adds, if any. */
  special?: { key: string; card?: string };
  /** Hidden by Ink: shown as "?", with no numbers. */
  hidden?: boolean;
  description: string;
  kinds: IntentKind[];
  damage?: number;
  hits?: number;
  /** How hard it pulls on the line (before the player's Hold). */
  pull?: number;
  block?: number;
  /** What the green arrow (Block and its own buffs) and the red arrow (debuffs) do, for their chips' tooltips. */
  buffText?: string;
  debuffText?: string;
  /** How hard the move is: one to three pips next to the badge's value. Display-only. */
  intensity?: MoveIntensity;
}

/** A mini-boss's or boss's Second Wind: not in its move set, telegraphed once (`telegraphSecondWind`). */
export const SECOND_WIND_ID = 'secondWind';
function secondWindMove(): EnemyMove {
  return { id: SECOND_WIND_ID, name: text('move.secondWind'), tag: 'pull', intensity: 'light', effects: [{ type: 'secondWind' }] };
}

export function getIntentMove(enemy: EnemyState, data: GameData): EnemyMove | undefined {
  if (enemy.intent === SECOND_WIND_ID) return secondWindMove();
  return data.enemies[enemy.defId]?.moves.find((m) => m.id === enemy.intent);
}

/** The pattern a creature follows in this fight: its `bossPattern` as a mini-boss or boss. */
export function patternOf(enemy: EnemyState, data: GameData): IntentPattern {
  const def = data.enemies[enemy.defId];
  return (enemy.boss && def.bossPattern) || def.pattern;
}

/**
 * A mini-boss or boss whose Health or Will has dropped below `SECOND_WIND_PERCENT` shows its
 * Second Wind as its next move, once per fight. True if it did. A Will that starts that low
 * only counts once the player has pushed it below where it started.
 */
export function telegraphSecondWind(enemy: EnemyState, data: GameData): boolean {
  if (!enemy.boss || enemy.secondWindUsed || enemy.hp <= 0 || enemy.escape <= 0) return false;
  const low = (value: number, max: number) => value * 100 < max * SECOND_WIND_PERCENT;
  const willDropped = low(enemy.escape, enemy.escapeAt) && enemy.escape < (data.enemies[enemy.defId]?.escapeStart ?? 0);
  if (!low(enemy.hp, enemy.maxHp) && !willDropped) return false;
  enemy.secondWindUsed = true;
  enemy.intent = SECOND_WIND_ID;
  enemy.intentHidden = false;
  return true;
}

/**
 * Decide (and store) the enemy's next move from its intent pattern. A Wind-up is always followed
 * by its heavy move; in a weighted pattern, heavy moves come only that way, a special never
 * follows a special, and a Wind-up never follows Ink.
 */
export function chooseIntent(state: CombatState, enemy: EnemyState, data: GameData): void {
  enemy.intentHidden = !!enemy.inked;
  enemy.inked = false;
  if (telegraphSecondWind(enemy, data)) return;
  const moves = data.enemies[enemy.defId].moves;
  const pattern = patternOf(enemy, data);
  const history = enemy.moveHistory;

  if (pattern.type === 'sequence') {
    const loopFrom = pattern.loopFrom ?? 0;
    const n = history.length;
    const loopLength = pattern.moves.length - loopFrom;
    const index = n < pattern.moves.length ? n : loopFrom + ((n - loopFrom) % loopLength);
    enemy.intent = pattern.moves[index];
    return;
  }

  const last = moves.find((m) => m.id === history[history.length - 1]);
  if (last?.role === 'windUp' && last.followUp) {
    enemy.intent = last.followUp;
    return;
  }
  if (history.length === 0 && pattern.firstMove) {
    enemy.intent = pattern.firstMove;
    return;
  }
  const max = pattern.maxConsecutive ?? Infinity;
  const recent = history.slice(-max);
  const allowed = (id: string) => {
    const move = moves.find((m) => m.id === id);
    if (!move || move.role === 'heavy') return false;
    if (last?.role === 'special' && move.role === 'special') return false;
    if (last?.effects.some((e) => e.type === 'ink') && move.role === 'windUp') return false;
    return !(recent.length >= max && recent.every((m) => m === id));
  };
  let entries = Object.entries(pattern.weights).filter(([id, w]) => w > 0 && allowed(id));
  if (entries.length === 0) entries = Object.entries(pattern.weights).filter(([, w]) => w > 0);
  enemy.intent = pickWeighted(state, entries);
}

/** How much bigger a move is than usual: its statuses (`nextMoveMods`), and a heavy Shake the Hook when the player has no Hold. */
function moveMods(state: CombatState, enemy: EnemyState, move: EnemyMove) {
  const mods = nextMoveMods(enemy, move);
  const shake = state.player.block === 0 && move.effects.some((e) => e.type === 'pull' && e.heavyIfNoHold);
  return { ...mods, scale: shake ? (mods.scale * MOVE_INTENSITY.heavy) / MOVE_INTENSITY[move.intensity] : mods.scale };
}

export function executeIntent(state: CombatState, enemy: EnemyState, data: GameData): void {
  const move = getIntentMove(enemy, data);
  if (!move) return;
  enemy.intentHidden = false;
  addLog(state, text('log.uses', { name: enemy.name, move: move.name }));
  // Statuses the player put on it change this move, and are used up by it.
  const mods = moveMods(state, enemy, move);
  for (const id of mods.used) delete enemy.statuses[id];
  const ctx = { sourceId: enemy.id, targetId: PLAYER_ID, amountScale: enemy.damageScale ?? 1, moveScale: mods.scale, strikeLess: mods.less, data };
  for (const effect of move.effects) {
    resolveEffect(state, effect, ctx);
    if (state.player.hp <= 0) break;
  }
  // A mini-boss's or boss's Wind-up also makes it stronger.
  if (move.role === 'windUp' && enemy.boss) resolveEffect(state, { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' }, ctx);
  if (move.id !== SECOND_WIND_ID) enemy.moveHistory.push(move.id);
}

/** The move's effects with its Strikes and Pulls at this fight's size (`damageScale`), for its description. */
function scaledEffects(move: EnemyMove, enemy: EnemyState): Effect[] {
  const scale = enemy.damageScale ?? 1;
  return move.effects.map((e) => (e.type === 'dealDamage' || e.type === 'pull' ? { ...e, amount: Math.floor(e.amount * scale) } : e));
}

/** What a special move does, for its icon and tooltip. */
function specialOf(move: EnemyMove, data: GameData): IntentPreview['special'] {
  for (const e of move.effects) {
    if (e.type === 'ink') return { key: 'ink' };
    if (e.type === 'addJunk') return { key: 'junk', card: data.cards[e.card]?.name ?? e.card };
    if (e.type === 'stealPatience') return { key: 'steal' };
    if (e.type === 'secondWind') return { key: 'secondWind' };
    if (e.type === 'pull' && e.heavyIfNoHold) return { key: 'shake' };
    if (e.type === 'applyStatus' && move.role === 'special') return { key: e.status };
  }
  return undefined;
}

export function previewIntent(state: CombatState, enemy: EnemyState, data: GameData): IntentPreview | null {
  const move = getIntentMove(enemy, data);
  if (!move) return null;
  if (enemy.intentHidden) return { moveName: '?', tag: move.tag, hidden: true, description: '', kinds: [] };
  const preview: IntentPreview = {
    moveName: move.name,
    tag: move.id === SECOND_WIND_ID ? 'secondWind' : move.tag,
    role: move.role,
    special: specialOf(move, data),
    intensity: move.intensity,
    description: describeEffects(scaledEffects(move, enemy), { byCreature: true }),
    kinds: [],
  };
  const arrowEffects: { buff: Effect[]; debuff: Effect[] } = { buff: [], debuff: [] };
  const addKind = (k: IntentKind, effect?: Effect) => {
    if (!preview.kinds.includes(k)) preview.kinds.push(k);
    if (effect && k !== 'attack' && k !== 'pull') arrowEffects[k === 'debuff' ? 'debuff' : 'buff'].push(effect);
  };
  const { scale, less } = moveMods(state, enemy, move);
  const size = enemy.damageScale ?? 1;
  for (const effect of move.effects) {
    switch (effect.type) {
      case 'dealDamage':
        addKind('attack');
        preview.damage ??= Math.max(0, Math.floor(calculateDamage(effect.amount * size, enemy.statuses, state.player.statuses) * scale) - less);
        preview.hits ??= effect.hits ?? 1;
        break;
      case 'pull':
        addKind('pull');
        preview.pull = (preview.pull ?? 0) + Math.floor(effect.amount * size * scale);
        break;
      case 'gainBlock':
        addKind('defend', effect);
        preview.block = (preview.block ?? 0) + effect.amount;
        break;
      case 'applyStatus':
        // A Wind-up's own status, and a special's, are already its icon.
        if (effect.status !== 'windUp' && move.role !== 'special') addKind((effect.target ?? 'target') === 'self' && effect.amount > 0 ? 'buff' : 'debuff', effect);
        break;
      case 'healPercent':
      case 'ink':
      case 'addJunk':
      case 'stealPatience':
      case 'secondWind':
        break;
      case 'drawCards':
      case 'gainEnergy':
      case 'slowCap':
      case 'gainPatience':
      case 'heal':
      case 'multiplyStatus':
      case 'loseHold':
      case 'patienceToHold':
      case 'keepHold':
      case 'delayed':
      case 'echoDamage':
      case 'ifIntent':
      case 'ifStatus':
      case 'ifNoAttack':
      case 'coil':
      case 'venomNow':
      case 'power':
      case 'swapHealthAndWill':
      case 'venomBonus':
      case 'venomCoating':
      case 'flipIntent':
      case 'rerollIntent':
      case 'holdFromIntent':
        addKind('buff', effect);
        break;
    }
  }
  // The effects, then what each status they give does.
  const arrowText = (effects: Effect[]) => {
    const statuses = effects.flatMap((e) => (e.type === 'applyStatus' ? [`${statusName(e.status)}: ${statusDescription(e.status)}`] : []));
    return effects.length ? [describeEffects(effects, { byCreature: true }), ...statuses].join(' ') : undefined;
  };
  preview.buffText = arrowText(arrowEffects.buff);
  preview.debuffText = arrowText(arrowEffects.debuff);
  return preview;
}
