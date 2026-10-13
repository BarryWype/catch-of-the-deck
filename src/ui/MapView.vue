<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  activeBonuses,
  availableDestinations,
  describeCompanionEffect,
  encountersFor,
  findNode,
  type GameData,
  type MapNode,
  type RunState,
} from '../engine';
import basemapUrl from './assets/map/basemap.png';
import seaUrl from './assets/map/sea.png';

const props = defineProps<{ run: RunState; data: GameData }>();
const emit = defineEmits<{ travel: [nodeId: string] }>();

/** The coast art's coordinates, which content/levels.ts and coast.ts use. The open sea goes below it. */
const ART_WIDTH = 1000;
const COAST_HEIGHT = 150;
/** Every map layer image (coast features, sea features) is this size. */
const LAYER = { width: 1000, height: 150 };
const RADIUS = 12;
/** Node markers keep the same size on screen whatever the zoom: 1 = RADIUS pixels. */
const NODE_SIZE = 0.9;

const layerUrls = import.meta.glob<string>('./assets/map/**/*.png', { eager: true, query: '?url', import: 'default' });

const level = computed(() => props.data.levels[props.run.level]);
/** The coast features laid out for the run, as drawn: those this age stops at. */
const features = computed(() =>
  props.run.coast.flatMap((placement) => {
    const def = props.data.coast.features.find((f) => f.id === placement.feature);
    const url = def && layerUrls[`./assets/map/${def.image}`];
    return def?.visits[props.run.level] && url ? [{ ...def, x: placement.x, url }] : [];
  }),
);
const nodes = computed(() => props.run.map.columns.flat());
const destinations = computed(() => new Set(availableDestinations(props.run).map((n) => n.id)));
const visited = computed(() => new Set(props.run.visited));
const currentColumn = computed(() => findNode(props.run.map, props.run.position)?.column ?? 0);
const equipment = computed(() => props.run.equipment.map((id) => props.data.equipment[id]).filter(Boolean));
/** Companion bonuses from the creatures brought along, shown next to the equipment. */
const bonuses = computed(() =>
  activeBonuses(props.run.companions, props.data).map((b) => ({ ...b, text: b.effects.map(describeCompanionEffect) })),
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

const SYMBOLS: Partial<Record<MapNode['kind'], string>> = { event: '?', shop: '$', treasure: 'T', leave: '⌂' };

const strongAgainst = computed(() => new Set(props.data.builds[props.run.build]?.strongAgainst ?? []));

/** Every creature this fight can bring is one the run's build is strong against. */
function isStrong(node: MapNode) {
  if (!['fight', 'miniBoss', 'boss'].includes(node.kind)) return false;
  return encountersFor(node, props.data).every((e) =>
    e.enemies.every((id) => (props.data.enemies[id]?.tags ?? []).some((t) => strongAgainst.value.has(t))),
  );
}

function creatureNames(node: MapNode) {
  return [...new Set((node.enemies ?? []).map((id) => props.data.enemies[id]?.name ?? id))].join(', ');
}

/** Hover text: what the node is, plus a hint when the build is strong against its creatures. */
function tooltipFor(node: MapNode): { title: string; hint?: string; detail?: string } {
  const strong = isStrong(node) ? 'Your gear is strong against these' : undefined;
  switch (node.kind) {
    case 'start':
      return { title: props.data.character.home.name };
    case 'shop':
      return { title: 'Shop' };
    case 'event':
      return { title: 'Event' };
    case 'treasure':
      return { title: 'Treasure' };
    case 'leave':
      return { title: 'Head home', detail: 'Ends the run here; your bucket comes home' };
    case 'miniBoss':
    case 'boss':
      return { title: `${node.kind === 'boss' ? 'Boss' : 'Mini-boss'} · ${node.label ?? ''}`, detail: creatureNames(node), hint: strong };
    default: {
      const spot = node.spot ? props.data.spots[node.spot] : undefined;
      const type = node.creatureType ? props.data.creatureTypes[node.creatureType]?.name : undefined;
      const detail = node.enemies ? creatureNames(node) : [node.label && spot?.name, type].filter(Boolean).join(' · ');
      return { title: node.label ?? spot?.name ?? 'Fight', detail: detail || undefined, hint: strong };
    }
  }
}

/** The map is never shorter than this; a level wider than the screen then scrolls sideways. */
const MIN_HEIGHT = 300;

/** The part of the art shown: the whole width, and as far out to sea as the age goes, so the map zooms out as you grow. */
const view = computed(() => ({ x: 0, y: 0, width: ART_WIDTH, height: level.value?.height ?? COAST_HEIGHT }));

/** Share of the screen under the top bar the map takes, above the bucket. */
const MAP_SHARE = 0.6;
/** The top bar, and the gap and padding of the map layout (App.vue), in pixels. */
const CHROME_HEIGHT = 88;

// MAP_SHARE of the screen's height, scrolling sideways when that's wider than the screen.
const scroller = ref<HTMLElement>();
const windowHeight = ref(window.innerHeight);
const onResize = () => (windowHeight.value = window.innerHeight);
onMounted(() => window.addEventListener('resize', onResize));
onBeforeUnmount(() => window.removeEventListener('resize', onResize));
const size = computed(() => {
  const ratio = view.value.width / view.value.height;
  const height = Math.max(MIN_HEIGHT, (windowHeight.value - CHROME_HEIGHT) * MAP_SHARE);
  return { width: height * ratio, height };
});
/** Screen pixels per art unit. */
const scale = computed(() => size.value.width / view.value.width);

/** When the map is wider than the screen, keep the current position near the left, with what's next in view. */
watch(
  [() => props.run.position, scale],
  async () => {
    await nextTick();
    const here = findNode(props.run.map, props.run.position);
    if (here) scroller.value?.scrollTo({ left: (here.x - view.value.x) * scale.value - 120, behavior: 'smooth' });
  },
  { immediate: true },
);

/** Labels near the right edge extend leftwards, so they stay on the map. */
function labelAnchor(node: MapNode) {
  return node.x > view.value.x + view.value.width - 140 / scale.value ? 'end' : 'middle';
}

const showLegend = ref(false);

function choose(node: MapNode) {
  if (destinations.value.has(node.id)) emit('travel', node.id);
}
</script>

<template>
  <section class="map-screen">
    <ul v-if="equipment.length || bonuses.length" class="equipment" aria-label="Equipment and companion bonuses">
      <li
        v-for="item in equipment"
        :key="item.id"
        v-tip="{ title: item.name, body: item.description }"
        class="item"
        tabindex="0"
        :aria-label="item.name"
      >
        <span class="icon">{{ item.icon ?? '🎒' }}</span>
      </li>
      <li
        v-for="b in bonuses"
        :key="b.def.id"
        v-tip="{ title: b.def.name, detail: `${b.species} ${b.def.temperamentName} species brought`, body: b.text.join(' ') }"
        class="item companion"
        tabindex="0"
        :aria-label="b.def.name"
      >
        <span class="icon">{{ b.def.icon ?? '🐟' }}</span>
      </li>
    </ul>

    <p class="level-name">{{ level?.name }}</p>
    <button class="legend-toggle" :aria-expanded="showLegend" @click="showLegend = !showLegend">
      {{ showLegend ? 'Hide legend' : 'Legend' }}
    </button>
    <ul v-if="showLegend" class="legend" aria-label="Map legend">
      <li v-for="spot in data.spots" :key="spot.id">
        <span class="swatch" :style="{ background: spot.color }" /><b>{{ spot.id }}</b> {{ spot.name }}
      </li>
      <li><span class="sym">?</span> Event</li>
      <li><span class="sym">$</span> Shop</li>
      <li><span class="sym">T</span> Treasure</li>
      <li><span class="sym leave">⌂</span> Head home (ends the run)</li>
      <li><span class="sym diamond" /> Mini-boss</li>
      <li><span class="sym boss" /> Boss</li>
    </ul>

    <div ref="scroller" class="map-scroll">
      <svg
        class="map"
        :width="size.width"
        :height="size.height"
        :viewBox="`${view.x} ${view.y} ${view.width} ${view.height}`"
        role="group"
        :aria-label="`Map: ${level?.name}`"
      >
        <g class="art" aria-hidden="true">
          <image :href="basemapUrl" :width="ART_WIDTH" :height="COAST_HEIGHT" />
          <image v-if="view.height > COAST_HEIGHT" :href="seaUrl" :y="COAST_HEIGHT" :width="ART_WIDTH" :height="COAST_HEIGHT" />
          <!-- Each feature: its crop of its layer image, slid to where the run placed it. -->
          <svg
            v-for="(f, i) in features"
            :key="i"
            :x="f.x"
            :y="f.y"
            :width="f.crop.width"
            :height="f.crop.height"
            :viewBox="`${f.crop.x} ${f.crop.y} ${f.crop.width} ${f.crop.height}`"
          >
            <image :href="f.url" :width="LAYER.width" :height="LAYER.height" />
          </svg>
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
          :class="[node.kind, nodeState(node), { strong: isStrong(node) }]"
          :transform="`translate(${node.x} ${node.y}) scale(${NODE_SIZE / scale})`"
          :role="destinations.has(node.id) ? 'button' : undefined"
          :tabindex="destinations.has(node.id) ? 0 : undefined"
          v-tip="tooltipFor(node)"
          :aria-label="tooltipFor(node).title"
          @click="choose(node)"
          @keydown.enter="choose(node)"
        >
          <!-- Highlight ring: where you are, or where you can go. -->
          <circle v-if="nodeState(node) === 'current' || nodeState(node) === 'available'" class="ring" :r="node.kind === 'boss' ? 26 : 19" />
          <circle v-if="node.kind === 'start'" class="hit" r="26" />
          <template v-else-if="node.kind === 'fight'">
            <circle class="body" :r="RADIUS" :style="{ fill: node.spot ? data.spots[node.spot]?.color : undefined }" />
            <text class="code" dominant-baseline="central" text-anchor="middle">{{ node.spot ?? '!' }}</text>
          </template>
          <rect v-else-if="node.kind === 'miniBoss'" class="body" x="-12" y="-12" width="24" height="24" transform="rotate(45)" />
          <template v-else-if="node.kind === 'boss'">
            <circle class="body" r="18" />
            <circle class="core" r="8" />
          </template>
          <template v-else>
            <circle class="body" :r="RADIUS - 1" />
            <text class="symbol" dominant-baseline="central" text-anchor="middle">{{ SYMBOLS[node.kind] }}</text>
          </template>
          <text v-if="nodeState(node) === 'visited' && node.kind !== 'start'" class="check" x="8" y="-8">✓</text>
          <text v-if="node.label && (node.kind === 'miniBoss' || node.kind === 'boss')" class="label" :text-anchor="labelAnchor(node)" :x="labelAnchor(node) === 'end' ? 18 : 0" :y="node.kind === 'boss' ? -28 : -22">
            {{ node.kind === 'boss' ? 'boss' : 'mini-boss' }} · {{ node.label }}
          </text>
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
/* Hugs the map, so the overlays (equipment, level name, legend) sit on it. */
.map-screen { position: relative; flex-shrink: 0; width: fit-content; max-width: 100%; margin-inline: auto; }

/* Equipment sits over the map's top-left corner and doesn't scroll with it. */
.equipment { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; gap: 6px; margin: 0; padding: 0; list-style: none; }
.item { position: relative; }
.companion .icon { border-color: #2f5a3a; }
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

.level-name {
  position: absolute;
  white-space: nowrap;
  top: 10px;
  left: 50%;
  z-index: 2;
  margin: 0;
  padding: 4px 14px;
  border-radius: 999px;
  transform: translateX(-50%);
  background: rgb(20 24 32 / 0.8);
  font-weight: 700;
  pointer-events: none;
}
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
.legend b { font-family: ui-monospace, Menlo, monospace; font-size: 0.7rem; }
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
  font: 700 10px ui-monospace, Menlo, monospace;
}
.sym.leave { border-color: #2d8a73; color: #2d8a73; }
.sym.diamond { width: 11px; height: 11px; margin: 0 2px; border: 2px solid #fff; border-radius: 0; background: #c4531c; transform: rotate(45deg); }
.sym.boss { border: 3px solid #c4531c; background: #fff; }

/* Sized from the level's view (see `size`); scrolls sideways when the screen is narrow. */
.map-scroll { max-width: 100%; overflow-x: auto; border-radius: 12px; }
.map { display: block; }
.art image { image-rendering: pixelated; }

.edge { stroke: #2e2d27; stroke-width: 1.6; stroke-opacity: 0.55; vector-effect: non-scaling-stroke; }
.edge.from-home { stroke-dasharray: 3 4; }
.edge.travelled { stroke: #fff; stroke-width: 3; stroke-opacity: 0.9; }
.edge.open { stroke: var(--highlight); stroke-width: 3; stroke-opacity: 1; stroke-dasharray: 6 5; }

.node .body { stroke: #fff; stroke-width: 2; }
.node .code { font: 600 9.5px ui-monospace, Menlo, monospace; fill: #fff; pointer-events: none; }
.node.event .body,
.node.shop .body,
.node.treasure .body { fill: #fff; stroke: #2e2d27; stroke-width: 1.8; }
.node.leave .body { fill: #fff; stroke: #2d8a73; stroke-width: 2.5; }
.node .symbol { font: 700 12px ui-monospace, Menlo, monospace; fill: #2e2d27; pointer-events: none; }
.node.leave .symbol { fill: #2d8a73; font-size: 14px; }
.node.miniBoss .body { fill: #c4531c; }
.node.boss .body { fill: #c4531c; stroke-width: 3; }
.node.boss .core { fill: #fff; }
.node .label {
  font: 600 12px system-ui, sans-serif;
  fill: #14232a;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 4px;
  stroke-linejoin: round;
  pointer-events: none;
}
.node .hit { fill: transparent; }
.node .check { font-size: 11px; font-weight: 800; fill: #fff; paint-order: stroke; stroke: #14232a; stroke-width: 3px; pointer-events: none; }

/* Fights the run's build is strong against get a green outline. */
.node.strong .body { stroke: #7ee08a; }

.node .ring { fill: none; stroke: var(--highlight); stroke-width: 3; }
.node.current .ring { stroke: #fff; stroke-width: 4; }
.node.available { cursor: pointer; }
.node.available .ring { animation: pulse 1.4s ease-in-out infinite; }
.node.available:focus { outline: none; }
.node.visited .body { opacity: 0.6; }
.node.skipped { opacity: 0.45; }

/* Narrow screens: the level name goes under the equipment and legend buttons. */
@media (max-width: 700px) {
  .level-name { top: 56px; font-size: 0.85rem; }
}

@keyframes pulse {
  50% { stroke-width: 6; }
}
@media (prefers-reduced-motion: reduce) {
  .node.available .ring { animation: none; }
}
</style>
