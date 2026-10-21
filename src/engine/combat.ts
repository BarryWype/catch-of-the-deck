import { bonusTotal } from './companions';
import {
  BASE_ENERGY,
  ENCOUNTER_TURN_AVERAGE,
  HOLD_PER_PATIENCE,
  MAX_PATIENCE,
  MOVE_INTENSITY,
  OWN_STATS_MAX_PERCENT,
  OWN_STATS_MIN_PERCENT,
  PACE_WILL_PERCENT,
  PLAYER_ID,
  SKITTISH_CARDS,
  SKITTISH_WILL,
  STARTING_HAND_SIZE,
  TAX_COST,
  TROPHY_POOL_PERCENT,
  WIND_UP_PERCENT,
} from './constants';
import { hasFeature } from './features';
import { text } from './text';
import { equipmentEffects, escapeRateReduction } from './equipment';
import { doubled, fireTriggers, isAlive, moveValue, powerCount, powerTotal, resolveEffect, venomHits } from './effects';
import { chooseIntent, executeIntent, getIntentMove, patternOf, telegraphSecondWind } from './intents';
import { discardHand, drawCards } from './piles';
import { nextInt, shuffleInPlace } from './rng';
import { takeReport } from './report';
import { escapeRise, getStatus, tickStatuses } from './statuses';
import type { CardDef, Combatant, CombatAction, CombatState, CompanionEffect, Effect, EnemyMove, EnemyState, GameData, IntentPattern, StatusId } from './types';
import { addLog, clone } from './util';

export interface CombatConfig {
  seed: number;
  /** Card definition ids. */
  deck: string[];
  /** Enemy definition ids. */
  enemies: string[];
  playerHp: number;
  playerMaxHp: number;
  /** Equipment ids carried into the fight. */
  equipment?: string[];
  /** Companion bonuses, already scaled (`companionEffects`). */
  bonuses?: CompanionEffect[];
  /** The least Health the creatures have together (raised in proportion when they roll less). */
  hpPool?: number;
  /** The least Will the creatures start with together: their bars (start, top and rise) are raised in proportion when they start lower. */
  willPool?: number;
  /** What each creature deals per turn on average: its moves are scaled to it (`turnAverage`). */
  damage?: number;
  /** A mini-boss or boss fight: the creatures follow their `bossPattern`, their Wind-ups also give Strength, and they have a Second Wind. */
  bosses?: boolean;
  /** A card (id) that starts in hand, free to play this fight (an event's `freeNextFight`). */
  freeCard?: string;
  /** Cards (ids) that start in hand, for this fight only (`baitChance` gear). */
  extraCards?: string[];
  /** A trophy fight: Health and Will `TROPHY_POOL_PERCENT` bigger after the pools, and 1 Strength (`damage` is already bigger). */
  trophy?: boolean;
}

export function createCombat(config: CombatConfig, data: GameData): CombatState {
  const state: CombatState = {
    seed: config.seed,
    rng: config.seed | 0,
    turn: 0,
    phase: 'playerTurn',
    player: {
      id: PLAYER_ID,
      name: data.character.name,
      hp: config.playerHp,
      maxHp: config.playerMaxHp,
      block: 0,
      statuses: {},
      energy: 0,
      maxEnergy: BASE_ENERGY,
      patience: 0,
    },
    enemies: [],
    piles: {
      draw: config.deck.map((defId, i) => ({ uid: `c${i}`, defId })),
      hand: [],
      discard: [],
      exhaust: [],
    },
    log: [],
    bonuses: config.bonuses ?? [],
    bonusTracker: { attacksThisTurn: 0, attacksThisFight: 0, dodged: 0, belowHalf: false, carriedBlock: 0 },
  };

  config.enemies.forEach((defId, i) => {
    const def = data.enemies[defId];
    if (!def) throw new Error(`Unknown enemy "${defId}"`);
    const maxHp = nextInt(state, def.hp[0], def.hp[1]);
    state.enemies.push({
      id: `e${i}`,
      defId,
      tags: [...(def.tags ?? [])],
      name: def.name,
      hp: maxHp,
      maxHp,
      block: 0,
      statuses: { ...def.startingStatuses },
      intent: null,
      moveHistory: [],
      escape: def.escapeStart,
      escapeAt: def.escapeAt,
      escapeRate: def.escapeRate,
      ...(config.bosses ? { boss: true } : {}),
    });
  });

  // Creatures' own stats: each one scaled from its tier's average to its share of the pools, its spread kept within bounds.
  const averages = hasFeature(data, 'ownStats') && !config.bosses ? data.tierAverages : undefined;
  const average = (enemy: EnemyState) => averages?.[data.enemies[enemy.defId].tier ?? 1];
  const ownShare = (value: number, share: number) => Math.min((share * OWN_STATS_MAX_PERCENT) / 100, Math.max((share * OWN_STATS_MIN_PERCENT) / 100, value));
  const rolled = state.enemies.reduce((sum, e) => sum + e.maxHp, 0);
  if (averages) {
    for (const enemy of state.enemies) {
      const tier = average(enemy);
      if (!tier) continue;
      if (config.hpPool) {
        const share = config.hpPool / state.enemies.length;
        enemy.hp = enemy.maxHp = Math.ceil(ownShare((enemy.maxHp * share) / tier.hp, share));
      }
      if (config.willPool && enemy.escape > 0) {
        const share = config.willPool / state.enemies.length;
        const factor = ownShare((enemy.escape * share) / tier.will, share) / enemy.escape;
        enemy.escape = Math.round(enemy.escape * factor);
        enemy.escapeAt = Math.round(enemy.escapeAt * factor);
        enemy.escapeRate = Math.round(enemy.escapeRate * factor);
      }
    }
  } else {
    if (config.hpPool && rolled > 0 && rolled < config.hpPool) {
      for (const enemy of state.enemies) enemy.hp = enemy.maxHp = Math.ceil((enemy.maxHp * config.hpPool) / rolled);
    }
    const will = state.enemies.reduce((sum, e) => sum + e.escape, 0);
    if (config.willPool && will > 0 && will < config.willPool) {
      for (const enemy of state.enemies) {
        enemy.escape = Math.round((enemy.escape * config.willPool) / will);
        enemy.escapeAt = Math.round((enemy.escapeAt * config.willPool) / will);
        enemy.escapeRate = Math.round((enemy.escapeRate * config.willPool) / will);
      }
    }
  }
  if (config.trophy) {
    for (const enemy of state.enemies) {
      const bigger = (n: number) => Math.round((n * TROPHY_POOL_PERCENT) / 100);
      enemy.hp = enemy.maxHp = bigger(enemy.maxHp);
      enemy.escape = bigger(enemy.escape);
      enemy.escapeAt = bigger(enemy.escapeAt);
      enemy.escapeRate = bigger(enemy.escapeRate);
      enemy.trophy = true;
      enemy.statuses.strength = (enemy.statuses.strength ?? 0) + 1;
    }
  }
  if (config.damage) {
    for (const enemy of state.enemies) {
      const moves = turnAverage(data.enemies[enemy.defId].moves, patternOf(enemy, data));
      // Its own stats: its moves keep their size against its tier's average, within bounds.
      const tier = average(enemy);
      const dealt = tier?.turnAverage ? ownShare((moves * config.damage) / tier.turnAverage, config.damage) : config.damage;
      if (moves > 0) enemy.damageScale = dealt / moves;
      enemy.fightScale = config.damage / ENCOUNTER_TURN_AVERAGE;
    }
  }

  for (const effect of equipmentEffects(config.equipment ?? [], data)) {
    if (effect.type !== 'slowEscape') continue;
    for (const enemy of state.enemies) enemy.escapeRate -= escapeRateReduction(enemy.escapeRate, effect.percent);
  }
  const pull = equipmentEffects(config.equipment ?? [], data).reduce((sum, e) => (e.type === 'strongerPull' ? sum + e.percent : sum), 0);
  if (pull) state.pullPercent = pull;
  const companionSlow = bonusTotal(state.bonuses, 'slowEscape');
  if (companionSlow) {
    for (const enemy of state.enemies) enemy.escapeRate -= escapeRateReduction(enemy.escapeRate, companionSlow);
  }

  shuffleInPlace(state, state.piles.draw);
  if (config.freeCard) {
    state.piles.hand.push({ uid: 'free0', defId: config.freeCard });
    state.freeCards = ['free0'];
  }
  config.extraCards?.forEach((defId, i) => state.piles.hand.push({ uid: `x${i}`, defId }));
  for (const enemy of state.enemies) chooseIntent(state, enemy, data);
  startPlayerTurn(state, data);
  fireTriggers(state, 'combatStart');
  checkCombatEnd(state);
  return state;
}

/** Returns a reason the action is illegal, or null if it can be applied. */
export function validateAction(state: CombatState, action: CombatAction, data: GameData): string | null {
  if (state.phase !== 'playerTurn') return text('invalid.over');
  // Cards shown by `pickFromDraw`: one goes in hand before anything else happens.
  if (state.pick) return action.type === 'pickCard' && state.pick.includes(action.cardUid) ? null : text('invalid.pickFirst');
  if (action.type === 'pickCard') return text('invalid.noPick');
  if (action.type === 'endTurn') return null;

  const card = state.piles.hand.find((c) => c.uid === action.cardUid);
  if (!card) return text('invalid.notInHand');
  const def = data.cards[card.defId];
  if (!def) return `Unknown card "${card.defId}".`;
  if (def.unplayable) return text('invalid.unplayable');
  if (cardCost(state, def, card.uid) > state.player.energy) return text('invalid.noEnergy');
  if ((def.patienceCost ?? 0) > state.player.patience) return text('invalid.noPatience');
  if (def.target === 'enemy') {
    const target = state.enemies.find((e) => e.id === action.targetId);
    if (!target || !isAlive(target)) return text('invalid.chooseTarget');
  }
  return null;
}

/** Attack and Drain cards count as attacks (`firstAttackEachTurn`, "if you haven't played an attack this turn"…). */
export function isAttackCard(def: CardDef): boolean {
  return def.type === 'attack' || def.type === 'drain';
}

/** A random creature still in the fight, for cards played on a random creature. */
function randomLivingEnemy(state: CombatState): EnemyState | undefined {
  const living = state.enemies.filter(isAlive);
  return living.length ? living[nextInt(state, 0, living.length - 1)] : undefined;
}

/** Can this card in hand be played right now (ignoring target choice)? */
export function isCardPlayable(state: CombatState, cardUid: string, data: GameData): boolean {
  if (state.phase !== 'playerTurn') return false;
  const card = state.piles.hand.find((c) => c.uid === cardUid);
  const def = card && data.cards[card.defId];
  return !!def && !state.pick && !def.unplayable && cardCost(state, def, cardUid) <= state.player.energy && (def.patienceCost ?? 0) <= state.player.patience;
}

/** A card's energy cost right now: Numb Fingers makes Attack cards cost more, Tangled Drain cards. A free card (`uid` in `freeCards`) costs nothing. */
export function cardCost(state: CombatState, def: CardDef, uid?: string): number {
  if (uid && state.freeCards?.includes(uid)) return 0;
  const has = (id: StatusId) => getStatus(state.player, id) > 0;
  return def.cost + ((def.type === 'attack' && has('numbFingers')) || (def.type === 'drain' && has('tangled')) ? TAX_COST : 0);
}

/**
 * A creature's average Strike or Pull per turn as written (its moves' intensities), over its moves
 * as often as its pattern plays them: each Wind-up is followed by its heavy move, played heavy and
 * `WIND_UP_PERCENT` bigger. The fight scales it to its damage (`damageScale`).
 */
export function turnAverage(moves: EnemyMove[], pattern: IntentPattern): number {
  const byId = (id: string | undefined) => moves.find((m) => m.id === id);
  const heavy = (move: EnemyMove) => ((moveValue(move) * MOVE_INTENSITY.heavy) / MOVE_INTENSITY[move.intensity]) * (1 + WIND_UP_PERCENT / 100);
  const turns: { weight: number; value: number }[] = [];
  if (pattern.type === 'sequence') {
    pattern.moves.forEach((id, i) => {
      const move = byId(id);
      if (!move) return;
      const prev = byId(pattern.moves[(i + pattern.moves.length - 1) % pattern.moves.length]);
      turns.push({ weight: 1, value: prev?.role === 'windUp' ? heavy(move) : moveValue(move) });
    });
  } else {
    for (const [id, weight] of Object.entries(pattern.weights)) {
      const move = byId(id);
      if (!move || weight <= 0) continue;
      turns.push({ weight, value: moveValue(move) });
      const follow = move.role === 'windUp' ? byId(move.followUp) : undefined;
      if (follow) turns.push({ weight, value: heavy(follow) });
    }
  }
  const total = turns.reduce((sum, t) => sum + t.weight, 0);
  return total ? turns.reduce((sum, t) => sum + t.weight * t.value, 0) / total : 0;
}

/**
 * The reducer. Never mutates `state`: returns a new state, or the very same
 * object if the action is illegal (check with `validateAction` for the reason).
 */
export function applyAction(state: CombatState, action: CombatAction, data: GameData): CombatState {
  // An action reports only its own events: whatever the last one left unread is dropped.
  takeReport();
  if (validateAction(state, action, data) !== null) return state;
  const next = clone(state);
  switch (action.type) {
    case 'playCard':
      playCard(next, action.cardUid, action.targetId, data);
      break;
    case 'pickCard':
      pickCard(next, action.cardUid, data);
      break;
    case 'endTurn':
      endTurn(next, data);
      break;
  }
  return next;
}

/** Rebuild a combat exactly from its config and the list of actions taken. */
export function replayCombat(config: CombatConfig, actions: CombatAction[], data: GameData): CombatState {
  return actions.reduce((state, action) => applyAction(state, action, data), createCombat(config, data));
}

// --- internals (operate on the private working copy) -----------------------

/** Block the player keeps into their next turn (companion bonuses, or all of it after `keepHold`). */
function keptBlock(state: CombatState): number {
  if (state.keepHold || powerCount(state, 'hardShell')) return state.player.block;
  return bonusTotal(state.bonuses, 'keepBlock') + state.bonusTracker.carriedBlock;
}

/** Venom hits at the start of its bearer's turn, then loses a charge. */
function venomStrikes(state: CombatState, combatant: Combatant): void {
  venomHits(state, combatant, true);
}

/** A random creature still in the fight takes this (Powers' effects, numbers as written). */
function onRandomCreature(state: CombatState, effect: Effect): void {
  const target = randomLivingEnemy(state);
  if (target) resolveEffect(state, effect, { sourceId: PLAYER_ID, targetId: target.id, raw: true });
}

function startPlayerTurn(state: CombatState, data: GameData): void {
  state.turn++;
  addLog(state, text('log.turn', { n: state.turn }));
  venomStrikes(state, state.player);
  if (checkCombatEnd(state)) return;
  state.player.block = Math.min(state.player.block, keptBlock(state));
  state.keepHold = false;
  state.bonusTracker.carriedBlock = 0;
  state.bonusTracker.attacksThisTurn = 0;
  state.thisTurn = {};
  if (runDelayedEffects(state)) return;
  // Dead Weight: every creature gains Slow now, and it slows their coming turn.
  const deadWeight = powerTotal(state, 'deadWeight');
  if (deadWeight > 0) resolveEffect(state, { type: 'applyStatus', status: 'slow', amount: deadWeight, target: 'allEnemies' }, { sourceId: PLAYER_ID, raw: true });
  state.player.energy = state.player.maxEnergy;
  drawCards(state, STARTING_HAND_SIZE);
  // Grab the Bait: a random card from the new hand is lost.
  if (getStatus(state.player, 'baitGrabbed') > 0 && state.piles.hand.length) {
    delete state.player.statuses.baitGrabbed;
    const [card] = state.piles.hand.splice(nextInt(state, 0, state.piles.hand.length - 1), 1);
    state.piles.discard.push(card);
    addLog(state, text('log.baitGrabbed', { who: state.player.name, card: data.cards[card.defId]?.name ?? card.defId }));
  }
  if (state.turn === 2) fireTriggers(state, 'secondTurnStart');
}

/** Effects waiting for this turn (`delayed`, `echoDamage`), after the Hold reset. True if they ended the fight. */
function runDelayedEffects(state: CombatState): boolean {
  const due = state.delayed ?? [];
  state.delayed = [];
  for (const d of due) {
    for (const effect of d.effects) {
      resolveEffect(state, effect, { sourceId: PLAYER_ID, targetId: d.targetId, raw: d.raw, fromCard: true });
      if (checkCombatEnd(state)) return true;
    }
    if (d.turnsLeft > 1) state.delayed.push({ ...d, turnsLeft: d.turnsLeft - 1 });
  }
  return false;
}

function playCard(state: CombatState, cardUid: string, targetId: string | undefined, data: GameData): void {
  const index = state.piles.hand.findIndex((c) => c.uid === cardUid);
  // Remove the card first: while its effects resolve it's in no pile, so a
  // mid-effect reshuffle can't pick it up.
  const [card] = state.piles.hand.splice(index, 1);
  const def = data.cards[card.defId];
  const tension = state.player.maxEnergy - state.player.energy;
  state.player.energy -= cardCost(state, def, card.uid);
  state.player.patience -= def.patienceCost ?? 0;
  addLog(state, text('log.plays', { who: state.player.name, card: def.name }));
  // Skittish: a busy turn raises the Will of the creatures that made the player skittish.
  const played = ((state.thisTurn ??= {}).cardsPlayed = (state.thisTurn.cardsPlayed ?? 0) + 1);
  if (played === SKITTISH_CARDS && getStatus(state.player, 'skittish') > 0) {
    for (const enemy of state.enemies.filter((e) => isAlive(e) && state.skittishFrom?.includes(e.id))) {
      enemy.escape = Math.min(enemy.escapeAt, enemy.escape + Math.round(SKITTISH_WILL * (enemy.fightScale ?? 1)));
      addLog(state, text('log.skittish', { name: enemy.name, escape: enemy.escape, escapeAt: enemy.escapeAt }));
    }
    if (checkCombatEnd(state)) {
      state.piles.discard.push(card);
      return;
    }
  }
  // Old as the River: Patience spent hurts a random creature.
  const river = powerTotal(state, 'oldAsTheRiver') * (def.patienceCost ?? 0);
  if (river > 0) onRandomCreature(state, { type: 'dealDamage', amount: river });
  if (checkCombatEnd(state)) {
    state.piles.discard.push(card);
    return;
  }

  const tracker = state.bonusTracker;
  const attack = isAttackCard(def);
  const attacksBefore = tracker.attacksThisTurn;
  const firstOfTurn = attack && tracker.attacksThisTurn === 0;
  const firstOfFight = attack && tracker.attacksThisFight === 0;
  if (attack) {
    tracker.attacksThisTurn++;
    tracker.attacksThisFight++;
  }

  const ctx = {
    sourceId: PLAYER_ID,
    targetId: def.target === 'enemy' ? targetId : def.target === 'random' ? randomLivingEnemy(state)?.id : undefined,
    damagePercent: firstOfFight ? bonusTotal(state.bonuses, 'firstAttackDamage') : 0,
    data,
    attack,
    attacksBefore,
    fromCard: true,
    tension,
  };
  // Coiled: the next attack's numbers are doubled.
  const coiled = attack && !!state.thisTurn?.coiled;
  if (coiled) state.thisTurn!.coiled = false;
  for (const effect of coiled ? def.effects.map(doubled) : def.effects) {
    resolveEffect(state, effect, ctx);
    if (checkCombatEnd(state)) break;
  }
  state.thisTurn!.lastCard = def.type;
  if (state.phase === 'playerTurn' && (firstOfTurn || firstOfFight)) {
    // Cards hitting every enemy have no chosen target: the bonus lands on the first one still in.
    const hit = ctx.targetId ?? state.enemies.find(isAlive)?.id;
    if (firstOfTurn) fireTriggers(state, 'firstAttackEachTurn', hit);
    if (firstOfFight) fireTriggers(state, 'firstAttackEachFight', hit);
    checkCombatEnd(state);
  }

  // Bait Ball: a 0-cost card Drains a random creature.
  const bait = def.cost === 0 && state.phase === 'playerTurn' ? powerTotal(state, 'baitBall') : 0;
  if (bait > 0) {
    onRandomCreature(state, { type: 'changeEscape', amount: -bait });
    checkCombatEnd(state);
  }

  if (def.exhaust || def.bait || def.type === 'power') state.piles.exhaust.push(card);
  else state.piles.discard.push(card);
  // A mini-boss or boss brought low shows its Second Wind right away.
  for (const enemy of state.enemies) telegraphSecondWind(enemy, data);
}

/** One of the cards shown by `pickFromDraw` goes from the draw pile into the hand; the others stay where they are. */
function pickCard(state: CombatState, cardUid: string, data: GameData): void {
  const index = state.piles.draw.findIndex((c) => c.uid === cardUid);
  const [card] = state.piles.draw.splice(index, 1);
  state.piles.hand.push(card);
  delete state.pick;
  addLog(state, text('log.picked', { who: state.player.name, card: data.cards[card.defId]?.name ?? card.defId }));
}

/** Adds Patience, up to `MAX_PATIENCE`; returns how much was really added. */
function gainPatience(state: CombatState, amount: number, reason: 'waits' | 'steady'): number {
  const gained = Math.min(amount, MAX_PATIENCE - state.player.patience);
  if (gained <= 0) return 0;
  state.player.patience += gained;
  addLog(state, text(`log.patience.${reason}`, { who: state.player.name, n: gained }));
  return gained;
}

function endTurn(state: CombatState, data: GameData): void {
  // Perfect Disguise: a quiet turn (no attack) gives Hold now, and Slows a random creature at the
  // start of the next turn, so the Slow shows for a whole turn before it wears off.
  const disguises = state.bonusTracker.attacksThisTurn === 0 ? powerCount(state, 'perfectDisguise') : 0;
  if (disguises) {
    resolveEffect(state, { type: 'gainBlock', amount: powerTotal(state, 'perfectDisguise') }, { sourceId: PLAYER_ID, raw: true });
    const slow: Effect = { type: 'applyStatus', status: 'slow', amount: 1, target: 'randomEnemy' };
    (state.delayed ??= []).push({ turnsLeft: 1, raw: true, effects: Array.from({ length: disguises }, () => slow) });
  }
  // A turn without an attack: gear and companion bonuses that reward it.
  if (state.bonusTracker.attacksThisTurn === 0) {
    fireTriggers(state, 'quietTurnEnd');
    if (checkCombatEnd(state)) return;
  }
  gainPatience(state, state.player.energy, 'waits');
  // Junk still in hand (Slimy Seaweed) costs Grit.
  for (const card of state.piles.hand) {
    const grit = Math.min(state.player.hp, data.cards[card.defId]?.inHand?.gritAtEndOfTurn ?? 0);
    if (!grit) continue;
    state.player.hp -= grit;
    addLog(state, text('log.junkGrit', { who: state.player.name, card: data.cards[card.defId].name, n: grit }));
  }
  discardHand(state);
  tickStatuses(state.player);
  if (!getStatus(state.player, 'skittish')) state.skittishFrom = [];
  if (checkCombatEnd(state)) return;

  for (const enemy of state.enemies) {
    if (!isAlive(enemy)) continue;
    enemy.block = 0;
    delete enemy.statuses.burrowed;
    venomStrikes(state, enemy);
    // Venom can wear a creature out before it acts: it's caught.
    if (checkCombatEnd(state)) return;
    if (!isAlive(enemy)) continue;
    const move = getIntentMove(enemy, data);
    executeIntent(state, enemy, data);
    if (checkCombatEnd(state)) return;
    // A pace move: its Will rises half as much this turn.
    const rise = escapeRise(enemy, state.player.patience, state.slowCap);
    const paced = move?.role === 'pace' ? Math.ceil((rise * PACE_WILL_PERCENT) / 100) : rise;
    if (isAlive(enemy)) enemy.escape = Math.min(enemy.escapeAt, enemy.escape + paced);
    if (checkCombatEnd(state)) return;
  }
  for (const enemy of state.enemies) {
    if (!isAlive(enemy)) continue;
    tickStatuses(enemy, powerCount(state, 'pushTheLimits') ? ['slow'] : []);
    chooseIntent(state, enemy, data);
  }
  if (checkCombatEnd(state)) return;

  // Hold the creatures didn't wear through, and that isn't kept for next turn, turns into Patience.
  const unused = Math.max(0, state.player.block - keptBlock(state));
  const held = gainPatience(state, Math.floor(unused / HOLD_PER_PATIENCE), 'steady');
  state.player.block -= held * HOLD_PER_PATIENCE;

  startPlayerTurn(state, data);
}

/** Sets `phase` once the player is down, a creature got away, or every creature is caught. True when the fight is over. */
export function checkCombatEnd(state: CombatState): boolean {
  if (state.phase !== 'playerTurn') return true;
  const escaped = state.enemies.find((e) => isAlive(e) && e.escape >= e.escapeAt);
  if (state.player.hp <= 0) {
    state.phase = 'lost';
    addLog(state, text('log.defeat'));
  } else if (escaped) {
    state.phase = 'fled';
    addLog(state, text('log.gotAway', { name: escaped.name }));
  } else if (state.enemies.every((e) => !isAlive(e))) {
    state.phase = 'won';
    addLog(state, text('log.victory'));
  }
  return state.phase !== 'playerTurn';
}
