<script setup lang="ts">
import { computed } from 'vue';
import { ESCAPE_BAR_NAME } from '../engine';

/** The tug of war: the creature flees when the bar fills, and is captured if it's pushed down to 0. */
const props = defineProps<{ escape: number; escapeAt: number; escapeRate: number }>();
const percent = (value: number) => (props.escapeAt > 0 ? Math.min(100, (100 * value) / props.escapeAt) : 0);
const fill = computed(() => percent(props.escape));
const next = computed(() => percent(props.escape + props.escapeRate) - fill.value);
const text = computed(() => `${ESCAPE_BAR_NAME} ${props.escape}/${props.escapeAt} (+${props.escapeRate}/turn)`);
</script>

<template>
  <div class="panicbar" :title="`${text}: it flees when the bar fills, and is caught if it drops to 0`">
    <div class="fill" :style="{ transform: `scaleX(${fill / 100})` }" />
    <!-- Next turn's rise, from `fill` to `fill + next`: the outer window's right edge and the
         inner one's left edge slide there, so only transforms change. -->
    <div class="next-window" :style="{ transform: `translateX(${fill + next - 100}%)` }">
      <div class="next" :style="{ transform: `translateX(${100 - next}%)` }" />
    </div>
    <span class="label">{{ text }}</span>
  </div>
</template>

<style scoped>
.panicbar {
  position: relative;
  width: 170px;
  height: 14px;
  border-radius: 7px;
  background: #1b2b3a;
  overflow: hidden;
  border: 1px solid #0006;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, #4fa6c7, #e8a33d);
  transform-origin: left;
  transition: transform 0.3s ease;
}
.next-window { position: absolute; inset: 0; overflow: hidden; transition: transform 0.3s ease; }
.next {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(135deg, rgb(232 163 61 / 0.45) 0 4px, transparent 4px 8px);
  transition: transform 0.3s ease;
}
.label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.66rem;
  font-weight: 700;
  white-space: nowrap;
  text-shadow: 0 1px 2px #000;
}
</style>
