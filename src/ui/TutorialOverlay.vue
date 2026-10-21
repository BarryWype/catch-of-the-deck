<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from './i18n';

/** One step: the elements to light up (a CSS selector; several are lit together) and what to say. */
export interface TutorialStep {
  target: string;
  text: string;
}

/**
 * A short guided tour over a screen: everything goes dark but the step's elements, with a line of
 * text beside them, Next and Skip. It's a modal <dialog>, so the screen under it can't be played
 * (and CombatView's Space shortcut stands down). The first element of a step is scrolled into view
 * (the map scrolls sideways); a step with nothing on screen is passed over. Esc skips.
 */
const props = defineProps<{ steps: TutorialStep[] }>();
const emit = defineEmits<{ done: [] }>();

const GUTTER = 16;
const PAD = 8;
const GAP = 12;

const dialog = ref<HTMLDialogElement>();
const bubble = ref<HTMLElement>();
const nextButton = ref<HTMLButtonElement>();
const index = ref(0);
/** The lit area, in viewport pixels. */
const hole = ref<{ x: number; y: number; width: number; height: number } | null>(null);
/** Where the text sits; null until it has been measured, so it never shows in the wrong place. */
const bubbleAt = ref<{ left: number; top: number } | null>(null);

/** Lights up step `i`'s elements: false when none of them is on screen. */
function light(i: number): boolean {
  const elements = [...document.querySelectorAll(props.steps[i].target)];
  elements[0]?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const rects = elements
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width && r.height && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight);
  if (!rects.length) return false;
  const left = Math.max(0, Math.min(...rects.map((r) => r.left)) - PAD);
  const top = Math.max(0, Math.min(...rects.map((r) => r.top)) - PAD);
  const right = Math.min(innerWidth, Math.max(...rects.map((r) => r.right)) + PAD);
  const bottom = Math.min(innerHeight, Math.max(...rects.map((r) => r.bottom)) + PAD);
  hole.value = { x: left, y: top, width: right - left, height: bottom - top };
  return true;
}

/** The text under the lit area, or above it, or at the bottom of the screen when neither fits. */
function placeBubble() {
  const h = hole.value;
  const box = bubble.value;
  if (!h || !box) return;
  const { offsetWidth: width, offsetHeight: height } = box;
  const below = h.y + h.height + GAP;
  const above = h.y - GAP - height;
  const top = below + height <= innerHeight - GUTTER ? below : above >= GUTTER ? above : innerHeight - GUTTER - height;
  const left = Math.max(GUTTER, Math.min(innerWidth - GUTTER - width, h.x + h.width / 2 - width / 2));
  bubbleAt.value = { left, top };
}

async function show(i: number) {
  while (i < props.steps.length && !light(i)) i++;
  if (i >= props.steps.length) return finish();
  index.value = i;
  bubbleAt.value = null;
  await nextTick();
  placeBubble();
  nextButton.value?.focus();
}

function finish() {
  dialog.value?.close();
  emit('done');
}

function onResize() {
  if (light(index.value)) placeBubble();
}

onMounted(() => {
  dialog.value?.showModal();
  // The screen under it lays itself out first (the map scrolls to the player, the fight measures its scene).
  requestAnimationFrame(() => requestAnimationFrame(() => show(0)));
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => window.removeEventListener('resize', onResize));
</script>

<template>
  <dialog ref="dialog" class="tutorial" :aria-label="t('tutorial.label')" @cancel.prevent="finish">
    <div
      v-if="hole"
      :key="`hole${index}`"
      class="hole"
      :style="{ width: `${hole.width}px`, height: `${hole.height}px`, transform: `translate(${hole.x}px, ${hole.y}px)` }"
    />
    <div
      ref="bubble"
      :key="`bubble${index}`"
      class="bubble"
      :class="{ placed: !!bubbleAt }"
      :style="bubbleAt ? { transform: `translate(${bubbleAt.left}px, ${bubbleAt.top}px)` } : undefined"
      role="status"
    >
      <p>{{ steps[index].text }}</p>
      <footer>
        <button class="ghost" @click="finish">{{ t('tutorial.skip') }}</button>
        <span class="count">{{ index + 1 }}/{{ steps.length }}</span>
        <button ref="nextButton" @click="show(index + 1)">{{ index === steps.length - 1 ? t('tutorial.done') : t('tutorial.next') }}</button>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
/* A transparent full-screen layer: the dark comes from the lit area's shadow. */
.tutorial {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: hidden;
}
.tutorial::backdrop { background: transparent; }
.hole {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 12px;
  box-shadow: 0 0 0 200vmax rgb(4 8 14 / 0.74), 0 0 0 2px var(--highlight) inset;
  pointer-events: none;
  animation: fade-in 0.35s ease-out;
}
.bubble {
  position: absolute;
  left: 0;
  top: 0;
  width: min(340px, calc(100vw - 32px));
  padding: 14px 16px 12px;
  border-radius: 12px;
  background: var(--panel-soft);
  border: 1px solid var(--line);
  box-shadow: 0 12px 30px rgb(0 0 0 / 0.5);
  color: var(--text);
  visibility: hidden;
}
.bubble.placed { visibility: visible; animation: fade-in 0.35s ease-out 0.1s both; }
.bubble p { margin: 0 0 12px; line-height: 1.45; }
.bubble footer { display: flex; align-items: center; gap: 10px; }
.bubble footer button:last-child { margin-left: auto; }
.count { color: var(--muted); font-size: 0.8rem; }
@keyframes fade-in {
  from { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .hole, .bubble.placed { animation: none; }
}
</style>
