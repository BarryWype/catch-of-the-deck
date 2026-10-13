<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import {
  bonusTotal,
  creatureTypeNames,
  describeCard,
  isCardEffectiveAgainst,
  instantSaleValue,
  isAlive,
  isCardPlayable,
  PLAYER_ID,
  previewIntent,
  escapeRise,
  HOLD_PER_PATIENCE,
  MAX_PATIENCE,
  PATIENCE_ESCAPE_PERCENT,
  validateAction,
  type CardInstance,
  type CombatAction,
  type CombatState,
  type EnemyState,
  type GameData,
} from '../engine';
import CardView from './CardView.vue';
import { t, term } from './i18n';
import CombatantView from './CombatantView.vue';
import {
  animatedSheetFor,
  creatureClip,
  PLAYER_CLIPS,
  type AnimationClip,
  type AnimationName,
  type PlayerAnimation,
} from './sprites';

/**
 * `newEggs`: eggs laid at home when the run ends here (see useGame `breed`).
 * `releaseReason`: set for mini-bosses and bosses, which swim away instead of being caught.
 */
const props = defineProps<{
  state: CombatState;
  data: GameData;
  equipment: string[];
  newEggs: number;
  releaseReason: string | null;
}>();
const emit = defineEmits<{ action: [CombatAction]; claimVictory: []; leave: []; restart: [] }>();

const PATIENCE_TIP = t('combat.patienceTip', { hold: HOLD_PER_PATIENCE, percent: PATIENCE_ESCAPE_PERCENT, max: MAX_PATIENCE });

/** The creatures let go after a mini-boss or boss fight, named once each. */
const releasedNames = computed(() => [...new Set(props.state.enemies.map((e) => e.name))].join(t('combat.and')));

/** A card waiting for the player to click an enemy (keyboard play). */
const selectedUid = ref<string | null>(null);

/**
 * A card dragged out of the hand, from pointer down to release. A card played on an enemy stays in
 * the hand with an arrow to the pointer (`aimed`); the others follow the pointer and are played by
 * dropping them on the battlefield.
 */
interface Drag {
  uid: string;
  aimed: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  /** Where the arrow starts: the top middle of the card. */
  fromX: number;
  fromY: number;
  moved: boolean;
  /** The enemy under the pointer, when the card can be played on it. */
  targetId: string | null;
  overBattlefield: boolean;
}
const DRAG_THRESHOLD_PX = 6;
const drag = ref<Drag | null>(null);
const battlefield = ref<HTMLElement>();

/** Coins from creatures sold on the spot by equipment (null when they go to the aquarium). */
const instantSale = computed(() => {
  const sales = props.state.enemies.map((e) => instantSaleValue(e.defId, props.equipment, props.data, bonusTotal(props.state.bonuses, 'sellBonus')));
  return sales.some((s) => s === null) ? null : sales.reduce<number>((sum, s) => sum + (s ?? 0), 0);
});

const isPlayerTurn = computed(() => props.state.phase === 'playerTurn');
const livingEnemies = computed(() => props.state.enemies.filter(isAlive));
const recentLog = computed(() => props.state.log.slice(-8).reverse());

/** The end-of-fight overlay waits a moment so the capture / flee animation can play. */
const OVERLAY_DELAY_MS = 900;
const overlayVisible = ref(false);
let overlayTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.state.phase,
  (phase) => {
    clearTimeout(overlayTimer);
    overlayVisible.value = false;
    if (phase !== 'playerTurn') overlayTimer = setTimeout(() => (overlayVisible.value = true), OVERLAY_DELAY_MS);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearTimeout(overlayTimer));

/**
 * Per-combatant animation (keyed by combatant id, the player included), derived
 * by comparing each new state with the previous one.
 */
const animations = reactive<Record<string, { name: AnimationName | PlayerAnimation; key: number }>>({});
function animate(id: string, name: AnimationName | PlayerAnimation) {
  animations[id] = { name, key: (animations[id]?.key ?? 0) + 1 };
}

/**
 * Creatures caught (or let go) while others still fight leave the battlefield once their
 * capture / flee animation has played; the engine keeps them for the bucket (`finishCombat`).
 * The last one stays, under the end-of-fight overlay.
 */
const LEAVE_DELAY_MS = 900;
const gone = reactive(new Set<string>());
/** Short "caught" notes, one per creature that left mid-fight. */
const caughtNotes = ref<{ id: string; text: string }[]>([]);
const leaveTimers: ReturnType<typeof setTimeout>[] = [];
onBeforeUnmount(() => leaveTimers.forEach(clearTimeout));
function leaveBattlefield(enemy: EnemyState) {
  leaveTimers.push(
    setTimeout(() => {
      if (props.state.phase !== 'playerTurn') return;
      gone.add(enemy.id);
      const text = props.releaseReason ? t('combat.swimsAway', { name: enemy.name }) : t('combat.caught', { name: enemy.name });
      caughtNotes.value = [...caughtNotes.value, { id: enemy.id, text }];
      leaveTimers.push(setTimeout(() => (caughtNotes.value = caughtNotes.value.filter((n) => n.id !== enemy.id)), 1800));
    }, LEAVE_DELAY_MS),
  );
}
const shownEnemies = computed(() => props.state.enemies.filter((e) => !gone.has(e.id)));
// A new fight (new seed) starts with everyone back on the battlefield.
watch(
  () => props.state.seed,
  () => {
    gone.clear();
    caughtNotes.value = [];
  },
);
/** Names of the creatures caught before one got away (they're kept). */
const caughtBeforeEscape = computed(() => props.state.enemies.filter((e) => !isAlive(e)).map((e) => e.name));

/** Let the creature's lunge land before the fisherman flinches. */
const HURT_DELAY_MS = 300;
let hurtTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(hurtTimer));

function playerClip(): AnimationClip {
  const name = animations[PLAYER_ID]?.name;
  return PLAYER_CLIPS[name === 'win' || name === 'hurt' ? name : 'idle'];
}
function enemyClip(enemy: EnemyState): AnimationClip | undefined {
  const sprite = props.data.enemies[enemy.defId].sprite;
  const url = sprite && animatedSheetFor(sprite);
  const name = animations[enemy.id]?.name;
  const creatureName: AnimationName = name === 'attack' || name === 'capture' || name === 'flee' ? name : 'idle';
  return url ? creatureClip(url, creatureName) : undefined;
}
/** One-shot reactions (attack, hurt) return to idle; end-of-fight ones hold their last frame. */
function onAnimationDone(id: string) {
  const name = animations[id]?.name;
  if (props.state.phase === 'playerTurn' && (name === 'attack' || name === 'hurt')) animate(id, 'idle');
}

watch(
  () => props.state,
  (state, previous) => {
    if (selectedUid.value && !isCardPlayable(state, selectedUid.value, props.data)) selectedUid.value = null;
    if (!previous) return;

    const caughtOrEscaped = state.phase === 'won' || state.phase === 'fled';
    if (caughtOrEscaped && previous.phase === 'playerTurn') {
      clearTimeout(hurtTimer); // a late flinch must not replace the catch
      animate(PLAYER_ID, 'win');
    } else if (state.player.hp < previous.player.hp) {
      clearTimeout(hurtTimer);
      hurtTimer = setTimeout(() => {
        if (props.state.phase !== 'won' && props.state.phase !== 'fled') animate(PLAYER_ID, 'hurt');
      }, HURT_DELAY_MS);
    }

    for (const enemy of state.enemies) {
      const before = previous.enemies.find((e) => e.id === enemy.id);
      if (!before) continue;
      if (!isAlive(enemy) && isAlive(before)) {
        animate(enemy.id, props.releaseReason ? 'flee' : 'capture');
        if (state.phase === 'playerTurn') leaveBattlefield(enemy);
      } else if (state.phase === 'fled' && previous.phase !== 'fled' && enemy.escape >= enemy.escapeAt) {
        animate(enemy.id, 'flee');
      } else if (state.phase === 'lost' && previous.phase !== 'lost' && isAlive(enemy)) {
        animate(enemy.id, 'flee');
      } else if (enemy.moveHistory.length > before.moveHistory.length) {
        const moveId = enemy.moveHistory[enemy.moveHistory.length - 1];
        const move = props.data.enemies[enemy.defId].moves.find((m) => m.id === moveId);
        if (move?.effects.some((e) => e.type === 'dealDamage' || e.type === 'pull')) animate(enemy.id, 'attack');
      }
    }
  },
);

const tagNames = computed(() => creatureTypeNames(props.data));

function cardText(card: CardInstance) {
  // With a single enemy we can show exact numbers (its Vulnerable and type bonus included).
  const only = livingEnemies.value.length === 1 ? livingEnemies.value[0] : undefined;
  return describeCard(props.data.cards[card.defId], {
    attacker: props.state.player.statuses,
    defender: only?.statuses,
    defenderTags: only?.tags,
    tagNames: tagNames.value,
    bonusDamage: bonusTotal(props.state.bonuses, 'bonusDamage'),
  });
}

/** Glow when the card's type bonus applies to at least one living enemy. */
function isEffective(card: CardInstance) {
  const def = props.data.cards[card.defId];
  return livingEnemies.value.some((e) => isCardEffectiveAgainst(def, e.tags));
}

function typeLabel(enemy: EnemyState) {
  return enemy.tags.map((t) => tagNames.value[t] ?? t).join(' · ');
}

/** Copies of played cards flying to their target (or flaring where they were dropped). */
const playedCards = ref<{ key: number; defId: string; text: string; rect: DOMRect; dx: number; dy: number; aimed: boolean }[]>([]);
let playedKey = 0;

function play(cardUid: string, targetId?: string) {
  selectedUid.value = null;
  const card = props.state.piles.hand.find((c) => c.uid === cardUid);
  const cardEl = document.querySelector(`[data-card-uid="${cardUid}"]`);
  const targetEl = targetId && document.querySelector(`[data-enemy-id="${targetId}"]`);
  if (card && cardEl) {
    const rect = cardEl.getBoundingClientRect();
    const to = targetEl ? targetEl.getBoundingClientRect() : undefined;
    playedCards.value.push({
      key: ++playedKey,
      defId: card.defId,
      text: cardText(card),
      rect,
      dx: to ? to.left + to.width / 2 - (rect.left + rect.width / 2) : 0,
      dy: to ? to.top + to.height / 2 - (rect.top + rect.height / 2) : 0,
      aimed: !!to,
    });
  }
  emit('action', { type: 'playCard', cardUid, targetId });
}

function onCardPointerDown(card: CardInstance, event: PointerEvent) {
  if (event.button !== 0 || !isCardPlayable(props.state, card.uid, props.data)) return;
  event.preventDefault();
  selectedUid.value = null;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  drag.value = {
    uid: card.uid,
    aimed: props.data.cards[card.defId].target === 'enemy',
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    fromX: rect.left + rect.width / 2,
    fromY: rect.top,
    moved: false,
    targetId: null,
    overBattlefield: false,
  };
  // Nothing on the battlefield moves while a card is held: measure it once, now.
  zones = {
    field: battlefield.value?.getBoundingClientRect() ?? null,
    enemies: [...document.querySelectorAll<HTMLElement>('[data-enemy-id]')].map((el) => ({
      id: el.dataset.enemyId!,
      rect: el.getBoundingClientRect(),
    })),
  };
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', stopDrag);
}

/** The battlefield and creatures, measured when the drag starts, so moving never reads layout. */
let zones: { field: DOMRect | null; enemies: { id: string; rect: DOMRect }[] } = { field: null, enemies: [] };
const inside = (r: DOMRect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
/** The latest pointer position, applied at most once per frame. */
const pointer = { x: 0, y: 0 };
let moveFrame = 0;

function onPointerMove(event: PointerEvent) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  moveFrame ||= requestAnimationFrame(applyPointer);
}

function applyPointer() {
  moveFrame = 0;
  const d = drag.value;
  if (!d) return;
  d.x = pointer.x;
  d.y = pointer.y;
  d.moved ||= Math.hypot(d.x - d.startX, d.y - d.startY) > DRAG_THRESHOLD_PX;
  const id = zones.enemies.find((e) => inside(e.rect, d.x, d.y))?.id;
  const action = { type: 'playCard' as const, cardUid: d.uid, targetId: id };
  d.targetId = d.aimed && id && validateAction(props.state, action, props.data) === null ? id : null;
  d.overBattlefield = !!zones.field && inside(zones.field, d.x, d.y);
}

function onPointerUp(event: PointerEvent) {
  // Where it was released counts, even if that move wasn't drawn yet.
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (drag.value) applyPointer();
  const d = drag.value;
  stopDrag();
  if (!d?.moved) return;
  if (d.aimed && d.targetId) play(d.uid, d.targetId);
  else if (!d.aimed && d.overBattlefield) play(d.uid);
}

function stopDrag() {
  cancelAnimationFrame(moveFrame);
  moveFrame = 0;
  drag.value = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', stopDrag);
}
onBeforeUnmount(stopDrag);

/** The aiming arrow: leaves the card upwards and bends towards the pointer. */
const arrowPath = computed(() => {
  const d = drag.value;
  if (!d?.aimed || !d.moved) return null;
  return `M ${d.fromX} ${d.fromY} Q ${d.fromX} ${d.y} ${d.x} ${d.y}`;
});

/** The card being dragged onto the battlefield follows the pointer. */
function dragStyle(card: CardInstance) {
  const d = drag.value;
  if (d?.uid !== card.uid || d.aimed || !d.moved) return undefined;
  return { transform: `translate(${d.x - d.startX}px, ${d.y - d.startY}px) rotate(${(d.x - d.startX) / 40}deg) scale(1.05)` };
}

/** Keyboard play (Enter / Space on a card): mouse and touch drag instead. */
function onCardClick(card: CardInstance) {
  if (!isCardPlayable(props.state, card.uid, props.data)) return;
  const def = props.data.cards[card.defId];
  if (def.target === 'none') play(card.uid);
  else if (livingEnemies.value.length === 1) play(card.uid, livingEnemies.value[0].id);
  else selectedUid.value = selectedUid.value === card.uid ? null : card.uid;
}

function onEnemyClick(enemy: EnemyState) {
  if (selectedUid.value && isAlive(enemy)) play(selectedUid.value, enemy.id);
}

const hint = computed(() => {
  if (drag.value?.moved) return drag.value.aimed ? t('combat.dropOnCreature') : t('combat.dropOnBattlefield');
  return selectedUid.value ? t('combat.chooseTarget') : null;
});

function endTurn() {
  selectedUid.value = null;
  emit('action', { type: 'endTurn' });
}
</script>

<template>
  <div class="combat" :class="{ dragging: drag?.moved, 'on-target': !!drag?.targetId }">
    <section ref="battlefield" class="battlefield" :class="{ 'drop-zone': drag?.moved && !drag.aimed, 'drop-ready': drag?.moved && !drag.aimed && drag.overBattlefield }">
      <CombatantView
        :combatant="state.player"
        :portrait="data.character.portrait ?? '🧑'"
        :clip="playerClip()"
        :animation-key="animations[PLAYER_ID]?.key"
        @animation-done="onAnimationDone(PLAYER_ID)"
      />
      <TransitionGroup tag="div" name="leave" class="enemies">
        <CombatantView
          v-for="enemy in shownEnemies"
          :key="enemy.id"
          :combatant="enemy"
          :portrait="data.enemies[enemy.defId].portrait ?? '👹'"
          :sprite="data.enemies[enemy.defId].sprite"
          :subtitle="typeLabel(enemy)"
          :clip="enemyClip(enemy)"
          :animation-key="animations[enemy.id]?.key"
          :intent="previewIntent(state, enemy, data)"
          :escape-bar="{ escape: enemy.escape, escapeAt: enemy.escapeAt, escapeRate: escapeRise(enemy, state.player.patience) }"
          :data-enemy-id="enemy.id"
          :targetable="(!!selectedUid || (!!drag?.aimed && drag.moved)) && isAlive(enemy)"
          :class="{ aimed: drag?.targetId === enemy.id }"
          @select="onEnemyClick(enemy)"
          @animation-done="onAnimationDone(enemy.id)"
        />
      </TransitionGroup>
      <TransitionGroup tag="ul" name="note" class="caught-notes" aria-live="polite">
        <li v-for="note in caughtNotes" :key="note.id">{{ note.text }}</li>
      </TransitionGroup>
      <ol class="log">
        <li v-for="(line, i) in recentLog" :key="state.log.length - i">{{ line }}</li>
      </ol>
    </section>

    <section class="controls">
      <div class="side">
        <div v-tip="t('combat.energy')" class="energy">{{ state.player.energy }}/{{ state.player.maxEnergy }}</div>
        <div v-tip="{ title: term('patience'), body: PATIENCE_TIP }" class="patience" tabindex="0">
          <span class="patience-count" :class="{ empty: !state.player.patience }">⏳ {{ term('patience') }} {{ state.player.patience }}/{{ MAX_PATIENCE }}</span>
        </div>
        <div v-tip="t('combat.drawPile')" class="pile">🂠 {{ t('combat.draw', { n: state.piles.draw.length }) }}</div>
      </div>

      <div class="hand">
        <CardView
          v-for="card in state.piles.hand"
          :key="card.uid"
          :card="data.cards[card.defId]"
          :description="cardText(card)"
          :playable="isCardPlayable(state, card.uid, data)"
          :selected="selectedUid === card.uid || (drag?.uid === card.uid && drag.aimed)"
          :effective="isEffective(card)"
          :data-card-uid="card.uid"
          :class="{ held: drag?.uid === card.uid && drag.moved && !drag.aimed }"
          :style="dragStyle(card)"
          @pointerdown="onCardPointerDown(card, $event)"
          @click="$event.detail === 0 && onCardClick(card)"
        />
        <p v-if="hint" class="hint">{{ hint }}</p>
      </div>

      <div class="side">
        <button class="end-turn" :disabled="!isPlayerTurn" @click="endTurn">{{ t('combat.endTurn') }}</button>
        <div v-tip="t('combat.discardPile')" class="pile">♻️ {{ t('combat.discard', { n: state.piles.discard.length }) }}</div>
        <div v-tip="t('combat.exhaustPile')" class="pile">🔥 {{ t('combat.exhaust', { n: state.piles.exhaust.length }) }}</div>
      </div>
    </section>

    <svg v-if="arrowPath" class="aim" :class="{ locked: !!drag?.targetId }" aria-hidden="true">
      <defs>
        <marker id="aim-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      <path :d="arrowPath" marker-end="url(#aim-head)" />
    </svg>

    <div
      v-for="card in playedCards"
      :key="card.key"
      class="played-card"
      :class="card.aimed ? 'thrown' : 'flared'"
      :style="{ left: `${card.rect.left}px`, top: `${card.rect.top}px`, '--dx': `${card.dx}px`, '--dy': `${card.dy}px` }"
      @animationend="playedCards = playedCards.filter((c) => c.key !== card.key)"
    >
      <CardView :card="data.cards[card.defId]" :description="card.text" />
    </div>

    <div v-if="state.phase !== 'playerTurn' && overlayVisible" class="overlay">
      <div class="panel">
        <template v-if="state.phase === 'won'">
          <h2>{{ t('combat.victory') }}</h2>
          <p>{{ t('combat.wonIn', { n: state.turn, grit: state.player.hp }) }}</p>
          <p v-if="releaseReason">
            {{ t(state.enemies.length > 1 ? 'combat.releasedMany' : 'combat.releasedOne', { names: releasedNames, reason: releaseReason }) }}
          </p>
          <p v-else-if="instantSale !== null">{{ t('combat.soldOnSpot', { coins: instantSale }) }}</p>
          <button @click="emit('claimVictory')">{{ t('combat.chooseReward') }}</button>
        </template>
        <template v-else-if="state.phase === 'fled'">
          <h2>{{ t('combat.fledTitle') }}</h2>
          <p>
            {{ t('combat.brokeFree', { name: state.enemies.find((e) => e.escape >= e.escapeAt)?.name ?? '', n: state.turn }) }}
            <template v-if="!caughtBeforeEscape.length">{{ t('combat.noCatch') }}</template>
            <template v-else-if="releaseReason">{{ t('combat.letOthersGo') }}</template>
            <template v-else>{{ t('combat.othersStay', { names: caughtBeforeEscape.join(', '), n: caughtBeforeEscape.length }) }}</template>
          </p>
          <button @click="emit('leave')">{{ t('combat.backToMap') }}</button>
        </template>
        <template v-else>
          <h2>{{ t('combat.defeatTitle') }}</h2>
          <p>{{ t('combat.defeatText', { n: state.turn }) }}</p>
          <p v-if="newEggs" class="new-eggs">{{ t('common.newEggs', { n: newEggs }) }}</p>
          <button @click="emit('restart')">{{ t('common.startNewRun') }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.new-eggs { color: var(--highlight); font-weight: 600; }
.combat { position: relative; display: flex; flex-direction: column; gap: 16px; min-height: calc(100vh - 80px); }

.battlefield {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 24px;
  border-radius: 16px;
  background: linear-gradient(180deg, #1d2c3f 0%, #17324a 55%, #12283b 100%);
}
.enemies { display: flex; gap: 24px; }
/* A caught creature fades out of the battlefield; the others slide over. */
.enemies > .leave-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.enemies > .leave-leave-to { opacity: 0; transform: translateY(12px) scale(0.9); }
.enemies > .leave-move { transition: transform 0.4s ease; }
.caught-notes {
  position: absolute;
  top: 12px;
  left: 50%;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  transform: translateX(-50%);
  list-style: none;
  pointer-events: none;
}
.caught-notes li { padding: 6px 14px; border-radius: 999px; background: rgb(20 24 32 / 0.9); font-weight: 700; color: var(--highlight); }
.note-enter-active, .note-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.note-enter-from, .note-leave-to { opacity: 0; transform: translateY(-8px); }

.log {
  position: absolute;
  top: 10px;
  left: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.72rem;
  color: var(--muted);
  max-width: 260px;
}
.log li:first-child { color: var(--text); }

.controls { display: flex; align-items: flex-end; gap: 16px; padding: 0 8px 12px; }
.side { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 120px; }
.hand {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 8px;
  padding-top: 24px;
  min-height: 230px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.hint { position: absolute; top: -6px; margin: 0; color: var(--highlight); font-weight: 600; pointer-events: none; }

.hand :deep(.card) { touch-action: none; user-select: none; }
.hand :deep(.card.held) { position: relative; z-index: 5; transition: none; pointer-events: none; box-shadow: 0 18px 30px rgb(0 0 0 / 0.6); }
.combat.dragging, .combat.dragging :deep(*) { cursor: grabbing !important; }
.combat.on-target, .combat.on-target :deep(*) {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' fill='none' stroke='%23f5d76e' stroke-width='2.5'%3E%3Ccircle cx='16' cy='16' r='10'/%3E%3Ccircle cx='16' cy='16' r='2' fill='%23f5d76e'/%3E%3Cpath d='M16 1v8M16 23v8M1 16h8M23 16h8'/%3E%3C/svg%3E") 16 16, crosshair !important;
}
.battlefield.drop-zone { outline: 2px dashed rgb(245 215 110 / 0.35); outline-offset: -6px; }
.battlefield.drop-ready { outline-color: var(--highlight); background: linear-gradient(180deg, #22364c 0%, #1b3b56 55%, #152e44 100%); }
.enemies :deep(.aimed) { transform: scale(1.04); box-shadow: 0 0 0 2px var(--highlight), 0 0 24px rgb(245 215 110 / 0.35); }

.aim { position: fixed; inset: 0; z-index: 20; width: 100vw; height: 100vh; pointer-events: none; overflow: visible; }
.aim { color: #c9d3df; }
.aim.locked { color: var(--highlight); }
.aim path { fill: none; stroke: currentColor; stroke-width: 6; stroke-linecap: round; stroke-dasharray: 2 12; }
.aim marker path { fill: currentColor; stroke: none; }

.played-card { position: fixed; z-index: 15; pointer-events: none; }
.played-card :deep(.card) { transition: none; }
.played-card.thrown { animation: card-thrown 0.38s cubic-bezier(0.5, 0, 0.75, 0.4) forwards; }
.played-card.flared { animation: card-flared 0.4s ease-out forwards; }
/* A still glow: animating a filter would repaint the card on every frame. */
.played-card.flared :deep(.card) { box-shadow: 0 0 0 2px var(--highlight), 0 0 22px rgb(245 215 110 / 0.8); }
@keyframes card-thrown {
  0% { transform: none; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0.35) rotate(18deg); opacity: 0.2; }
}
@keyframes card-flared {
  0% { transform: scale(1.05); }
  40% { transform: scale(1.15); opacity: 1; }
  100% { transform: translateY(-40px) scale(1.25); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .played-card.thrown, .played-card.flared { animation-duration: 0.01s; }
}

.energy {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe08a, var(--energy) 60%, #a5741b);
  color: #1b1d24;
  font-size: 1.4rem;
  font-weight: 800;
  box-shadow: 0 0 16px rgb(242 182 66 / 0.45);
}
.pile { font-size: 0.85rem; color: var(--muted); }
.patience { position: relative; cursor: help; }
.patience:focus { outline: none; }
.patience-count { display: block; padding: 2px 10px; border-radius: 999px; background: #2a3f5a; color: #bfe3ff; font-size: 0.85rem; font-weight: 700; }
.patience-count.empty { opacity: 0.55; }
.patience:focus-visible .patience-count { outline: 2px solid var(--highlight); }
.end-turn { padding: 12px 18px; font-size: 1rem; }

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(10 11 15 / 0.7);
  border-radius: 16px;
}
.panel { padding: 28px 40px; border-radius: 16px; background: var(--panel); text-align: center; }
.panel h2 { margin: 0 0 8px; font-size: 2rem; }
</style>
