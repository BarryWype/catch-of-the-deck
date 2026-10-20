<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { activeTip, TOOLTIP_ID } from './tooltip';
import CardView from './CardView.vue';

/**
 * The one tooltip of the app (see tooltip.ts). It sits above its element, or below when there's no
 * room above, stays inside the window, and follows the element while it moves (swimming creatures).
 * It's a popover, shown again for each tip, so it sits in the top layer above any open modal dialog.
 */
const GAP = 6;
const EDGE = 6;

const el = ref<HTMLElement>();
const pos = ref<{ left: number; top: number; below: boolean } | null>(null);
let frame = 0;

function place() {
  const tip = activeTip.value;
  if (!tip) return;
  if (!tip.anchor.isConnected) {
    activeTip.value = null;
    return;
  }
  const rect = tip.anchor.getBoundingClientRect();
  const width = el.value?.offsetWidth ?? 0;
  const height = el.value?.offsetHeight ?? 0;
  const below = rect.top - GAP - height < EDGE;
  const half = width / 2;
  const left = Math.min(Math.max(rect.left + rect.width / 2, half + EDGE), window.innerWidth - half - EDGE);
  const top = below ? rect.bottom + GAP : rect.top - GAP;
  const p = pos.value;
  if (!p || p.left !== left || p.top !== top || p.below !== below) pos.value = { left, top, below };
  frame = requestAnimationFrame(place);
}

watch(activeTip, async (tip) => {
  cancelAnimationFrame(frame);
  if (!tip) {
    pos.value = null;
    return;
  }
  await nextTick(); // measure the new text before placing it
  el.value?.hidePopover();
  el.value?.showPopover();
  place();
});
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <div
    v-if="activeTip"
    :id="TOOLTIP_ID"
    ref="el"
    popover="manual"
    class="tip"
    :class="{ below: pos?.below, long: !!activeTip.content.body }"
    role="tooltip"
    :style="pos ? { left: `${pos.left}px`, top: `${pos.top}px` } : { visibility: 'hidden' }"
  >
    <strong v-if="activeTip.content.title">{{ activeTip.content.title }}</strong>
    <small v-if="activeTip.content.detail">{{ activeTip.content.detail }}</small>
    <p v-if="activeTip.content.body">{{ activeTip.content.body }}</p>
    <span v-if="activeTip.content.hint" class="hint">{{ activeTip.content.hint }}</span>
    <CardView v-if="activeTip.content.card" class="tip-card" :card="activeTip.content.card" />
  </div>
</template>

<style scoped>
/* The map-node tooltip style, for every hover text in the app. */
.tip {
  position: fixed;
  inset: auto;
  z-index: 1000;
  overflow: visible;
  margin: 0;
  border: 0;
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: max-content;
  max-width: 280px;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgb(20 24 32 / 0.95);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.45);
  color: var(--text);
  font-size: 0.8rem;
  text-align: center;
  pointer-events: none;
}
.tip.below { transform: translate(-50%, 0); }
.tip.long { align-items: flex-start; padding: 7px 10px; text-align: left; }
small { font-size: 0.72rem; color: var(--muted); }
p { margin: 3px 0 0; line-height: 1.35; color: #d3d7de; }
.hint { font-size: 0.72rem; color: #7ee08a; }
.tip-card { margin-top: 4px; }
</style>
