import { bonusTotal } from './companions';
import {
  BURROW_PERCENT,
  MAX_JUNK_CARDS,
  MAX_MOVE_STRENGTH,
  MAX_PATIENCE,
  MAX_SLOW_PERCENT,
  PINCHED_HAND_HOLD,
  PLAYER_ID,
  SECOND_WIND_POINTS,
  SPINES_GRIT,
} from './constants';
import { applyDamage, calculateDamage } from './damage';
import { drawCards, reshuffleDiscardIntoDraw } from './piles';
import { reportEvent } from './report';
import { nextInt } from './rng';
import { addStatus, getStatus, statusName } from './statuses';
import { text } from './text';
import { traitOf } from './traits';
import type { Combatant, CombatState, CompanionTrigger, Effect, EffectTarget, EnemyMove, EnemyState, GameData, PerStatus, PowerId } from './types';
import { addLog } from './util';

export interface EffectContext {
  sourceId: string;
  /** The chosen target (an enemy for player cards, the player for enemy moves). */
  targetId?: string;
  /** Companion trigger effects: numbers are used as written, without Strength, Weak or bonuses. */
  raw?: boolean;
  /** Extra damage, in percent, on every hit (the first attack of a fight with `firstAttackDamage`). */
  damagePercent?: number;
  /** Health taken so far by this card's damage (`echoDamage` reads it). */
  dealt?: number;
  /** The game data, for effects that look at creatures' moves (`ifIntent`, `flipIntent`…). */
  data?: GameData;
  /** A creature's move at the fight's size (`EnemyState.damageScale`), before Strength and statuses. */
  amountScale?: number;
  /** A creature's move changed by its statuses (`nextMoveMods`): share of it that lands, and how much less its Strike deals. */
  moveScale?: number;
  strikeLess?: number;
  /** Strike damage of this move so far, before `moveScale` (so a multi-hit Strike is scaled in total). */
  struck?: number;
  /** Played from an attack (Attack or Drain card): this turn's attack bonuses apply. */
  attack?: boolean;
  /** Attacks played this turn before this card (`ifNoAttack`). */
  attacksBefore?: number;
  /** Resolved for a card (or what it left for later turns), not for a Power's or a companion's trigger. */
  fromCard?: boolean;
  /** The player's Tension before this card's cost (`ifTension`, `byTension`, `perTension`). */
  tension?: number;
}

/** A Power's number for this fight, added up over the copies played (0 when none). */
export function powerTotal(state: CombatState, power: PowerId): number {
  return (state.powers ?? []).reduce((sum, p) => (p.power === power ? sum + p.amount : sum), 0);
}

/** How many copies of a Power were played this fight. */
export function powerCount(state: CombatState, power: PowerId): number {
  return (state.powers ?? []).filter((p) => p.power === power).length;
}

/**
 * A combatant's Venom hits: its charges as damage (ignoring Block), or, on a creature under
 * Stings and Spines, drained from its escape bar. `loseCharge`: then one charge less.
 */
export function venomHits(state: CombatState, target: Combatant, loseCharge: boolean): void {
  const venom = getStatus(target, 'venom');
  if (venom <= 0) return;
  const stings = 'escape' in target ? powerTotal(state, 'stingsAndSpines') : 0;
  if (stings) {
    const enemy = target as EnemyState;
    const drain = Math.min(enemy.escape, venom * stings);
    enemy.escape -= drain;
    addLog(state, text('log.venomDrain', { who: enemy.name, n: drain }));
  } else {
    const damage = Math.min(target.hp, venom);
    target.hp -= damage;
    if (damage) addLog(state, text('log.venom', { who: target.name, n: damage }));
  }
  if (loseCharge) addStatus(target, 'venom', -1);
}

/** Envenomed Hooks: a hit of a card's damage or Drain also applies Venom. */
function hookWithVenom(state: CombatState, ctx: EffectContext, target: Combatant): void {
  const venom = ctx.fromCard ? powerTotal(state, 'envenomedHooks') : 0;
  if (venom <= 0 || !isAlive(target)) return;
  addStatus(target, 'venom', venom);
  addLog(state, text('log.statusGained', { who: target.name, n: venom, status: statusName('venom') }));
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
      // What this Strike did to the player, reported as one event however many hits land.
      let strikeBlocked = 0;
      let strikeHpLost = 0;
      // A played card's own damage, however many hits or targets it lands on.
      let playerHit = false;
      for (let i = 0; i < hits; i++) {
        for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
          const fromPlayer = source.id === PLAYER_ID;
          const companionBonus = fromPlayer && !ctx.raw ? bonusTotal(state.bonuses, 'bonusDamage') : 0;
          const venomBonus = ctx.attack && getStatus(t, 'venom') > 0 ? (state.thisTurn?.venomBonus ?? 0) : 0;
          // A creature's Strike at the fight's size, and a Hook-scarred one's bigger.
          const scarred = fromPlayer ? 100 : 100 + ((source as EnemyState).strikePercent ?? 0);
          const written = effect.fromHold ? state.player.block : effect.amount * (fromPlayer ? 1 : ((ctx.amountScale ?? 1) * scarred) / 100);
          const base = written + (effect.perTension ?? 0) * (ctx.tension ?? 0) + companionBonus + venomBonus + perStatusBonus(effect.perStatus, t);
          let amount = ctx.raw ? base : calculateDamage(base, source.statuses, t.statuses);
          if (ctx.damagePercent) amount = Math.floor((amount * (100 + ctx.damagePercent)) / 100);
          // Burrow: the player's attacks do less until the creature's next turn.
          if (fromPlayer && getStatus(t, 'burrowed') > 0) amount = Math.floor((amount * (100 - BURROW_PERCENT)) / 100);
          // Drifting: so do they while its next move is its pace.
          const guard = fromPlayer && 'escape' in t ? traitOf(t as EnemyState, ctx.data) : undefined;
          if (guard?.type === 'paceGuard' && ctx.data && intentMove(t as EnemyState, ctx.data)?.role === 'pace') amount = Math.floor((amount * (100 - guard.percent)) / 100);
          // Spines: every hit of an attack card pricks the player.
          if (fromPlayer && ctx.attack && getStatus(state.player, 'spines') > 0) {
            const pricked = Math.min(state.player.hp, SPINES_GRIT);
            state.player.hp -= pricked;
            if (pricked) addLog(state, text('log.spines', { who: state.player.name, n: pricked }));
          }
          const enemyAttack = !fromPlayer && t.id === PLAYER_ID;
          if (enemyAttack) amount = changedStrike(ctx, amount);
          if (enemyAttack && state.bonusTracker.dodged < bonusTotal(state.bonuses, 'dodgeAttacks')) {
            state.bonusTracker.dodged++;
            addLog(state, text('log.dodge', { who: t.name, attacker: source.name }));
            continue;
          }
          const { blocked, hpLost } = applyDamage(t, amount);
          ctx.dealt = (ctx.dealt ?? 0) + hpLost;
          if (enemyAttack) {
            strikeBlocked += blocked;
            strikeHpLost += hpLost;
          } else if (ctx.fromCard) {
            playerHit = true;
          }
          if (ctx.attack) coatWithVenom(state, t);
          if (fromPlayer) hookWithVenom(state, ctx, t);
          const params = { who: t.name, attacker: source.name, n: hpLost, soaked: blocked ? text('log.soaked', { n: blocked }) : '' };
          if (enemyAttack && !hpLost) addLog(state, text('log.held', params));
          else if (enemyAttack) addLog(state, text('log.wornDown', params));
          else addLog(state, text('log.hit', params));
          if (enemyAttack) afterEnemyHit(state, source.id, amount, hpLost, ctx.data);
          else if (fromPlayer && 'escape' in t) afterPlayerHit(state, t as EnemyState, amount, blocked, hpLost, ctx.data);
        }
      }
      if (strikeBlocked + strikeHpLost > 0) reportEvent({ kind: 'strike', blocked: strikeBlocked, hpLost: strikeHpLost });
      if (playerHit) reportEvent({ kind: 'hit' });
      return;
    }
    case 'gainBlock': {
      let amount = effect.amount + (source.id === PLAYER_ID ? bonusTotal(state.bonuses, 'bonusBlock') : 0);
      // Pinched Hand and Tangled Lines in hand: Hold cards give less.
      if (ctx.fromCard && ctx.data && source.id === PLAYER_ID) amount = Math.max(0, amount - holdTax(state, ctx.data));
      source.block += amount;
      addLog(state, text(source.id === PLAYER_ID ? 'log.gainHold' : 'log.gainBlock', { who: source.name, n: amount }));
      return;
    }
    case 'pull': {
      if (!('escape' in source)) return;
      const enemy = source as EnemyState;
      // Gooey Mess takes its share off first.
      let pull = Math.max(0, Math.floor(effect.amount * (ctx.amountScale ?? 1) * (ctx.moveScale ?? 1)) - powerTotal(state, 'gooeyMess'));
      // The fight's first Pull is smaller with `firstPullPercent`.
      const firstPull = bonusTotal(state.bonuses, 'firstPullPercent');
      if (firstPull && !state.bonusTracker.firstPullDone) {
        state.bonusTracker.firstPullDone = true;
        pull = Math.floor((pull * (100 - Math.min(100, firstPull))) / 100);
      }
      const held = Math.min(state.player.block, pull);
      state.player.block -= held;
      enemy.escape = Math.min(enemy.escapeAt, enemy.escape + pull - held);
      if (pull > 0) reportEvent({ kind: 'pull', blocked: held, raised: pull - held });
      const holding = held ? text('log.heldPart', { n: held }) : '';
      addLog(state, text('log.pulls', { name: enemy.name, held: holding, escape: enemy.escape, escapeAt: enemy.escapeAt }));
      return;
    }
    case 'applyStatus':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        let amount = effect.amount;
        // A creature's moves give it MAX_MOVE_STRENGTH Strength at most per fight.
        if (effect.status === 'strength' && amount > 0 && t === source && 'escape' in t) {
          const enemy = t as EnemyState;
          amount = Math.min(amount, MAX_MOVE_STRENGTH - (enemy.strengthGained ?? 0));
          if (amount <= 0) continue;
          enemy.strengthGained = (enemy.strengthGained ?? 0) + amount;
        }
        addStatus(t, effect.status, amount);
        // Toxic: Venom from this creature doesn't lose a charge the first time it hits.
        if (effect.status === 'venom' && t.id === PLAYER_ID && 'escape' in source && traitOf(source as EnemyState, ctx.data)?.type === 'lingeringVenom') state.venomLinger = true;
        // Skittish remembers whose Will the player's busy turn raises.
        if (effect.status === 'skittish' && 'escape' in source) (state.skittishFrom ??= []).push(source.id);
        const key = amount >= 0 ? 'log.statusGained' : 'log.statusLost';
        addLog(state, text(key, { who: t.name, n: Math.abs(amount), status: statusName(effect.status) }));
      }
      return;
    case 'drawCards':
      if (source.id === PLAYER_ID) drawCards(state, effect.amount);
      return;
    case 'gainEnergy':
      if (source.id === PLAYER_ID) state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + effect.amount);
      return;
    case 'loseHold': {
      const lost = Math.floor(state.player.block * effect.share);
      state.player.block -= lost;
      if (lost) addLog(state, text('log.loseHold', { who: state.player.name, n: lost }));
      return;
    }
    case 'patienceToHold': {
      const lost = state.player.patience;
      state.player.patience = 0;
      state.player.block += lost * effect.per;
      if (lost) addLog(state, text('log.patienceToHold', { who: state.player.name, n: lost, hold: lost * effect.per }));
      return;
    }
    case 'keepHold':
      state.keepHold = true;
      return;
    case 'ifNoAttack':
      for (const e of (ctx.attacksBefore ?? state.bonusTracker.attacksThisTurn) === 0 ? effect.then : (effect.else ?? [])) resolveEffect(state, e, ctx);
      return;
    case 'venomNow':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) venomHits(state, t, false);
      return;
    case 'power':
      (state.powers ??= []).push({ power: effect.power, amount: effect.amount ?? 1 });
      return;
    case 'swapHealthAndWill':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        if (!('escape' in t)) continue;
        const enemy = t as EnemyState;
        const health = enemy.hp / enemy.maxHp;
        const will = enemy.escape / enemy.escapeAt;
        enemy.hp = Math.floor(will * enemy.maxHp);
        enemy.escape = Math.floor(health * enemy.escapeAt);
        addLog(state, text('log.swap', { name: enemy.name, hp: enemy.hp, maxHp: enemy.maxHp, escape: enemy.escape, escapeAt: enemy.escapeAt }));
      }
      return;
    case 'coil':
      (state.thisTurn ??= {}).coiled = true;
      return;
    case 'venomBonus':
      (state.thisTurn ??= {}).venomBonus = (state.thisTurn.venomBonus ?? 0) + effect.amount;
      return;
    case 'venomCoating':
      (state.thisTurn ??= {}).venomCoating = (state.thisTurn.venomCoating ?? 0) + effect.amount;
      return;
    case 'ifStatus': {
      const target = ctx.targetId === undefined ? undefined : getCombatant(state, ctx.targetId);
      for (const e of target && getStatus(target, effect.status) > 0 ? effect.then : (effect.else ?? [])) resolveEffect(state, e, ctx);
      return;
    }
    case 'ifLastCard':
      for (const e of state.thisTurn?.lastCard === effect.cardType ? effect.then : (effect.else ?? [])) resolveEffect(state, e, ctx);
      return;
    case 'ifBelow': {
      const target = ctx.targetId === undefined ? undefined : getCombatant(state, ctx.targetId);
      const enemy = target && 'escape' in target ? (target as EnemyState) : undefined;
      const [value, max] = effect.bar === 'health' ? [target?.hp, target?.maxHp] : [enemy?.escape, enemy?.escapeAt];
      const below = value !== undefined && max !== undefined && value * effect.part < max;
      for (const e of below ? effect.then : (effect.else ?? [])) resolveEffect(state, e, ctx);
      return;
    }
    case 'ifTension': {
      const tension = ctx.tension ?? 0;
      const met = effect.tension === 'full' ? tension >= state.player.maxEnergy : tension === effect.tension;
      for (const e of met ? effect.then : (effect.else ?? [])) resolveEffect(state, e, ctx);
      return;
    }
    case 'byTension':
      for (const e of effect.effects[Math.min(ctx.tension ?? 0, effect.effects.length - 1)] ?? []) resolveEffect(state, e, ctx);
      return;
    case 'pickFromDraw': {
      if (source.id !== PLAYER_ID) return;
      const piles = state.piles;
      // As when drawing: the cards left come first, then the shuffled discard pile under them.
      if (piles.draw.length < effect.look && piles.discard.length) {
        const left = piles.draw.splice(0);
        reshuffleDiscardIntoDraw(state);
        piles.draw.push(...left);
      }
      const shown = piles.draw.slice(-effect.look).reverse();
      if (shown.length === 1) drawCards(state, 1);
      else if (shown.length) state.pick = shown.map((c) => c.uid);
      return;
    }
    case 'ifIntent': {
      const enemy = ctx.targetId === undefined ? undefined : getCombatant(state, ctx.targetId);
      const move = enemy && ctx.data && 'intent' in enemy ? intentMove(enemy as EnemyState, ctx.data) : undefined;
      for (const e of move?.tag === effect.tag ? effect.then : (effect.else ?? [])) resolveEffect(state, e, ctx);
      return;
    }
    case 'flipIntent':
    case 'rerollIntent':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        if (!('intent' in t) || !ctx.data) continue;
        const enemy = t as EnemyState;
        const current = intentMove(enemy, ctx.data);
        const moves = ctx.data.enemies[enemy.defId]?.moves ?? [];
        // A flip turns a Strike into a Pull and back. Heavy moves only come after a Wind-up.
        const other = current?.tag === 'strike' ? 'pull' : 'strike';
        const options = moves.filter((m) => m.id !== current?.id && m.role !== 'heavy' && (effect.type === 'rerollIntent' || m.tag === other));
        if (!options.length) continue;
        const move = options[nextInt(state, 0, options.length - 1)];
        enemy.intent = move.id;
        delete enemy.bluff;
        addLog(state, text('log.newIntent', { name: enemy.name, move: move.name }));
      }
      return;
    case 'delayMove':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        if (!('intent' in t) || !ctx.data) continue;
        const enemy = t as EnemyState;
        const pace = ctx.data.enemies[enemy.defId]?.moves.find((m) => m.role === 'pace');
        // A move is put off once: a second bait on the same creature changes nothing.
        if (!pace || enemy.intent === null || enemy.delayedIntent !== undefined) continue;
        enemy.delayedIntent = enemy.intent;
        enemy.intent = pace.id;
        enemy.intentHidden = false;
        delete enemy.bluff;
        addLog(state, text('log.delayMove', { name: enemy.name, move: pace.name }));
      }
      return;
    case 'holdFromIntent':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        if (!('intent' in t) || !ctx.data) continue;
        const move = intentMove(t as EnemyState, ctx.data);
        const hold = Math.min(effect.max, move ? moveValue(move, t as EnemyState, state.player) : 0);
        state.player.block += hold;
        if (hold) addLog(state, text('log.gainHold', { who: state.player.name, n: hold }));
      }
      return;
    case 'delayed':
      (state.delayed ??= []).push({ turnsLeft: effect.turns, effects: effect.effects, targetId: ctx.targetId, raw: ctx.raw });
      return;
    case 'echoDamage': {
      const amount = Math.floor((ctx.dealt ?? 0) * effect.share);
      if (amount > 0) (state.delayed ??= []).push({ turnsLeft: 1, effects: [{ type: 'dealDamage', amount }], targetId: ctx.targetId, raw: true });
      return;
    }
    case 'gainPatience': {
      const gained = Math.min(effect.amount, MAX_PATIENCE - state.player.patience);
      if (gained > 0) {
        state.player.patience += gained;
        addLog(state, text('log.gainPatience', { who: state.player.name, n: gained }));
      }
      return;
    }
    case 'heal':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        const healed = Math.min(effect.amount, t.maxHp - t.hp);
        t.hp += healed;
        if (healed) addLog(state, text('log.heal', { who: t.name, n: healed }));
      }
      return;
    case 'ink':
      if ('escape' in source) {
        const enemy = source as EnemyState;
        enemy.inked = true;
        // Ink Sense: it hides more than its next move.
        const ink = traitOf(enemy, ctx.data);
        if (ink?.type === 'inkMoves') enemy.inkLeft = ink.moves - 1;
      }
      return;
    case 'addJunk': {
      const piles = state.piles;
      const junk = [...piles.draw, ...piles.hand, ...piles.discard].filter((c) => ctx.data?.cards[c.defId]?.type === 'junk').length;
      if (junk >= MAX_JUNK_CARDS || !ctx.data?.cards[effect.card]) return;
      piles.discard.push({ uid: `junk${(state.junkAdded = (state.junkAdded ?? 0) + 1)}`, defId: effect.card });
      addLog(state, text('log.junk', { name: source.name, card: ctx.data.cards[effect.card].name }));
      return;
    }
    case 'stealPatience': {
      const lost = Math.min(effect.amount, state.player.patience);
      state.player.patience -= lost;
      if (lost) addLog(state, text('log.losePatience', { who: state.player.name, n: lost }));
      return;
    }
    case 'secondWind': {
      if (!('escape' in source)) return;
      const enemy = source as EnemyState;
      // Points move from the fuller bar into the emptier one, never emptying either.
      const points = Math.round(SECOND_WIND_POINTS * (enemy.fightScale ?? 1));
      if (enemy.hp / enemy.maxHp < enemy.escape / enemy.escapeAt) {
        const moved = Math.min(points, enemy.escape - 1, enemy.maxHp - enemy.hp);
        enemy.escape -= moved;
        enemy.hp += moved;
      } else {
        const moved = Math.min(points, enemy.hp - 1, enemy.escapeAt - 1 - enemy.escape);
        enemy.hp -= moved;
        enemy.escape += moved;
      }
      addLog(state, text('log.secondWind', { name: enemy.name, hp: enemy.hp, escape: enemy.escape, escapeAt: enemy.escapeAt }));
      return;
    }
    case 'healPercent':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        const healed = Math.min(Math.ceil((t.maxHp * effect.percent) / 100), t.maxHp - t.hp);
        t.hp += healed;
        if (healed) addLog(state, text('log.heal', { who: t.name, n: healed }));
      }
      return;
    case 'slowCap':
      if (effect.amount > (state.slowCap ?? MAX_SLOW_PERCENT)) {
        state.slowCap = effect.amount;
        addLog(state, text('log.slowCap', { n: effect.amount }));
      }
      return;
    case 'changeEscape': {
      // A played card's calming, reported as one event however many creatures it reaches.
      let calmed = false;
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        if (!('escape' in t)) continue;
        const enemy = t as EnemyState;
        const amount = (effect.fromHold ? -state.player.block : effect.amount) + perStatusBonus(effect.perStatus, enemy);
        const calming = source.id === PLAYER_ID && amount < 0 && !ctx.raw;
        const pull = calming ? Math.ceil((-amount * (state.pullPercent ?? 0)) / 100) : 0;
        let change = amount - pull - (calming ? bonusTotal(state.bonuses, 'bonusEscapeReduction') : 0);
        // Slippery: the player's first Drain on it each turn drains less.
        const slippery = source.id === PLAYER_ID && change < 0 ? traitOf(enemy, ctx.data) : undefined;
        if (slippery?.type === 'firstDrain' && !enemy.drainedThisTurn) {
          enemy.drainedThisTurn = true;
          change = -Math.ceil((-change * slippery.percent) / 100);
          addLog(state, text('log.trait', { name: enemy.name, trait: ctx.data!.enemies[enemy.defId].trait!.name }));
        }
        const before = enemy.escape;
        enemy.escape = Math.max(0, Math.min(enemy.escapeAt, enemy.escape + change));
        if (ctx.attack && change < 0) coatWithVenom(state, enemy);
        if (source.id === PLAYER_ID && change < 0) hookWithVenom(state, ctx, enemy);
        if (enemy.escape < before) calmed = true;
        addLog(state, text(change >= 0 ? 'log.panics' : 'log.calms', { name: enemy.name, escape: enemy.escape, escapeAt: enemy.escapeAt }));
      }
      if (calmed) reportEvent({ kind: 'drain' });
      return;
    }
    case 'multiplyStatus':
      for (const t of resolveTargets(state, effect.target ?? 'target', ctx, source)) {
        const stacks = getStatus(t, effect.status);
        const added = Math.min(stacks * (effect.factor - 1), effect.max ?? Infinity);
        if (added <= 0) continue;
        addStatus(t, effect.status, added);
        addLog(state, text('log.statusGained', { who: t.name, n: added, status: statusName(effect.status) }));
      }
      return;
  }
}

/** A creature's Strike hit, changed by its statuses (`ctx.moveScale`, `ctx.strikeLess`): scaled in total, rounded down. */
function changedStrike(ctx: EffectContext, amount: number): number {
  const before = ctx.struck ?? 0;
  ctx.struck = before + amount;
  const scale = ctx.moveScale ?? 1;
  let hit = Math.floor(ctx.struck * scale) - Math.floor(before * scale);
  const less = Math.min(ctx.strikeLess ?? 0, hit);
  ctx.strikeLess = (ctx.strikeLess ?? 0) - less;
  hit -= less;
  return hit;
}

/** Toxic Coating: a hit of an attack this turn also applies Venom. */
function coatWithVenom(state: CombatState, target: Combatant): void {
  const venom = state.thisTurn?.venomCoating ?? 0;
  if (venom <= 0 || !isAlive(target)) return;
  addStatus(target, 'venom', venom);
  addLog(state, text('log.statusGained', { who: target.name, n: venom, status: statusName('venom') }));
}

/** Coiled: an effect with its numbers doubled (inner effects included). */
export function doubled(effect: Effect): Effect {
  const e = { ...effect } as Effect & {
    amount?: number;
    perStatus?: PerStatus;
    perTension?: number;
    then?: Effect[];
    else?: Effect[];
    effects?: Effect[] | Effect[][];
  };
  if (typeof e.amount === 'number') e.amount *= 2;
  if (e.perStatus) e.perStatus = { ...e.perStatus, amount: e.perStatus.amount * 2 };
  if (e.perTension) e.perTension *= 2;
  if (e.then) e.then = e.then.map(doubled);
  if (e.else) e.else = e.else.map(doubled);
  if (e.type === 'byTension') e.effects = e.effects.map((list) => list.map(doubled));
  else if (e.effects) e.effects = (e.effects as Effect[]).map(doubled);
  return e;
}

/** The creature's next move. */
function intentMove(enemy: EnemyState, data: GameData): EnemyMove | undefined {
  return data.enemies[enemy.defId]?.moves.find((m) => m.id === enemy.intent);
}

/**
 * What a move is worth: its total Strike damage or its Pull; 0 otherwise. As written (its
 * intensity), or, given the creature and the player, as it would land in this fight (rounded down).
 */
export function moveValue(move: EnemyMove, enemy?: EnemyState, player?: Combatant): number {
  const scale = enemy?.damageScale ?? 1;
  const value = move.effects.reduce((sum, e) => {
    if (e.type === 'dealDamage') return sum + (enemy && player ? calculateDamage((e.amount * scale * (100 + (enemy.strikePercent ?? 0))) / 100, enemy.statuses, player.statuses) : e.amount) * (e.hits ?? 1);
    if (e.type === 'pull') return sum + e.amount * (enemy ? scale : 1);
    return sum;
  }, 0);
  return enemy ? Math.floor(value) : value;
}

/** How much less Hold a Hold card gives right now: Pinched Hand, and each Tangled Line in hand. */
export function holdTax(state: CombatState, data: GameData): number {
  const lines = state.piles.hand.reduce((sum, c) => sum + (data.cards[c.defId]?.inHand?.holdLess ?? 0), 0);
  return (getStatus(state.player, 'pinchedHand') > 0 ? PINCHED_HAND_HOLD : 0) + lines;
}

/** An effect's extra amount from its target's stacks of a status (`perStatus`). */
function perStatusBonus(per: PerStatus | undefined, target: Combatant): number {
  return per ? per.amount * getStatus(target, per.status) : 0;
}

/** Triggers that fire during the enemies' turn: Block they give lasts into the player's next turn. */
const ENEMY_TURN_TRIGGERS: CompanionTrigger[] = ['hitByEnemy', 'fullBlock', 'firstBelowHalfHp'];

/** Resolve, as the player, every companion bonus triggered by `on`. `targetId` is who 'target' means. */
export function fireTriggers(state: CombatState, on: CompanionTrigger, targetId?: string, data?: GameData): void {
  for (const bonus of state.bonuses) {
    if (bonus.type !== 'trigger' || bonus.on !== on) continue;
    const before = state.player.block;
    resolveEffect(state, bonus.effect, { sourceId: PLAYER_ID, targetId, raw: true, data });
    if (ENEMY_TURN_TRIGGERS.includes(on)) state.bonusTracker.carriedBlock += state.player.block - before;
  }
}

function afterEnemyHit(state: CombatState, attackerId: string, amount: number, hpLost: number, data?: GameData): void {
  fireTriggers(state, 'hitByEnemy', attackerId, data);
  if (amount > 0 && hpLost === 0) fireTriggers(state, 'fullBlock', attackerId, data);
  if (hpLost > 0 && !state.bonusTracker.belowHalf && state.player.hp * 2 < state.player.maxHp) {
    state.bonusTracker.belowHalf = true;
    fireTriggers(state, 'firstBelowHalfHp', undefined, data);
  }
  // Bloodlust: creatures that sense the player weakening.
  if (hpLost <= 0) return;
  for (const enemy of state.enemies) {
    const rule = traitOf(enemy, data);
    if (rule?.type !== 'playerBelow' || enemy.traitUsed || !isAlive(enemy) || state.player.hp * 100 >= state.player.maxHp * rule.percent) continue;
    enemy.traitUsed = true;
    addLog(state, text('log.trait', { name: enemy.name, trait: data!.enemies[enemy.defId].trait!.name }));
    resolveEffect(state, rule.effect, { sourceId: enemy.id, targetId: PLAYER_ID, data });
  }
}

/** A hit of the player's on a creature, for its trait: Inflate counts it, Counter-pinch answers a soaked one, Scatter watches its Health. */
function afterPlayerHit(state: CombatState, enemy: EnemyState, amount: number, blocked: number, hpLost: number, data?: GameData): void {
  const rule = traitOf(enemy, data);
  if (!rule) return;
  const name = data!.enemies[enemy.defId].trait!.name;
  if (rule.type === 'afterHits') {
    enemy.hitsThisTurn = (enemy.hitsThisTurn ?? 0) + 1;
    if (enemy.hitsThisTurn === rule.hits && isAlive(enemy)) {
      addLog(state, text('log.trait', { name: enemy.name, trait: name }));
      resolveEffect(state, rule.effect, { sourceId: enemy.id, targetId: PLAYER_ID, data });
    }
  }
  if (rule.type === 'counter' && amount > 0 && blocked > 0 && hpLost === 0 && isAlive(enemy)) {
    const { hpLost: lost } = applyDamage(state.player, rule.damage);
    addLog(state, text('log.counter', { name: enemy.name, trait: name, n: lost }));
  }
  if (rule.type === 'belowHealth' && !enemy.traitUsed && isAlive(enemy) && enemy.hp * 100 < enemy.maxHp * rule.percent) {
    enemy.traitUsed = true;
    enemy.escape = Math.min(enemy.escapeAt, enemy.escape + Math.round(rule.will * (enemy.fightScale ?? 1)));
    addLog(state, text('log.trait', { name: enemy.name, trait: name }));
  }
}
