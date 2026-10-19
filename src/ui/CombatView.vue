<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  bonusTotal,
  creatureFamilies,
  creatureTypeNames,
  describeCard,
  isCardEffectiveAgainst,
  instantSaleValue,
  isAlive,
  cardCost,
  isCardPlayable,
  PLAYER_ID,
  previewCard,
  previewIntent,
  previewIntents,
  escapeRise,
  takeReport,
  HOLD_PER_PATIENCE,
  MAX_PATIENCE,
  PATIENCE_ESCAPE_PERCENT,
  validateAction,
  type CardInstance,
  type CombatAction,
  type CombatReport,
  type CombatState,
  type EnemyState,
  type GameData,
  type RunState,
} from '../engine';
import CardView from './CardView.vue';
import KeywordText from './KeywordText.vue';
import { t, term, type TextKey } from './i18n';
import CombatantView from './CombatantView.vue';
import PixelBubbles from './PixelBubbles.vue';
import SpriteView from './SpriteView.vue';
import HealthBar from './HealthBar.vue';
import StatusList from './StatusList.vue';
import PowerList from './PowerList.vue';
import { playTheme, stopTheme } from './music';
import { playSfx } from './sfx';
import { COMPACT_QUERY, useMedia } from './useScreen';
import {
  animatedSheetFor,
  creatureClip,
  playerClip as characterAnimation,
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
  /** The run around the fight: its store effects show with the powers. */
  run?: RunState;
  equipment: string[];
  newEggs: number;
  releaseReason: string | null;
  /** The fight's map node spot id: the scene's water colour (see `data.spots`). */
  spot?: string;
  /** The player's art (`BuildDef.character`). */
  character?: string;
}>();
const emit = defineEmits<{ action: [CombatAction]; claimVictory: []; leave: []; menu: [] }>();

const PATIENCE_TIP = t('combat.patienceTip', { hold: HOLD_PER_PATIENCE, percent: PATIENCE_ESCAPE_PERCENT, max: MAX_PATIENCE });

/** The creatures let go after a mini-boss or boss fight, named once each. */
const releasedNames = computed(() => [...new Set(props.state.enemies.map((e) => e.name))].join(t('combat.and')));

/** A move's intensity, as a word. */
const INTENSITY: Record<string, TextKey> = { light: 'intent.intensity.light', normal: 'intent.intensity.normal', heavy: 'intent.intensity.heavy' };

/** Hover text over a creature: its whole move set (name, type, intensity), so players can plan. */
function creatureTip(enemy: EnemyState) {
  const moves = props.data.enemies[enemy.defId].moves;
  return {
    title: enemy.name,
    body: moves
      .map((m) => `${m.name} (${t(m.tag === 'pull' ? 'intent.pull' : 'intent.strike')}, ${t(INTENSITY[m.intensity])})`)
      .join(' · '),
  };
}

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
  /** The card's left edge when picked up: with fromY, where a card that goes fixed stays put. */
  cardLeft: number;
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
/** The fight log can be folded away, leaving only its toggle. */
const logOpen = ref(true);

/** The end-of-fight overlay waits a moment so the capture / flee animation can play. */
const OVERLAY_DELAY_MS = 900;
const overlayVisible = ref(false);
let overlayTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.state.phase,
  (phase) => {
    clearTimeout(overlayTimer);
    overlayVisible.value = false;
    if (phase !== 'playerTurn') {
      overlayTimer = setTimeout(() => (overlayVisible.value = true), OVERLAY_DELAY_MS);
      stopTheme(); // The fight is over: the map's theme takes over when the player leaves.
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => clearTimeout(overlayTimer));
/** The fight theme (music.ts): the boss track for mini-bosses and bosses, the regular one for
 * every other fight. */
onMounted(() => playTheme(props.releaseReason ? 'boss' : 'fight'));
onBeforeUnmount(stopTheme);

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
  return characterAnimation(name === 'win' || name === 'hurt' ? name : 'idle', props.character);
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

/** One sound per thing the last action did: a hit that lands or is held, Venom or Slow, and the
 * player's own damage and calming. */
function playSound(event: CombatReport) {
  if (event.kind === 'strike') playSfx(event.hpLost > 0 ? 'splash-big.wav' : 'umbrella-open.wav');
  else if (event.kind === 'pull') playSfx(event.raised > 0 ? 'dive.wav' : 'umbrella-open.wav');
  else if (event.kind === 'status') playSfx(event.status === 'venom' ? 'fish-flop.wav' : 'Hook_Set_Hard.wav');
  else if (event.kind === 'drain') playSfx('wave-wash.wav');
  else playSfx('dig-sand.wav');
}

watch(
  () => props.state,
  (state, previous) => {
    if (selectedUid.value && !isCardPlayable(state, selectedUid.value, props.data)) selectedUid.value = null;
    if (!previous) return;
    for (const event of takeReport()) playSound(event);

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
        // A release (mini-boss, boss) swims away instead: it is not a catch.
        if (!props.releaseReason) playSfx('treasure-found.wav');
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
    cardLeft: rect.left,
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
  // The click that ends a drag isn't a tap.
  justDragged = true;
  setTimeout(() => (justDragged = false), 0);
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
  return {
    transform: `translate(${d.x - d.startX}px, ${d.y - d.startY}px) rotate(${(d.x - d.startX) / 40}deg) scale(1.05)`,
    '--held-left': `${d.cardLeft}px`,
    '--held-top': `${d.fromY}px`,
  };
}

/**
 * The hand is held, not laid out: each card tilts a few degrees off upright, and the further it
 * sits from the middle, the lower it dips. The card's own transforms (hover, selected, drag)
 * stay on the card, so they still lift it straight out of the fan. Compact screens scroll the
 * hand sideways instead, so there the cards lie flat.
 */
const DEGREES_PER_CARD = 4.5;
const MAX_TILT_DEG = 14;
/** How far an outer card dips, growing with the square of its distance from the middle. */
const DIP_PER_CARD = 0.5;
const compact = useMedia(COMPACT_QUERY);

/**
 * How far the combatants sit from the edges of the battlefield: close to the bottom right corner,
 * out of the fisherman's way. A wide group fight needs the width instead, and compact screens keep
 * their own tight padding (their layout wraps).
 */
const sidePadding = computed(() => {
  if (compact.value) return undefined;
  const count = shownEnemies.value.length;
  return count <= 1 ? '10%' : count === 2 ? '6%' : '4%';
});

/**
 * The water's colour: the fishing spot's own map colour (a creek runs greener than the open sea),
 * except where that colour is the land's (the jetty's wood, the beach's sand, the cliff's stone).
 */
const SEA = '#2b7fa8';
const WATER_OVER = new Set(['JT', 'BE', 'CL']);
const spotColour = computed(() => (props.spot && !WATER_OVER.has(props.spot) ? props.data.spots[props.spot]?.color : undefined) ?? SEA);
/**
 * Where the fisherman stands on the shore, as a share of the battlefield's width: further left as
 * more creatures need the room.
 */
const playerX = computed(() => (compact.value ? 0.2 : ([0.28, 0.2, 0.14][Math.min(2, shownEnemies.value.length - 1)] ?? 0.28)));
/** On the bank, except on a small screen with several creatures: those wrap, and he joins the flow. */
const onBank = computed(() => !compact.value || shownEnemies.value.length <= 1);
/** Three creatures at once: one sprite size smaller, and closer together, so they fit beside him. */
const crowded = computed(() => shownEnemies.value.length >= 3);
/** The battlefield's inline style: its water colour, the combatants' side padding, and his place. */
const battlefieldStyle = computed(() => ({
  '--spot': spotColour.value,
  '--player-x': `${playerX.value * 100}%`,
  ...(shore.value ? { '--shore-y0': `${shore.value.y0}px`, '--shore-y1': `${shore.value.y1}px` } : {}),
  ...(sidePadding.value ? { paddingInline: sidePadding.value } : {}),
}));

/**
 * The scene: the shore runs diagonally from the bottom left to the top right, the fisherman on land
 * above it, the creatures in the water below, so they don't stand on the same plane. The line is
 * measured from the laid-out sprites so it fits them at any size: it passes just under his feet,
 * as steep as it must to stay above every creature's art, and at least `SHORE_SLOPE` steep.
 * `shore` holds where it meets the left (`y0`) and right (`y1`) edges, in px from the top.
 */
const SHORE_SLOPE = 0.55; // of the battlefield's height per width
const FEET = { x: 0.62, y: 1 }; // in the fisherman's frame: just ahead of his feet.
const ART_TOP = { x: 0.15, y: 0.1 }; // in a creature's frame: its art starts a little inside the frame.
const shore = ref<{ y0: number; y1: number } | null>(null);
/** Seaweed on the bottom, on the water's side (objects.png: 1 green algae, 2 red algae, 3 seaweed). */
const SEAWEED = [
  { index: 3, left: '52%', size: 96, delay: '0s', flip: false },
  { index: 1, left: '64%', size: 64, delay: '-1.3s', flip: true },
  { index: 2, left: '86%', size: 80, delay: '-2.2s', flip: false },
  { index: 3, left: '93%', size: 72, delay: '-0.7s', flip: true },
];
/** The shore's look, from the fight's fishing spot (spots.ts codes). */
const LAND_BY_SPOT: Record<string, string> = {
  RP: 'rocks', CL: 'rocks', JT: 'jetty', BE: 'beach', ST: 'grass', PO: 'grass', LK: 'grass', RV: 'grass',
  ES: 'mud', BY: 'boat', OS: 'boat', DP: 'boat', RF: 'reef',
};
const land = computed(() => (props.spot && LAND_BY_SPOT[props.spot]) || 'grass');
/** The water's far shapes and bed, from the fight's fishing spot (spots.ts codes). */
const WATER_BY_SPOT: Record<string, { back: string; bed: string }> = {
  RP: { back: 'rocks', bed: 'rock' }, CL: { back: 'rocks', bed: 'rock' }, DP: { back: 'rocks', bed: 'deep' },
  JT: { back: 'kelp', bed: 'sand' }, BE: { back: 'kelp', bed: 'sand' }, BY: { back: 'kelp', bed: 'sand' }, OS: { back: 'kelp', bed: 'sand' },
  ST: { back: 'reeds', bed: 'rock' }, RV: { back: 'reeds', bed: 'rock' }, LK: { back: 'reeds', bed: 'sand' },
  PO: { back: 'reeds', bed: 'mud' }, ES: { back: 'reeds', bed: 'mud' },
  RF: { back: 'coral', bed: 'coral' },
};
const water = computed(() => (props.spot && WATER_BY_SPOT[props.spot]) || { back: 'reeds', bed: 'sand' });
/** Drawn along the shore line, back to front: the bank's shadow on the water, its side, its lit rim, the foam. */
const SHORE_PARTS = ['bank-shadow', 'bank-side', 'bank-rim', 'surface-foam', 'surface-line'];
function measureScene() {
  const field = battlefield.value;
  if (!field) return;
  const box = field.getBoundingClientRect();
  const at = (el: Element, point: { x: number; y: number }) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - box.left + r.width * point.x, y: r.top - box.top + r.height * point.y };
  };
  const player = field.querySelector('.portrait.player');
  if (!player) return;
  const feet = at(player, FEET);
  // Steep enough to pass above each creature's art (to the right of him), at least the default slope.
  let slope = -SHORE_SLOPE * (box.height / box.width);
  for (const enemy of shownEnemies.value) {
    const el = field.querySelector(`[data-enemy-id="${enemy.id}"] .portrait`);
    if (!el) continue;
    const art = at(el, ART_TOP);
    if (art.x > feet.x + 8) slope = Math.min(slope, (art.y - 6 - feet.y) / (art.x - feet.x));
  }
  shore.value = { y0: Math.round(feet.y - slope * feet.x), y1: Math.round(feet.y + slope * (box.width - feet.x)) };
}
watch([() => props.state, shownEnemies, compact], async () => {
  await nextTick();
  measureScene();
}, { immediate: true });
let fieldResizes: ResizeObserver | undefined;
onMounted(() => {
  fieldResizes = new ResizeObserver(() => measureScene());
  if (battlefield.value) fieldResizes.observe(battlefield.value);
});
onBeforeUnmount(() => fieldResizes?.disconnect());

function slotStyle(card: CardInstance, index: number, count: number) {
  if (compact.value) return undefined;
  if (drag.value?.moved && !drag.value.aimed && drag.value.uid === card.uid) return { transform: 'none' };
  const offset = index - (count - 1) / 2;
  const tilt = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, offset * DEGREES_PER_CARD));
  return { transform: `rotate(${tilt}deg) translateY(${offset * offset * DIP_PER_CARD}px)` };
}

let justDragged = false;

/**
 * A tap or click selects a card: tap it again (or the battlefield) to play it, or a creature for
 * a card aimed at one. Keyboard play (Enter / Space) plays it at once, or picks its target first.
 * Dragging plays it too.
 */
function onCardClick(card: CardInstance, event: MouseEvent) {
  if (justDragged || !isCardPlayable(props.state, card.uid, props.data)) return;
  const def = props.data.cards[card.defId];
  const onlyEnemy = livingEnemies.value.length === 1 ? livingEnemies.value[0] : undefined;
  const again = selectedUid.value === card.uid;
  if (event.detail !== 0 && !again) {
    selectedUid.value = card.uid;
    return;
  }
  if (def.target !== 'enemy') play(card.uid);
  else if (onlyEnemy) play(card.uid, onlyEnemy.id);
  else selectedUid.value = again ? null : card.uid;
}

function onEnemyClick(enemy: EnemyState) {
  const card = selectedCard.value;
  if (card && props.data.cards[card.defId].target === 'enemy' && isAlive(enemy)) play(card.uid, enemy.id);
}

/** The selected card, when it's still in the hand. */
const selectedCard = computed(() => props.state.piles.hand.find((c) => c.uid === selectedUid.value));
/** Whether the current selection (or an aimed drag) aims at a creature: only then are creatures targetable. */
const aimingAtEnemy = computed(() => {
  if (drag.value?.aimed && drag.value.moved) return true;
  const def = selectedCard.value && props.data.cards[selectedCard.value.defId];
  return !!def && def.target === 'enemy';
});

/** A selected card that plays on the player (or on no one) plays when the fisherman is tapped. */
function onPlayerClick() {
  const card = selectedCard.value;
  if (card && props.data.cards[card.defId].target !== 'enemy') play(card.uid);
}

/** A selected card that isn't aimed at a creature plays when the battlefield is tapped. */
function onBattlefieldClick() {
  const card = selectedCard.value;
  if (card && props.data.cards[card.defId].target !== 'enemy') play(card.uid);
}

/**
 * What the card being dragged (or selected) would do: `state`, the fight after it, for the
 * player's bars and the creatures' intents; `enemies`, each creature after it. A card aimed at a
 * creature with none picked yet shows, on each creature, what it would do to that one (the
 * player's side from playing it on the first), and leaves the intents as they are.
 */
const cardPreview = computed<{ state: CombatState; enemies: Record<string, EnemyState> } | null>(() => {
  const d = drag.value;
  const uid = d?.moved ? d.uid : selectedUid.value;
  const card = isPlayerTurn.value && props.state.piles.hand.find((c) => c.uid === uid);
  if (!card) return null;
  const aimed = props.data.cards[card.defId].target === 'enemy';
  const targetId = d?.moved ? d.targetId : null;
  const targets = !aimed ? [undefined] : targetId ? [targetId] : livingEnemies.value.map((e) => e.id);
  const plays = targets.map((id) => ({ id, next: previewCard(props.state, card.uid, id, props.data) }));
  const first = plays[0]?.next;
  if (!first) return null;
  const enemies = Object.fromEntries(first.enemies.map((e) => [e.id, e]));
  if (targets.length > 1) for (const { id, next } of plays) if (id && next) enemies[id] = next.enemies.find((e) => e.id === id)!;
  return { state: targets.length > 1 ? { ...first, enemies: props.state.enemies } : first, enemies };
});
/** The fight the intents and bars are shown for: after the card being played, if any. */
const shownState = computed(() => cardPreview.value?.state ?? props.state);
/** After the creatures' shown moves (engine: `previewIntents`). */
const turnPreview = computed(() => previewIntents(shownState.value, props.data));

/** A creature's bars after the card, then after the creatures' moves (what those moves change, on top). */
function enemyPreview(enemy: EnemyState) {
  const after = cardPreview.value?.enemies[enemy.id] ?? enemy;
  const before = shownState.value.enemies.find((e) => e.id === enemy.id) ?? enemy;
  const end = turnPreview.value.enemies.find((e) => e.id === enemy.id) ?? before;
  return {
    health: { after: after.hp, end: after.hp + end.hp - before.hp, blockAfter: after.block },
    escape: after.escape,
    escapeEnd: after.escape + end.escape - before.escape,
  };
}

const hint = computed(() => {
  if (drag.value?.moved) return drag.value.aimed ? t('combat.dropOnCreature') : t('combat.dropOnBattlefield');
  const selected = selectedUid.value ? props.state.piles.hand.find((c) => c.uid === selectedUid.value) : undefined;
  if (!selected) return null;
  return props.data.cards[selected.defId].target === 'enemy' ? t('combat.chooseTarget') : t('combat.playAgain');
});

function endTurn() {
  selectedUid.value = null;
  emit('action', { type: 'endTurn' });
}
/**
 * Space ends the turn, wherever focus is (a clicked card keeps it), except while typing, dragging
 * a card, or with a dialog open over the fight. Cancelling the keydown stops a focused button from being pressed as well;
 * Enter still presses it.
 */
function onKey(event: KeyboardEvent) {
  if (event.code !== 'Space' || event.repeat || !isPlayerTurn.value || drag.value) return;
  if ((event.target as Element | null)?.closest('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  endTurn();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="combat" :class="{ dragging: drag?.moved, 'on-target': !!drag?.targetId }">
    <section
      ref="battlefield"
      class="battlefield"
      :class="{ 'drop-zone': drag?.moved && !drag.aimed, 'drop-ready': drag?.moved && !drag.aimed && drag.overBattlefield, bank: onBank }"
      :style="battlefieldStyle"
      @click="onBattlefieldClick"
    >
      <!-- The scene, behind the sprites: land above the diagonal shore (its look from the fishing
           spot), water below it, then the bank's edge dropping into the water. -->
      <div class="land" :class="land" aria-hidden="true" />
      <div class="water-tint" aria-hidden="true" />
      <!-- The water's side, like the home aquarium: light from above, far shapes and a bed that
           follow the fishing spot, seaweed, a passing school, bubbles rising. Only the bubbles,
           the school and a slow sway move (cheap even without a GPU). -->
      <div class="underwater" aria-hidden="true">
        <div class="rays" />
        <div class="backdrop" :class="water.back" />
        <div class="school" />
        <div class="bed" :class="water.bed" />
        <div v-for="(w, i) in SEAWEED" :key="i" class="seaweed" :class="{ flip: w.flip }" :style="{ left: w.left, animationDelay: w.delay }">
          <SpriteView :sprite="{ sheet: 'objects', index: w.index }" :size="compact ? w.size / 2 : w.size" />
        </div>
        <PixelBubbles :count="10" />
      </div>
      <svg class="scene" :class="land" aria-hidden="true">
        <line
          v-for="part in SHORE_PARTS"
          :key="part"
          :class="part"
          x1="0"
          x2="100%"
          :y1="shore?.y0 ?? '85%'"
          :y2="shore?.y1 ?? '15%'"
        />
      </svg>
      <!-- The player's corner panel, under his character: his Grit, Hold and statuses (he stands on
           the bank with nothing under his feet), then his Energy and Patience. -->
      <div class="resources">
        <div class="player-hud">
          <HealthBar
            :hp="state.player.hp"
            :max-hp="state.player.maxHp"
            :block="state.player.block"
            :after="shownState.player.hp"
            :end="turnPreview.player.hp"
            grit
          />
          <StatusList :statuses="state.player.statuses" />
          <PowerList :state="state" :data="data" :run="run" />
        </div>
        <div class="orbs">
          <div v-tip="t('combat.energy')" class="energy">
            <span class="energy-icon" aria-hidden="true"><GameIcon icon="⚡" /></span>
            <span class="energy-count">{{ state.player.energy }}/{{ state.player.maxEnergy }}</span>
          </div>
          <div
            v-tip="{ title: term('patience'), body: PATIENCE_TIP }"
            class="patience"
            :class="{ empty: !state.player.patience }"
            tabindex="0"
          >
            <span class="patience-icon" aria-hidden="true"><GameIcon icon="coffee" /></span>
            <span class="patience-count">{{ state.player.patience }}/{{ MAX_PATIENCE }}</span>
          </div>
        </div>
      </div>
      <!-- The turn counter, up in the safe area of the battlefield. -->
      <p class="turn">{{ t('combat.turn', { n: state.turn }) }}</p>
      <!-- The player stands on the bank, above the water line (compact screens stack the flow). -->
      <div class="player-anchor" :class="{ raised: onBank }">
        <CombatantView
          :combatant="state.player"
          :portrait="data.character.portrait ?? '🧑'"
          :clip="playerClip()"
          :frame="4"
          bare
          :animation-key="animations[PLAYER_ID]?.key"
          :targetable="!aimingAtEnemy && !!selectedCard"
          @select="onPlayerClick"
          @animation-done="onAnimationDone(PLAYER_ID)"
        />
        <!-- His Hold, right beside him, so it's seen where the strikes land. -->
        <Transition name="hold">
          <span
            v-if="state.player.block > 0 || shownState.player.block > 0"
            :key="state.player.block"
            v-tip="`${state.player.block} ${term('hold')}`"
            class="player-hold"
          >
            <GameIcon icon="life-buoy" />{{ shownState.player.block === state.player.block ? state.player.block : `${state.player.block} → ${shownState.player.block}` }}
          </span>
        </Transition>
      </div>
      <TransitionGroup tag="div" name="leave" class="enemies" :class="{ crowded }">
        <CombatantView
          v-for="enemy in shownEnemies"
          :key="enemy.id"
          :combatant="enemy"
          :portrait="data.enemies[enemy.defId].portrait ?? '👹'"
          :sprite="data.enemies[enemy.defId].sprite"
          :frame="(releaseReason ? 6 : 3 + (data.enemies[enemy.defId].tier ?? 2)) - (crowded ? 1 : 0)"
          :families="creatureFamilies(enemy.defId, data)"
          :tip="drag?.moved ? undefined : creatureTip(enemy)"
          :clip="enemyClip(enemy)"
          :animation-key="animations[enemy.id]?.key"
          :intent="previewIntent(shownState, enemy, data)"
          :escape-bar="{
            escape: enemy.escape,
            escapeAt: enemy.escapeAt,
            escapeRate: escapeRise(enemy, state.player.patience, state.slowCap),
            pull: previewIntent(shownState, enemy, data)?.pull,
            after: enemyPreview(enemy).escape,
            end: enemyPreview(enemy).escapeEnd,
          }"
          :health-preview="enemyPreview(enemy).health"
          :data-enemy-id="enemy.id"
          :targetable="aimingAtEnemy && isAlive(enemy)"
          :class="{ aimed: drag?.targetId === enemy.id }"
          @select="onEnemyClick(enemy)"
          @animation-done="onAnimationDone(enemy.id)"
        />
      </TransitionGroup>
      <TransitionGroup tag="ul" name="note" class="caught-notes" aria-live="polite">
        <li v-for="note in caughtNotes" :key="note.id">{{ note.text }}</li>
      </TransitionGroup>
      <div v-if="recentLog.length" class="log-box">
        <button
          v-tip="t('combat.log')"
          class="log-toggle"
          type="button"
          :aria-expanded="logOpen"
          @click="logOpen = !logOpen"
        >
          {{ logOpen ? '❮' : '❯' }}
        </button>
        <ol v-show="logOpen" class="log">
          <li v-for="(line, i) in recentLog" :key="state.log.length - i"><KeywordText :text="line" /></li>
        </ol>
      </div>
    </section>

    <section class="controls">
      <div class="side">
        <div v-tip="t('combat.drawPile')" class="pile">🂠 {{ t('combat.draw', { n: state.piles.draw.length }) }}</div>
      </div>

      <div class="hand">
        <span v-for="(card, i) in state.piles.hand" :key="card.uid" class="slot" :style="slotStyle(card, i, state.piles.hand.length)">
          <CardView
            :card="data.cards[card.defId]"
            :description="cardText(card)"
            :playable="isCardPlayable(state, card.uid, data)"
            :cost="cardCost(state, data.cards[card.defId])"
            :selected="selectedUid === card.uid || (drag?.uid === card.uid && drag.aimed)"
            :effective="isEffective(card)"
            :data-card-uid="card.uid"
            :class="{ held: drag?.uid === card.uid && drag.moved && !drag.aimed }"
            :style="dragStyle(card)"
            @pointerdown="onCardPointerDown(card, $event)"
            @click="onCardClick(card, $event)"
          />
        </span>
        <p v-if="hint" class="hint">{{ hint }}</p>
      </div>

      <div class="side">
        <button class="end-turn" :disabled="!isPlayerTurn" @click="endTurn">{{ t('combat.endTurn') }}</button>
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

    <!-- The debug scenario's in-fight tools (DebugCombatTools), from App. -->
    <slot name="debug" />
    <div v-if="state.phase !== 'playerTurn' && overlayVisible" class="overlay">
      <div class="panel">
        <template v-if="state.phase === 'won'">
          <h2>{{ t('combat.victory') }}</h2>
          <p v-if="releaseReason">
            <KeywordText :text="t(state.enemies.length > 1 ? 'combat.releasedMany' : 'combat.releasedOne', { names: releasedNames, reason: releaseReason })" />
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
          <p><KeywordText :text="t('combat.defeatText', { n: state.turn })" /></p>
          <p v-if="newEggs" class="new-eggs">{{ t('common.newEggs', { n: newEggs }) }}</p>
          <button @click="emit('menu')">{{ t('complete.toMenu') }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.new-eggs { color: var(--highlight); font-weight: 600; }
.combat { position: relative; display: flex; flex-direction: column; gap: 16px; min-height: 100%; /* Clips the part of the cards held below the screen edge, without making the page scroll. */ overflow: clip; }

.battlefield {
  position: relative;
  /* Its own stacking context: the scene (z-index: -1) sits behind the sprites but above this background. */
  isolation: isolate;
  flex: 1;
  display: flex;
  /* Bottom-aligned, so the creatures stand on the same ground line; the player is raised onto
     the bank above the water (see .player-anchor). */
  align-items: flex-end;
  /* The player is out of the flow (on the bank), so the creatures pin to the bottom right. */
  justify-content: flex-end;
  padding: 8px 22%;
  border-radius: 16px;
  /* The water, tinted by the fight's spot: a creek runs greener than the open sea. */
  background:
    radial-gradient(70% 50% at 50% -8%, rgb(126 175 200 / 0.28), transparent 68%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--spot, #2b7fa8) 30%, #20324a) 0%,
      color-mix(in srgb, var(--spot, #2b7fa8) 35%, #17324a) 55%,
      color-mix(in srgb, var(--spot, #2b7fa8) 40%, #12283b) 100%
    );
  border: 1px solid rgb(120 160 195 / 0.16);
  box-shadow: inset 0 0 70px rgb(2 6 12 / 0.35);
}
/* Land above the diagonal shore, water below it (--shore-y0 / --shore-y1: where the shore meets the
   left and right edges, measured in measureScene). All behind the sprites (z-index: -1). */
.land, .water-tint, .underwater { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.land { clip-path: polygon(0 0, 100% 0, 100% var(--shore-y1, 15%), 0 var(--shore-y0, 85%)); }
.water-tint, .underwater { clip-path: polygon(0 var(--shore-y0, 85%), 100% var(--shore-y1, 15%), 100% 100%, 0 100%); }
.water-tint { background: color-mix(in srgb, var(--spot, #2b7fa8) 60%, #0d2030); opacity: 0.45; }
/* The ground by fishing spot: a pixel-art tile (`npm run shore`) at the sprites' 3× scale (2× on
   compact screens), lit from the top left and shaded towards the water. */
.land { --tile: 192px; background: 0 0 / var(--tile) var(--tile); image-rendering: pixelated; }
.land::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(165deg, rgb(255 240 200 / 0.12), transparent 45%, rgb(10 20 30 / 0.22));
}
.land.grass { background-image: url('./assets/shore/grass.png'); }
.land.rocks { background-image: url('./assets/shore/rocks.png'); }
.land.jetty { background-image: url('./assets/shore/jetty.png'); }
.land.boat { background-image: url('./assets/shore/boat.png'); }
.land.beach { background-image: url('./assets/shore/beach.png'); }
.land.mud { background-image: url('./assets/shore/mud.png'); }
.land.reef { background-image: url('./assets/shore/reef.png'); }
@media (max-width: 700px), (max-height: 500px) {
  .land { --tile: 128px; }
}
/* Light rays slanting down into the water, fading with depth; still, so nothing repaints the whole water. */
.rays {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(105deg, rgb(255 255 255 / 0.06) 0 40px, transparent 40px 120px);
  mask-image: linear-gradient(180deg, #000 10%, transparent 85%);
}
/* The water's side is a size container, so the bubbles rise its full height (cqh). Deeper water
   darkens in flat steps, like the pixel art in front of it. */
.underwater {
  overflow: hidden;
  container-type: size;
  --px: 3px;
  background: linear-gradient(
    180deg,
    transparent 0 34%,
    rgb(3 12 22 / 0.08) 34% 52%,
    rgb(3 12 22 / 0.16) 52% 70%,
    rgb(3 12 22 / 0.24) 70%
  );
}
@media (max-width: 700px), (max-height: 500px) {
  .underwater { --px: 2px; }
}
/* Pixel strips from `npm run shore`, repeated sideways at the sprites' scale (--px per pixel). */
.backdrop, .bed, .school { position: absolute; background-repeat: repeat-x; image-rendering: pixelated; }
/* Far shapes standing on the bed, faded into the water so they stay behind the creatures. */
.backdrop {
  inset: auto 0 calc(14 * var(--px));
  height: calc(48 * var(--px));
  background-size: calc(128 * var(--px)) 100%;
  opacity: 0.4;
}
.backdrop.kelp { background-image: url('./assets/shore/back-kelp.png'); }
.backdrop.reeds { background-image: url('./assets/shore/back-reeds.png'); }
.backdrop.rocks { background-image: url('./assets/shore/back-rocks.png'); }
.backdrop.coral { background-image: url('./assets/shore/back-coral.png'); }
.bed {
  inset: auto 0 0;
  height: calc(24 * var(--px));
  background-size: calc(64 * var(--px)) 100%;
}
.bed.sand { background-image: url('./assets/shore/bed-sand.png'); }
.bed.mud { background-image: url('./assets/shore/bed-mud.png'); }
.bed.rock { background-image: url('./assets/shore/bed-rock.png'); }
.bed.coral { background-image: url('./assets/shore/bed-coral.png'); }
.bed.deep { background-image: url('./assets/shore/bed-deep.png'); }
/* A small school far off, crossing slowly from left to right now and then. */
.school {
  top: 58%;
  left: 0;
  width: calc(26 * var(--px));
  height: calc(12 * var(--px));
  background: url('./assets/shore/school.png') 0 0 / 100% 100%;
  opacity: 0.3;
  animation: school-swim 38s linear -12s infinite;
}
@keyframes school-swim {
  from { transform: translate(-100%, 0); }
  50% { transform: translate(50cqw, -6cqh); }
  to { transform: translate(100cqw, 2cqh); }
}
.seaweed { position: absolute; bottom: calc(8 * var(--px)); transform-origin: 50% 100%; animation: seaweed-sway 5s ease-in-out infinite alternate; }
.seaweed.flip > :deep(.sprite) { scale: -1 1; }
@keyframes seaweed-sway {
  from { transform: rotate(-3deg); }
  to { transform: rotate(3deg); }
}
@media (prefers-reduced-motion: reduce) {
  .seaweed, .school { animation: none; }
  .school { display: none; }
}
/* An <svg> doesn't stretch to `inset: 0` like a div: it needs its size, or it stays 300×150 and clips the lines. */
.scene { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; pointer-events: none; }
/* The bank seen from above: the land ends on the shore line under his feet, its side drops into
   the water below it, foam where it meets the water, and a shadow on the water past that. */
.bank-shadow { stroke: rgb(4 14 24 / 0.28); stroke-width: 12; transform: translateY(22px); }
.bank-side { stroke: var(--bank-side); stroke-width: 14; transform: translateY(7px); }
.bank-rim { stroke: var(--bank-rim); stroke-width: 2; transform: translateY(1px); }
.surface-foam { stroke: rgb(255 255 255 / 0.22); stroke-width: 8; transform: translateY(16px); }
.surface-line { stroke: rgb(255 255 255 / 0.75); stroke-width: 2; transform: translateY(14px); }
.scene.grass { --bank-side: #6b4a2b; --bank-rim: #8cc463; }
.scene.rocks { --bank-side: #4a5054; --bank-rim: #b1b6b9; }
.scene.jetty { --bank-side: #4a321d; --bank-rim: #c09a66; }
.scene.boat { --bank-side: #ece6d6; --bank-rim: #7a5a37; }
.scene.beach { --bank-side: #b8995e; --bank-rim: #f3e6be; }
.scene.mud { --bank-side: #3f3424; --bank-rim: #8a9a45; }
.scene.reef { --bank-side: #b49a7c; --bank-rim: #f6e7d6; }
/* He stands on the shore, in the upper left; the shore line is drawn under his feet (measureScene). */
.player-anchor.raised { position: absolute; left: var(--player-x, 28%); bottom: 46%; transform: translateX(-50%); }
.player-anchor { position: relative; }
/* Behind him (he faces the water), at his feet: clear of the log above. */
.player-hold {
  position: absolute;
  right: 66%;
  bottom: 2%;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 10px 2px 4px;
  border: 2px solid #0d1a26;
  border-radius: 12px;
  background: var(--block);
  color: #0d1a26;
  font-size: 1.25rem;
  font-weight: 800;
  box-shadow: 0 3px 8px rgb(0 0 0 / 0.4);
  cursor: help;
}
.player-hold .game-icon { width: 28px; height: 28px; }
/* A short pop each time it changes. */
.hold-enter-active { transition: transform 0.25s cubic-bezier(0.3, 1.6, 0.5, 1), opacity 0.2s ease; }
.hold-leave-active { position: absolute; transition: opacity 0.2s ease; }
.hold-enter-from { transform: scale(0.4); opacity: 0; }
.hold-leave-to { opacity: 0; }
.enemies { display: flex; gap: 24px; }
.enemies.crowded { gap: 10px; }
.enemies.crowded :deep(.hud) { width: 170px; }
/* A caught creature fades out of the battlefield; the others slide over. */
.enemies > .leave-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.enemies > .leave-leave-to { opacity: 0; transform: translateY(12px) scale(0.9); }
.enemies > .leave-move { transition: transform 0.4s ease; }
.caught-notes {
  position: absolute;
  top: 16px;
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

.log-box {
  position: absolute;
  top: 16px;
  left: 16px;
  max-width: 260px;
}
.log-toggle {
  padding: 0 6px;
  border: none;
  border-radius: 8px;
  background: rgb(10 14 20 / 0.6);
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.4;
  cursor: pointer;
}
@media (hover: hover) {
  .log-toggle:hover { color: var(--text); }
}
.log {
  margin: 0;
  padding: 6px 10px;
  list-style: none;
  font-size: 0.72rem;
  color: var(--muted);
  /* Readable on any ground, light sand or dark rock. */
  border-radius: 8px;
  background: rgb(10 14 20 / 0.6);
}
.log li:first-child { color: var(--text); }

.controls { display: flex; align-items: flex-end; gap: 16px; padding: 0 8px 12px; }
.side { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 120px; }
.hand {
  position: relative;
  flex: 1;
  /* It may not push the side panels off screen: a crowded hand overlaps fan-style on wide
     windows, and mid-width windows scroll it instead (see the mid-width rules). */
  min-width: 0;
  display: flex;
  justify-content: center;
  gap: 8px;
  padding-top: 24px;
  min-height: 180px;
  align-items: flex-end;
  /* Cards hang below the screen edge, so a hover must lift them fully clear of it — with the
     small lift, the bottom lines of a long rules text stayed cut off. */
  --card-hover-lift: -60px;
  /* One row, always: a hand that doesn't fit overlaps fan-style instead of wrapping into rows
     (which would leave the upper rows floating above the screen edge). */
  flex-wrap: nowrap;
}
/* Each card sits in a slot that holds the fan (tilt and dip); the card's own transforms (hover
   lift, selected, drag) apply on top of it. The slot's bottom margin pulls each card below the
   screen edge (clipped by .combat), like cards held in a real hand — and it frees the space the
   battlefield now uses. A slot narrower than its card lets crowded hands overlap; the pivot
   (70px = half a card) and the tilt then stay with the card, not the shrunken slot. */
.slot {
  display: flex;
  min-width: 0;
  margin-bottom: -40px;
  transform-origin: 70px 100%;
  transition: transform 0.25s ease;
}
.hint { position: absolute; top: -6px; margin: 0; color: var(--highlight); font-weight: 600; pointer-events: none; }

.hand :deep(.card) { touch-action: none; user-select: none; }
.hand :deep(.card.held) { position: relative; z-index: 5; transition: none; pointer-events: none; box-shadow: 0 18px 30px rgb(0 0 0 / 0.6); }

/* Mid-width windows: the hand doesn't fit beside both side panels. It keeps its cards whole and
   scrolls sideways instead (like compact screens' hand), so no card is squeezed into a sliver.
   A scroll container clips at its own edges, so the top padding holds the whole hover lift and the
   matching negative margin slides the container over the battlefield's bottom edge: a hovered
   card rises above the fight section, like on wide windows. Only the slots take pointer events
   (the container's top strip covers the battlefield, which must stay clickable), and a dragged
   card goes fixed to escape the scroll clip while it follows the pointer. */
@media (min-width: 701px) and (max-width: 1050px) {
  .hand {
    justify-content: safe center;
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 0;
    margin-top: -60px;
    padding: 84px 45px 8px;
    --card-hover-lift: -60px;
    scrollbar-width: thin;
    pointer-events: none;
  }
  .hand .slot { flex-shrink: 0; margin-bottom: 0; pointer-events: auto; }
  .hand :deep(.card) { flex-shrink: 0; touch-action: pan-x; }
  .hand :deep(.card.held) { position: fixed; left: var(--held-left); top: var(--held-top); }
}
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
  .slot { transition: none; }
}

/* The player's two resource counters, at home on the battlefield: a glowing disc each, so they
   read as a pair (the tooltip tells them apart). */
/* Every HUD piece keeps at least 16px inside the battlefield's edges, so nothing is clipped. */
.resources { position: absolute; bottom: 16px; left: 16px; z-index: 2; display: flex; flex-direction: column; gap: 8px; }
.player-hud { display: flex; flex-direction: column; gap: 4px; width: 170px; }
.orbs { display: flex; gap: 10px; }
.turn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  margin: 0;
  padding: 3px 12px;
  border-radius: 999px;
  background: rgb(20 24 32 / 0.9);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 700;
}

.energy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe08a, var(--energy) 60%, #a5741b);
  color: #1b1d24;
  font-weight: 800;
  box-shadow: 0 0 16px rgb(242 182 66 / 0.45);
}
.energy-icon { font-size: 2rem; }
/* Flush against its counter: the icon and the count share line-height 1. */
.energy-icon, .energy-count { line-height: 1; }
.energy-count { font-size: 1.1rem; }
.pile { font-size: 0.85rem; color: var(--muted); }
.patience {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #cfeaff, #6fb7e3 60%, #2a5f8a);
  color: #12283c;
  cursor: help;
  box-shadow: 0 0 16px rgb(111 183 227 / 0.45);
}
.patience-icon { font-size: 2rem; }
.patience-icon, .patience-count { line-height: 1; }
.patience-count { font-size: 1.1rem; font-weight: 800; }
.patience.empty { opacity: 0.55; }
.patience:focus { outline: none; }
.patience:focus-visible { outline: 2px solid var(--highlight); }
.end-turn { padding: 12px 18px; font-size: 1rem; }

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(10 11 15 / 0.7);
  border-radius: 16px;
}
.panel { padding: 28px 40px; border-radius: 16px; background: var(--panel-soft); border: 1px solid var(--line); box-shadow: 0 18px 50px rgb(0 0 0 / 0.5); backdrop-filter: blur(4px); text-align: center; }
.panel h2 { margin: 0 0 8px; font-size: 2rem; }

/* Small screens (COMPACT_QUERY): creatures wrap, the counters and End Turn go in a row above the
   hand, and the hand scrolls sideways (a sideways swipe scrolls, an upward drag still plays). The
   fight log is left out: the cards and intents say what happens. */
@media (max-width: 700px), (max-height: 500px) {
  .combat { gap: 8px; }
  .battlefield { flex-wrap: wrap; justify-content: center; gap: 4px 12px; padding: 8px 4px; }
  /* The fisherman on the bank (one creature): it keeps to the right, clear of him. */
  .battlefield.bank { justify-content: flex-end; }
  .player-anchor.raised { bottom: 48%; }
  /* He stands near the left edge here, and the log is hidden: the Hold goes over his head. */
  .player-hold { right: auto; left: 20%; bottom: 84%; padding: 1px 8px 1px 3px; font-size: 1rem; }
  .player-hold .game-icon { width: 22px; height: 22px; }
  .enemies { flex-wrap: wrap; justify-content: center; gap: 4px 8px; }
  .log-box { display: none; }
  /* Wrapped combatants take the bottom corners, so the panel goes top left (the log is gone);
     with the fisherman up on the bank, the bottom left is free and it stays there. */
  .battlefield:not(.bank) .resources { top: 16px; bottom: auto; }
  .player-hud { width: 130px; }
  .controls { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 6px; padding: 0 0 6px; }
  .controls .side { flex-direction: row; flex-wrap: wrap; justify-content: flex-start; gap: 6px 10px; min-width: 0; }
  .controls .side:last-child { justify-content: flex-end; }
  .hand {
    grid-column: 1 / -1;
    grid-row: 2;
    flex-wrap: nowrap;
    justify-content: safe center;
    overflow-x: auto;
    min-height: 0;
    padding: 20px 6px 8px;
    scrollbar-width: none;
    /* No part of the card is hidden here, so the normal lift is enough. */
    --card-hover-lift: -16px;
  }
  .hand .slot { flex-shrink: 0; margin-bottom: 0; }
  .hand :deep(.card) { flex-shrink: 0; touch-action: pan-x; }
  /* A dragged card goes fixed to escape the scrolling hand's clip, pinned where it was picked up
     (a fixed card's own position would ignore the hand's scroll); its slot keeps the card's size
     so the rest of the hand doesn't close up. */
  .hand .slot:has(.held) { width: 118px; height: 166px; }
  .hand :deep(.card.held) { position: fixed; left: var(--held-left); top: var(--held-top); }
  /* Out of the scrolling hand, so it's never cut off: just above it, in the middle of the screen. */
  .hint {
    position: fixed;
    top: auto;
    bottom: calc(env(safe-area-inset-bottom) + 182px);
    left: 50%;
    z-index: 6;
    transform: translateX(-50%);
    padding: 2px 10px;
    border-radius: 999px;
    background: rgb(15 18 25 / 0.85);
    white-space: nowrap;
    font-size: 0.8rem;
  }
  .energy { width: 48px; height: 48px; }
  .energy-icon { font-size: 1.6rem; }
  .energy-count { font-size: 0.9rem; }
  .patience { width: 48px; height: 48px; }
  .patience-icon { font-size: 1.6rem; }
  .patience-count { font-size: 0.9rem; }
  .end-turn { padding: 10px 14px; }
  .pile { font-size: 0.75rem; }
  .panel { padding: 20px 22px; margin: 0 12px; }
  .panel h2 { font-size: 1.5rem; }
}

/* A phone lying flat: too short to stack them, so the battlefield on the left, the counters and
   the hand on the right. */
@media (max-height: 500px) and (orientation: landscape) {
  .combat { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); height: 100%; min-height: 0; gap: 8px; }
  .battlefield { min-height: 0; overflow-y: auto; align-content: center; }
  .controls { align-content: end; align-self: end; }
  .hint { left: 75%; }
}
</style>
