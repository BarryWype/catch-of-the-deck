<script setup lang="ts">
import KeywordText from './KeywordText.vue';
import GameIcon from './GameIcon.vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { bondLevel, bondToFull, companionStars, describeCompanionEffect, MAX_BOND_LEVEL, type Catch, type GameData, type Habitat } from '../engine';
import AnimatedSprite from './AnimatedSprite.vue';
import BaitConfirm from './BaitConfirm.vue';
import BaitLabel from './BaitLabel.vue';
import { t } from './i18n';
import PixelBubbles from './PixelBubbles.vue';
import SpriteView from './SpriteView.vue';
import { HOLD_ICON } from './icons';
import { animatedSheetFor, creatureClip } from './sprites';

const props = withDefaults(
  defineProps<{
    /** Creatures to show (a run's bucket, or the home aquarium). */
    creatures: Catch[];
    /** How many it holds, when it's limited (the bucket): the count reads "n/capacity". */
    capacity?: number;
    data: GameData;
    /** Header, e.g. "Bucket" or "Home aquarium". */
    title?: string;
    icon?: string;
    /** False: just to look at, creatures can't be clicked. */
    interactive?: boolean;
    /** What clicking a creature offers: selling it, bringing it for the session, or only using it as bait (in a fight). */
    action?: 'sell' | 'bring' | 'bait';
    /** Also offer using it as bait, next to selling. */
    bait?: boolean;
    /** The bait button's text, when it isn't a plain "Use as bait". */
    baitLabel?: string;
    /** In a fight: room left in the hand, for where the bait cards go. */
    handSpace?: number;
    /** Why bringing is unavailable right now (e.g. all slots taken), if it is. */
    bringBlocked?: string;
    /**
     * In a run's bucket: the first this-many creatures were brought from home and give their bonus;
     * the rest were caught and are angry. Omit outside a run.
     */
    companions?: number;
    /** Bond points of each creature, in the same order (home aquarium, or a bucket's companions). */
    bonds?: number[];
    /** The sell button's text, when it isn't a plain "Sell". */
    sellLabel?: string;
  }>(),
  {
    interactive: true,
    capacity: undefined,
    title: undefined,
    icon: '🐠',
    action: 'sell',
    bringBlocked: undefined,
    companions: undefined,
    bonds: undefined,
    sellLabel: undefined,
    bait: false,
    baitLabel: undefined,
    handSpace: undefined,
  },
);
const emit = defineEmits<{ sell: [slot: number]; bring: [slot: number]; bait: [slot: number] }>();

const SIZE = 96;

/** Stable pseudo-random number in [0, 1) per (creature slot, channel), so fish keep their lanes. */
function rand(slot: number, channel: number) {
  const x = Math.sin(slot * 127.1 + channel * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Stable number per string, so a fish keeps its lane when others are sold. */
function hash(text: string) {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) % 10007;
  return h;
}

function placement(habitat: Habitat, slot: number) {
  return { '--bob': `${(3 + rand(slot, 4) * 3).toFixed(1)}s`, zIndex: habitat === 'bottom' ? 3 : 2 };
}

/**
 * How each habitat wanders: its speed (px/s), how often it rests between moves, how far one move
 * goes (share of the tank's width, and of its height), and the band of height it keeps to (share
 * of the room left under the creature: 0 is the top, 1 the sand).
 */
const PACE: Record<Habitat, { speed: [number, number]; rest: number; reach: number; rise: number; band: [number, number] }> = {
  swim: { speed: [45, 85], rest: 0.25, reach: 0.6, rise: 0.3, band: [0.06, 0.62] },
  drift: { speed: [14, 28], rest: 0.4, reach: 0.4, rise: 0.25, band: [0.04, 0.45] },
  bottom: { speed: [10, 22], rest: 0.6, reach: 0.3, rise: 0, band: [0.94, 0.98] },
};

interface Swimmer { el: HTMLElement; habitat: Habitat; x: number; y: number; placed: boolean; move?: Animation; timer?: number }
const swimmers = new Map<string, Swimmer>();
const stillWater = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const between = (low: number, high: number) => low + Math.random() * (high - low);
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const at = (x: number, y: number) => `translate(${Math.round(x)}px, ${Math.round(y)}px)`;

/** The room a creature has to move in: the tank less its own size. */
function room(el: HTMLElement) {
  const tank = el.parentElement;
  return { w: (tank?.clientWidth ?? 0) - el.offsetWidth, h: (tank?.clientHeight ?? 0) - el.offsetHeight };
}

/**
 * One move at a time, each to a random spot near the last (or a rest in place), on the compositor
 * (a transform animation per move, committed to the style when it ends). The sprite faces the
 * way it swims: sprites face left, so `.bob` mirrors them when heading right.
 */
function wander(s: Swimmer) {
  if (!s.el.isConnected) return;
  if (!s.placed) place(s);
  const { w, h } = room(s.el);
  const pace = PACE[s.habitat];
  if (!s.placed || Math.random() < pace.rest) {
    s.timer = window.setTimeout(() => wander(s), between(600, 3000));
    return;
  }
  const x = clamp(s.x + between(-1, 1) * pace.reach * w, 0, w);
  const y = clamp(s.y + between(-1, 1) * pace.rise * h, pace.band[0] * h, pace.band[1] * h);
  const bob = s.el.querySelector<HTMLElement>('.bob');
  if (bob && Math.abs(x - s.x) > 4) bob.style.scale = x > s.x ? '-1 1' : '1 1';
  const duration = Math.max(800, (Math.hypot(x - s.x, y - s.y) / between(...pace.speed)) * 1000);
  const move = s.el.animate([{ transform: at(s.x, s.y) }, { transform: at(x, y) }], { duration, easing: 'ease-in-out' });
  s.move = move;
  move.finished
    .then(() => {
      s.el.style.transform = at(x, y);
      Object.assign(s, { x, y });
      wander(s);
    })
    .catch(() => {}); // Cancelled: the creature left the tank.
}

/**
 * A random start spot in the tank. On a fresh page the tank has no size yet when its creatures
 * appear: they stay hidden until it has one (see refit and wander), rather than all starting in
 * the top-left corner.
 */
function place(s: Swimmer) {
  const { w, h } = room(s.el);
  if (w <= 0 || h <= 0) return;
  Object.assign(s, { x: Math.random() * w, y: between(...PACE[s.habitat].band) * h, placed: true });
  s.el.style.transform = at(s.x, s.y);
  s.el.style.visibility = '';
}

/** Starts a creature at a random spot when it enters the tank, and stops it when it leaves. */
function track(key: string, habitat: Habitat, el: Element | null) {
  const known = swimmers.get(key);
  if (el && known?.el === el) return;
  if (known) stop(key);
  if (!(el instanceof HTMLElement)) return;
  const s: Swimmer = { el, habitat, x: 0, y: 0, placed: false };
  el.style.visibility = 'hidden';
  place(s);
  swimmers.set(key, s);
  if (!stillWater) s.timer = window.setTimeout(() => wander(s), between(0, 1500));
}
function stop(key: string) {
  const s = swimmers.get(key);
  s?.move?.cancel();
  clearTimeout(s?.timer);
  swimmers.delete(key);
}
/** When the tank changes size (a window resize, a phone turning), creatures outside it come back in. */
function refit() {
  for (const s of swimmers.values()) {
    if (!s.placed) {
      place(s);
      continue;
    }
    const { w, h } = room(s.el);
    const band = PACE[s.habitat].band;
    const x = clamp(s.x, 0, Math.max(0, w));
    const y = clamp(s.y, band[0] * Math.max(0, h), band[1] * Math.max(0, h));
    if (x === s.x && y === s.y) continue;
    s.move?.cancel();
    clearTimeout(s.timer);
    Object.assign(s, { x, y });
    s.el.style.transform = at(x, y);
    if (!stillWater) s.timer = window.setTimeout(() => wander(s), between(0, 1500));
  }
}
const tank = ref<HTMLElement>();
const resizes = new ResizeObserver(refit);
onMounted(() => tank.value && resizes.observe(tank.value));
onBeforeUnmount(() => {
  resizes.disconnect();
  [...swimmers.keys()].forEach(stop);
});

const residents = computed(() => {
  const copies = new Map<string, number>();
  return props.creatures.map(({ id, size, lifeJacket }, slot) => {
    const def = props.data.enemies[id];
    const points = props.bonds?.[slot];
    const habitat = def?.habitat ?? 'swim';
    const copy = copies.get(id) ?? 0;
    copies.set(id, copy + 1);
    const key = `${id}#${copy}`;
    return {
      key,
      slot,
      name: def?.name ?? id,
      sellValue: def?.sellValue ?? 0,
      habitat,
      url: def?.sprite ? animatedSheetFor(def.sprite) : undefined,
      sprite: def?.sprite,
      portrait: def?.portrait ?? '🐟',
      style: placement(habitat, hash(key)),
      bonus: def?.temperament ? props.data.companionBonuses[def.temperament] : undefined,
      angry: props.companions !== undefined && slot >= props.companions,
      bond: bondOf(id, points),
      lifeJacket: !!lifeJacket,
      size,
      stars: points === undefined ? undefined : companionStars({ id, bond: points, size }, props.data),
    };
  });
});

/** Bond level and progress, or undefined when this aquarium doesn't track bonds. */
function bondOf(id: string, points: number | undefined) {
  if (points === undefined) return undefined;
  const level = bondLevel({ id, bond: points, size: 'normal' }, props.data);
  const text = t(level === MAX_BOND_LEVEL ? 'aquarium.bondFull' : 'aquarium.bond', { level, points, full: bondToFull(id, props.data) });
  return { level, text };
}

type Resident = (typeof residents.value)[number];

/** Hover text for a creature: its name, then its size, stars, sell value and mood, and its bond. */
function residentTip(r: Resident) {
  const detail = [
    t(`size.${r.size}`),
    r.stars ? t('aquarium.stars', { n: r.stars }) : '',
    props.interactive && props.action === 'sell' ? t('aquarium.sellsFor', { coins: r.sellValue }) : '',
    r.angry ? t('aquarium.angry') : '',
    r.lifeJacket ? t('shop.lifeJacket') : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return { title: r.name, detail: detail || undefined, body: r.bond ? `♥ ${r.bond.text}` : undefined };
}

const selectedKey = ref<string | null>(null);
const selected = computed(() => residents.value.find((r) => r.key === selectedKey.value));

function act(r: Resident | undefined = selected.value) {
  if (!r) return;
  if (props.action === 'sell') emit('sell', r.slot);
  else emit('bring', r.slot);
  selectedKey.value = null;
}

/** The same creatures as a list, easier to pick from than a crowded tank. Stays open between actions. */
const list = ref<HTMLDialogElement>();

const baitable = computed(() => props.action === 'bait' || props.bait);
/** Using a creature as bait asks first (`BaitConfirm`). */
const baitConfirm = ref<InstanceType<typeof BaitConfirm>>();
let baitSlot = -1;
function askBait(r: Resident) {
  baitSlot = r.slot;
  baitConfirm.value?.open(props.creatures[r.slot], props.companions !== undefined && r.slot < props.companions);
}
function bait() {
  emit('bait', baitSlot);
  selectedKey.value = null;
}

// Decoration: seaweed from objects.png (1 green algae, 2 red algae, 3 seaweed). `flip` mirrors the
// sprite so they don't all lean the same way. Bubbles: PixelBubbles.
const plants = [
  { index: 3, left: '4%', size: 96, delay: '0s' },
  { index: 1, left: '15%', size: 72, delay: '-1.2s', flip: true },
  { index: 2, left: '47%', size: 80, delay: '-2.1s' },
  { index: 3, left: '78%', size: 88, delay: '-0.6s', flip: true },
  { index: 1, left: '90%', size: 64, delay: '-1.7s' },
];
</script>

<template>
  <section class="aquarium" :aria-label="title ?? t('aquarium.default')">
    <div ref="tank" class="tank">
      <component
        :is="interactive && creatures.length ? 'button' : 'span'"
        class="count"
        :class="{ full: capacity !== undefined && creatures.length >= capacity }"
        v-tip="interactive && creatures.length ? t('aquarium.listTip') : undefined"
        @click="interactive && creatures.length && list?.showModal()"
      >
        <span v-if="interactive && creatures.length" aria-hidden="true">☰ </span>
        {{ capacity === undefined ? t('aquarium.count', { n: creatures.length }) : t('aquarium.countOf', { n: creatures.length, max: capacity }) }}
      </component>
      <div class="surface" />
      <div class="rays" />
      <PixelBubbles />

      <div class="sand" />
      <div
        v-for="(p, i) in plants"
        :key="`p${i}`"
        class="plant"
        :class="{ flip: p.flip }"
        :style="{ left: p.left, animationDelay: p.delay }"
      >
        <SpriteView :sprite="{ sheet: 'objects', index: p.index }" :size="p.size" />
      </div>

      <!-- Each creature wanders the tank by transform only (see wander). -->
      <div
        v-for="r in residents"
        :key="r.key"
        :ref="(el) => track(r.key, r.habitat, el as Element | null)"
        class="resident"
        :class="[r.habitat, { selected: r.key === selectedKey, interactive }]"
        :style="r.style"
      >
        <div
          class="fish"
          v-tip="residentTip(r)"
          :role="interactive ? 'button' : undefined"
          :tabindex="interactive ? 0 : undefined"
          @click="interactive && (selectedKey = r.key)"
          @keydown.enter="interactive && (selectedKey = r.key)"
        >
          <div class="bob">
            <AnimatedSprite v-if="r.url" :clip="creatureClip(r.url, 'idle')" :size="SIZE" />
            <SpriteView v-else-if="r.sprite" :sprite="r.sprite" :size="SIZE * (2 / 3)" />
            <span v-else class="emoji">{{ r.portrait }}</span>
          </div>
          <!-- Outside .bob, which mirrors the sprite, so the badges read the right way. -->
          <span v-if="r.lifeJacket" class="jacket" aria-hidden="true"><GameIcon :icon="HOLD_ICON" /></span>
          <span v-if="r.angry" class="angry" aria-hidden="true">💢</span>
          <span v-else-if="r.bond?.level" class="bond" :class="{ full: r.bond.level === MAX_BOND_LEVEL }" aria-hidden="true">
            ♥{{ r.bond.level }}
          </span>
        </div>
      </div>

      <div v-if="selected" class="sell-panel" @keydown.esc="selectedKey = null">
        <strong>{{ selected.name }}</strong>
        <span class="size">{{ t(`size.${selected.size}`) }}<template v-if="selected.stars"> · <span class="stars">{{ t('aquarium.stars', { n: selected.stars }) }}</span></template></span>
        <span v-if="selected.bond" class="bond-text">♥ {{ selected.bond.text }}</span>
        <template v-if="action !== 'bring'">
          <span v-if="selected.angry" class="mood">{{ t('aquarium.angryMood') }}</span>
          <span v-else-if="companions !== undefined && selected.bonus" class="mood">
            {{ selected.bonus.icon }} {{ t('aquarium.companionMood', { bonus: selected.bonus.name }) }}
          </span>
          <span v-if="action === 'sell'" class="sell-value"><GameIcon icon="🪙" /> {{ selected.sellValue }}</span>
          <div class="actions">
            <button v-if="action === 'sell'" @click="act()">{{ sellLabel ?? t('aquarium.sell') }}</button>
            <button v-if="baitable" class="bait" @click="askBait(selected)">
              <BaitLabel :text="baitLabel ?? t('bait.use')" :creature="creatures[selected.slot]" :data="data" />
            </button>
            <button class="ghost" @click="selectedKey = null">{{ t('aquarium.keep') }}</button>
          </div>
        </template>
        <template v-else>
          <div v-if="selected.bonus" class="bonus">
            <b>{{ selected.bonus.icon }} {{ selected.bonus.name }}</b> · {{ selected.bonus.temperamentName }}
            <p v-for="(effect, i) in selected.bonus.effects" :key="i"><KeywordText :text="describeCompanionEffect(effect)" /></p>
          </div>
          <div class="actions">
            <button v-tip="bringBlocked" :disabled="!!bringBlocked" @click="act()">{{ t('aquarium.bring') }}</button>
            <button class="ghost" @click="selectedKey = null">{{ t('common.cancel') }}</button>
          </div>
          <span v-if="bringBlocked" class="blocked">{{ bringBlocked }}</span>
        </template>
      </div>

      <p v-if="!creatures.length" class="empty">{{ t('aquarium.empty') }}</p>
      <div class="glare" />
    </div>

    <dialog v-if="interactive" ref="list" class="confirm list" :aria-label="title ?? t('aquarium.default')" @click="$event.target === list && list?.close()">
      <h3><GameIcon :icon="icon" /> {{ title ?? t('aquarium.default') }}</h3>
      <ul class="rows">
        <li v-for="r in residents" :key="r.key">
          <SpriteView v-if="r.sprite" :sprite="r.sprite" :size="40" />
          <span v-else class="row-emoji">{{ r.portrait }}</span>
          <span class="row-about">
            <strong>
              {{ r.name }}
              <span v-if="r.lifeJacket" v-tip="t('shop.lifeJacket')"><GameIcon :icon="HOLD_ICON" /></span>
              <span v-if="r.angry" v-tip="t('aquarium.angryMood')">💢</span>
              <span v-else-if="r.bond?.level" class="bond-text" v-tip="r.bond.text">♥{{ r.bond.level }}</span>
            </strong>
            <span class="size">
              {{ t(`size.${r.size}`) }}
              <span v-if="r.stars" class="stars">{{ t('aquarium.stars', { n: r.stars }) }}</span>
              <span v-if="companions !== undefined && !r.angry && r.bonus">{{ r.bonus.icon }} {{ r.bonus.name }}</span>
            </span>
          </span>
          <span v-if="action !== 'bring'" class="row-actions">
            <button v-if="action === 'sell'" @click="act(r)">{{ sellLabel ?? t('aquarium.sell') }} <GameIcon icon="🪙" /> {{ r.sellValue }}</button>
            <button v-if="baitable" class="bait" @click="askBait(r)"><BaitLabel :text="baitLabel ?? t('bait.use')" :creature="creatures[r.slot]" :data="data" /></button>
          </span>
          <button v-else v-tip="bringBlocked" :disabled="!!bringBlocked" @click="act(r)">{{ t('aquarium.bring') }}</button>
        </li>
      </ul>
      <p v-if="!creatures.length">{{ t('aquarium.empty') }}</p>
      <footer>
        <button class="ghost" autofocus @click="list?.close()">{{ t('common.close') }}</button>
      </footer>
    </dialog>
    <BaitConfirm v-if="baitable" ref="baitConfirm" :data="data" :hand-space="handSpace" @confirm="bait" />
  </section>
</template>

<style scoped>
.aquarium { display: flex; flex-direction: column; gap: 6px; min-height: 220px; }
.label { display: flex; justify-content: space-between; font-weight: 700; padding: 0 4px; }
.count { color: var(--muted); font-weight: 500; text-shadow: 2px 0 0 #2e1c2c, -2px 0 0 #2e1c2c, 0 2px 0 #2e1c2c, 0 -2px 0 #2e1c2c, 2px 2px 0 #2e1c2c, -2px 2px 0 #2e1c2c, 2px -2px 0 #2e1c2c, -2px -2px 0 #2e1c2c, 0 3px 6px rgb(0 0 0 / 0.8); position: absolute;
  right: 10px; }
.count.full { color: #f0a050; font-weight: 700; }
button.count { z-index: 6; padding: 0 8px; border: 1px solid var(--line); border-radius: 999px; background: rgb(255 255 255 / 0.05); }
@media (hover: hover) {
  button.count:hover { background: rgb(255 255 255 / 0.12); }
}

.list { width: min(520px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); }
.list[open] { display: flex; flex-direction: column; }
.rows { display: flex; flex-direction: column; gap: 6px; min-height: 0; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.rows li { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border: 1px solid #2c3a4a; border-radius: 10px; background: linear-gradient(180deg, #1f3448, #17283a); }
.row-emoji { width: 40px; font-size: 1.8rem; text-align: center; }
.row-about { display: flex; flex: 1; flex-direction: column; min-width: 0; line-height: 1.25; }
.row-about .size { display: flex; flex-wrap: wrap; gap: 0 6px; color: var(--muted); font-size: 0.75rem; }
.rows .stars { color: #f2c94c; }
.rows .bond-text { color: #f08bb0; }
.rows button { flex: none; white-space: nowrap; }
.row-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }

.tank {
  --size: 96px;
  position: relative;
  flex: 1;
  overflow: hidden;
  /* Its size is what the bubbles' rise (100cqh) is measured against: `size` rather than
     `inline-size`, so they can rise a whole tank height. The tank's height never depends on its
     contents (everything inside is absolutely positioned). */
  container-type: size;
  border: 6px solid #5c6b78;
  border-top-width: 10px;
  border-radius: 10px 10px 14px 14px;
  background: linear-gradient(180deg, #4fa6c7 0%, #2b7fa8 30%, #1d5f86 70%, #164a6b 100%);
  box-shadow: inset 0 0 40px rgb(0 0 0 / 0.35), 0 8px 18px rgb(0 0 0 / 0.4);
}

/* Water line just under the rim. */
.surface {
  position: absolute;
  inset: 0 0 auto;
  height: 10px;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.35), transparent);
}
/* Static on purpose: an animated full-tank layer would be blended over the whole tank every
   frame (a full-screen menu did exactly that); flattened into the tank like this, it's free. */
.rays {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(105deg, rgb(255 255 255 / 0.06) 0 40px, transparent 40px 110px);
}
.glare {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(120deg, rgb(255 255 255 / 0.12) 0%, transparent 25%, transparent 75%, rgb(255 255 255 / 0.05) 100%);
  z-index: 5;
}
.sand {
  position: absolute;
  inset: auto 0 0;
  height: 14%;
  min-height: 26px;
  background:
    radial-gradient(ellipse 60% 60% at 30% 0%, #e2c98f 0 40%, transparent 41%),
    radial-gradient(ellipse 50% 70% at 80% 10%, #d8bd80 0 40%, transparent 41%),
    linear-gradient(180deg, #d4b679, #b8975a);
  z-index: 1;
}

.plant {
  position: absolute;
  bottom: 4%;
  transform-origin: 50% 100%;
  animation: sway 4s ease-in-out infinite alternate;
  z-index: 1;
}
/* The wrapper's transform belongs to the sway animation, so the mirror goes on the sprite. */
.plant.flip > :deep(.sprite) { scale: -1 1; }

/* Residents: the outer element wanders the tank (moved from the script, see wander), and `.bob`
   turns the sprite to face its way (sprites face left; `scale`) and adds a little vertical life
   (`translate`). Each is only as big as its creature, so a full-window tank doesn't make every
   moving layer window-wide. */
.resident {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--size);
  pointer-events: none;
}
.fish { position: relative; width: var(--size); pointer-events: auto; }
.bob { transition: scale 0.3s ease; animation: bob var(--bob) ease-in-out infinite alternate; }
.drift .bob { animation: drift calc(var(--bob) * 2) ease-in-out infinite alternate; }
.bottom .bob { animation: none; }
.emoji { font-size: 3rem; }

.resident.interactive .fish { cursor: pointer; }
.fish:focus { outline: none; }
.resident.interactive .fish:hover .bob,
.resident.interactive .fish:focus-visible .bob { filter: drop-shadow(0 0 4px rgb(255 255 255 / 0.7)); }
.resident.selected .bob { filter: drop-shadow(0 0 6px var(--highlight)); }

.sell-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgb(20 24 32 / 0.9);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.4);
}
.sell-panel .sell-value { color: var(--energy); font-weight: 700; }
.sell-panel { max-width: 260px; text-align: center; }
.sell-panel .bonus { font-size: 0.78rem; }
.sell-panel .bonus p, .sell-panel .mood { margin: 2px 0 0; color: var(--muted); font-size: 0.75rem; }
.bond {
  position: absolute;
  top: -2px;
  right: 14px;
  padding: 0 5px;
  border-radius: 8px;
  background: rgb(201 74 120 / 0.85);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  pointer-events: none;
}
.bond.full { background: #d9a520; }
.sell-panel .bond-text { color: #f08bb0; font-size: 0.75rem; }
.sell-panel .size { color: var(--muted); font-size: 0.75rem; }
.sell-panel .stars { color: #f2c94c; }
.angry { position: absolute; top: -4px; right: 18px; font-size: 1rem; pointer-events: none; }
/* The life jacket's buoy, on the other side from the mood and bond marks. */
.jacket { position: absolute; top: -4px; left: 14px; font-size: 1rem; pointer-events: none; }
.sell-panel .blocked { color: var(--muted); font-size: 0.75rem; }
.sell-panel .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 4px; }

.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: rgb(255 255 255 / 0.7);
  font-style: italic;
  z-index: 4;
}

@keyframes bob {
  from { translate: 0 -4px; }
  to { translate: 0 4px; }
}
@keyframes drift {
  from { translate: 0 -28px; }
  to { translate: 0 28px; }
}
@keyframes sway {
  from { transform: rotate(-4deg); }
  to { transform: rotate(4deg); }
}

/* Small screens: a shorter tank, smaller creatures. */
@media (max-width: 700px), (max-height: 500px) {
  .aquarium { min-height: 150px; }
  .tank { --size: 72px; }
  .sell-panel { max-width: 200px; font-size: 0.85rem; }
}
@media (prefers-reduced-motion: reduce) {
  .bob, .plant { animation: none; }
}
</style>
