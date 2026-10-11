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
import coastUrl from './assets/coast.svg';

const props = defineProps<{ run: RunState; data: GameData }>();
const emit = defineEmits<{ travel: [nodeId: string] }>();

/** The coast art's coordinates, which node positions in content/levels.ts use. */
const ART_WIDTH = 1200;
const ART_HEIGHT = 600;
const RADIUS = 12;

const level = computed(() => props.data.levels[props.run.level]);
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
function tooltipFor(node: MapNode): { name: string; hint?: string; detail?: string } {
  const strong = isStrong(node) ? 'Your gear is strong against these' : undefined;
  switch (node.kind) {
    case 'start':
      return { name: props.data.character.home.name };
    case 'shop':
      return { name: 'Shop' };
    case 'event':
      return { name: 'Event' };
    case 'treasure':
      return { name: 'Treasure' };
    case 'leave':
      return { name: 'Head home', detail: 'Ends the run here; your bucket comes home' };
    case 'miniBoss':
    case 'boss':
      return { name: `${node.kind === 'boss' ? 'Boss' : 'Mini-boss'} · ${node.label ?? ''}`, detail: creatureNames(node), hint: strong };
    default: {
      const spot = node.spot ? props.data.spots[node.spot] : undefined;
      const type = node.creatureType ? props.data.creatureTypes[node.creatureType]?.name : undefined;
      return { name: spot?.name ?? 'Fight', detail: node.enemies ? creatureNames(node) : type, hint: strong };
    }
  }
}

// The map keeps the art's 2:1 shape: its size comes from CSS, its scale from the rendered width.
const scroller = ref<HTMLElement>();
const svg = ref<SVGSVGElement>();
const scale = ref(1);
const scrollLeft = ref(0);
const resizeObserver = new ResizeObserver(() => (scale.value = (svg.value?.clientWidth ?? ART_WIDTH) / ART_WIDTH));
onMounted(() => svg.value && resizeObserver.observe(svg.value));
onBeforeUnmount(() => resizeObserver.disconnect());

/** When the map is wider than the screen, keep the current position near the left, with what's next in view. */
watch(
  [() => props.run.position, scale],
  async () => {
    await nextTick();
    const here = findNode(props.run.map, props.run.position);
    if (here) scroller.value?.scrollTo({ left: here.x * scale.value - 120, behavior: 'smooth' });
  },
  { immediate: true },
);

/** The node under the pointer (or keyboard focus), and where its tooltip goes. */
const hovered = ref<MapNode | null>(null);
const tooltip = computed(() => {
  const node = hovered.value;
  if (!node) return null;
  const below = node.y < 90;
  const offset = (node.kind === 'boss' ? 22 : RADIUS + 6) * scale.value;
  return {
    ...tooltipFor(node),
    left: node.x * scale.value - scrollLeft.value,
    top: node.y * scale.value + (below ? offset : -offset),
    below,
  };
});

/** Labels near the right edge extend leftwards, so they stay on the map. */
function labelAnchor(node: MapNode) {
  return node.x > ART_WIDTH - 140 ? 'end' : 'middle';
}

const showLegend = ref(false);

function choose(node: MapNode) {
  if (destinations.value.has(node.id)) emit('travel', node.id);
}
</script>

<template>
  <section class="map-screen">
    <ul v-if="equipment.length || bonuses.length" class="equipment" aria-label="Equipment and companion bonuses">
      <li v-for="item in equipment" :key="item.id" class="item" tabindex="0" :aria-label="`${item.name}: ${item.description}`">
        <span class="icon">{{ item.icon ?? '🎒' }}</span>
        <div class="tooltip" role="tooltip">
          <strong>{{ item.name }}</strong>
          <p>{{ item.description }}</p>
        </div>
      </li>
      <li
        v-for="b in bonuses"
        :key="b.def.id"
        class="item companion"
        tabindex="0"
        :aria-label="`${b.def.name}: ${b.text.join(' ')}`"
      >
        <span class="icon">{{ b.def.icon ?? '🐟' }}</span>
        <div class="tooltip" role="tooltip">
          <strong>{{ b.def.name }}</strong>
          <span class="species">{{ b.species }} {{ b.def.temperamentName }} species brought</span>
          <p v-for="(line, i) in b.text" :key="i">{{ line }}</p>
        </div>
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

    <div ref="scroller" class="map-scroll" @scroll="scrollLeft = scroller?.scrollLeft ?? 0">
      <svg ref="svg" class="map" :viewBox="`0 0 ${ART_WIDTH} ${ART_HEIGHT}`" role="group" :aria-label="`Map: ${level?.name}`">
        <defs>
          <pattern id="out-of-reach" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#0E1A20" stroke-width="3" stroke-opacity="0.35" />
          </pattern>
        </defs>
        <image :href="coastUrl" :width="ART_WIDTH" :height="ART_HEIGHT" />

        <!-- Shade what this age can't reach yet. -->
        <g v-if="level?.reach" class="reach" aria-hidden="true">
          <path :d="`M0 0 H${ART_WIDTH} V${ART_HEIGHT} H0 Z ${level.reach}`" fill="#0E1A20" fill-opacity="0.38" fill-rule="evenodd" />
          <path :d="`M0 0 H${ART_WIDTH} V${ART_HEIGHT} H0 Z ${level.reach}`" fill="url(#out-of-reach)" fill-rule="evenodd" opacity="0.5" />
          <path :d="level.reach" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="8 6" opacity="0.9" />
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
          :transform="`translate(${node.x} ${node.y})`"
          :role="destinations.has(node.id) ? 'button' : undefined"
          :tabindex="destinations.has(node.id) ? 0 : undefined"
          :aria-label="tooltipFor(node).name"
          @click="choose(node)"
          @keydown.enter="choose(node)"
          @mouseenter="hovered = node"
          @mouseleave="hovered = null"
          @focus="hovered = node"
          @blur="hovered = null"
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
          <text v-if="node.label" class="label" :text-anchor="labelAnchor(node)" :x="labelAnchor(node) === 'end' ? 18 : 0" :y="node.kind === 'boss' ? -28 : -22">
            {{ node.kind === 'boss' ? 'boss' : 'mini-boss' }} · {{ node.label }}
          </text>
        </g>
      </svg>
    </div>

    <div v-if="tooltip" class="node-tooltip" :class="{ below: tooltip.below }" role="tooltip" :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }">
      <strong>{{ tooltip.name }}</strong>
      <small v-if="tooltip.detail">{{ tooltip.detail }}</small>
      <span v-if="tooltip.hint">{{ tooltip.hint }}</span>
    </div>
  </section>
</template>

<style scoped>
/* Hugs the map, so the overlays (equipment, level name, legend) sit on it. */
.map-screen { position: relative; flex-shrink: 0; width: fit-content; max-width: 100%; margin-inline: auto; }

/* Node hover text, placed above the node and kept outside the scrolling map so it isn't clipped. */
.node-tooltip {
  position: absolute;
  z-index: 3;
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgb(20 24 32 / 0.95);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.45);
  font-size: 0.8rem;
  white-space: nowrap;
  pointer-events: none;
}
.node-tooltip.below { transform: translate(-50%, 0); }
.node-tooltip small { font-size: 0.72rem; color: var(--muted); }
.node-tooltip span { font-size: 0.72rem; color: #7ee08a; }

/* Equipment sits over the map's top-left corner and doesn't scroll with it. */
.equipment { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; gap: 6px; margin: 0; padding: 0; list-style: none; }
.item { position: relative; }
.companion .icon { border-color: #2f5a3a; }
.tooltip .species { display: block; color: var(--muted); font-size: 0.72rem; }
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
.tooltip {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 240px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgb(20 24 32 / 0.95);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.45);
  font-size: 0.8rem;
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.tooltip p { margin: 4px 0 0; color: var(--muted); }
.item:hover .tooltip,
.item:focus-visible .tooltip { visibility: visible; opacity: 1; }

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

/* The art's 2:1 shape, as tall as there's room for; scrolls sideways when the screen is narrow. */
.map-scroll { max-width: 100%; overflow-x: auto; border-radius: 12px; }
.map { display: block; height: max(320px, min(62vh, 50vw)); aspect-ratio: 2 / 1; }

.edge { stroke: #2e2d27; stroke-width: 1.6; stroke-opacity: 0.55; }
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
