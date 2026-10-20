<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { GOLDEN_SHELLS, nodeBlocked, progressionLayout, type GameData, type Logbook, type ProgressionNodeDef } from '../engine';
import GameIcon from './GameIcon.vue';
import { t, type TextKey } from './i18n';
import { COMPACT_QUERY, useMedia } from './useScreen';

/**
 * The Logbook, over the menu: its tracks side by side (one at a time, in tabs, on compact screens),
 * each node on the row `progressionLayout` gives it, with lines to the nodes it requires. A node is
 * bought, next (all it requires bought: its name, effect and cost show) or later ("?" and its cost).
 */
const props = defineProps<{ logbook: Logbook; data: GameData }>();
const emit = defineEmits<{ buy: [id: string]; close: [] }>();

const compact = useMedia(COMPACT_QUERY);
const layout = computed(() => progressionLayout(props.data));
const tab = ref(0);
/** The tracks shown, by their index in the layout. */
const shown = computed(() => (compact.value ? [tab.value] : layout.value.tracks.map((_, i) => i)));
const trackName = (track: string) => t(`logbook.track.${track}` as TextKey);
const rows = computed(() => Math.max(0, ...layout.value.nodes.map((n) => n.row)) + 1);

type State = 'bought' | 'next' | 'later';
const stateOf = (node: ProgressionNodeDef): State =>
  props.logbook.unlocked.includes(node.id) ? 'bought' : node.requires.every((r) => props.logbook.unlocked.includes(r)) ? 'next' : 'later';

const cells = computed(() =>
  layout.value.nodes
    .filter((n) => shown.value.includes(n.column))
    .map(({ node, column, row }) => {
      const state = stateOf(node);
      const short = node.cost - props.logbook.shells;
      return {
        node,
        state,
        column: shown.value.indexOf(column),
        row,
        affordable: state === 'next' && short <= 0,
        status: state === 'bought' ? t('logbook.bought') : state === 'next' && short > 0 ? t('logbook.needMore', { n: short }) : '',
      };
    }),
);

/** A line from each node to each node it requires, among those shown, in the board's cell units; solid once the required one is bought. */
const lines = computed(() => {
  const at = new Map(cells.value.map((c) => [c.node.id, c]));
  return cells.value.flatMap((c) =>
    c.node.requires.flatMap((id) => {
      const from = at.get(id);
      if (!from) return [];
      return [{ key: `${id}-${c.node.id}`, x1: from.column + 0.5, y1: from.row + 0.5, x2: c.column + 0.5, y2: c.row + 0.5, bought: from.state === 'bought' }];
    }),
  );
});

function tip(cell: (typeof cells.value)[number]) {
  if (cell.state === 'later') return { title: '?', body: t('logbook.hidden') };
  return { title: cell.node.name, body: cell.node.description, hint: cell.affordable ? t('logbook.buyTip') : undefined };
}

const confirm = ref<HTMLDialogElement>();
const picked = ref<ProgressionNodeDef | null>(null);

/**
 * A next node clicked without enough shells: its cost's shell and the counter's shake for
 * `SHAKE_MS`. `shakes` counts the clicks, as the shells' key, so a new click restarts the shake.
 */
const SHAKE_MS = 1500;
const shaking = ref<string | null>(null);
const shakes = ref(0);
let shakeTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(shakeTimer));

function pick(cell: (typeof cells.value)[number]) {
  if (cell.state === 'next' && !cell.affordable) {
    shaking.value = cell.node.id;
    shakes.value++;
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => (shaking.value = null), SHAKE_MS);
  }
  if (!cell.affordable) return;
  picked.value = cell.node;
  confirm.value?.showModal();
}

function buy() {
  if (picked.value && !nodeBlocked(picked.value.id, props.logbook, props.data)) emit('buy', picked.value.id);
  confirm.value?.close();
}
</script>

<template>
  <section class="logbook" @keydown.esc="emit('close')">
    <div class="panel">
      <header>
        <button class="ghost" @click="emit('close')">{{ t('common.back') }}</button>
        <h2>{{ t('logbook.title') }}</h2>
        <span class="shells" v-tip="t('logbook.shellsTip', GOLDEN_SHELLS)"><span :key="shakes" :class="{ shake: shaking }"><GameIcon icon="golden-shell" /></span> {{ logbook.shells }}</span>
      </header>
      <p class="intro">{{ t('logbook.intro', GOLDEN_SHELLS) }}</p>
      <nav v-if="compact" class="tabs" role="tablist">
        <button
          v-for="(track, i) in layout.tracks"
          :key="track"
          role="tab"
          :aria-selected="tab === i"
          :class="{ active: tab === i }"
          @click="tab = i"
        >{{ trackName(track) }}</button>
      </nav>
      <div class="board" :style="{ '--columns': shown.length, '--rows': rows }">
        <h3 v-for="(i, column) in shown" v-show="!compact" :key="i" class="track" :style="{ gridColumn: column + 1 }">
          {{ trackName(layout.tracks[i]) }}
        </h3>
        <div class="nodes">
          <svg class="lines" :viewBox="`0 0 ${shown.length} ${rows}`" preserveAspectRatio="none" aria-hidden="true">
            <line
              v-for="l in lines"
              :key="l.key"
              :x1="l.x1"
              :y1="l.y1"
              :x2="l.x2"
              :y2="l.y2"
              :class="{ bought: l.bought }"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div v-for="cell in cells" :key="cell.node.id" class="cell" :style="{ gridColumn: cell.column + 1, gridRow: cell.row + 1 }">
            <button
              type="button"
              class="node"
              :class="[cell.state, { affordable: cell.affordable }]"
              :aria-disabled="!cell.affordable"
              :aria-label="cell.state === 'later' ? `? · ${cell.node.cost}` : cell.node.name"
              v-tip="tip(cell)"
              @click="pick(cell)"
            >
              <template v-if="cell.state === 'later'">
                <span class="icon unknown">?</span>
              </template>
              <template v-else>
                <span class="icon"><GameIcon :icon="cell.node.icon" /></span>
                <b class="name">{{ cell.node.name }}</b>
                <small class="effect">{{ cell.node.description }}</small>
              </template>
              <span v-if="cell.state !== 'bought'" class="cost"><span :key="shaking === cell.node.id ? shakes : 0" :class="{ shake: shaking === cell.node.id }"><GameIcon icon="golden-shell" /></span> {{ cell.node.cost }}</span>
              <small v-if="cell.status" class="status">{{ cell.status }}</small>
            </button>
          </div>
        </div>
      </div>
    </div>

    <dialog ref="confirm" class="confirm" @click="$event.target === confirm && confirm?.close()">
      <template v-if="picked">
        <h3><GameIcon :icon="picked.icon" /> {{ t('logbook.confirmTitle', { name: picked.name }) }}</h3>
        <p>{{ picked.description }}</p>
        <p class="price">{{ t('logbook.confirmText', { cost: picked.cost, left: logbook.shells - picked.cost }) }}</p>
      </template>
      <footer>
        <button class="ghost" autofocus @click="confirm?.close()">{{ t('common.cancel') }}</button>
        <button @click="buy">{{ t('logbook.buy') }}</button>
      </footer>
    </dialog>
  </section>
</template>

<style scoped>
.logbook { position: absolute; inset: 0; z-index: 30; display: grid; place-items: start center; padding: 24px 16px; overflow-y: auto; background: rgb(12 19 32 / 0.92); }
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(100%, 860px);
  padding: 20px 24px;
  border-radius: 16px;
  background: var(--panel);
  border: 1px solid #2c3a4a;
}
header { display: flex; align-items: center; gap: 12px; }
header h2 { flex: 1; margin: 0; font-size: 1.4rem; }
.shells { font-size: 1.2rem; font-weight: 800; color: var(--highlight); white-space: nowrap; }
.intro { margin: 0; color: var(--muted); font-size: 0.9rem; }
.tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 6px; }
.tabs button { background: rgb(15 18 25 / 0.6); color: var(--muted); }
.tabs button.active { background: var(--highlight); color: #1a1a1a; }

.board { display: grid; grid-template-columns: repeat(var(--columns), minmax(0, 1fr)); }
.track { margin: 0 0 6px; text-align: center; font-size: 1rem; color: var(--highlight); }
/* Equal rows and columns, no gaps: a cell's centre is at (column + 0.5, row + 0.5) in the lines' viewBox. */
.nodes {
  position: relative;
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  grid-template-rows: repeat(var(--rows), 1fr);
}
.lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.lines line { stroke: #3a4a5e; stroke-width: 3; stroke-dasharray: 6 5; }
.lines line.bought { stroke: var(--highlight); stroke-dasharray: none; }
.cell { position: relative; display: grid; place-items: center; padding: 14px 8px; }

.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: min(100%, 220px);
  min-height: 120px;
  padding: 10px 12px;
  border: 2px solid #2c3a4a;
  border-radius: 14px;
  background: #141c28;
  color: var(--text);
  text-align: center;
  cursor: default;
}
.node .icon { font-size: 1.8rem; line-height: 1.2; }
.node .unknown { font-size: 2rem; font-weight: 800; color: var(--muted); }
.node .name { font-size: 0.95rem; }
.node .effect { color: var(--muted); font-size: 0.78rem; line-height: 1.3; }
.node .cost { font-weight: 800; color: var(--muted); }
.node .status { font-size: 0.75rem; color: var(--muted); }
.node.later { opacity: 0.6; justify-content: center; }
.node.next { border-color: #4a5d75; }
.node.affordable { border-color: var(--highlight); box-shadow: 0 0 14px rgb(245 215 110 / 0.35); cursor: pointer; }
.node.affordable .cost { color: var(--highlight); }
.node.bought { border-color: var(--highlight); background: linear-gradient(180deg, #4a3d17, #2e2712); }
.node.bought .effect { color: #e9dcb0; }
.node.bought .status { color: var(--highlight); font-weight: 700; }
@media (hover: hover) {
  .node.affordable:hover { transform: translateY(-2px); box-shadow: 0 0 20px rgb(245 215 110 / 0.5); }
}
.confirm .price { margin-top: 8px; color: var(--text); }
/* Not enough shells: the shell shakes, settling down over SHAKE_MS. */
.shake { display: inline-block; animation: shell-shake 1.5s ease-out; }
@keyframes shell-shake {
  0%, 100% { transform: none; }
  5%, 25%, 45%, 65% { transform: translateX(-3px) rotate(-12deg); }
  15%, 35%, 55%, 75% { transform: translateX(3px) rotate(12deg); }
  85% { transform: translateX(-1px) rotate(-4deg); }
}
@media (prefers-reduced-motion: reduce) {
  .shake { animation-name: shell-blink; }
  @keyframes shell-blink { 50% { opacity: 0.3; } }
}

@media (max-width: 700px), (max-height: 500px) {
  .logbook { padding: 12px; }
  .panel { padding: 14px 16px; gap: 10px; }
  .cell { padding: 10px 8px; }
  .node { min-height: 0; width: min(100%, 300px); }
}
</style>
