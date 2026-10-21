<script setup lang="ts">
import GameIcon from './GameIcon.vue';
import SpriteView from './SpriteView.vue';
import { iconUrl } from './icons';
import { storeEffectChips } from './storeEffects';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  activeBonuses,
  hasFeature,
  progressionTotal,
  storeItems,
  availableDestinations,
  describeCompanionEffect,
  findNode,
  STORE_KINDS,
  type GameData,
  type MapNode,
  type RunState,
  type StoreKind,
} from '../engine';
import { t } from './i18n';
import { playTheme, stopTheme } from './music';
import { TOUCH_QUERY, useMedia } from './useScreen';
import mapUrl from './assets/coast/map.png';
import cafeNodeUrl from './assets/stores/cafe-node.png';
import tackleNodeUrl from './assets/stores/tackle-node.png';
import baitNodeUrl from './assets/stores/bait-node.png';

const props = defineProps<{ run: RunState; data: GameData }>();
const emit = defineEmits<{ travel: [nodeId: string] }>();

/** The coast art's coordinates, which content/levels.ts and coast.ts use: the land and shallows, then the open sea. */
const ART_WIDTH = 1300;
const ART_HEIGHT = 450;
const RADIUS = 12;
/** Node markers keep the same size on screen whatever the zoom: 1 = RADIUS pixels. Bigger for a finger. */
const touch = useMedia(TOUCH_QUERY);
const nodeSize = computed(() => (touch.value ? 1.3 : 0.9));


const level = computed(() => props.data.levels[props.run.level]);
const nodes = computed(() => props.run.map.columns.flat());
const destinations = computed(() => new Set(availableDestinations(props.run).map((n) => n.id)));
/** The shop the player stands on can be walked back into, until he moves on. */
const reopens = (node: MapNode) => node.id === props.run.position && node.kind === 'shop';
const clickable = (node: MapNode) => destinations.value.has(node.id) || reopens(node);
const visited = computed(() => new Set(props.run.visited));
const currentColumn = computed(() => findNode(props.run.map, props.run.position)?.column ?? 0);
const equipment = computed(() => props.run.equipment.map((id) => props.data.equipment[id]).filter(Boolean));
/** What was bought in stores and still works (`storeEffectChips`), after the companion bonuses. */
const bought = computed(() => storeEffectChips(props.run, props.data));
/** Companion bonuses from the creatures brought along, shown next to the equipment. */
const bonuses = computed(() =>
  activeBonuses(props.run.companions, props.data, progressionTotal(props.run.progression, props.data, 'companionStars')).map((b) => ({ ...b, text: b.effects.map(describeCompanionEffect) })),
);

const edges = computed(() =>
  nodes.value.flatMap((from) =>
    from.next.map((id) => {
      const to = findNode(props.run.map, id)!;
      return {
        key: `${from.id}>${to.id}`,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        fromHome: from.kind === 'start',
        travelled: visited.value.has(from.id) && visited.value.has(to.id),
        open: from.id === props.run.position && destinations.value.has(to.id),
      };
    }),
  ),
);

function nodeState(node: MapNode) {
  if (node.id === props.run.position) return 'current';
  if (destinations.value.has(node.id)) return 'available';
  if (visited.value.has(node.id)) return 'visited';
  return node.column < currentColumn.value ? 'skipped' : 'locked';
}

const SYMBOLS: Partial<Record<MapNode['kind'], string>> = { event: 'question-mark', treasure: 'chest', leave: 'house' };

/** A shop node shows its store's front (assets/stores/<store>-node.png, drawn 1:1). */
const STORE_NODES: Record<StoreKind, string> = { cafe: cafeNodeUrl, tackle: tackleNodeUrl, bait: baitNodeUrl };
const storeOf = (node: MapNode): StoreKind => node.store ?? 'tackle';

const hasTrophy = computed(() => nodes.value.some((n) => n.trophy));
const hasFisherman = computed(() => props.run.map.columns.some((column) => column.some((n) => n.kind === 'fisherman')));

function creatureNames(node: MapNode) {
  return [...new Set((node.enemies ?? []).map((id) => props.data.enemies[id]?.name ?? id))].join(', ');
}

/** Hover text: what the node is. */
function tooltipFor(node: MapNode): { title: string; hint?: string; detail?: string } {
  switch (node.kind) {
    case 'start':
      return { title: props.data.character.home.name };
    case 'shop':
      return {
        title: t(`shop.title.${storeOf(node)}`),
        hint: reopens(node) ? t('map.reenterShop') : undefined,
        detail: storeItems(props.run, { store: storeOf(node) }, props.data).map((item) => item.name).join(' · '),
      };
    case 'event':
      return { title: t('map.event') };
    case 'treasure':
      return { title: t('map.treasure') };
    case 'fisherman':
      return { title: props.data.fishermen[node.fisherman ?? '']?.name ?? t('map.fisherman'), detail: t('map.fishermanDetail') };
    case 'leave':
      return { title: t('map.headHome'), detail: t('map.headHomeDetail') };
    case 'miniBoss':
    case 'boss':
      return { title: `${t(node.kind === 'boss' ? 'map.boss' : 'map.miniBoss')} · ${node.label ?? ''}`, detail: creatureNames(node) };
    default: {
      const spot = node.spot ? props.data.spots[node.spot] : undefined;
      const detail = node.enemies ? creatureNames(node) : node.label && spot?.name;
      if (node.trophy) return { title: `🏆 ${t('map.trophy')} · ${node.label ?? spot?.name ?? ''}`, hint: t('map.trophyDetail'), detail: detail || undefined };
      return { title: node.label ?? spot?.name ?? t('map.fight'), detail: detail || undefined };
    }
  }
}

/** The map is never shorter than this (unless the screen is very short); a level wider than the screen then scrolls sideways. */
const MIN_HEIGHT = 300;

/** The part of the art shown: the whole width, and as far out to sea as the age goes, so the map zooms out as you grow. */
const view = computed(() => ({ x: 0, y: 0, width: ART_WIDTH, height: level.value?.height ?? ART_HEIGHT }));

/** Share of the screen under the top bar the map takes, above the bucket. */
const MAP_SHARE = 0.6;

// MAP_SHARE of the room under the top bar (its layout's height), scrolling sideways when that's
// wider than the screen. On a short screen it may take up to 3/4 of it to stay readable.
const root = ref<HTMLElement>();
const scroller = ref<HTMLElement>();
const room = ref(window.innerHeight);
let resizes: ResizeObserver | undefined;
onMounted(() => {
  playTheme('map'); // The map theme (music.ts).
  const layout = root.value?.parentElement;
  if (!layout) return;
  resizes = new ResizeObserver(() => (room.value = layout.clientHeight));
  resizes.observe(layout);
  room.value = layout.clientHeight;
});
onBeforeUnmount(() => {
  stopTheme();
  resizes?.disconnect();
});
const size = computed(() => {
  const ratio = view.value.width / view.value.height;
  const height = Math.max(Math.min(MIN_HEIGHT, room.value * 0.75), room.value * MAP_SHARE);
  return { width: height * ratio, height };
});
/** Screen pixels per art unit. */
const scale = computed(() => size.value.width / view.value.width);

/** When the map is wider than the screen, keep the current position near the left, with what's next in view.
 * The map is freshly mounted every time the player lands on it, and a visible slide in from the
 * left edge would spoil that landing — so it always jumps (a resize re-centers instantly too). */
watch(
  [() => props.run.position, scale],
  async () => {
    await nextTick();
    const here = findNode(props.run.map, props.run.position);
    if (here) scroller.value?.scrollTo({ left: (here.x - view.value.x) * scale.value - 120, behavior: 'auto' });
  },
  { immediate: true },
);

/** Labels near the right edge extend leftwards, so they stay on the map. */
function labelAnchor(node: MapNode) {
  return node.x > view.value.x + view.value.width - 140 / scale.value ? 'end' : 'middle';
}

/** A mouse drags the map sideways, like a finger does. Past a few pixels it's a drag, and the click that ends it doesn't choose a node. */
const DRAG_THRESHOLD = 5;
let drag: { pointer: number; startX: number; startLeft: number; moved: boolean } | undefined;
const dragging = ref(false);
function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || e.button !== 0 || !scroller.value) return;
  dragged = false;
  drag = { pointer: e.pointerId, startX: e.clientX, startLeft: scroller.value.scrollLeft, moved: false };
}
function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointer || !scroller.value) return;
  const dx = e.clientX - drag.startX;
  if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
  if (!drag.moved) {
    drag.moved = true;
    dragging.value = true;
    scroller.value.setPointerCapture(e.pointerId);
  }
  scroller.value.scrollLeft = drag.startLeft - dx;
}
function onPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.pointer) return;
  dragged = drag.moved;
  drag = undefined;
  dragging.value = false;
}
let dragged = false;
function onClickCapture(e: MouseEvent) {
  if (dragged) e.stopPropagation();
  dragged = false;
}

const showLegend = ref(false);

function choose(node: MapNode) {
  if (clickable(node)) emit('travel', node.id);
}
</script>

<template>
  <section ref="root" class="map-screen">
    <ul v-if="equipment.length || bonuses.length || bought.length" class="equipment" :aria-label="t('map.equipment')">
      <li
        v-for="item in equipment"
        :key="item.id"
        v-tip="{ title: item.name, body: item.description }"
        class="item"
        tabindex="0"
        :aria-label="item.name"
      >
        <SpriteView v-if="item.sprite" class="icon" :sprite="item.sprite" :size="24" />
        <span v-else class="icon"><GameIcon :icon="item.icon ?? '🎒'" /></span>
      </li>
      <li
        v-for="b in bonuses"
        :key="b.def.id"
        v-tip="{ title: b.def.name, detail: t('map.starsBrought', { stars: b.stars, n: b.species, temperament: b.def.temperamentName }), body: b.text.join(' ') }"
        class="item companion"
        tabindex="0"
        :aria-label="b.def.name"
      >
        <span class="icon">{{ b.def.icon ?? '🐟' }}</span>
        <b class="stars" aria-hidden="true">★{{ b.stars }}</b>
      </li>
      <li v-for="b in bought" :key="b.key" v-tip="{ title: b.title, body: b.body }" class="item bought" tabindex="0" :aria-label="b.title">
        <span class="icon"><GameIcon :icon="b.icon" /></span>
        <b v-if="b.badge" class="stars" aria-hidden="true">{{ b.badge }}</b>
      </li>
    </ul>

    <button class="legend-toggle" :aria-expanded="showLegend" @click="showLegend = !showLegend">
      {{ showLegend ? t('map.hideLegend') : t('map.legend') }}
    </button>
    <ul v-if="showLegend" class="legend" :aria-label="t('map.legend')">
      <li v-for="spot in data.spots" :key="spot.id">
        <span class="swatch" :style="{ background: spot.color }" /><b>{{ spot.id }}</b> {{ spot.name }}
      </li>
      <li><span class="sym">?</span> {{ t('map.event') }}</li>
      <li v-for="store in STORE_KINDS" :key="store"><img class="sym-art" :src="STORE_NODES[store]" alt=""> {{ t(`shop.title.${store}`) }}</li>
      <li><span class="sym">T</span> {{ t('map.treasure') }}</li>
      <li><span class="sym leave">⌂</span> {{ t('map.headHomeLegend') }}</li>
      <li v-if="hasFisherman"><span class="sym fisherman">F</span> {{ t('map.fisherman') }}</li>
      <li v-if="hasTrophy"><span class="sym">🏆</span> {{ t('map.trophy') }}</li>
      <li><span class="sym diamond" /> {{ t('map.miniBoss') }}</li>
      <li><span class="sym boss" /> {{ t('map.boss') }}</li>
    </ul>

    <div
      ref="scroller"
      class="map-scroll"
      :class="{ dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.capture="onClickCapture"
      @dragstart.prevent
    >
      <svg
        class="map"
        :width="size.width"
        :height="size.height"
        :viewBox="`${view.x} ${view.y} ${view.width} ${view.height}`"
        role="group"
        :aria-label="t('map.label', { name: level?.name ?? '' })"
      >
        <g class="art" aria-hidden="true">
          <image :href="mapUrl" :width="ART_WIDTH" :height="ART_HEIGHT" />
        </g>

        <line
          v-for="e in edges"
          :key="e.key"
          :x1="e.x1"
          :y1="e.y1"
          :x2="e.x2"
          :y2="e.y2"
          class="edge"
          :class="{ 'from-home': e.fromHome, travelled: e.travelled, open: e.open }"
        />

        <g
          v-for="node in nodes"
          :key="node.id"
          class="node"
          :class="[node.kind, nodeState(node), { reopens: reopens(node) }]"
          :transform="`translate(${node.x} ${node.y}) scale(${nodeSize / scale})`"
          :role="clickable(node) ? 'button' : undefined"
          :tabindex="clickable(node) ? 0 : undefined"
          v-tip="tooltipFor(node)"
          :aria-label="tooltipFor(node).title"
          @click="choose(node)"
          @keydown.enter="choose(node)"
        >
          <!-- Highlight ring: where you are, or where you can go. -->
          <circle v-if="nodeState(node) === 'current' || nodeState(node) === 'available'" class="ring" :r="node.kind === 'boss' || node.kind === 'shop' ? 26 : 19" />
          <circle v-if="node.kind === 'start'" class="hit" r="26" />
          <template v-else>
            <!-- A finger-sized target around small nodes, in addition to their body. -->
            <circle v-if="touch" class="hit" r="18" />
            <template v-if="node.kind === 'fight'">
              <circle v-if="node.trophy" class="trophy-ring" :r="RADIUS + 4" />
              <circle class="body" :r="RADIUS" :style="{ fill: node.spot ? data.spots[node.spot]?.color : undefined }" />
              <text class="code" dominant-baseline="central" text-anchor="middle">{{ node.spot ?? '!' }}</text>
              <text v-if="node.trophy" class="trophy-mark" x="-15" y="-9">🏆</text>
            </template>
            <rect v-else-if="node.kind === 'miniBoss'" class="body" x="-12" y="-12" width="24" height="24" transform="rotate(45)" />
            <template v-else-if="node.kind === 'boss'">
              <circle class="body" r="18" />
              <circle class="core" r="8" />
            </template>
            <template v-else-if="node.kind === 'shop'">
              <circle class="body" r="23" />
              <image class="symbol store-art" :href="STORE_NODES[storeOf(node)]" x="-20" y="-20" width="40" height="40" />
            </template>
            <template v-else>
              <circle class="body" :r="RADIUS - 1" />
              <image class="symbol" :href="iconUrl(node.kind === 'fisherman' ? (data.fishermen[node.fisherman ?? '']?.icon ?? '') : (SYMBOLS[node.kind] ?? ''))" x="-9" y="-9" width="18" height="18" />
            </template>
          </template>
          <text v-if="nodeState(node) === 'visited' && node.kind !== 'start'" class="check" x="8" y="-8">✓</text>
          <text v-if="node.label && (node.kind === 'miniBoss' || node.kind === 'boss')" class="label" :text-anchor="labelAnchor(node)" :x="labelAnchor(node) === 'end' ? 18 : 0" :y="node.kind === 'boss' ? -28 : -22">
            {{ t(node.kind === 'boss' ? 'map.bossLabel' : 'map.miniBossLabel') }} · {{ hasFeature(data, 'bossPools') ? creatureNames(node) : node.label }}
          </text>
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
/* Hugs the map, so the overlays (equipment, legend) sit on it. */
.map-screen { position: relative; flex-shrink: 0; width: fit-content; max-width: 100%; margin-inline: auto; }

/* Equipment sits over the map's top-left corner and doesn't scroll with it. */
.equipment { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; gap: 6px; margin: 0; padding: 0; list-style: none; }
.item { position: relative; }
.companion .icon { border-color: #2f5a3a; }
.bought .icon { border-color: #5aa45f; }
.companion { position: relative; }
.companion .stars,
.bought .stars {
  position: absolute;
  right: -4px;
  bottom: -4px;
  padding: 0 4px;
  border-radius: 8px;
  background: #3a3220;
  color: #f2c94c;
  font-size: 0.65rem;
  line-height: 1.4;
}
.bought .stars { color: #bfe8a8; }
.item .icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 2px solid #4a4f5c;
  background: rgb(20 24 32 / 0.85);
  font-size: 1.3rem;
  cursor: help;
}
.item:hover .icon,
.item:focus-visible .icon { border-color: var(--highlight); }
.item:focus { outline: none; }

.legend-toggle { position: absolute; top: 10px; right: 10px; z-index: 2; padding: 6px 12px; font-size: 0.8rem; }
.legend {
  position: absolute;
  top: 48px;
  right: 10px;
  z-index: 3;
  max-height: calc(100% - 58px);
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 4px 16px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgb(20 24 32 / 0.92);
  list-style: none;
  font-size: 0.75rem;
}
.legend li { display: flex; align-items: center; gap: 6px; }
.legend b { font-size: 0.7rem; }
.swatch { flex: none; width: 12px; height: 12px; border: 2px solid #fff; border-radius: 50%; }
.sym {
  display: grid;
  flex: none;
  place-items: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid #2e2d27;
  border-radius: 50%;
  background: #fff;
  color: #2e2d27;
  font-size: 10px;
  font-weight: 700;
}
.sym.leave { border-color: #2d8a73; color: #2d8a73; }
.sym.fisherman { border-color: var(--highlight); }
.sym-art { flex: none; width: 18px; height: 18px; image-rendering: pixelated; }
.sym.diamond { width: 11px; height: 11px; margin: 0 2px; border: 2px solid #fff; border-radius: 0; background: #c4531c; transform: rotate(45deg); }
.sym.boss { border: 3px solid #c4531c; background: #fff; }

/* Sized from the level's view (see `size`); scrolls sideways when the screen is narrow. */
.map-scroll { max-width: 100%; overflow-x: auto; border-radius: 12px; }
.map-scroll.dragging { cursor: grabbing; user-select: none; }
.map { display: block; }
.art image { image-rendering: pixelated; }

.edge { stroke: #2e2d27; stroke-width: 1.6; stroke-opacity: 0.55; vector-effect: non-scaling-stroke; }
.edge.from-home { stroke-dasharray: 3 4; }
.edge.travelled { stroke: #fff; stroke-width: 3; stroke-opacity: 0.9; }
.edge.open { stroke: var(--highlight); stroke-width: 3; stroke-opacity: 1; stroke-dasharray: 6 5; }

.node .body { stroke: #fff; stroke-width: 2; }
.node .code { font-size: 9.5px; font-weight: 600; fill: #fff; pointer-events: none; }
.node.event .body,
.node.treasure .body { fill: #fff; stroke: #2e2d27; stroke-width: 1.8; }
.node.leave .body { fill: #fff; stroke: #2d8a73; stroke-width: 2.5; }
.node.fisherman .body { fill: #fff; stroke: var(--highlight); stroke-width: 2.5; }
.node .symbol { image-rendering: pixelated; pointer-events: none; }
.node.shop .body { fill: rgb(255 255 255 / 0.85); stroke: #2e2d27; stroke-width: 1.8; }
.node.visited .store-art { opacity: 0.6; }
.node.miniBoss .body { fill: #c4531c; }
.node.boss .body { fill: #c4531c; stroke-width: 3; }
.node.boss .core { fill: #fff; }
.node .label {
  font-size: 12px;
  font-weight: 600;
  fill: #14232a;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 4px;
  stroke-linejoin: round;
  pointer-events: none;
}
.node .hit { fill: transparent; }
.node .check { font-size: 11px; font-weight: 800; fill: #fff; paint-order: stroke; stroke: #14232a; stroke-width: 3px; pointer-events: none; }


.node .ring { fill: none; stroke: var(--highlight); stroke-width: 3; }
.node.current .ring { stroke: #fff; stroke-width: 4; }
.node.available, .node.reopens { cursor: pointer; }
.node.available .ring { transform-box: fill-box; transform-origin: center; animation: pulse 1.4s ease-in-out infinite; }
.node.available:focus, .node.reopens:focus { outline: none; }
@media (hover: hover) {
  .node.available:hover .body, .node.reopens:hover .body { stroke: var(--highlight); stroke-width: 3; filter: brightness(1.12); }
  .node.shop.available:hover .body, .node.reopens:hover .body { fill: #fff; }
  .node.available:hover .symbol, .node.reopens:hover .symbol { transform: translateY(-2px); }
}
.node.visited .body { opacity: 0.6; }
.node.skipped { opacity: 0.45; }

@keyframes pulse {
  50% { transform: scale(1.15); opacity: 0.6; }
}
@media (prefers-reduced-motion: reduce) {
  .node.available .ring { animation: none; }
}
.trophy-ring { fill: none; stroke: #f5d76e; stroke-width: 3; stroke-dasharray: 4 3; }
.trophy-mark { font-size: 11px; pointer-events: none; }
</style>
