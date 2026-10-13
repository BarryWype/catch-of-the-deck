<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GameData } from '../engine';
import AnimatedSprite from './AnimatedSprite.vue';
import SpriteView from './SpriteView.vue';
import { animatedSheetFor, creatureClip, eggClip } from './sprites';

/**
 * Eggs waiting along the bottom of the window. Clicking one plays its hatching animation,
 * then emits `hatch` and shows the creature in the centre until the next click.
 */
const props = defineProps<{ eggs: string[]; data: GameData }>();
const emit = defineEmits<{ hatch: [index: number] }>();

const EGG_SIZE = 64;
/** Party streamers bursting out of the halo: angle (deg), length (px), colour. */
const STREAMERS = Array.from({ length: 20 }, (_, i) => ({
  angle: i * 18 + (i % 3) * 5,
  length: 40 + ((i * 37) % 50),
  colour: ['#f5d76e', '#ef7f7f', '#6fd0dc', '#b48cff', '#7fd18f'][i % 5],
}));

/** The egg playing its hatching animation. */
const hatching = ref<number | null>(null);
/** The creature that just came out, shown in the centre. */
const hatched = ref<string | null>(null);

const creature = computed(() => (hatched.value ? props.data.enemies[hatched.value] : undefined));
const creatureSheet = computed(() => creature.value?.sprite && animatedSheetFor(creature.value.sprite));

function open(index: number) {
  if (hatching.value === null && !hatched.value) hatching.value = index;
}

function onHatched(index: number) {
  hatched.value = props.eggs[index];
  hatching.value = null;
  emit('hatch', index);
}
</script>

<template>
  <div v-if="eggs.length" class="eggs">
    <button
      v-for="(id, i) in eggs"
      :key="`${i}-${id}`"
      class="egg"
      :aria-label="hatching === i ? 'Hatching…' : 'Hatch this egg'"
      v-tip="'Click to hatch'"
      @click="open(i)"
    >
      <AnimatedSprite
        :clip="eggClip('beige', hatching === i ? 'hatch' : 'idle')"
        :size="EGG_SIZE"
        @done="onHatched(i)"
      />
    </button>
  </div>

  <div v-if="creature" class="reveal" role="dialog" aria-label="An egg hatched" @click="hatched = null">
    <div class="burst">
      <div class="halo" />
      <span
        v-for="(s, i) in STREAMERS"
        :key="i"
        class="streamer"
        :style="{ '--angle': `${s.angle}deg`, '--length': `${s.length}px`, background: s.colour }"
      />
      <AnimatedSprite v-if="creatureSheet" class="creature" :clip="creatureClip(creatureSheet, 'idle')" :size="192" />
      <SpriteView v-else-if="creature.sprite" class="creature" :sprite="creature.sprite" :size="160" />
    </div>
    <h2>It's a {{ creature.name }}!</h2>
    <p>It joins your home aquarium. Click anywhere to continue.</p>
  </div>
</template>

<style scoped>
.eggs {
  position: fixed;
  bottom: 8px;
  left: 50%;
  /* Above the menu (z-index 10). */
  z-index: 15;
  display: flex;
  gap: 4px;
  transform: translateX(-50%);
}
.egg {
  padding: 0;
  border: none;
  background: none;
  filter: drop-shadow(0 3px 4px rgb(0 0 0 / 0.5));
  transition: transform 0.15s ease;
}
.egg:hover,
.egg:focus-visible { transform: translateY(-4px); background: none; }

.reveal {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgb(5 8 12 / 0.7);
  cursor: pointer;
  animation: fade-in 0.3s ease;
}
.reveal h2 { margin: 0; font-size: 2rem; color: var(--highlight); }
.reveal p { margin: 0; color: var(--muted); }

.burst { position: relative; display: grid; place-items: center; width: 320px; height: 320px; }
.burst > * { grid-area: 1 / 1; }
.creature { z-index: 1; animation: pop 0.5s cubic-bezier(0.2, 1.6, 0.4, 1); }

/* A soft glow behind slowly turning rays. */
.halo {
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgb(255 236 160 / 0.9) 0 22%, rgb(255 220 120 / 0.35) 40%, transparent 68%),
    repeating-conic-gradient(rgb(255 236 160 / 0.28) 0 10deg, transparent 10deg 30deg);
  mask: radial-gradient(circle, #000 40%, transparent 70%);
  animation: spin 12s linear infinite, pop 0.5s ease-out;
}

/* Streamers shoot out from the centre once, then fade. */
.streamer {
  z-index: 2;
  width: 5px;
  height: var(--length);
  border-radius: 3px;
  transform-origin: 50% 100%;
  translate: 0 -50%;
  opacity: 0;
  animation: streamer 1.4s ease-out forwards;
}

/* From the edge of the creature out past the halo, stretching as they go. */
@keyframes streamer {
  0% { opacity: 1; transform: rotate(var(--angle)) translateY(-80px) scaleY(0.2); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--angle)) translateY(-230px) scaleY(1); }
}
@keyframes spin { to { rotate: 360deg; } }
@keyframes pop { from { scale: 0.2; } }
@keyframes fade-in { from { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .halo, .creature, .streamer, .reveal { animation: none; }
}
</style>
