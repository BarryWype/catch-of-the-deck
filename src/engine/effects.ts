import { bonusTotal } from './companions';
import { ESCAPE_BAR_NAME, PLAYER_ID } from './constants';
import { applyDamage, calculateDamage, isStrongAgainst, tagsOf } from './damage';
import { drawCards } from './piles';
import { nextInt } from './rng';
import { addStatus, STATUS_META } from './statuses';
import type { Combatant, CombatState, CompanionTrigger, Effect, EffectTarget, EnemyState } from './types';
import { addLog } from './util';

export interface EffectContext {
  sourceId: string;
  /** The chosen target (an enemy for player cards, the player for enemy moves). */
  targetId?: string;
  /** Companion trigger effects: numbers are used as written, without Strength, Weak or bonuses. */
  raw?: boolean;
  /** Extra damage, in percent, on every hit (the first attack of a fight with `firstAttackDamage`). */
  damagePercent?: number;
}

export function getCombatant(state: CombatState, id: string): Combatant | undefined {
  return id === PLAYER_ID ? state.player : state.enemies.find((e) => e.id === id);
}

/** Still in the fight: not beaten down and, for a creature, its escape bar not pushed to 0. */
export function isAlive(combatant: Combatant): boolean {
  return combatant.hp > 0 && (!('escape' in combatant) || (combatant as EnemyState).escape > 0);
}

export function livingOpponents(state: CombatState, id: string): Combatant[] {
  return (id === PLAYER_ID ? state.enemies : [state.player]).filter(isAlive);
}

function resolveTargets(
  state: CombatState,
  target: EffectTarget,
  ctx: EffectContext,
  source: Combatant,
): Combatant[] {
  switch (target) {
    case 'self':
      return [source];
    case 'target': {
      const t = ctx.targetId === undefined ? undefined : getCombatant(state, ctx.targetId);
      return t && isAlive(t) ? [t] : [];
    }
    case 'allEnemies':
      return livingOpponents(state, source.id);
    case 'randomEnemy': {
      const options = livingOpponents(state, source.id);
      return options.length ? [options[nextInt(state, 0, options.length - 1)]] : [];
    }
  }
}

/** Apply one effect primitive. Mutates `state` (the engine's private working copy). */
export function resolveEffect(state: CombatState, effect: Effect, ctx: EffectContext): void {
  const source = getCombatant(state, ctx.sourceId);
  if (!source || !isAlive(source)) return;

  switch (effect.type) {
    case 'dealDamage': {
      const hits = effect.hits ?? 1;
      for (let i = 0; i < hits; i++) {
        for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
          const fromPlayer = source.id === PLAYER_ID;
          const companionBonus = fromPlayer && !ctx.raw ? bonusTotal(state.bonuses, 'bonusDamage') : 0;
          const base = effect.amount + companionBonus;
          let amount = ctx.raw ? base : calculateDamage(base, source.statuses, t.statuses, isStrongAgainst(effect.bonus, tagsOf(t)));
          if (ctx.damagePercent) amount = Math.floor((amount * (100 + ctx.damagePercent)) / 100);
          const enemyAttack = !fromPlayer && t.id === PLAYER_ID;
          if (enemyAttack && state.bonusTracker.dodged < bonusTotal(state.bonuses, 'dodgeAttacks')) {
            state.bonusTracker.dodged++;
            addLog(state, `${t.name} slips away from ${source.name}'s attack.`);
            continue;
          }
          const { blocked, hpLost } = applyDamage(t, amount);
          addLog(state, `${source.name} hit ${t.name} for ${hpLost}${blocked ? ` (${blocked} blocked)` : ''}.`);
          if (enemyAttack) afterEnemyHit(state, source.id, amount, hpLost);
        }
      }
      return;
    }
    case 'gainBlock': {
      const amount = effect.amount + (source.id === PLAYER_ID ? bonusTotal(state.bonuses, 'bonusBlock') : 0);
      source.block += amount;
      addLog(state, `${source.name} gained ${amount} Block.`);
      return;
    }
    case 'applyStatus':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        addStatus(t, effect.status, effect.amount);
        const verb = effect.amount >= 0 ? 'gained' : 'lost';
        addLog(state, `${t.name} ${verb} ${Math.abs(effect.amount)} ${STATUS_META[effect.status].name}.`);
      }
      return;
    case 'drawCards':
      if (source.id === PLAYER_ID) drawCards(state, effect.amount);
      return;
    case 'gainEnergy':
      if (source.id === PLAYER_ID) state.player.energy += effect.amount;
      return;
    case 'changeEscape':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        if (!('escape' in t)) continue;
        const enemy = t as EnemyState;
        const calming = source.id === PLAYER_ID && effect.amount < 0 && !ctx.raw;
        const pull = calming ? Math.ceil((-effect.amount * (state.pullPercent ?? 0)) / 100) : 0;
        const change = effect.amount - pull - (calming ? bonusTotal(state.bonuses, 'bonusEscapeReduction') : 0);
        enemy.escape = Math.max(0, Math.min(enemy.escapeAt, enemy.escape + change));
        addLog(state, `${enemy.name} ${change >= 0 ? 'panics' : 'calms down'} (${ESCAPE_BAR_NAME} ${enemy.escape}/${enemy.escapeAt}).`);
      }
      return;
    case 'changeEscapeRate':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        if (!('escape' in t)) continue;
        const enemy = t as EnemyState;
        enemy.escapeRate = Math.max(0, enemy.escapeRate + effect.amount);
        addLog(state, `${enemy.name}'s ${ESCAPE_BAR_NAME} now rises by ${enemy.escapeRate} a turn.`);
      }
      return;
  }
}

/** Triggers that fire during the enemies' turn: Block they give lasts into the player's next turn. */
const ENEMY_TURN_TRIGGERS: CompanionTrigger[] = ['hitByEnemy', 'fullBlock', 'firstBelowHalfHp'];

/** Resolve, as the player, every companion bonus triggered by `on`. `targetId` is who 'target' means. */
export function fireTriggers(state: CombatState, on: CompanionTrigger, targetId?: string): void {
  for (const bonus of state.bonuses) {
    if (bonus.type !== 'trigger' || bonus.on !== on) continue;
    const before = state.player.block;
    resolveEffect(state, bonus.effect, { sourceId: PLAYER_ID, targetId, raw: true });
    if (ENEMY_TURN_TRIGGERS.includes(on)) state.bonusTracker.carriedBlock += state.player.block - before;
  }
}

function afterEnemyHit(state: CombatState, attackerId: string, amount: number, hpLost: number): void {
  fireTriggers(state, 'hitByEnemy', attackerId);
  if (amount > 0 && hpLost === 0) fireTriggers(state, 'fullBlock', attackerId);
  if (hpLost > 0 && !state.bonusTracker.belowHalf && state.player.hp * 2 < state.player.maxHp) {
    state.bonusTracker.belowHalf = true;
    fireTriggers(state, 'firstBelowHalfHp');
  }
}
