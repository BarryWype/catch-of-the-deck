<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { zoomedCard } from './cardZoom';
import CardView from './CardView.vue';

/**
 * The card held under a finger (cardZoom.ts), scaled up to fill the screen. A modal dialog, so it
 * sits above any other dialog; any tap or Escape closes it.
 */
const EDGE = 16;

const dialog = ref<HTMLDialogElement>();
const scale = ref(1);

/** The card keeps its own layout (its text fits its box) and is scaled as a whole. */
function fit() {
  const card = dialog.value?.querySelector<HTMLElement>('.card');
  if (!card) return;
  scale.value = Math.min((window.innerWidth - 2 * EDGE) / card.offsetWidth, (window.innerHeight - 2 * EDGE) / card.offsetHeight);
}

watch(zoomedCard, async (zoomed) => {
  window.removeEventListener('resize', fit);
  if (!zoomed) return;
  await nextTick();
  if (!dialog.value?.open) dialog.value?.showModal();
  fit();
  window.addEventListener('resize', fit);
});
onBeforeUnmount(() => window.removeEventListener('resize', fit));

const close = () => (zoomedCard.value = null);
</script>

<template>
  <dialog v-if="zoomedCard" ref="dialog" class="zoom" :aria-label="zoomedCard.card.name" @click="close" @close="close">
    <CardView
      :card="zoomedCard.card"
      :description="zoomedCard.description"
      :cost="zoomedCard.cost"
      :zoomable="false"
      :style="{ transform: `scale(${scale})`, transformOrigin: '50% 50%', transition: 'none' }"
    />
  </dialog>
</template>

<style scoped>
.zoom {
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
.zoom[open] { display: grid; place-items: center; }
.zoom::backdrop { background: rgb(4 7 12 / 0.8); backdrop-filter: blur(3px); }
</style>
